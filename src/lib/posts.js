import {
  saveFileInContainer,
  getContainedResourceUrlAll,
  deleteFile,
  createContainerAt,
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  removeThing,
  setStringNoLocale,
  getStringNoLocale,
  addUrl,
  getUrlAll,
} from '@inrupt/solid-client';
import {
  PATHS,
  SCHEMA,
  PODSTA,
  ALLOWED_IMAGE_TYPES,
  MAX_PHOTO_BYTES,
  MAX_ALBUM_PHOTOS,
  MAX_CAPTION_LENGTH,
  MAX_TEXT_LENGTH,
} from './vocab.js';
import { plainText } from './text.js';
import { audienceResourceUrls, isAlbumPost, photoUrls } from './album.js';
import { overallRatio, putPhotoFile, uploadRatio } from './uploadProgress.js';
import {
  applyAudience,
  isPublic,
  lockCommentsToOwner,
  makeGroupReadable,
  makePublic,
} from './acl.js';
import {
  addToContactsIndex,
  addToPublicIndex,
  removeFromContactsIndex,
  removeFromPublicIndex,
} from './publicIndex.js';
import { publicIndexEntryFromPost } from './indexEntry.js';
import { isNotFound, retryTransient, withTimeout } from './timeoutFetch.js';
import {
  audienceAllowed,
  effectiveAudience,
  groupDocUrl,
  groupFragment,
} from './discoverability.js';
import { ensureContactsGroup } from './contactsGroup.js';
import { altsAligned, cleanAlt } from './altText.js';

/**
 * A "post" in Podsta is one of two things:
 *   1. A photo + optional caption (binary file at /podsta/photos/<id>.<ext>
 *      with sidecar /<id>.<ext>.meta holding the caption RDF).
 *   2. A text post (RDF resource at /podsta/posts/<id>.ttl with a body and
 *      optional title — no binary).
 *
 * Both expose the same shape to the UI:
 *   { id, url, type, body, title, caption, dateCreated, isPublic, mediaUrl, mediaBlob, ownerWebId }
 *
 * `mediaBlob` is the actual File for photos (so we can show it via createObjectURL);
 * `mediaUrl` is the canonical URL on the pod.
 */

async function ensureContainer(containerUrl, session) {
  await retryTransient(async () => {
    try {
      await createContainerAt(containerUrl, { fetch: session.fetch });
    } catch {
      // Already exists or can't be created — try to confirm it's there.
      try {
        await getSolidDataset(containerUrl, { fetch: session.fetch });
      } catch (err) {
        throw new Error(`Container unavailable: ${containerUrl} (${err.message})`);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────
// PHOTO POSTS
// ─────────────────────────────────────────────────────────────

function limitedPlain(value, max, label) {
  const text = plainText(value || '');
  if (text.length > max) throw new Error(`${label} stops at ${max} characters`);
  return text;
}

function thumbUrlFor(photoUrl) {
  return String(photoUrl || '').replace(/(\.[a-z0-9]+)$/i, '.thumb.jpg');
}

async function putPhotoUnlessExists(args) {
  try {
    return await putPhotoFile(args);
  } catch (err) {
    if (err?.status === 412) return args.url;
    throw err;
  }
}

export function validatePhotoFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "We can't use that file. Podsta takes JPEG, PNG, GIF and WebP photos.";
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `That photo is too big. Each one can be up to ${MAX_PHOTO_BYTES / 1024 / 1024} MB. Try a smaller copy, or crop it first.`;
  }
  return null;
}

export async function uploadPhoto({ podUrl, session, file, caption }) {
  const container = `${podUrl}${PATHS.photos}`;
  await ensureContainer(container, session);

  // saveFileInContainer mints a slug-based URL from the original filename.
  // We prefix with timestamp for stable chronological sort and disambiguation.
  const slug = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const saved = await saveFileInContainer(container, file, {
    slug,
    contentType: file.type,
    fetch: session.fetch,
  });

  const photoUrl = saved?.internal_resourceInfo?.sourceIri;
  if (!photoUrl) throw new Error('The pod accepted upload but returned no URL');

  // Save caption metadata as a sibling .meta resource if provided.
  const captionText = plainText(caption || '');
  if (captionText) {
    let ds = createSolidDataset();
    let thing = createThing({ url: photoUrl });
    thing = setStringNoLocale(thing, SCHEMA.caption, captionText);
    thing = setStringNoLocale(thing, SCHEMA.dateCreated, new Date().toISOString());
    ds = setThing(ds, thing);
    await saveSolidDatasetAt(`${photoUrl}.meta`, ds, { fetch: session.fetch });
  }

  return photoUrl;
}

function safeSeed(seed) {
  return String(seed || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
}

function photoSlug(file, index, seed) {
  const safe = (file?.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const prefix = safeSeed(seed) || String(Date.now());
  return `${prefix}-${index}-${safe}`;
}

/**
 * One or more photos become a single post file plus the image files.
 * `alreadyUploaded` lets a retry continue after a failure instead of sending
 * the same bytes again. Progress stays under 100% until the post file is saved.
 */
function chosenDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function chosenSource(value) {
  return plainText(value || '').slice(0, 300);
}

export async function createPhotoAlbum({
  podUrl,
  session,
  files,
  caption,
  alts = [],
  onProgress,
  alreadyUploaded = [],
  thumbnails = [],
  idSeed,
  dateCreated,
  importedFrom,
}) {
  const list = Array.from(files || []).filter(Boolean);
  const captionText = limitedPlain(caption, MAX_CAPTION_LENGTH, 'Captions');
  if (!list.length) throw new Error('Choose a photo');
  if (list.length > MAX_ALBUM_PHOTOS)
    throw new Error("That's the limit. One post holds up to ten photos.");
  for (const file of list) {
    const problem = validatePhotoFile(file);
    if (problem) throw new Error(problem);
  }

  const container = `${podUrl}${PATHS.photos}`;
  await ensureContainer(container, session);
  const uploaded = [...alreadyUploaded];
  const storedThumbs = alreadyUploaded.map((url) => thumbUrlFor(url));

  for (let index = uploaded.length; index < list.length; index += 1) {
    const file = list[index];
    const photoUrl = `${container}${photoSlug(file, index, idSeed)}`;
    const thumbFile = thumbnails[index] || null;
    const thumbUrl = thumbFile ? thumbUrlFor(photoUrl) : '';
    try {
      await putPhotoUnlessExists({
        url: photoUrl,
        file,
        fetchFn: session.fetch,
        onBytes: (sent, total) => {
          onProgress?.({
            index,
            count: list.length,
            ratio: overallRatio(index, list.length, uploadRatio(sent, total)),
            phase: 'upload',
          });
        },
      });
      if (thumbFile && thumbUrl) {
        await putPhotoUnlessExists({
          url: thumbUrl,
          file: thumbFile,
          fetchFn: session.fetch,
        });
      }
      uploaded.push(photoUrl);
      storedThumbs.push(thumbUrl);
    } catch (err) {
      const error = new Error(err?.message || 'Upload failed');
      error.uploaded = uploaded;
      error.failedAt = index;
      throw error;
    }
  }

  onProgress?.({
    index: Math.max(0, list.length - 1),
    count: list.length,
    ratio: overallRatio(Math.max(0, list.length - 1), list.length, 0.9),
    phase: 'save',
  });

  const postsContainer = `${podUrl}${PATHS.posts}`;
  await ensureContainer(postsContainer, session);
  const id = safeSeed(idSeed) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const postUrl = `${postsContainer}${id}.ttl`;
  let ds = createSolidDataset();
  let thing = createThing({ url: postUrl });
  thing = setStringNoLocale(thing, PODSTA.PostType, 'photo');
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, chosenDate(dateCreated));
  const source = chosenSource(importedFrom);
  if (source) thing = setStringNoLocale(thing, PODSTA.importedFrom, source);
  if (captionText) thing = setStringNoLocale(thing, SCHEMA.caption, captionText);
  uploaded.forEach((image, index) => {
    thing = addUrl(thing, SCHEMA.image, image);
    if (storedThumbs[index]) thing = addUrl(thing, SCHEMA.thumbnail, storedThumbs[index]);
  });
  ds = setThing(ds, thing);
  const storedAlts = altsAligned(
    uploaded,
    uploaded.map((url, index) => ({ url, alt: cleanAlt(alts[index]) })),
  );
  for (const item of storedAlts) {
    let imageThing = createThing({ url: item.url });
    imageThing = setStringNoLocale(imageThing, SCHEMA.description, item.alt);
    ds = setThing(ds, imageThing);
  }
  try {
    await saveSolidDatasetAt(postUrl, ds, { fetch: session.fetch });
  } catch (err) {
    const error = new Error(err?.message || 'The photos uploaded, but the post was not saved');
    error.uploaded = uploaded;
    error.failedAt = list.length;
    throw error;
  }

  onProgress?.({ index: list.length - 1, count: list.length, ratio: 1, phase: 'done' });
  return { url: postUrl, images: uploaded, thumbnails: storedThumbs.filter(Boolean), alts: storedAlts };
}

async function loadPhotoCaption(photoUrl, fetchFn) {
  const timed = withTimeout(fetchFn || fetch);
  try {
    const ds = await getSolidDataset(`${photoUrl}.meta`, { fetch: timed });
    const thing = getThing(ds, photoUrl);
    if (!thing) return { caption: '', alt: '', dateCreated: '', audience: '' };
    return {
      caption: plainText(getStringNoLocale(thing, SCHEMA.caption) || ''),
      alt: getStringNoLocale(thing, SCHEMA.description) || '',
      dateCreated: getStringNoLocale(thing, SCHEMA.dateCreated) || '',
      audience: getStringNoLocale(thing, PODSTA.audience) || '',
    };
  } catch {
    return { caption: '', alt: '', dateCreated: '', audience: '' };
  }
}

async function storeAudience(resourceUrl, thingUrl, audience, session) {
  let ds;
  try {
    ds = await getSolidDataset(resourceUrl, { fetch: session.fetch });
  } catch (err) {
    if (!isNotFound(err)) throw err;
    ds = createSolidDataset();
  }
  let thing = getThing(ds, thingUrl) ?? createThing({ url: thingUrl });
  thing = setStringNoLocale(thing, PODSTA.audience, audience);
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(resourceUrl, ds, { fetch: session.fetch });
}

export async function loadOwnPhotos({ podUrl, session, exclude }) {
  const container = `${podUrl}${PATHS.photos}`;
  let urls = [];
  try {
    const ds = await getSolidDataset(container, { fetch: session.fetch });
    urls = getContainedResourceUrlAll(ds).filter(
      (u) => /\.(jpg|jpeg|png|gif|webp)$/i.test(u) && !exclude?.has(u),
    );
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }

  // Caption and ACL only. The image bytes load later, when a card is on screen.
  const photos = await Promise.all(
    urls.map(async (url) => {
      const [meta, pub] = await Promise.all([
        loadPhotoCaption(url, session.fetch),
        isPublic(url, session.fetch),
      ]);
      // Use file last-modified or filename timestamp for ordering.
      const tsMatch = url.match(/(\d{13})/);
      const dateCreated =
        meta.dateCreated ||
        (tsMatch ? new Date(parseInt(tsMatch[1], 10)).toISOString() : new Date(0).toISOString());
      const audience = effectiveAudience({ stored: meta.audience, isPublic: pub });
      return {
        id: url,
        url,
        type: 'photo',
        caption: meta.caption,
        body: '',
        title: '',
        alts: meta.alt ? [{ url, alt: meta.alt }] : [],
        dateCreated,
        isPublic: pub,
        audience,
        images: [url],
        mediaUrl: url,
        mediaBlob: null,
      };
    }),
  );

  return photos.sort((a, b) => b.dateCreated.localeCompare(a.dateCreated));
}

// ─────────────────────────────────────────────────────────────
// TEXT POSTS
// ─────────────────────────────────────────────────────────────

export async function createTextPost({
  podUrl,
  session,
  title,
  body,
  idSeed,
  dateCreated,
  importedFrom,
}) {
  const bodyText = limitedPlain(body, MAX_TEXT_LENGTH, 'Text posts');
  const titleText = plainText(title || '').slice(0, 500);
  if (!bodyText) throw new Error('Text posts must have a body');
  const container = `${podUrl}${PATHS.posts}`;
  await ensureContainer(container, session);

  const id = safeSeed(idSeed) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const postUrl = `${container}${id}.ttl`;

  let ds = createSolidDataset();
  let thing = createThing({ url: postUrl });
  thing = setStringNoLocale(thing, SCHEMA.body, bodyText);
  if (titleText) thing = setStringNoLocale(thing, SCHEMA.name, titleText);
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, chosenDate(dateCreated));
  const source = chosenSource(importedFrom);
  if (source) thing = setStringNoLocale(thing, PODSTA.importedFrom, source);
  thing = setStringNoLocale(thing, PODSTA.PostType, 'text');
  ds = setThing(ds, thing);

  await saveSolidDatasetAt(postUrl, ds, { fetch: session.fetch });
  return postUrl;
}

async function loadTextPost(postUrl, fetchFn) {
  const timed = withTimeout(fetchFn || fetch);
  try {
    const ds = await getSolidDataset(postUrl, { fetch: timed });
    const thing = getThing(ds, postUrl);
    if (!thing) return null;
    const kind = getStringNoLocale(thing, PODSTA.PostType) || 'text';
    const images = getUrlAll(thing, SCHEMA.image);
    const dateCreated = getStringNoLocale(thing, SCHEMA.dateCreated) || '';
    const audience = getStringNoLocale(thing, PODSTA.audience) || '';
    if (kind === 'photo') {
      const alts = images
        .map((image) => {
          const imageThing = getThing(ds, image);
          const alt = imageThing ? getStringNoLocale(imageThing, SCHEMA.description) || '' : '';
          return alt ? { url: image, alt } : null;
        })
        .filter(Boolean);
      return {
        id: postUrl,
        url: postUrl,
        type: 'photo',
        body: '',
        title: '',
        caption: plainText(getStringNoLocale(thing, SCHEMA.caption) || ''),
        dateCreated,
        audience,
        images,
        thumbnails: getUrlAll(thing, SCHEMA.thumbnail),
        alts,
        mediaUrl: images[0] || null,
        mediaBlob: null,
      };
    }
    return {
      id: postUrl,
      url: postUrl,
      type: 'text',
      body: plainText(getStringNoLocale(thing, SCHEMA.body) || ''),
      title: plainText(getStringNoLocale(thing, SCHEMA.name) || ''),
      caption: '',
      dateCreated,
      audience,
      images: [],
      mediaUrl: null,
      mediaBlob: null,
    };
  } catch {
    return null;
  }
}

export async function loadOwnTextPosts({ podUrl, session }) {
  const container = `${podUrl}${PATHS.posts}`;
  let urls = [];
  try {
    // A cached container listing hides a post that was just saved.
    const fresh = (input, init = {}) => session.fetch(input, { ...init, cache: 'no-store' });
    const ds = await getSolidDataset(container, { fetch: fresh });
    urls = getContainedResourceUrlAll(ds).filter((u) => u.endsWith('.ttl'));
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }

  const posts = await Promise.all(
    urls.map(async (url) => {
      const [post, pub] = await Promise.all([
        loadTextPost(url, session.fetch),
        isPublic(url, session.fetch),
      ]);
      if (!post) return null;
      const audience = effectiveAudience({ stored: post.audience, isPublic: pub });
      return { ...post, isPublic: pub, audience };
    }),
  );

  return posts
    .filter(Boolean)
    .sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
}

// ─────────────────────────────────────────────────────────────
// UNIFIED LOAD — fetches both photos and text posts and merges
// ─────────────────────────────────────────────────────────────

export async function loadOwnPosts({ podUrl, session }) {
  const texts = await loadOwnTextPosts({ podUrl, session });
  const exclude = new Set(texts.flatMap((post) => post.images || []));
  const photos = await loadOwnPhotos({ podUrl, session, exclude });
  return [...photos, ...texts].sort((a, b) =>
    (b.dateCreated || '').localeCompare(a.dateCreated || ''),
  );
}

// ─────────────────────────────────────────────────────────────
// SHARING
// Side-effect: also writes/removes the public-index entry so cross-pod
// feeds can discover this post.
// ─────────────────────────────────────────────────────────────

async function rememberAudience(post, audience, session) {
  if (post.type === 'photo' && !isAlbumPost(post)) {
    await storeAudience(`${post.url}.meta`, post.url, audience, session);
    return;
  }
  await storeAudience(post.url, post.url, audience, session);
}

export async function sharePost({ post, podUrl, ownerWebId, session, audience = 'public' }) {
  if (audience !== 'public' && audience !== 'contacts') {
    throw new Error('Share audience must be public or contacts');
  }
  const groupUrl = groupFragment(podUrl);
  if (audience === 'contacts') {
    await ensureContactsGroup({ podUrl, session });
    await makePublic(groupDocUrl(podUrl), ownerWebId, session);
  }

  // Record the audience before the ACL. If the ACL write fails, isPublic
  // still reflects the old rule, so the UI does not claim the new audience.
  await rememberAudience(post, audience, session);

  await applyAudience(audienceResourceUrls(post), audience, { ownerWebId, groupUrl, session });

  // Comments stay owner-only. This also replaces an older public Append grant.
  const commentsContainer = `${podUrl}${PATHS.comments}`;
  await ensureContainer(commentsContainer, session);
  await lockCommentsToOwner(commentsContainer, ownerWebId, session);

  const entry = publicIndexEntryFromPost(post);
  if (audience === 'public') {
    await addToPublicIndex(podUrl, entry, ownerWebId, session);
    await removeFromContactsIndex(podUrl, post.url, session);
  } else {
    await addToContactsIndex(podUrl, entry, ownerWebId, groupUrl, session);
    await removeFromPublicIndex(podUrl, post.url, session);
  }
}

export async function unsharePost({ post, podUrl, ownerWebId, session }) {
  await applyAudience(audienceResourceUrls(post), 'private', {
    ownerWebId,
    groupUrl: groupFragment(podUrl),
    session,
  });
  await removeFromPublicIndex(podUrl, post.url, session);
  await removeFromContactsIndex(podUrl, post.url, session);
  try {
    await rememberAudience(post, 'private', session);
  } catch (err) {
    // A photo with no sidecar has nothing to tag. The ACL is already owner-only.
    if (!isNotFound(err)) throw err;
  }
}

/**
 * Set one post's audience. Refuses a choice above the profile ceiling.
 * Private clears both indexes. Success is the write returning, not a local flip.
 */
export async function setPostAudience({ post, audience, level, podUrl, ownerWebId, session }) {
  if (level && !audienceAllowed(level, audience)) {
    const err = new Error(
      "That's more open than your profile allows. Change who can find you on your profile first, then try again.",
    );
    err.code = 'above-ceiling';
    throw err;
  }
  if (audience === 'private') {
    await unsharePost({ post, podUrl, ownerWebId, session });
    return;
  }
  await sharePost({ post, audience, podUrl, ownerWebId, session });
}

// ─────────────────────────────────────────────────────────────
// EDIT & DELETE
// ─────────────────────────────────────────────────────────────

export async function editPhotoCaption({ post, newCaption, alts, podUrl, ownerWebId, session }) {
  const caption = limitedPlain(newCaption, MAX_CAPTION_LENGTH, 'Captions');
  if (isAlbumPost(post)) {
    let ds;
    try {
      ds = await getSolidDataset(post.url, { fetch: session.fetch });
    } catch {
      ds = createSolidDataset();
    }
    let thing = getThing(ds, post.url) ?? createThing({ url: post.url });
    thing = setStringNoLocale(thing, PODSTA.PostType, 'photo');
    thing = setStringNoLocale(thing, SCHEMA.caption, caption);
    if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
      thing = setStringNoLocale(
        thing,
        SCHEMA.dateCreated,
        post.dateCreated || new Date().toISOString(),
      );
    }
    const existing = new Set(getUrlAll(thing, SCHEMA.image));
    for (const image of photoUrls(post)) {
      if (!existing.has(image)) thing = addUrl(thing, SCHEMA.image, image);
    }
    ds = setThing(ds, thing);
    const nextAlts = Array.isArray(alts) ? altsAligned(photoUrls(post), alts) : post.alts || [];
    if (Array.isArray(alts)) {
      for (const image of photoUrls(post)) {
        const alt = nextAlts.find((item) => item.url === image)?.alt || '';
        const imageThing = getThing(ds, image);
        if (!alt) {
          if (imageThing) ds = removeThing(ds, imageThing);
          continue;
        }
        let described = imageThing ?? createThing({ url: image });
        described = setStringNoLocale(described, SCHEMA.description, alt);
        ds = setThing(ds, described);
      }
    }
    await saveSolidDatasetAt(post.url, ds, { fetch: session.fetch });
    const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
    if (audience === 'private') return;
    try {
      const entry = publicIndexEntryFromPost({ ...post, caption, audience, alts: nextAlts }, { caption });
      if (audience === 'public') {
        await addToPublicIndex(podUrl, entry, ownerWebId, session);
      } else {
        await addToContactsIndex(podUrl, entry, ownerWebId, groupFragment(podUrl), session);
      }
    } catch (err) {
      throw new Error(
        `The caption was saved, but the shared index was not updated: ${err.message}`,
      );
    }
    return;
  }
  let ds;
  try {
    ds = await getSolidDataset(`${post.url}.meta`, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  let thing = getThing(ds, post.url) ?? createThing({ url: post.url });
  thing = setStringNoLocale(thing, SCHEMA.caption, caption);
  const legacyAlt = Array.isArray(alts) ? cleanAlt(alts.find((item) => item.url === post.url)?.alt || alts[0]?.alt || '') : '';
  if (Array.isArray(alts)) thing = setStringNoLocale(thing, SCHEMA.description, legacyAlt);
  if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
    thing = setStringNoLocale(
      thing,
      SCHEMA.dateCreated,
      post.dateCreated || new Date().toISOString(),
    );
  }
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(`${post.url}.meta`, ds, { fetch: session.fetch });

  const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
  if (audience === 'private') return;
  const nextAlts = Array.isArray(alts)
    ? altsAligned([post.url], [{ url: post.url, alt: legacyAlt }])
    : post.alts || [];
  try {
    const entry = publicIndexEntryFromPost({ ...post, caption, audience, alts: nextAlts }, { caption });
    if (audience === 'public') {
      if (caption) await makePublic(`${post.url}.meta`, ownerWebId, session);
      await addToPublicIndex(podUrl, entry, ownerWebId, session);
    } else {
      const groupUrl = groupFragment(podUrl);
      if (caption) await makeGroupReadable(`${post.url}.meta`, ownerWebId, groupUrl, session);
      await addToContactsIndex(podUrl, entry, ownerWebId, groupUrl, session);
    }
  } catch (err) {
    throw new Error(`The caption was saved, but the shared index was not updated: ${err.message}`);
  }
}

export async function editTextPost({ post, newTitle, newBody, podUrl, ownerWebId, session }) {
  let ds;
  try {
    ds = await getSolidDataset(post.url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  const body = limitedPlain(newBody, MAX_TEXT_LENGTH, 'Text posts');
  const title = plainText(newTitle || '').slice(0, 500);
  let thing = getThing(ds, post.url) ?? createThing({ url: post.url });
  thing = setStringNoLocale(thing, SCHEMA.body, body);
  thing = setStringNoLocale(thing, SCHEMA.name, title);
  if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
    thing = setStringNoLocale(
      thing,
      SCHEMA.dateCreated,
      post.dateCreated || new Date().toISOString(),
    );
  }
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(post.url, ds, { fetch: session.fetch });

  const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
  if (audience === 'private') return;
  try {
    const entry = publicIndexEntryFromPost({ ...post, title, body, audience }, { title, body });
    if (audience === 'public') {
      await addToPublicIndex(podUrl, entry, ownerWebId, session);
    } else {
      await addToContactsIndex(podUrl, entry, ownerWebId, groupFragment(podUrl), session);
    }
  } catch (err) {
    throw new Error(`The post was saved, but the shared index was not updated: ${err.message}`);
  }
}

export async function deletePost({ post, podUrl, session }) {
  // Always try. A stale flag should not leave the post in either feed.
  await removeFromPublicIndex(podUrl, post.url, session).catch(() => {});
  await removeFromContactsIndex(podUrl, post.url, session).catch(() => {});

  // Delete the main resource.
  try {
    await deleteFile(post.url, { fetch: session.fetch });
  } catch (err) {
    if (err?.statusCode !== 404) throw err;
  }

  // Cleanup siblings — best-effort, don't fail the whole operation if these 404.
  await deleteFile(`${post.url}.acl`, { fetch: session.fetch }).catch(() => {});
  if (isAlbumPost(post)) {
    for (const image of photoUrls(post)) {
      await deleteFile(image, { fetch: session.fetch }).catch(() => {});
      await deleteFile(`${image}.acl`, { fetch: session.fetch }).catch(() => {});
    }
  } else if (post.type === 'photo') {
    await deleteFile(`${post.url}.meta`, { fetch: session.fetch }).catch(() => {});
    await deleteFile(`${post.url}.meta.acl`, { fetch: session.fetch }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD A SINGLE PUBLIC POST FROM ANOTHER POD (for friend feeds)
// ─────────────────────────────────────────────────────────────

async function loadPublicPostOnce({ url, type, fetchFn }) {
  if (typeof url === 'string' && url.endsWith('.ttl')) {
    const post = await loadTextPost(url, fetchFn);
    if (!post) return null;
    return { ...post, isPublic: true };
  }
  if (type === 'photo') {
    const meta = await loadPhotoCaption(url, fetchFn);
    return {
      id: url,
      url,
      type: 'photo',
      caption: meta.caption,
      body: '',
      title: '',
      alts: meta.alt ? [{ url, alt: meta.alt }] : [],
      dateCreated: meta.dateCreated || '',
      images: [url],
      mediaUrl: url,
      mediaBlob: null,
      isPublic: true,
    };
  }
  return loadTextPost(url, fetchFn);
}

/**
 * A public post should still open when the signed-in fetch is refused.
 * The anonymous read is the same one a logged-out visitor can do.
 */
export async function loadPublicPost({ url, type, fetchFn }) {
  const loaded = await loadPublicPostOnce({ url, type, fetchFn });
  if (loaded || !fetchFn) return loaded;
  return loadPublicPostOnce({ url, type });
}
