/**
 * Save selected Instagram posts into the signed-in pod.
 * Photos go through the same prepare step as a new upload, which redraws them
 * and drops camera location. A stopped run keeps the photos that already landed
 * and continues from there. A post key already on the pod is skipped.
 */

import { getContainedResourceUrlAll, getSolidDataset, getStringNoLocale, getThing } from '@inrupt/solid-client';
import { audienceAllowed } from './discoverability.js';
import { fileFromExportBytes, yieldToMain } from './instagramExport.js';
import { createBrowserLedger, ledgerKey } from './importLedger.js';
import { preparePhoto } from './photoAdjust.js';
import { createPhotoAlbum, createTextPost, sharePost } from './posts.js';
import { isNotFound } from './timeoutFetch.js';
import { PATHS, PODSTA } from './vocab.js';

export async function readImportedSources({ podUrl, session, pause = yieldToMain, onProgress }) {
  const keys = new Set();
  if (!podUrl || !session?.fetch) return keys;
  const container = `${podUrl}${PATHS.posts}`;
  let urls = [];
  try {
    const dataset = await getSolidDataset(container, { fetch: session.fetch });
    urls = getContainedResourceUrlAll(dataset).filter((url) => url.endsWith('.ttl'));
  } catch (err) {
    if (isNotFound(err)) return keys;
    throw err;
  }
  for (let index = 0; index < urls.length; index += 1) {
    if (index % 10 === 0) {
      onProgress?.({ phase: 'check', index, count: urls.length });
      await pause();
    }
    try {
      const dataset = await getSolidDataset(urls[index], { fetch: session.fetch });
      const thing = getThing(dataset, urls[index]);
      const source = thing ? getStringNoLocale(thing, PODSTA.importedFrom) : '';
      if (source) keys.add(source);
    } catch {
      // One unreadable post does not hide the rest of the import.
    }
  }
  return keys;
}

export async function markAlreadyImported(posts, knownKeys, ledger, webId) {
  const marked = [];
  for (const post of posts) {
    const saved = await ledger.get(ledgerKey(webId, post.key));
    marked.push({
      ...post,
      alreadyImported: knownKeys.has(post.key) || saved?.status === 'done',
    });
  }
  return marked;
}

/**
 * Import the posts whose keys are selected.
 * Throws after saving a partial photo list so the caller can offer Continue.
 */
export async function runInstagramImport({
  posts,
  keys,
  fs,
  audience,
  level,
  ledger,
  webId,
  prepareFile,
  uploadPost,
  onProgress,
  shouldStop,
  pause = yieldToMain,
}) {
  const chosen = audienceAllowed(level, audience) ? audience : 'private';
  const selected = (posts || []).filter((post) => keys?.has(post.key) && post.importable && !post.alreadyImported);
  const summary = { saved: 0, skipped: 0, failed: 0, shareFailed: 0, audience: chosen };
  for (let index = 0; index < selected.length; index += 1) {
    if (shouldStop?.()) break;
    const post = selected[index];
    onProgress?.({
      phase: 'import',
      index: index + 1,
      count: selected.length,
      caption: post.caption,
      ratio: selected.length ? index / selected.length : 1,
    });
    await pause();
    const recordKey = ledgerKey(webId, post.key);
    const prior = await ledger.get(recordKey);
    if (prior?.status === 'done') {
      summary.skipped += 1;
      continue;
    }
    try {
      const files = [];
      const thumbnails = [];
      for (const image of post.images) {
        const bytes = await fs.read(image.path);
        const prepared = await prepareFile(fileFromExportBytes(image.path, bytes));
        files.push(prepared.file);
        thumbnails.push(prepared.thumbnail || null);
        await pause();
      }
      const result = await uploadPost({
        post,
        files,
        thumbnails,
        audience: chosen,
        alreadyUploaded: prior?.status === 'partial' ? prior.uploaded || [] : [],
      });
      await ledger.put(recordKey, {
        status: 'done',
        uploaded: result.images || [],
        postUrl: result.url || '',
        shareFailed: Boolean(result.shareFailed),
      });
      summary.saved += 1;
      if (result.shareFailed) summary.shareFailed += 1;
    } catch (err) {
      if (Array.isArray(err?.uploaded)) {
        await ledger.put(recordKey, { status: 'partial', uploaded: err.uploaded });
      }
      summary.failed += 1;
      const error = new Error(err?.message || 'Could not save that post');
      error.summary = summary;
      error.post = post;
      error.uploaded = err?.uploaded;
      throw error;
    }
  }
  onProgress?.({ phase: 'done', index: selected.length, count: selected.length, ratio: 1 });
  return summary;
}

export async function uploadPreparedInstagramPost({
  post,
  files,
  thumbnails,
  audience,
  alreadyUploaded,
  session,
  podUrl,
  ownerWebId,
  onProgress,
}) {
  if (!files?.length) {
    const url = await createTextPost({
      podUrl,
      session,
      body: post.caption,
      dateCreated: post.createdAt,
      importedFrom: post.key,
    });
    return { url, images: [], thumbnails: [], shareFailed: false };
  }
  const created = await createPhotoAlbum({
    podUrl,
    session,
    files,
    thumbnails,
    caption: post.caption,
    onProgress,
    alreadyUploaded,
    dateCreated: post.createdAt,
    importedFrom: post.key,
  });
  if (audience !== 'public' && audience !== 'contacts') {
    return { ...created, shareFailed: false };
  }
  try {
    await sharePost({
      post: {
        url: created.url,
        type: 'photo',
        images: created.images,
        thumbnails: created.thumbnails,
        caption: post.caption,
        dateCreated: post.createdAt,
      },
      audience,
      podUrl,
      ownerWebId,
      session,
    });
    return { ...created, shareFailed: false };
  } catch (err) {
    return { ...created, shareFailed: true, shareMessage: err?.message || '' };
  }
}

export function browserImportTools() {
  return {
    ledger: createBrowserLedger(),
    prepareFile: (file) => preparePhoto(file),
  };
}
