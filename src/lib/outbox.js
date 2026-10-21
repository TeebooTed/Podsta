/**
 * Local queue for a post, like, or comment that could not reach the pod.
 * The bytes stay on this device until a later send succeeds or the person discards them.
 * There is no Podsta server involved.
 */

import { addComment } from './comments.js';
import { setOwnLike } from './likes.js';
import { createPhotoAlbum, createTextPost, sharePost } from './posts.js';

const DB_NAME = 'podsta-outbox';
const STORE = 'items';

export const OFFLINE_COPY = "You're offline. Nothing's lost. Podsta will try again once you're back online.";
export const QUEUED_COPY = 'Saved on this device. It will send when your pod answers.';

export function isRetryableFailure(err, online = true) {
  if (online === false) return true;
  const status = Number(err?.statusCode || err?.status || err?.response?.status || 0);
  if ([400, 401, 403, 404, 409, 412].includes(status)) return false;
  if ([408, 429, 500, 502, 503, 504].includes(status)) return true;
  if (!status) {
    const message = `${err?.name || ''} ${err?.message || ''}`;
    if (/failed to fetch|network|timeout|aborted|offline|not respond|unreachable|econn/i.test(message)) return true;
    if (err?.name === 'TypeError' || err?.name === 'AbortError') return true;
  }
  return false;
}

export function outboxKindLabel(item) {
  if (item?.kind === 'comment') return 'Comment';
  if (item?.kind === 'like') return item.liked ? 'Like' : 'Unlike';
  return item?.postType === 'text' ? 'Note' : 'Photo';
}

export function outboxLabel(item) {
  if (item?.kind === 'comment') return item.text || 'Comment';
  if (item?.kind === 'like') return item.liked ? 'A like' : 'Removing a like';
  if (item?.postType === 'text') return item.body || 'A note';
  return item?.caption || 'A photo post';
}

export function createMemoryOutbox() {
  const map = new Map();
  return {
    async list(webId) {
      return [...map.values()]
        .filter((item) => item.webId === webId)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    },
    async put(item) {
      map.set(item.id, item);
    },
    async remove(id) {
      map.delete(id);
    },
  };
}

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, run) {
  const db = await openDb();
  if (!db) return null;
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = run(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export function createBrowserOutbox() {
  return {
    async list(webId) {
      const db = await openDb();
      if (!db) return [];
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return rows
        .filter((item) => item?.webId === webId)
        .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    },
    async put(item) {
      const db = await openDb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(item, item.id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    async remove(id) {
      await withStore('readwrite', (store) => {
        store.delete(id);
      });
    },
  };
}

let browserStore;
const inflight = new Set();
export function browserOutbox() {
  if (!browserStore) browserStore = createBrowserOutbox();
  return browserStore;
}

export function notifyOutboxChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('podsta-outbox-changed'));
}

export function notifyOutboxSent() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('podsta-outbox-sent'));
}

function asFile(blob, name, type) {
  if (!blob) return null;
  if (typeof File !== 'undefined' && blob instanceof File) return blob;
  return new File([blob], name || 'photo.jpg', { type: blob.type || type || 'image/jpeg' });
}

export function postDraftItem({ draft, webId }) {
  const id = String(draft?.draftId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  if (!id) throw new Error('Missing a draft id');
  const files = Array.from(draft.files || (draft.file ? [draft.file] : [])).filter(Boolean);
  return {
    id,
    webId,
    kind: 'post',
    postType: draft.type === 'text' ? 'text' : 'photo',
    createdAt: draft.createdAt || new Date().toISOString(),
    caption: draft.caption || '',
    title: draft.title || '',
    body: draft.body || '',
    audience: draft.audience || 'private',
    alts: Array.isArray(draft.alts) ? draft.alts.map((value) => String(value || '').slice(0, 200)) : [],
    files,
    thumbnails: Array.from(draft.thumbnails || []).filter(Boolean),
    alreadyUploaded: Array.isArray(draft.alreadyUploaded) ? draft.alreadyUploaded : [],
    error: '',
  };
}

export async function sendOutboxItem(item, { session, podUrl }) {
  if (item.kind === 'like') {
    return setOwnLike({
      podUrl,
      session,
      post: {
        url: item.postUrl,
        ownerWebId: item.ownerWebId,
        audience: item.audience,
        type: item.postType,
      },
      ownerPodUrl: item.ownerPodUrl,
      liked: Boolean(item.liked),
      knownEntries: item.knownEntries,
    });
  }
  if (item.kind === 'comment') {
    return addComment({
      podUrl,
      session,
      post: { url: item.postUrl, ownerWebId: item.ownerWebId },
      ownerPodUrl: item.ownerPodUrl,
      text: item.text,
      id: item.commentId || item.id,
    });
  }
  const ownerWebId = session?.info?.webId;
  let postUrl = '';
  let images = [];
  let thumbnails = [];
  let storedAlts = [];
  if (item.postType === 'text') {
    postUrl = await createTextPost({
      podUrl,
      session,
      title: item.title,
      body: item.body,
      idSeed: item.id,
    });
  } else {
    const created = await createPhotoAlbum({
      podUrl,
      session,
      files: (item.files || []).map((file, index) => asFile(file, file.name || `photo-${index}.jpg`, file.type)),
      thumbnails: (item.thumbnails || []).map((file, index) => asFile(file, `thumb-${index}.jpg`, 'image/jpeg')),
      caption: item.caption,
      alts: item.alts || [],
      alreadyUploaded: item.alreadyUploaded || [],
      idSeed: item.id,
      onProgress: item.onProgress,
    });
    postUrl = created.url;
    images = created.images;
    thumbnails = created.thumbnails || [];
    storedAlts = created.alts || [];
  }
  let shareFailed = false;
  let shareMessage = '';
  if (item.audience === 'public' || item.audience === 'contacts') {
    try {
      await sharePost({
        post: {
          url: postUrl,
          type: item.postType,
          images,
          thumbnails,
          caption: item.postType === 'photo' ? item.caption : '',
          alts: item.postType === 'photo' ? storedAlts : [],
          body: item.postType === 'text' ? item.body : '',
          title: item.postType === 'text' ? item.title : '',
          dateCreated: item.createdAt,
        },
        audience: item.audience,
        podUrl,
        ownerWebId,
        session,
      });
    } catch (err) {
      shareFailed = true;
      shareMessage = err?.message || '';
    }
  }
  return { url: postUrl, images, thumbnails, shareFailed, shareMessage, audience: item.audience, queued: false };
}

/**
 * Remember the draft before trying the network. A failed send stays in the store.
 */
export async function deliverPost({ draft, session, podUrl, webId, store, online, send }) {
  const box = store || browserOutbox();
  const item = postDraftItem({ draft, webId });
  const previous = (await box.list(webId)).find((entry) => entry.id === item.id);
  const saved = {
    ...item,
    createdAt: previous?.createdAt || item.createdAt,
    alreadyUploaded: item.alreadyUploaded.length ? item.alreadyUploaded : previous?.alreadyUploaded || [],
  };
  await box.put(saved);
  notifyOutboxChanged();
  const isOnline = online ? online() : typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isOnline) return { queued: true, offline: true };
  if (inflight.has(saved.id)) return { queued: true };
  inflight.add(saved.id);
  try {
    const result = await (send || ((next) => sendOutboxItem(next, { session, podUrl })))(saved);
    await box.remove(saved.id);
    notifyOutboxChanged();
    return result;
  } catch (err) {
    await box.put({
      ...saved,
      alreadyUploaded: Array.isArray(err?.uploaded) ? err.uploaded : saved.alreadyUploaded,
      error: err?.message || 'Could not send',
    });
    notifyOutboxChanged();
    if (isRetryableFailure(err, isOnline)) return { queued: true, offline: false };
    throw err;
  } finally {
    inflight.delete(saved.id);
  }
}

export async function queueSocialItem(item, { webId, store, online, send, session, podUrl, knownEntries }) {
  const box = store || browserOutbox();
  const saved = {
    ...item,
    webId,
    createdAt: item.createdAt || new Date().toISOString(),
    error: '',
  };
  await box.put(saved);
  notifyOutboxChanged();
  const isOnline = online ? online() : typeof navigator === 'undefined' || navigator.onLine !== false;
  if (!isOnline) return { queued: true, offline: true };
  if (inflight.has(saved.id)) return { queued: true };
  inflight.add(saved.id);
  try {
    const result = await (send || ((next) => sendOutboxItem({ ...next, knownEntries }, { session, podUrl })))(saved);
    await box.remove(saved.id);
    notifyOutboxChanged();
    return { ...result, queued: false };
  } catch (err) {
    await box.put({ ...saved, error: err?.message || 'Could not send' });
    notifyOutboxChanged();
    if (isRetryableFailure(err, isOnline)) return { queued: true, offline: false };
    throw err;
  } finally {
    inflight.delete(saved.id);
  }
}

export async function flushOutbox({ webId, store, send, online = true }) {
  const box = store || browserOutbox();
  const items = await box.list(webId);
  let sent = 0;
  for (const item of items) {
    if (online === false) break;
    if (inflight.has(item.id)) continue;
    inflight.add(item.id);
    try {
      await send(item);
      await box.remove(item.id);
      sent += 1;
    } catch (err) {
      await box.put({
        ...item,
        alreadyUploaded: Array.isArray(err?.uploaded) ? err.uploaded : item.alreadyUploaded,
        error: err?.message || 'Could not send',
      });
      if (isRetryableFailure(err, online)) break;
    } finally {
      inflight.delete(item.id);
    }
  }
  return { sent, items: await box.list(webId) };
}
