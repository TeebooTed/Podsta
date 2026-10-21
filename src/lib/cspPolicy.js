/**
 * Production Content-Security-Policy.
 * GitHub Pages cannot set response headers, so the production build injects
 * this as a meta tag. vercel.json repeats it, including frame-ancestors,
 * which a meta tag is not allowed to set.
 * style-src allows inline style attributes used for photo zoom.
 * script-src does not.
 */
export const CSP_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' https: blob: data:",
  "connect-src 'self' https: wss:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self' https:",
  "frame-src 'self' https:",
].join('; ');

/** Header form used by hosts that can set headers. Adds frame-ancestors. */
export const CSP_HEADER = `${CSP_POLICY}; frame-ancestors 'none'`;
