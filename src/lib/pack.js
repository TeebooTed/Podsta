import { PATHS as POD_PATHS, PODSTA } from './vocab.js';
import { normalizeWebId, samePerson } from './webId.js';
import { assertTurtleIri, safeHttpUrl } from './urls.js';
import { PATHS } from './navigation.js';

/** Remember which addresses to follow after the redirect back from the pod host. */
export const PACK_FOLLOW_KEY = 'podsta.pack';

export const MAX_PACK_PEOPLE = 50;

export function packResourceUrl(podUrl) {
  const root = String(podUrl || '');
  return `${root.endsWith('/') ? root : `${root}/`}${POD_PATHS.starterPack}`;
}

export function packPath(resourceUrl) {
  const safe = safeHttpUrl(resourceUrl);
  if (!safe) return '';
  return `${PATHS.pack}?url=${encodeURIComponent(safe)}`;
}

export function packAppUrl(origin, resourceUrl) {
  const root = String(origin || '').replace(/\/$/, '');
  const path = packPath(resourceUrl);
  return path ? `${root}${path}` : '';
}

export function urlFromPack(search) {
  const params = new URLSearchParams(String(search || '').replace(/^\?/, ''));
  return safeHttpUrl(params.get('url') || '') || '';
}

/**
 * A public list of addresses. Names and photos stay on each person's own pod,
 * so a Hidden profile is not copied into this file.
 */
export function serializePack(webIds) {
  const ids = uniqueWebIds(webIds);
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
    `<#pack> a <${PODSTA.Pack}> .`,
    '',
  ];
  for (const id of ids) {
    lines.push(`[] schema:url <${assertTurtleIri(id)}> .`, '');
  }
  return lines.join('\n');
}

export function parsePack(text) {
  if (!text || !text.includes(PODSTA.Pack)) return [];
  const ids = [];
  const pattern = /schema:url\s+<([^>\s]+)>/g;
  let match = pattern.exec(text);
  while (match) {
    const normalized = normalizeWebId(match[1]);
    if (normalized && !ids.includes(normalized)) ids.push(normalized);
    if (ids.length >= MAX_PACK_PEOPLE) break;
    match = pattern.exec(text);
  }
  return ids;
}

export function uniqueWebIds(webIds) {
  const ids = [];
  for (const value of webIds || []) {
    const normalized = normalizeWebId(value);
    if (!normalized || ids.includes(normalized)) continue;
    ids.push(normalized);
    if (ids.length >= MAX_PACK_PEOPLE) break;
  }
  return ids;
}

/** Skip yourself and people you already follow. Order stays as in the pack. */
export function peopleToFollow(webIds, { selfWebId = '', following = [] } = {}) {
  return uniqueWebIds(webIds).filter((id) => {
    if (samePerson(id, selfWebId)) return false;
    return !following.some((person) => samePerson(person.webId || person, id));
  });
}

export function packFollowResult(attempted, followed) {
  const wanted = Number(attempted) || 0;
  const done = Number(followed) || 0;
  if (wanted === 0) return "You're already following everyone in this pack.";
  if (done === 0) return 'Nobody from this pack could be followed.';
  const noun = done === 1 ? '1 person' : `${done} people`;
  if (done === wanted) {
    return `You're following ${noun} from this pack. Their public posts can show on Home. A private profile stays private.`;
  }
  return `Followed ${done} of ${wanted}. The rest could not be followed.`;
}

export function rememberPackFollow(storage, webIds) {
  const ids = uniqueWebIds(webIds);
  if (!storage || !ids.length) return;
  storage.setItem(PACK_FOLLOW_KEY, JSON.stringify(ids));
}

export function consumePackFollow(storage) {
  if (!storage) return [];
  const raw = storage.getItem(PACK_FOLLOW_KEY) || '';
  if (raw) storage.removeItem(PACK_FOLLOW_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return uniqueWebIds(parsed);
  } catch {
    return [];
  }
}

async function readPack(url, fetchFn) {
  try {
    return await (fetchFn || fetch)(url, {
      headers: { Accept: 'text/turtle' },
      cache: 'no-store',
    });
  } catch (err) {
    if (err?.name === 'TypeError' || err?.name === 'AbortError') {
      return { ok: false, status: 0, text: async () => '' };
    }
    throw err;
  }
}

export async function loadOwnPack({ podUrl, fetchFn }) {
  const response = await readPack(packResourceUrl(podUrl), fetchFn);
  if (response.status === 404) return [];
  if (response.status === 0 || response.status === 401 || response.status === 403 || !response.ok) {
    throw new Error('Could not read your starter pack');
  }
  return parsePack(await response.text());
}

export async function loadPack(resourceUrl, fetchFn) {
  const url = safeHttpUrl(resourceUrl);
  if (!url) throw new Error('That pack link is not a web address.');
  const response = await readPack(url, fetchFn);
  if (response.status === 0) throw new Error("That pack didn't load. The pod didn't answer.");
  if (!response.ok) throw new Error("That pack didn't load. The address may be wrong, or the pod said no.");
  const text = await response.text();
  if (!text.includes(PODSTA.Pack)) throw new Error('That file is not a starter pack.');
  return parsePack(text);
}

