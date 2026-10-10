import { PATHS } from './vocab.js';
import { assertTurtleIri } from './urls.js';
import { samePerson, normalizeWebId } from './webId.js';
import { applyAudience } from './acl.js';
import { groupFragment } from './discoverability.js';

/**
 * Blocks and reports stay in the author's Pod, and they stay private.
 * A block hides that person's comments and likes when the author publishes.
 * A report is a private note. Podsta has no server to send it to.
 */

function turtleString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function unescapeTurtle(value) {
  return String(value)
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

function readLiterals(text, predicate) {
  const found = [];
  const re = new RegExp(`(?:${predicate})\\s+"((?:\\\\.|[^"\\\\])*)"`, 'gi');
  let match = re.exec(text || '');
  while (match) {
    found.push(unescapeTurtle(match[1]));
    match = re.exec(text);
  }
  return found;
}

function readIris(text, predicate) {
  const found = [];
  const re = new RegExp(`${predicate}[^<\\n]*<([^>\\s]+)>`, 'gi');
  let match = re.exec(text || '');
  while (match) {
    found.push(match[1]);
    match = re.exec(text);
  }
  return found;
}

export function blocksUrl(podUrl) {
  return `${podUrl}${PATHS.blocks}`;
}

export function reportsUrl(podUrl) {
  return `${podUrl}${PATHS.reports}`;
}

export function isBlocked(webId, blocked) {
  return (blocked || []).some((id) => samePerson(id, webId));
}

export function filterBlocked(webIds, blocked) {
  if (!blocked) return webIds || [];
  return (webIds || []).filter((id) => !isBlocked(id, blocked));
}

export function serializeBlocks(webIds) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const webId of webIds || []) {
    const author = assertTurtleIri(normalizeWebId(webId) || webId);
    lines.push(
      '[] a podsta:Block ;',
      `  schema:author <${author}> ;`,
      `  schema:dateCreated "${new Date().toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseBlocks(text) {
  if (!text || !/Block/.test(text)) return [];
  return readIris(text, 'author').filter((id, index, all) => all.findIndex((item) => samePerson(item, id)) === index);
}

export function serializeReports(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const author = assertTurtleIri(normalizeWebId(entry.authorWebId) || entry.authorWebId);
    const about = assertTurtleIri(entry.postUrl);
    const when = entry.created ? new Date(entry.created) : new Date();
    if (Number.isNaN(when.getTime())) throw new Error('Invalid date');
    lines.push(
      '[] a podsta:Report ;',
      `  schema:identifier "${turtleString(entry.commentId || '')}" ;`,
      `  schema:author <${author}> ;`,
      `  schema:about <${about}> ;`,
      `  schema:text "${turtleString(entry.text || '')}" ;`,
      `  schema:dateCreated "${when.toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseReports(text) {
  if (!text || !/Report/.test(text)) return [];
  const chunks = `\n${text}`.split(/\n\[\]\s+a\s+(?:podsta:Report|<https:\/\/podsta\.app\/vocab#Report>)/).slice(1);
  return chunks
    .map((chunk) => ({
      commentId: readLiterals(chunk, 'identifier')[0] || '',
      authorWebId: readIris(chunk, 'author')[0] || '',
      postUrl: readIris(chunk, 'about')[0] || '',
      text: readLiterals(chunk, 'text')[0] || '',
      created: readLiterals(chunk, 'dateCreated')[0] || '',
    }))
    .filter((entry) => entry.authorWebId && entry.postUrl);
}

async function readText(url, fetchFn) {
  try {
    return await (fetchFn || fetch)(url, { headers: { Accept: 'text/turtle' }, cache: 'no-store' });
  } catch (err) {
    if (err?.name === 'TypeError' || err?.name === 'AbortError') {
      return { ok: false, status: 0, text: async () => '' };
    }
    throw err;
  }
}

async function writePrivate(url, turtle, session, podUrl) {
  const response = await session.fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'text/turtle' },
    body: turtle,
  });
  if (!response.ok) throw new Error(`Could not save that (${response.status || 'network'})`);
  try {
    await applyAudience([url], 'private', {
      ownerWebId: session.info.webId,
      groupUrl: groupFragment(podUrl),
      session,
    });
  } catch (err) {
    if (!String(err?.message || '').includes('.acl')) throw err;
  }
}

export async function loadBlocks(podUrl, fetchFn) {
  const response = await readText(blocksUrl(podUrl), fetchFn);
  if (response.status === 404) return [];
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read your blocks');
  }
  if (!response.ok) throw new Error(`Blocks responded ${response.status}`);
  return parseBlocks(await response.text());
}

export async function saveBlocks({ podUrl, session, webIds }) {
  await writePrivate(blocksUrl(podUrl), serializeBlocks(webIds), session, podUrl);
  return webIds;
}

export async function loadReports(podUrl, fetchFn) {
  const response = await readText(reportsUrl(podUrl), fetchFn);
  if (response.status === 404) return [];
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read your reports');
  }
  if (!response.ok) throw new Error(`Reports responded ${response.status}`);
  return parseReports(await response.text());
}

export async function addReport({ podUrl, session, comment }) {
  if (!session?.info?.webId) throw new Error('Sign in to report a comment');
  let existing;
  try {
    existing = await loadReports(podUrl, session.fetch);
  } catch {
    throw new Error('Could not read your reports, so this one was not saved');
  }
  const entry = {
    commentId: comment?.id || '',
    authorWebId: comment?.author,
    postUrl: comment?.postUrl,
    text: comment?.text || '',
    created: new Date().toISOString(),
  };
  if (!entry.authorWebId || !entry.postUrl) throw new Error('That comment cannot be reported');
  const next = [...existing, entry];
  await writePrivate(reportsUrl(podUrl), serializeReports(next), session, podUrl);
  return entry;
}
