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
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.href;
  } catch {
    return null;
  }
}
