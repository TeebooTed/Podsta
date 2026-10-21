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
} from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { safeHttpUrl } from './urls.js';

/**
 * Profile decoration kept next to name and bio in /podsta/profile.ttl, so it is
 * exactly as visible as the profile itself.
 *   - coverImage: URL of the cover photo.
 *   - pinnedPosts: up to three post URLs, space separated so their order survives.
 */
export const EXTRAS = {
  cover: 'https://podsta.app/vocab#coverImage',
  pinned: 'https://podsta.app/vocab#pinnedPosts',
};

export const MAX_PINNED = 3;

export function normalizePinned(list) {
  const urls = (Array.isArray(list) ? list : String(list || '').split(/\s+/))
    .map((url) => safeHttpUrl(url))
    .filter(Boolean);
  return [...new Set(urls)].slice(0, MAX_PINNED);
}

export function readExtras(thing) {
  if (!thing) return { coverUrl: '', pinned: [] };
  return {
    coverUrl: safeHttpUrl(getStringNoLocale(thing, EXTRAS.cover) || '') || '',
    pinned: normalizePinned(getStringNoLocale(thing, EXTRAS.pinned) || ''),
  };
}

/** Leaves a field alone when it is undefined, so a name save keeps the cover and pins. */
export function writeExtras(thing, { coverUrl, pinned } = {}) {
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
  return next;
}

export function togglePinned(pinned, url) {
  const list = normalizePinned(pinned);
  if (list.includes(url)) return list.filter((item) => item !== url);
  if (list.length >= MAX_PINNED) return list;
  return [...list, url];
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

export async function saveProfileExtras({ podUrl, session, coverUrl, pinned }) {
  const url = `${podUrl}${PATHS.profile}`;
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  const thing = getThing(ds, url) ?? createThing({ url });
  await saveSolidDatasetAt(url, setThing(ds, writeExtras(thing, { coverUrl, pinned })), {
    fetch: session.fetch,
  });
}
