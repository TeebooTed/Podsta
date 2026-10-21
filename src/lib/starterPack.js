import { normalizeWebId, samePerson } from './webId.js';
import { assertTurtleIri, safeHttpUrl } from './urls.js';

/**
 * A starter pack is a public list of WebIDs in the author's own pod.
 * There is no central directory. The link and the QR code point at that file.
 */

export const PACK_KEY = 'podsta.pack';
export const MAX_PACK_MEMBERS = 50;
export const MAX_PACK_NAME = 80;

function iso(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return date.toISOString();
}

function turtleString(value) {
  return String(value || '')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .trim()
    .slice(0, MAX_PACK_NAME);
}

/** https WebIDs only, the author left out, duplicates dropped, capped. */
export function packMembers(webIds, authorWebId) {
  const out = [];
  for (const raw of webIds || []) {
    const id = normalizeWebId(raw);
    if (!id || !safeHttpUrl(id) || !id.startsWith('https://')) continue;
    if (authorWebId && samePerson(id, authorWebId)) continue;
    if (out.some((existing) => samePerson(existing, id))) continue;
    out.push(id);
    if (out.length >= MAX_PACK_MEMBERS) break;
  }
  return out;
}

export function serializePack({ name, authorWebId, created, members }) {
  const author = assertTurtleIri(normalizeWebId(authorWebId) || authorWebId);
  const people = packMembers(members, author);
  const title = turtleString(name) || 'Starter pack';
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
    '<> a podsta:StarterPack ;',
    `  schema:name "${title}" ;`,
    `  schema:author <${author}> ;`,
  ];
  for (const member of people) {
    lines.push(`  schema:itemListElement <${assertTurtleIri(member)}> ;`);
  }
  lines.push(`  schema:dateCreated "${iso(created)}" .`);
  return lines.join('\n');
}

export function parsePack(text) {
  if (!text || !/a\s+(?:podsta:StarterPack|<https:\/\/podsta\.app\/vocab#StarterPack>)/.test(text)) {
    return null;
  }
  const name = text.match(/name[^"\n]*"((?:\\.|[^"\\])*)"/i);
  const author = text.match(/author[^<\n]*<([^>\s]+)>/i);
  const created = text.match(/dateCreated[^"\n]*"([^"]*)"/i);
  const members = [];
  const re = /itemListElement[^<\n]*<([^>\s]+)>/gi;
  let match = re.exec(text);
  while (match) {
    members.push(match[1]);
    match = re.exec(text);
  }
  if (!author?.[1]) return null;
  return {
    name: (name?.[1] || 'Starter pack').replace(/\\"/g, '"').replace(/\\\\/g, '\\'),
    authorWebId: author[1],
    created: created?.[1] || '',
    members: packMembers(members, author[1]),
  };
}

export function packPagePath(fileUrl) {
  const safe = safeHttpUrl(fileUrl);
  if (!safe) return '';
  return `/pack?url=${encodeURIComponent(safe)}`;
}

export function rememberPack(storage, webIds) {
  const members = packMembers(webIds);
  if (!storage || !members.length) return;
  storage.setItem(PACK_KEY, JSON.stringify(members));
}

export async function followPackMembers({ members, me, add }) {
  const followed = [];
  const failed = [];
  for (const webId of packMembers(members, me)) {
    try {
      followed.push(await add(webId));
    } catch (err) {
      failed.push({ webId, message: err?.message || 'Could not follow' });
    }
  }
  return { followed, failed };
}

export function consumePack(storage) {
  if (!storage) return [];
  const raw = storage.getItem(PACK_KEY);
  if (raw) storage.removeItem(PACK_KEY);
  try {
    const parsed = JSON.parse(raw || '[]');
    return packMembers(Array.isArray(parsed) ? parsed : []);
  } catch {
    return [];
  }
}
