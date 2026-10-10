import { normalizeWebId } from './webId.js';
import { RECOMMENDED_PROVIDER } from './provider.js';

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
