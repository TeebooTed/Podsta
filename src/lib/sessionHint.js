/** localStorage prefix used by @inrupt/solid-client-authn-browser. */
export const SESSION_PREFIX = 'solidClientAuthn:';

/**
 * True when this browser already has a Solid session, or the page is the
 * OIDC return. The signed-out landing uses this so it does not download
 * the Solid client until someone signs in.
 */
export function hasStoredSession(storage, search = '') {
  const query = String(search || '');
  const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
  if (params.get('code') && params.get('state')) return true;
  if (!storage || typeof storage.length !== 'number' || typeof storage.key !== 'function') return false;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index) || '';
    if (key.startsWith(SESSION_PREFIX)) return true;
  }
  return false;
}
