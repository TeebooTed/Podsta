import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  getStringNoLocale,
  setStringNoLocale,
  removeAll,
  deleteFile,
} from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { safeHttpUrl } from './urls.js';

/**
 * Profile decoration kept next to name and bio in /podsta/profile.ttl, so it is
 * exactly as visible as the profile itself.
 *   - coverImage: URL of the cover photo.
 *   - pinnedPosts: up to three post URLs, space separated so their order survives.
 *   - showLikeCounts: "public" when the author wants counts visible. Absent means private.
 */
export const EXTRAS = {
  cover: 'https://podsta.app/vocab#coverImage',
  pinned: 'https://podsta.app/vocab#pinnedPosts',
  counts: 'https://podsta.app/vocab#showLikeCounts',
};

export const MAX_PINNED = 3;

export function normalizePinned(list) {
  const urls = (Array.isArray(list) ? list : String(list || '').split(/\s+/))
    .map((url) => safeHttpUrl(url))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, MAX_PINNED);
}

export function readExtras(thing) {
  if (!thing) return { coverUrl: '', pinned: [], showLikeCounts: false };
  return {
    coverUrl: safeHttpUrl(getStringNoLocale(thing, EXTRAS.cover) || '') || '',
    pinned: normalizePinned(getStringNoLocale(thing, EXTRAS.pinned) || ''),
    showLikeCounts: getStringNoLocale(thing, EXTRAS.counts) === 'public',
  };
}

/** Leaves a field alone when it is undefined, so a name save keeps the cover and pins. */
export function writeExtras(thing, { coverUrl, pinned, showLikeCounts } = {}) {
  let next = thing;
  if (coverUrl !== undefined) {
    const safe = coverUrl ? safeHttpUrl(coverUrl) : '';
    if (coverUrl && !safe) throw new Error('Cover URL must be an https URL');
    next = safe ? setStringNoLocale(next, EXTRAS.cover, safe) : removeAll(next, EXTRAS.cover);
  }
  if (pinned !== undefined) {
    const list = normalizePinned(pinned);
    next = list.length
      ? setStringNoLocale(next, EXTRAS.pinned, list.join(' '))
      : removeAll(next, EXTRAS.pinned);
  }
  if (showLikeCounts !== undefined) {
    next = showLikeCounts
      ? setStringNoLocale(next, EXTRAS.counts, 'public')
      : removeAll(next, EXTRAS.counts);
  }
  return next;
}

export function togglePinned(pinned, url) {
  const list = normalizePinned(pinned);
  if (list.includes(url)) return list.filter((item) => item !== url);
  if (list.length >= MAX_PINNED) return list;
  return [...list, url];
}

export function movePinned(pinned, from, to) {
  const list = normalizePinned(pinned);
  if (from < 0 || from >= list.length) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const [item] = list.splice(from, 1);
  list.splice(target, 0, item);
  return list;
}

/**
 * Pinned posts that can still be shown, in pin order. Only public posts count,
 * so the owner and every visitor see the same row.
 */
export function pinnedFrom(pinned, posts) {
  const byUrl = new Map(
    (posts || []).filter((post) => isPinnable(post)).map((post) => [post.url, post]),
  );
  return normalizePinned(pinned)
    .map((url) => byUrl.get(url))
    .filter(Boolean);
}

export function isPinnable(post) {
  if (!post?.url) return false;
  if (post.audience === 'public' || post.isPublic === true) return true;
  // Entries read from someone's public index carry neither field.
  return post.audience === undefined && post.isPublic === undefined;
}

export async function saveProfileExtras({ podUrl, session, coverUrl, pinned, showLikeCounts }) {
  const url = `${podUrl}${PATHS.profile}`;
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  const thing = getThing(ds, url) ?? createThing({ url });
  await saveSolidDatasetAt(url, setThing(ds, writeExtras(thing, { coverUrl, pinned, showLikeCounts })), {
    fetch: session.fetch,
  });
}

/** True for a cover Podsta uploaded into this pod, never for a link to somewhere else. */
export function isOwnCoverFile(podUrl, url) {
  if (!podUrl || !url) return false;
  try {
    const href = new URL(url).href;
    const folder = new URL('podsta/covers/', podUrl).href;
    return href.startsWith(folder) && href.length > folder.length && !href.endsWith('/');
  } catch {
    return false;
  }
}

/**
 * After a new cover is saved, or the cover is removed, the old file is deleted so
 * replaced photos don't pile up in the pod. Best effort: a failure leaves a stray file.
 */
export async function deleteOldCover({ podUrl, session, oldUrl, newUrl, deleteFn = deleteFile }) {
  if (!oldUrl || oldUrl === newUrl || !isOwnCoverFile(podUrl, oldUrl)) return false;
  try {
    await deleteFn(oldUrl, { fetch: session.fetch });
    return true;
  } catch {
    return false;
  }
}
