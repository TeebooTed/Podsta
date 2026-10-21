/**
 * Production Content-Security-Policy.
 * GitHub Pages cannot set response headers, so the production build injects
 * this as a meta tag. vercel.json repeats it, including frame-ancestors,
 * which a meta tag is not allowed to set.
 * style-src allows inline style attributes used for photo zoom.
 * script-src does not.
 *
 * The Pages build stays https-only. A local or CI preview may also talk to
 * a Community Solid Server on localhost, which is plain http.
 */
const LOCAL_HTTP = 'http://localhost:* http://127.0.0.1:*';

export function cspPolicy({ allowLocalHttp = false } = {}) {
  const local = allowLocalHttp ? ` ${LOCAL_HTTP}` : '';
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `img-src 'self' https: blob: data:${local}`,
    `connect-src 'self' https: wss:${local}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    `form-action 'self' https:${local}`,
    `frame-src 'self' https:${local}`,
  ].join('; ');
}

export const CSP_POLICY = cspPolicy();

/** Header form used by hosts that can set headers. Adds frame-ancestors. */
export const CSP_HEADER = `${CSP_POLICY}; frame-ancestors 'none'`;
