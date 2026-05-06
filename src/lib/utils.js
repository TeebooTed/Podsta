/**
 * Format an ISO date as a relative timestamp ("3 hours ago", "yesterday", etc.).
 * Falls back to absolute date for older dates.
 */
export function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diff = now - then;
  if (diff < 0) return 'just now';

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;

  // Older — show absolute.
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now - then > 365 * 24 * 60 * 60 * 1000 ? 'numeric' : undefined,
  });
}

/**
 * Format a byte count as KB/MB.
 */
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Truncate a WebID for display: "https://alice.solidpod.com/profile/card#me"
 * becomes "alice.solidpod.com".
 */
export function shortWebId(webId) {
  if (!webId) return '';
  try {
    const u = new URL(webId);
    return u.host;
  } catch {
    return webId;
  }
}

/**
 * Initials for an avatar fallback ("Alice Smith" → "AS", "alice" → "A").
 */
export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/**
 * Tiny stable hash for cache keys.
 */
export function hashString(s) {
  let h = 5381;
  for (const c of s) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return (h >>> 0).toString(36);
}

/**
 * Copy text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Debounce a function — returns a wrapper that delays execution until `wait`
 * ms have passed without another call.
 */
export function debounce(fn, wait) {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
