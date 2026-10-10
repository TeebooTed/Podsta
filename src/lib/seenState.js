/**
 * Which notifications this browser has already shown.
 *
 * Seen state stays in localStorage, keyed by WebID, rather than in the Pod.
 * A check should not need another Pod write, and it still works when the Pod
 * is slow. It does not follow the person to another browser.
 *
 * The first successful check is a baseline: everything already there is marked
 * seen, so old posts do not light the badge.
 */

export const SEEN_LIMIT = 400;

export function emptySeen() {
  return { initialized: false, ids: [] };
}

export function seenStorageKey(webId) {
  return `podsta.notifications.seen:${encodeURIComponent(webId || '')}`;
}

export function readSeen(storage, webId) {
  if (!storage) return emptySeen();
  try {
    const raw = storage.getItem(seenStorageKey(webId));
    if (!raw) return emptySeen();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ids)) return emptySeen();
    return {
      initialized: Boolean(parsed.initialized),
      ids: parsed.ids.filter((id) => typeof id === 'string'),
    };
  } catch {
    return emptySeen();
  }
}

export function writeSeen(storage, webId, seen) {
  if (!storage) return;
  storage.setItem(
    seenStorageKey(webId),
    JSON.stringify({
      initialized: Boolean(seen?.initialized),
      ids: Array.isArray(seen?.ids) ? seen.ids : [],
    }),
  );
}

export function baselineSeen(items) {
  return {
    initialized: true,
    ids: [...new Set((items || []).map((item) => item?.id).filter(Boolean))],
  };
}

/**
 * Keep ids that are still on screen, then the most recent extras, up to the cap.
 * Dropping an id that is still listed would make it look new again.
 */
export function trimSeen(ids, currentIds, max = SEEN_LIMIT) {
  const current = new Set(currentIds || []);
  const keep = [];
  const extra = [];
  for (const id of ids || []) {
    if (!id || typeof id !== 'string') continue;
    if (current.has(id)) keep.push(id);
    else extra.push(id);
  }
  const uniqueKeep = [...new Set(keep)].slice(0, max);
  const room = max - uniqueKeep.length;
  if (room <= 0) return uniqueKeep;
  const uniqueExtra = [...new Set(extra)];
  return [...uniqueKeep, ...uniqueExtra.slice(-room)];
}

export function acknowledge(seen, ids, currentIds, max = SEEN_LIMIT) {
  const merged = [...new Set([...(seen?.ids || []), ...(ids || []).filter(Boolean)])];
  return {
    initialized: true,
    ids: trimSeen(merged, currentIds || [], max),
  };
}

export function unseenItems(items, seen) {
  if (!seen?.initialized) return [];
  const known = new Set(seen.ids || []);
  return (items || []).filter((item) => item?.id && !known.has(item.id));
}
