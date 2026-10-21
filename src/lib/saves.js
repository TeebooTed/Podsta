import { overwriteFile } from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { applyAudience } from './acl.js';
import { assertTurtleIri } from './urls.js';
import { groupFragment } from './discoverability.js';

/**
 * A saved post is a private bookmark in the saver's Pod.
 * The file stores the post URL and the time it was saved. It does not copy
 * the caption, the photo, or the author's text. Reading the post later uses
 * the same access rules as any other visit. A post that is no longer readable
 * stays on the list as a URL the saver can forget.
 */

export function savesUrl(podUrl) {
  return `${podUrl}${PATHS.favorites}`;
}

export function serializeSaves(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const postUrl = assertTurtleIri(entry.postUrl);
    const savedAt = entry.savedAt ? new Date(entry.savedAt) : new Date();
    if (Number.isNaN(savedAt.getTime())) throw new Error('Invalid date');
    lines.push(
      '[] a podsta:Save ;',
      `  schema:about <${postUrl}> ;`,
      `  schema:dateCreated "${savedAt.toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseSaves(text) {
  if (!text || !text.includes('Save')) return [];
  const chunks = text.split(/a\s+(?:podsta:Save|<https:\/\/podsta\.app\/vocab#Save>)/);
  const entries = [];
  for (const chunk of chunks.slice(1)) {
    const about = chunk.match(/about[^<\n]*<([^>\s]+)>/i);
    const created = chunk.match(/dateCreated[^"\n]*"([^"]*)"/i);
    if (!about) continue;
    if (entries.some((entry) => entry.postUrl === about[1])) continue;
    entries.push({ postUrl: about[1], savedAt: created ? created[1] : '' });
  }
  return entries;
}

export function isSaved(entries, postUrl) {
  if (!postUrl) return false;
  return (entries || []).some((entry) => entry.postUrl === postUrl);
}

/** Add or remove one URL. The previous list is kept, so a toggle cannot drop saves that were not loaded. */
export function withSave(entries, postUrl, saved, savedAt = new Date().toISOString()) {
  const url = assertTurtleIri(postUrl);
  const without = (entries || []).filter((entry) => entry.postUrl !== url);
  if (!saved) return without;
  return [...without, { postUrl: url, savedAt }];
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

export async function loadSaves(podUrl, fetchFn) {
  const response = await readText(savesUrl(podUrl), fetchFn);
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read your saved posts');
  }
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Saved posts responded ${response.status}`);
  return parseSaves(await response.text());
}

async function lockPrivate(url, session, podUrl) {
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

export async function saveSaves({ podUrl, session, entries }) {
  const url = savesUrl(podUrl);
  const turtle = serializeSaves(entries);
  await overwriteFile(url, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: session.fetch,
  });
  await lockPrivate(url, session, podUrl);
  return entries;
}

/**
 * Replace the private list from a list that was read successfully.
 * A missing read must not be passed in: that would publish an empty file over saves we could not see.
 */
export async function setSaved({ podUrl, session, postUrl, saved, knownEntries, savedAt }) {
  if (!Array.isArray(knownEntries)) {
    throw new Error('Could not read your saved posts, so this change was not saved');
  }
  const entries = withSave(knownEntries, postUrl, saved, savedAt);
  await saveSaves({ podUrl, session, entries });
  return entries;
}
