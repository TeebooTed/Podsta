import { normalizeWebId } from './webId.js';

/** Remember a signup or a follow across the redirect to the Pod host. */

export const SIGNUP_KEY = 'podsta.signup';
export const FOLLOW_KEY = 'podsta.follow';

export function invitePath(webId) {
  return `/invite?webid=${encodeURIComponent(webId)}`;
}

export function inviteUrl(origin, webId) {
  const root = String(origin || '').replace(/\/$/, '');
  return `${root}${invitePath(webId)}`;
}

export function webIdFromInvite(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return normalizeWebId(params.get('webid') || '');
}

/**
 * Only send the browser back to this app. An off-site redirect would leave
 * the Solid login return somewhere else.
 */
export function sameOriginRedirect(target, origin) {
  const fallback = `${String(origin || '').replace(/\/$/, '')}/`;
  try {
    const base = new URL(fallback);
    const url = new URL(target || fallback, base);
    if (url.origin !== base.origin) return fallback;
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return fallback;
    return url.href;
  } catch {
    return fallback;
  }
}

export function rememberSignup(storage) {
  storage?.setItem(SIGNUP_KEY, '1');
}

export function consumeSignup(storage) {
  if (!storage) return false;
  const pending = storage.getItem(SIGNUP_KEY) === '1';
  if (pending) storage.removeItem(SIGNUP_KEY);
  return pending;
}

export function rememberFollow(storage, webId) {
  const normalized = normalizeWebId(webId);
  if (!storage || !normalized) return;
  storage.setItem(FOLLOW_KEY, normalized);
}

export function consumeFollow(storage) {
  if (!storage) return '';
  const value = storage.getItem(FOLLOW_KEY) || '';
  if (value) storage.removeItem(FOLLOW_KEY);
  return normalizeWebId(value) || '';
}

/**
 * What a stranger may see. A private Podsta profile and a missing public
 * index show nothing beyond the handle already present in the link.
 */
export function strangerNotice({ profileShared, posts }) {
  if (profileShared) return '';
  const postsVisible = Array.isArray(posts) && posts.length > 0;
  if (postsVisible) {
    return 'Their Podsta profile is not public. Public posts are listed below. A Hidden or Contacts profile does not open just because you have this link.';
  }
  return 'This link does not open their Podsta profile or posts. Hidden and Contacts profiles stay private. You can still follow them.';
}
