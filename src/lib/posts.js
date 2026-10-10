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
  setStringNoLocale,
  getStringNoLocale,
  addUrl,
  getUrlAll,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, PODSTA, ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES, MAX_ALBUM_PHOTOS } from './vocab.js';
import { audienceResourceUrls, isAlbumPost, photoUrls } from './album.js';
import { overallRatio, putPhotoFile, uploadRatio } from './uploadProgress.js';
import { applyAudience, isPublic, lockCommentsToOwner, makeGroupReadable, makePublic } from './acl.js';
import {
  addToContactsIndex,
  addToPublicIndex,
  removeFromContactsIndex,
  removeFromPublicIndex,
} from './publicIndex.js';
import { publicIndexEntryFromPost } from './indexEntry.js';
import { isNotFound, withTimeout } from './timeoutFetch.js';
import { audienceAllowed, effectiveAudience, groupDocUrl, groupFragment } from './discoverability.js';
import { ensureContactsGroup } from './contactsGroup.js';

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
}

// ─────────────────────────────────────────────────────────────
// PHOTO POSTS
// ─────────────────────────────────────────────────────────────

export function validatePhotoFile(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Image type ${file.type} not supported. Use JPEG, PNG, GIF, or WebP.`;
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return `Image too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max ${MAX_PHOTO_BYTES / 1024 / 1024}MB.`;
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
  if (!photoUrl) throw new Error('Pod accepted upload but returned no URL');

  // Save caption metadata as a sibling .meta resource if provided.
  if (caption?.trim()) {
    let ds = createSolidDataset();
    let thing = createThing({ url: photoUrl });
    thing = setStringNoLocale(thing, SCHEMA.caption, caption.trim());
    thing = setStringNoLocale(thing, SCHEMA.dateCreated, new Date().toISOString());
    ds = setThing(ds, thing);
    await saveSolidDatasetAt(`${photoUrl}.meta`, ds, { fetch: session.fetch });
  }

  return photoUrl;
}

function photoSlug(file, index) {
  const safe = (file?.name || 'photo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  return `${Date.now()}-${index}-${safe}`;
}

/**
 * One or more photos become a single post file plus the image files.
 * `alreadyUploaded` lets a retry continue after a failure instead of sending
 * the same bytes again. Progress stays under 100% until the post file is saved.
 */
export async function createPhotoAlbum({
  podUrl,
  session,
  files,
  caption,
  onProgress,
  alreadyUploaded = [],
}) {
  const list = Array.from(files || []).filter(Boolean);
  if (!list.length) throw new Error('Choose a photo');
  if (list.length > MAX_ALBUM_PHOTOS) throw new Error(`Choose up to ${MAX_ALBUM_PHOTOS} photos`);
  for (const file of list) {
    const problem = validatePhotoFile(file);
    if (problem) throw new Error(problem);
  }

  const container = `${podUrl}${PATHS.photos}`;
  await ensureContainer(container, session);
  const uploaded = [...alreadyUploaded];

  for (let index = uploaded.length; index < list.length; index += 1) {
    const file = list[index];
    const photoUrl = `${container}${photoSlug(file, index)}`;
    try {
      await putPhotoFile({
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
      uploaded.push(photoUrl);
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
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const postUrl = `${postsContainer}${id}.ttl`;
  let ds = createSolidDataset();
  let thing = createThing({ url: postUrl });
  thing = setStringNoLocale(thing, PODSTA.PostType, 'photo');
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, new Date().toISOString());
  if (caption?.trim()) thing = setStringNoLocale(thing, SCHEMA.caption, caption.trim());
  for (const image of uploaded) thing = addUrl(thing, SCHEMA.image, image);
  ds = setThing(ds, thing);
  try {
    await saveSolidDatasetAt(postUrl, ds, { fetch: session.fetch });
  } catch (err) {
    const error = new Error(err?.message || 'The photos uploaded, but the post was not saved');
    error.uploaded = uploaded;
    error.failedAt = list.length;
    throw error;
  }

  onProgress?.({ index: list.length - 1, count: list.length, ratio: 1, phase: 'done' });
  return { url: postUrl, images: uploaded };
}

async function loadPhotoCaption(photoUrl, fetchFn) {
  const timed = withTimeout(fetchFn || fetch);
  try {
    const ds = await getSolidDataset(`${photoUrl}.meta`, { fetch: timed });
    const thing = getThing(ds, photoUrl);
    if (!thing) return { caption: '', dateCreated: '', audience: '' };
    return {
      caption: getStringNoLocale(thing, SCHEMA.caption) || '',
      dateCreated: getStringNoLocale(thing, SCHEMA.dateCreated) || '',
      audience: getStringNoLocale(thing, PODSTA.audience) || '',
    };
  } catch {
    return { caption: '', dateCreated: '', audience: '' };
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

export async function createTextPost({ podUrl, session, title, body }) {
  if (!body?.trim()) throw new Error('Text posts must have a body');
  const container = `${podUrl}${PATHS.posts}`;
  await ensureContainer(container, session);

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const postUrl = `${container}${id}.ttl`;

  let ds = createSolidDataset();
  let thing = createThing({ url: postUrl });
  thing = setStringNoLocale(thing, SCHEMA.body, body.trim());
  if (title?.trim()) thing = setStringNoLocale(thing, SCHEMA.name, title.trim());
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, new Date().toISOString());
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
      return {
        id: postUrl,
        url: postUrl,
        type: 'photo',
        body: '',
        title: '',
        caption: getStringNoLocale(thing, SCHEMA.caption) || '',
        dateCreated,
        audience,
        images,
        mediaUrl: images[0] || null,
        mediaBlob: null,
      };
    }
    return {
      id: postUrl,
      url: postUrl,
      type: 'text',
      body: getStringNoLocale(thing, SCHEMA.body) || '',
      title: getStringNoLocale(thing, SCHEMA.name) || '',
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
    const ds = await getSolidDataset(container, { fetch: session.fetch });
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
  await applyAudience(audienceResourceUrls(post), 'private', { ownerWebId, groupUrl: groupFragment(podUrl), session });
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
    throw new Error('That visibility is above your discoverability setting');
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

export async function editPhotoCaption({ post, newCaption, podUrl, ownerWebId, session }) {
  const caption = (newCaption || '').trim();
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
      thing = setStringNoLocale(thing, SCHEMA.dateCreated, post.dateCreated || new Date().toISOString());
    }
    const existing = new Set(getUrlAll(thing, SCHEMA.image));
    for (const image of photoUrls(post)) {
      if (!existing.has(image)) thing = addUrl(thing, SCHEMA.image, image);
    }
    ds = setThing(ds, thing);
    await saveSolidDatasetAt(post.url, ds, { fetch: session.fetch });
    const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
    if (audience === 'private') return;
    try {
      const entry = publicIndexEntryFromPost({ ...post, caption, audience }, { caption });
      if (audience === 'public') {
        await addToPublicIndex(podUrl, entry, ownerWebId, session);
      } else {
        await addToContactsIndex(podUrl, entry, ownerWebId, groupFragment(podUrl), session);
      }
    } catch (err) {
      throw new Error(`The caption was saved, but the shared index was not updated: ${err.message}`);
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
  if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
    thing = setStringNoLocale(thing, SCHEMA.dateCreated, post.dateCreated || new Date().toISOString());
  }
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(`${post.url}.meta`, ds, { fetch: session.fetch });

  const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
  if (audience === 'private') return;
  try {
    const entry = publicIndexEntryFromPost({ ...post, caption, audience }, { caption });
    if (audience === 'public') {
      if (caption) await makePublic(`${post.url}.meta`, ownerWebId, session);
      await addToPublicIndex(podUrl, entry, ownerWebId, session);
    } else {
      const groupUrl = groupFragment(podUrl);
      if (caption) await makeGroupReadable(`${post.url}.meta`, ownerWebId, groupUrl, session);
      await addToContactsIndex(podUrl, entry, ownerWebId, groupUrl, session);
    }
  } catch (err) {
    throw new Error(
      `The caption was saved, but the shared index was not updated: ${err.message}`,
    );
  }
}

export async function editTextPost({ post, newTitle, newBody, podUrl, ownerWebId, session }) {
  let ds;
  try {
    ds = await getSolidDataset(post.url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  let thing = getThing(ds, post.url) ?? createThing({ url: post.url });
  thing = setStringNoLocale(thing, SCHEMA.body, newBody.trim());
  thing = setStringNoLocale(thing, SCHEMA.name, newTitle?.trim() || '');
  if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
    thing = setStringNoLocale(thing, SCHEMA.dateCreated, post.dateCreated || new Date().toISOString());
  }
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(post.url, ds, { fetch: session.fetch });

  const audience = effectiveAudience({ stored: post.audience, isPublic: post.isPublic });
  if (audience === 'private') return;
  const title = newTitle?.trim() || '';
  const body = newBody.trim();
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

export async function loadPublicPost({ url, type, fetchFn }) {
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
      dateCreated: meta.dateCreated || '',
      images: [url],
      mediaUrl: url,
      mediaBlob: null,
      isPublic: true,
    };
  }
  return loadTextPost(url, fetchFn);
}
