import {
  saveFileInContainer,
  getContainedResourceUrlAll,
  getFile,
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
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, PODSTA, ALLOWED_IMAGE_TYPES, MAX_PHOTO_BYTES } from './vocab.js';
import { isPublic, shareResources, unshareResources, makeCommentable } from './acl.js';
import { addToPublicIndex, removeFromPublicIndex } from './publicIndex.js';

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

async function loadPhotoCaption(photoUrl, fetchFn) {
  try {
    const ds = fetchFn
      ? await getSolidDataset(`${photoUrl}.meta`, { fetch: fetchFn })
      : await getSolidDataset(`${photoUrl}.meta`);
    const thing = getThing(ds, photoUrl);
    if (!thing) return { caption: '', dateCreated: '' };
    return {
      caption: getStringNoLocale(thing, SCHEMA.caption) || '',
      dateCreated: getStringNoLocale(thing, SCHEMA.dateCreated) || '',
    };
  } catch {
    return { caption: '', dateCreated: '' };
  }
}

export async function loadOwnPhotos({ podUrl, session }) {
  const container = `${podUrl}${PATHS.photos}`;
  let urls = [];
  try {
    const ds = await getSolidDataset(container, { fetch: session.fetch });
    urls = getContainedResourceUrlAll(ds).filter((u) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(u),
    );
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    throw err;
  }

  // Fetch each photo's binary, caption metadata, and public status in parallel.
  const photos = await Promise.all(
    urls.map(async (url) => {
      const [file, meta, pub] = await Promise.all([
        getFile(url, { fetch: session.fetch }).catch(() => null),
        loadPhotoCaption(url, session.fetch),
        isPublic(url),
      ]);
      // Use file last-modified or filename timestamp for ordering.
      const tsMatch = url.match(/(\d{13})/);
      const dateCreated =
        meta.dateCreated ||
        (tsMatch ? new Date(parseInt(tsMatch[1], 10)).toISOString() : new Date(0).toISOString());
      return {
        id: url,
        url,
        type: 'photo',
        caption: meta.caption,
        body: '',
        title: '',
        dateCreated,
        isPublic: pub,
        mediaUrl: url,
        mediaBlob: file,
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
  try {
    const ds = fetchFn
      ? await getSolidDataset(postUrl, { fetch: fetchFn })
      : await getSolidDataset(postUrl);
    const thing = getThing(ds, postUrl);
    if (!thing) return null;
    return {
      id: postUrl,
      url: postUrl,
      type: 'text',
      body: getStringNoLocale(thing, SCHEMA.body) || '',
      title: getStringNoLocale(thing, SCHEMA.name) || '',
      caption: '',
      dateCreated: getStringNoLocale(thing, SCHEMA.dateCreated) || '',
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
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    throw err;
  }

  const posts = await Promise.all(
    urls.map(async (url) => {
      const [post, pub] = await Promise.all([
        loadTextPost(url, session.fetch),
        isPublic(url),
      ]);
      if (!post) return null;
      return { ...post, isPublic: pub };
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
  const [photos, texts] = await Promise.all([
    loadOwnPhotos({ podUrl, session }),
    loadOwnTextPosts({ podUrl, session }),
  ]);
  return [...photos, ...texts].sort((a, b) =>
    (b.dateCreated || '').localeCompare(a.dateCreated || ''),
  );
}

// ─────────────────────────────────────────────────────────────
// SHARING
// Side-effect: also writes/removes the public-index entry so cross-pod
// feeds can discover this post.
// ─────────────────────────────────────────────────────────────

export async function sharePost({ post, podUrl, ownerWebId, session }) {
  // Apply public ACL to the post resource and any siblings.
  const urlsToShare = [post.url];
  if (post.type === 'photo' && post.caption) {
    urlsToShare.push(`${post.url}.meta`);
  }
  await shareResources(urlsToShare, ownerWebId, session);

  // Set up the comments container as commentable (read+append for public).
  // Lazy-create it the first time someone shares.
  const commentsContainer = `${podUrl}${PATHS.comments}`;
  await ensureContainer(commentsContainer, session);
  try {
    await makeCommentable(commentsContainer, ownerWebId, session);
  } catch (err) {
    // Non-fatal; comments will still work for the owner, just not for others.
    console.warn('Could not make comments container commentable:', err);
  }

  // Update public index so feeds find it.
  await addToPublicIndex(
    podUrl,
    {
      url: post.url,
      type: post.type,
      dateCreated: post.dateCreated,
      title: post.title || '',
      caption: post.caption || (post.type === 'text' ? post.body.slice(0, 200) : ''),
    },
    ownerWebId,
    session,
  );
}

export async function unsharePost({ post, podUrl, ownerWebId, session }) {
  const urls = [post.url];
  if (post.type === 'photo') urls.push(`${post.url}.meta`);
  await unshareResources(urls, ownerWebId, session);
  await removeFromPublicIndex(podUrl, post.url, session);
}

// ─────────────────────────────────────────────────────────────
// EDIT & DELETE
// ─────────────────────────────────────────────────────────────

export async function editPhotoCaption({ post, newCaption, session }) {
  let ds;
  try {
    ds = await getSolidDataset(`${post.url}.meta`, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  let thing = getThing(ds, post.url) ?? createThing({ url: post.url });
  thing = setStringNoLocale(thing, SCHEMA.caption, newCaption.trim());
  if (!getStringNoLocale(thing, SCHEMA.dateCreated)) {
    thing = setStringNoLocale(thing, SCHEMA.dateCreated, post.dateCreated || new Date().toISOString());
  }
  ds = setThing(ds, thing);
  await saveSolidDatasetAt(`${post.url}.meta`, ds, { fetch: session.fetch });
}

export async function editTextPost({ post, newTitle, newBody, session }) {
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
}

export async function deletePost({ post, podUrl, session }) {
  // If the post was public, remove from index FIRST (so feeds stop showing it).
  if (post.isPublic) {
    await removeFromPublicIndex(podUrl, post.url, session).catch(() => {});
  }

  // Delete the main resource.
  try {
    await deleteFile(post.url, { fetch: session.fetch });
  } catch (err) {
    if (err?.statusCode !== 404) throw err;
  }

  // Cleanup siblings — best-effort, don't fail the whole operation if these 404.
  if (post.type === 'photo') {
    await deleteFile(`${post.url}.meta`, { fetch: session.fetch }).catch(() => {});
    await deleteFile(`${post.url}.acl`, { fetch: session.fetch }).catch(() => {});
    await deleteFile(`${post.url}.meta.acl`, { fetch: session.fetch }).catch(() => {});
  } else {
    await deleteFile(`${post.url}.acl`, { fetch: session.fetch }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────
// LOAD A SINGLE PUBLIC POST FROM ANOTHER POD (for friend feeds)
// ─────────────────────────────────────────────────────────────

export async function loadPublicPost({ url, type, fetchFn }) {
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
      mediaUrl: url,
      mediaBlob: null, // friend-feed photos load via the URL directly, not blob
      isPublic: true,
    };
  } else {
    return await loadTextPost(url, fetchFn);
  }
}
