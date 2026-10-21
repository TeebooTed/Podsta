import { normalizeWebId } from './webId.js';
import { RECOMMENDED_PROVIDER } from './provider.js';
import { safeIssuer } from './urls.js';

/**
 * A display handle is derived from the WebID. It is not a registered name.
 * @ada means @ada on the recommended provider. @ada@other.host is explicit.
 * Two people can share a short name on different servers. The invite link
 * still carries the full WebID, which is the real identifier.
 */

const USER = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?';
const HOST = '[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+';

export function displayHandle(webId) {
  const empty = { handle: '', qualified: '', user: '', host: '' };
  if (!webId || typeof webId !== 'string') return empty;
  let url;
  try {
    url = new URL(webId);
  } catch {
    return { ...empty, handle: webId, qualified: webId };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return empty;

  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  let user = '';
  let provider = host;

  if (labels.length >= 3 && labels[0] !== 'www') {
    user = labels[0];
    provider = labels.slice(1).join('.');
  } else {
    const pathUser = url.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]*)\/profile\/card\/?$/);
    if (pathUser) user = pathUser[1].toLowerCase();
  }

  if (!user) {
    return { handle: host, qualified: host, user: '', host };
  }
  return {
    handle: `@${user}`,
    qualified: `@${user}@${provider}`,
    user,
    host: provider,
  };
}

/**
 * Turn what someone typed into a WebID.
 * A full https WebID is kept. @name uses the recommended provider.
 * @name@host builds https://name.host/profile/card#me.
 * Returns null when the text is not a handle or a WebID.
 */
export function parsePersonInput(input, defaultHost = RECOMMENDED_PROVIDER.host) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return normalizeWebId(trimmed);

  const match = trimmed.match(new RegExp(`^@?(${USER})(?:@(${HOST}))?$`, 'i'));
  if (!match) return null;
  const user = match[1].toLowerCase();
  const host = (match[2] || defaultHost || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return null;
  return normalizeWebId(`https://${user}.${host}/profile/card#me`);
}

/**
 * Sign-in opens an account host. It does not look the name up, and there is no registry.
 * Blank uses the recommended host. @ada uses that host too.
 * @ada@solidweb.org opens https://solidweb.org.
 * A full address opens that origin, or the parent host when the address is a person's.
 */
export function issuerForSignIn(input, fallback = RECOMMENDED_PROVIDER.issuer) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return safeIssuer(fallback) || '';
  return safeIssuer(guessSignInIssuer(trimmed)) || '';
}

function guessSignInIssuer(trimmed) {
  if (/^https?:\/\//i.test(trimmed)) {
    let url;
    try {
      url = new URL(trimmed);
    } catch {
      return '';
    }
    const labels = url.hostname.toLowerCase().split('.');
    const person =
      /\/profile\/card/i.test(url.pathname) && labels.length >= 3 && labels[0] !== 'www';
    if (person) return `${url.protocol}//${labels.slice(1).join('.')}`;
    return url.origin;
  }
  const webId = parsePersonInput(trimmed);
  if (!webId) return '';
  const url = new URL(webId);
  const labels = url.hostname.toLowerCase().split('.');
  if (labels.length >= 3 && labels[0] !== 'www') {
    return `${url.protocol}//${labels.slice(1).join('.')}`;
  }
  return url.origin;
}
