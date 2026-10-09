const TURTLE_IRI_UNSAFE = /[<>"\s{}|\\^`]/;

/**
 * Accept https URLs, and http only for localhost so a local WAC server can be used in development.
 * Returns null for anything else, including javascript: and data: URLs.
 */
export function safeHttpUrl(value) {
  if (!value || typeof value !== 'string') return null;
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.href;
  const localHttp =
    parsed.protocol === 'http:' &&
    (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (localHttp) return parsed.href;
  return null;
}

/** Pod roots are joined with relative paths, so they need a trailing slash. */
export function asPodRoot(value) {
  const href = safeHttpUrl(value);
  if (!href) return null;
  return href.endsWith('/') ? href : `${href}/`;
}

/**
 * IRIs interpolated into `<...>` in Turtle must not be able to close the bracket.
 * Throws instead of writing a broken or attacker-controlled ACL.
 */
export function assertTurtleIri(value) {
  const href = safeHttpUrl(value);
  if (!href) {
    throw new Error('Only https URLs can be used here');
  }
  if (TURTLE_IRI_UNSAFE.test(href)) {
    throw new Error('This URL cannot be written into an access-control file');
  }
  return href;
}
