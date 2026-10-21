import { unseenItems } from './seenState.js';

/**
 * On-device notices from the poll Podsta already runs.
 * There is no push server. A hidden tab still does not poll.
 * Comments, likes, and contact requests are the kinds this announces.
 * A new post in the feed stays in the list and on the bell only.
 */

export const SOCIAL_EVENT = 'podsta:social';
export const NOTICE_OPEN_EVENT = 'podsta:notice-open';
export const ANNOUNCED_LIMIT = 200;

const DEVICE_KINDS = new Set(['comment', 'like', 'contact-request']);

function storageKey(name, webId) {
  return `podsta.notices.${name}:${encodeURIComponent(webId || '')}`;
}

export function hasSocial(storage, webId) {
  if (!storage || !webId) return false;
  try {
    return storage.getItem(storageKey('social', webId)) === '1';
  } catch {
    return false;
  }
}

/** Remember that this person posted, followed, liked, or commented on this device. */
export function markSocial(webId, storage = globalThis.localStorage) {
  if (!webId || !storage) return;
  try {
    storage.setItem(storageKey('social', webId), '1');
  } catch {
    // Private mode can reject the write. The prompt waits until it can be stored.
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SOCIAL_EVENT));
}

export function hasDismissedPrompt(storage, webId) {
  if (!storage || !webId) return false;
  try {
    return storage.getItem(storageKey('dismissed', webId)) === '1';
  } catch {
    return false;
  }
}

export function dismissPrompt(webId, storage = globalThis.localStorage) {
  if (!webId || !storage) return;
  try {
    storage.setItem(storageKey('dismissed', webId), '1');
  } catch {
    // A failed write just shows the prompt again next time.
  }
}

/**
 * Ask only after a social action, and only while the browser has not decided.
 * Granted and denied both skip the in-app prompt.
 */
export function devicePromptChoice({ social = false, permission = 'default', dismissed = false } = {}) {
  if (!social || dismissed) return 'hidden';
  if (permission !== 'default') return 'hidden';
  return 'ask';
}

export function deviceCandidates(items, seen) {
  return unseenItems(items, seen).filter((item) => item?.id && DEVICE_KINDS.has(item.kind));
}

export function readAnnounced(storage, webId) {
  if (!storage || !webId) return { seeded: false, ids: [] };
  try {
    const parsed = JSON.parse(storage.getItem(storageKey('announced', webId)) || '');
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ids)) {
      return { seeded: false, ids: [] };
    }
    return {
      seeded: Boolean(parsed.seeded),
      ids: parsed.ids.filter((id) => typeof id === 'string').slice(-ANNOUNCED_LIMIT),
    };
  } catch {
    return { seeded: false, ids: [] };
  }
}

export function writeAnnounced(storage, webId, announced) {
  if (!storage || !webId) return;
  const ids = Array.isArray(announced?.ids) ? announced.ids.filter((id) => typeof id === 'string') : [];
  storage.setItem(
    storageKey('announced', webId),
    JSON.stringify({ seeded: Boolean(announced?.seeded), ids: ids.slice(-ANNOUNCED_LIMIT) }),
  );
}

/**
 * The first time notices are allowed, mark what is already unseen and stay quiet.
 * Later checks announce only comments, likes, and contact requests that are new.
 */
export function takeFreshNotices(stored, candidates) {
  const known = new Set(stored?.ids || []);
  const incoming = (candidates || []).filter((item) => item?.id);
  if (!stored?.seeded) {
    for (const item of incoming) known.add(item.id);
    return { show: [], next: { seeded: true, ids: [...known].slice(-ANNOUNCED_LIMIT) } };
  }
  const show = incoming.filter((item) => !known.has(item.id)).slice(0, 3);
  for (const item of show) known.add(item.id);
  return { show, next: { seeded: true, ids: [...known].slice(-ANNOUNCED_LIMIT) } };
}

export async function applyAppBadge(count, nav = globalThis.navigator) {
  const n = Math.max(0, Number(count) || 0);
  try {
    if (n > 0 && typeof nav?.setAppBadge === 'function') await nav.setAppBadge(n);
    else if (typeof nav?.clearAppBadge === 'function') await nav.clearAppBadge();
  } catch {
    // The badge is optional. Some browsers only allow it for an installed app.
  }
}

export async function showDeviceNotices(items, { registration, NotificationApi, urlFor, onClick } = {}) {
  const shown = [];
  for (const item of (items || []).filter((entry) => entry?.id).slice(0, 3)) {
    const title = item.title || 'Podsta';
    const body = item.detail || '';
    const tag = `podsta:${item.id}`;
    const data = { href: item.href || '', url: urlFor?.(item.href) || '' };
    try {
      if (registration?.showNotification) {
        await registration.showNotification(title, { body, tag, data });
      } else if (typeof NotificationApi === 'function') {
        const note = new NotificationApi(title, { body, tag, data });
        if (note && onClick) note.onclick = () => onClick(item);
      } else {
        break;
      }
      shown.push(item.id);
    } catch {
      break;
    }
  }
  return shown;
}
