/**
 * Normalize a WebID. Accepts a bare host and adds #me on the common profile-card path.
 */
export function normalizeWebId(input) {
  if (!input || typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;
  if (!s.startsWith('http://') && !s.startsWith('https://')) {
    s = `https://${s}`;
  }
  if (!s.includes('#') && s.includes('/profile/card')) {
    s = `${s}#me`;
  }
  try {
    const url = new URL(s);
    if (url.username || url.password) return null;
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/** True when two WebIDs name the same person after normalization. */
export function samePerson(a, b) {
  const left = normalizeWebId(a);
  const right = normalizeWebId(b);
  return Boolean(left && right && left === right);
}
