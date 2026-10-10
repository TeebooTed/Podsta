import { createContainerAt, getSolidDataset, getStringNoLocale, getThingAll } from '@inrupt/solid-client';
import { PATHS, SCHEMA } from './vocab.js';
import { assertTurtleIri } from './urls.js';
import { displayHandle } from './handles.js';
import { samePerson, normalizeWebId } from './webId.js';
import { groupFragment } from './discoverability.js';
import { applyAudience } from './acl.js';
import { containedLikeUrls, likeSetAudience, loadLikeSet, publishLikeSet } from './likes.js';
import { filterBlocked, isBlocked, loadBlocks, saveBlocks } from './blocks.js';
import { isNotFound, retryTransient } from './timeoutFetch.js';
import { MAX_COMMENT_LENGTH } from './vocab.js';

/**
 * A comment is stored in the commenter's Pod. The commenter sends an inbox
 * notice to the post author. The author copies notices they accept into a
 * per-post file and gives that file the same audience as the post.
 *
 * The public never gets write access to the author's Pod. The old
 * podsta/comments/ files stay owner-only. On the author's next check they
 * are copied into the published list so those notes still show.
 */

function hashPostUrl(url) {
  let hash = 5381;
  for (const char of url) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(36);
}

export function turtleString(value) {
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

function readLiteral(text, predicate) {
  const re = new RegExp(`(?:${predicate})\\s+"((?:\\\\.|[^"\\\\])*)"`, 'i');
  const match = re.exec(text || '');
  return match ? unescapeTurtle(match[1]) : '';
}

function readIri(text, predicate) {
  const match = (text || '').match(new RegExp(`${predicate}[^<\\n]*<([^>\\s]+)>`, 'i'));
  return match ? match[1] : '';
}

export function newCommentId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function legacyCommentId(comment) {
  return `legacy-${hashPostUrl(`${comment?.author || ''}|${comment?.date || ''}|${comment?.text || ''}`)}`;
}

export function ownCommentsUrl(podUrl) {
  return `${podUrl}${PATHS.myComments}`;
}

export function commentSetUrl(ownerPodUrl, postUrl) {
  return `${ownerPodUrl}${PATHS.commentSets}${hashPostUrl(postUrl)}.ttl`;
}

export function commentHidesUrl(podUrl) {
  return `${podUrl}${PATHS.commentHides}`;
}

function legacyFileUrl(ownerPodUrl, postUrl) {
  return `${ownerPodUrl}${PATHS.comments}${hashPostUrl(postUrl)}.ttl`;
}

export function commentSetAudience(post) {
  return likeSetAudience(post);
}

export function commenterLabel({ webId, me, name = '', nameReadable = false }) {
  if (samePerson(webId, me)) return { primary: 'You', handle: displayHandle(webId).handle || '' };
  const handle = displayHandle(webId).handle || 'Someone';
  if (nameReadable && name && name !== webId && name !== 'profile' && name !== 'Unknown') {
    return { primary: name, handle };
  }
  return { primary: handle, handle };
}

export function serializeOwnComments(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const about = assertTurtleIri(entry.postUrl);
    const created = new Date(entry.date || entry.created || Date.now());
    const modified = new Date(entry.modified || entry.date || Date.now());
    if (Number.isNaN(created.getTime()) || Number.isNaN(modified.getTime())) throw new Error('Invalid date');
    const text = String(entry.text || '').trim();
    if (!text) continue;
    if (text.length > MAX_COMMENT_LENGTH) throw new Error(`Comments stop at ${MAX_COMMENT_LENGTH} characters`);
    lines.push(
      '[] a podsta:Comment ;',
      `  schema:identifier "${turtleString(entry.id)}" ;`,
      `  schema:about <${about}> ;`,
      `  schema:text "${turtleString(text)}" ;`,
      `  schema:dateCreated "${created.toISOString()}" ;`,
      `  schema:dateModified "${modified.toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

function chunksOf(text, typeName) {
  if (!text) return [];
  const type = `(?:podsta:${typeName}(?![A-Za-z])|<https://podsta\\.app/vocab#${typeName}>)`;
  return `\n${text}`.split(new RegExp(`\\n(?:<>|\\[\\])\\s+a\\s+${type}`)).slice(1);
}

export function parseOwnComments(text) {
  return chunksOf(text, 'Comment')
    .map((chunk) => ({
      id: readLiteral(chunk, 'identifier'),
      postUrl: readIri(chunk, 'about'),
      text: readLiteral(chunk, 'text'),
      date: readLiteral(chunk, 'dateCreated'),
      modified: readLiteral(chunk, 'dateModified') || readLiteral(chunk, 'dateCreated'),
    }))
    .filter((entry) => entry.id && entry.postUrl && entry.text);
}

export function commentNoticeTurtle({ authorWebId, postUrl, id, text = '', action = 'add', created }) {
  const author = assertTurtleIri(normalizeWebId(authorWebId) || authorWebId);
  const about = assertTurtleIri(postUrl);
  const when = created ? new Date(created) : new Date();
  if (Number.isNaN(when.getTime())) throw new Error('Invalid date');
  if (!id) throw new Error('Missing comment');
  const verb = action === 'remove' || action === 'edit' ? action : 'add';
  return [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '<> a podsta:Comment ;',
    `  schema:author <${author}> ;`,
    `  schema:identifier "${turtleString(id)}" ;`,
    `  schema:about <${about}> ;`,
    `  schema:text "${turtleString(text || '')}" ;`,
    `  schema:action "${verb}" ;`,
    `  schema:dateCreated "${when.toISOString()}" .`,
  ].join('\n');
}

export function parseCommentNotice(text) {
  if (!text || !/a\s+(?:podsta:Comment(?![A-Za-z])|<https:\/\/podsta\.app\/vocab#Comment>)/.test(text)) return null;
  if (/a\s+(?:podsta:CommentSet|<https:\/\/podsta\.app\/vocab#CommentSet>)/.test(text) && !/schema:action/.test(text)) {
    return null;
  }
  const author = readIri(text, 'author');
  const about = readIri(text, 'about');
  const id = readLiteral(text, 'identifier');
  if (!author || !about || !id) return null;
  const action = readLiteral(text, 'action') || 'add';
  return {
    authorWebId: author,
    postUrl: about,
    id,
    text: readLiteral(text, 'text'),
    action,
    removed: action === 'remove',
    created: readLiteral(text, 'dateCreated'),
  };
}

export function serializeHides(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const about = assertTurtleIri(entry.postUrl);
    lines.push(
      '[] a podsta:Hide ;',
      `  schema:about <${about}> ;`,
      `  schema:identifier "${turtleString(entry.id)}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseHides(text) {
  return chunksOf(text, 'Hide')
    .map((chunk) => ({ postUrl: readIri(chunk, 'about'), id: readLiteral(chunk, 'identifier') }))
    .filter((entry) => entry.postUrl && entry.id);
}

export function serializeCommentSet({ postUrl, comments, migrated = false }) {
  const about = assertTurtleIri(postUrl);
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '<> a podsta:CommentSet ;',
    `  schema:about <${about}> ;`,
    `  podsta:migrated "${migrated ? 'true' : 'false'}" .`,
    '',
  ];
  for (const comment of comments || []) {
    const author = assertTurtleIri(normalizeWebId(comment.author) || comment.author);
    const created = new Date(comment.date || Date.now());
    const modified = new Date(comment.modified || comment.date || Date.now());
    if (Number.isNaN(created.getTime()) || Number.isNaN(modified.getTime())) throw new Error('Invalid date');
    lines.push(
      '[] a podsta:Comment ;',
      `  schema:identifier "${turtleString(comment.id)}" ;`,
      `  schema:author <${author}> ;`,
      `  schema:text "${turtleString(comment.text || '')}" ;`,
      `  schema:dateCreated "${created.toISOString()}" ;`,
      `  schema:dateModified "${modified.toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseCommentSet(text) {
  const comments = chunksOf(text, 'Comment')
    .map((chunk) => ({
      id: readLiteral(chunk, 'identifier'),
      author: readIri(chunk, 'author'),
      text: readLiteral(chunk, 'text'),
      date: readLiteral(chunk, 'dateCreated'),
      modified: readLiteral(chunk, 'dateModified') || readLiteral(chunk, 'dateCreated'),
      postUrl: readIri(chunk, 'about') || readIri(text, 'about'),
    }))
    .filter((comment) => comment.id && comment.author && comment.text);
  return { postUrl: readIri(text, 'about'), comments, migrated: readLiteral(text, 'migrated') === 'true' };
}

function byDate(a, b) {
  return (a.date || '').localeCompare(b.date || '');
}

/** A hidden id stays hidden. A later remove drops the comment. An edit replaces older text. */
export function applyCommentNotices(existing, notices, { hiddenIds = [] } = {}) {
  const hidden = new Set(hiddenIds);
  const byId = new Map();
  for (const comment of existing || []) {
    if (!comment?.id || hidden.has(comment.id)) continue;
    byId.set(comment.id, { ...comment });
  }
  const ordered = [...(notices || [])].sort((a, b) => (a.created || '').localeCompare(b.created || ''));
  for (const notice of ordered) {
    if (!notice?.id || hidden.has(notice.id)) continue;
    if (notice.removed || notice.action === 'remove') {
      byId.delete(notice.id);
      continue;
    }
    const previous = byId.get(notice.id);
    const when = notice.created || '';
    if (previous && (previous.modified || previous.date || '') > when) continue;
    const text = notice.action === 'edit' ? notice.text : notice.text || previous?.text || '';
    if (!String(text || '').trim()) {
      byId.delete(notice.id);
      continue;
    }
    byId.set(notice.id, {
      id: notice.id,
      postUrl: notice.postUrl || previous?.postUrl || '',
      author: notice.authorWebId || previous?.author || '',
      text: String(text).trim(),
      date: previous?.date || when,
      modified: when || previous?.modified || '',
    });
  }
  return [...byId.values()].sort(byDate);
}

export function mergeLegacy(comments, hiddenIds, legacy) {
  const hidden = new Set(hiddenIds || []);
  const next = [...(comments || [])];
  const ids = new Set(next.map((comment) => comment.id));
  for (const item of legacy || []) {
    if (!item?.text) continue;
    const id = item.id || legacyCommentId(item);
    if (hidden.has(id) || ids.has(id)) continue;
    next.push({
      id,
      postUrl: item.postUrl || '',
      author: item.author || '',
      text: item.text,
      date: item.date || '',
      modified: item.modified || item.date || '',
    });
    ids.add(id);
  }
  return next.sort(byDate);
}

export function presentThread({ published = [], hiddenIds = [], own = [], blocked = null, viewerWebId = '' }) {
  const hidden = new Set(hiddenIds);
  const visible = [];
  for (const comment of published) {
    if (!comment?.id || hidden.has(comment.id)) continue;
    if (blocked && isBlocked(comment.author, blocked)) continue;
    visible.push({ ...comment, status: 'published' });
  }
  const extras = [];
  for (const comment of own || []) {
    if (!samePerson(comment.author || viewerWebId, viewerWebId)) continue;
    if (visible.some((item) => item.id === comment.id)) continue;
    extras.push({
      ...comment,
      author: comment.author || viewerWebId,
      status: hidden.has(comment.id) ? 'hidden' : 'unpublished',
    });
  }
  return [...visible, ...extras].sort(byDate);
}

function commentSignature(comments) {
  return JSON.stringify(
    (comments || []).map((comment) => [comment.id, comment.author, comment.text, comment.modified || comment.date]),
  );
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

async function writeTurtle(url, turtle, session) {
  let response;
  try {
    response = await session.fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: turtle,
    });
  } catch (err) {
    if (err?.name === 'TypeError' || err?.name === 'AbortError') {
      throw new Error('The Pod did not respond');
    }
    throw err;
  }
  if (!response.ok) throw new Error(`The Pod responded ${response.status || 'network'}`);
  return response;
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

export async function loadOwnComments(podUrl, fetchFn) {
  const response = await readText(ownCommentsUrl(podUrl), fetchFn);
  if (response.status === 404) return [];
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read your comments');
  }
  if (!response.ok) throw new Error(`Comments responded ${response.status}`);
  return parseOwnComments(await response.text());
}

export async function saveOwnComments({ podUrl, session, entries }) {
  const url = ownCommentsUrl(podUrl);
  await retryTransient(() => writeTurtle(url, serializeOwnComments(entries), session));
  await lockPrivate(url, session, podUrl);
  return entries;
}

export async function loadHides(podUrl, fetchFn) {
  const response = await readText(commentHidesUrl(podUrl), fetchFn);
  if (response.status === 404) return [];
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read hidden comments');
  }
  if (!response.ok) throw new Error(`Hidden comments responded ${response.status}`);
  return parseHides(await response.text());
}

export async function saveHides({ podUrl, session, entries }) {
  const url = commentHidesUrl(podUrl);
  await writeTurtle(url, serializeHides(entries), session);
  await lockPrivate(url, session, podUrl);
  return entries;
}

export async function loadPublishedComments({ ownerPodUrl, postUrl, fetchFn }) {
  const response = await readText(commentSetUrl(ownerPodUrl, postUrl), fetchFn);
  if (response.status === 404) return { comments: [], readable: false, missing: true };
  if (response.status === 401 || response.status === 403) return { comments: [], readable: false, forbidden: true };
  if (response.status === 0 || !response.ok) return { comments: [], readable: false, failed: true };
  const parsed = parseCommentSet(await response.text());
  return { comments: parsed.comments, readable: true, migrated: parsed.migrated };
}

export async function loadLegacyComments({ ownerPodUrl, postUrl, fetchFn }) {
  try {
    const ds = await getSolidDataset(legacyFileUrl(ownerPodUrl, postUrl), { fetch: fetchFn });
    const comments = getThingAll(ds)
      .map((thing) => ({
        text: getStringNoLocale(thing, SCHEMA.text) || '',
        date: getStringNoLocale(thing, SCHEMA.dateCreated) || '',
        author: getStringNoLocale(thing, SCHEMA.author) || '',
        postUrl,
      }))
      .filter((comment) => comment.text)
      .map((comment) => ({ ...comment, id: legacyCommentId(comment) }));
    return { comments, error: null };
  } catch (err) {
    if (isNotFound(err)) return { comments: [], error: null };
    const status = err?.statusCode || err?.response?.status;
    if (status === 401 || status === 403) return { comments: [], error: 'private' };
    return { comments: [], error: 'unavailable' };
  }
}

async function ensureCommentSetContainer(podUrl, session) {
  const container = `${podUrl}${PATHS.commentSets}`;
  try {
    await retryTransient(() => createContainerAt(container, { fetch: session.fetch }));
  } catch {
    await getSolidDataset(container, { fetch: session.fetch });
  }
}

export async function publishCommentSet({ ownerPodUrl, session, post, comments, migrated = false }) {
  if (post?.ownerWebId && !samePerson(session?.info?.webId, post.ownerWebId)) {
    throw new Error('Only the author can publish comments');
  }
  await ensureCommentSetContainer(ownerPodUrl, session);
  const url = commentSetUrl(ownerPodUrl, post.url);
  const visible = (comments || []).filter((comment) => comment?.text && comment?.author && comment?.id);
  await retryTransient(() =>
    writeTurtle(
      url,
      serializeCommentSet({ postUrl: post.url, comments: visible, migrated }),
      session,
    ),
  );
  let shared = true;
  try {
    await applyAudience([url], commentSetAudience(post), {
      ownerWebId: session.info.webId,
      groupUrl: groupFragment(ownerPodUrl),
      session,
    });
  } catch {
    shared = false;
  }
  return { url, comments: visible, shared };
}

export async function postCommentNotice({ session, ownerPodUrl, postUrl, id, text, action }) {
  const turtle = commentNoticeTurtle({
    authorWebId: session.info.webId,
    postUrl,
    id,
    text,
    action,
    created: new Date().toISOString(),
  });
  let response;
  try {
    response = await session.fetch(`${ownerPodUrl}inbox/`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/turtle' },
      body: turtle,
    });
  } catch {
    return { ok: false, status: 0 };
  }
  return { ok: Boolean(response?.ok || response?.status === 201 || response?.status === 204), status: response?.status || 0 };
}

export async function readInboxComments(inboxUrl, fetchFn, limit = 30) {
  const response = await readText(inboxUrl, fetchFn);
  if (!response.ok) return [];
  const contained = containedLikeUrls(await response.text(), inboxUrl).slice(-limit);
  const notices = [];
  for (const url of contained) {
    try {
      const item = await readText(url, fetchFn);
      if (!item.ok) continue;
      const notice = parseCommentNotice(await item.text());
      if (notice) notices.push(notice);
    } catch {
      // One inbox item does not hide the rest.
    }
  }
  return notices;
}

async function readBlocked(podUrl, fetchFn) {
  try {
    return await loadBlocks(podUrl, fetchFn);
  } catch {
    return null;
  }
}

export async function refreshOwnedCommentSets({ podUrl, session, posts }) {
  const me = session.info.webId;
  const notices = await readInboxComments(`${podUrl}inbox/`, session.fetch);
  const blocked = await readBlocked(podUrl, session.fetch);
  let hides = [];
  try {
    hides = await loadHides(podUrl, session.fetch);
  } catch {
    hides = [];
  }
  let own = null;
  try {
    own = await loadOwnComments(podUrl, session.fetch);
  } catch {
    own = null;
  }
  const published = [];
  const imported = [];
  for (const post of posts || []) {
    if (!post?.url) continue;
    const incoming = notices.filter((notice) => notice.postUrl === post.url);
    const hiddenIds = hides.filter((hide) => hide.postUrl === post.url).map((hide) => hide.id);
    const current = await loadPublishedComments({
      ownerPodUrl: podUrl,
      postUrl: post.url,
      fetchFn: session.fetch,
    });
    if (!current.readable && !current.missing) continue;
    let comments = current.readable ? current.comments : [];
    const legacy = current.migrated
      ? { comments: [], error: null }
      : await loadLegacyComments({ ownerPodUrl: podUrl, postUrl: post.url, fetchFn: session.fetch });
    if (legacy.error === 'unavailable' && current.missing && incoming.length === 0) continue;
    comments = applyCommentNotices(comments, incoming, { hiddenIds });
    if (!legacy.error) comments = mergeLegacy(comments, hiddenIds, legacy.comments);
    if (own) {
      for (const entry of own.filter((item) => item.postUrl === post.url)) {
        if (hiddenIds.includes(entry.id)) continue;
        const index = comments.findIndex((item) => item.id === entry.id);
        const mine = { ...entry, author: me, postUrl: post.url };
        if (index === -1) comments.push(mine);
        else if ((entry.modified || '') > (comments[index].modified || '')) comments[index] = mine;
      }
    }
    if (blocked) comments = comments.filter((comment) => !isBlocked(comment.author, blocked));
    comments = comments.sort(byDate);
    const changed = !current.readable || commentSignature(comments) !== commentSignature(current.comments);
    const hasWork = incoming.length || (legacy.comments || []).length || comments.length;
    if (!changed || (!hasWork && current.missing)) continue;
    const result = await publishCommentSet({
      ownerPodUrl: podUrl,
      session,
      post: { ...post, ownerWebId: me },
      comments,
      migrated: legacy.error !== 'unavailable',
    });
    published.push({ url: post.url, comments: result.comments, shared: result.shared });
    for (const comment of legacy.comments || []) {
      if (!samePerson(comment.author, me)) continue;
      if (own && own.some((entry) => entry.id === comment.id)) continue;
      if (imported.some((entry) => entry.id === comment.id)) continue;
      imported.push({ ...comment, author: me, postUrl: post.url, modified: comment.date || '' });
    }
  }
  if (own && imported.length) {
    await saveOwnComments({ podUrl, session, entries: [...own, ...imported] });
  }
  return published;
}

function cleanText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Comment cannot be empty');
  if (trimmed.length > MAX_COMMENT_LENGTH) throw new Error(`Comments stop at ${MAX_COMMENT_LENGTH} characters`);
  return trimmed;
}

async function notifyAuthor({ session, post, ownerPodUrl, id, text, action }) {
  const me = session.info.webId;
  const mine = Boolean(post?.ownerWebId) && samePerson(me, post.ownerWebId);
  if (mine) return { notified: true, published: true };
  let targetPod = ownerPodUrl;
  if (!targetPod && post?.ownerWebId) {
    try {
      const url = new URL(post.ownerWebId);
      targetPod = `${url.protocol}//${url.host}/`;
    } catch {
      targetPod = '';
    }
  }
  if (!targetPod) return { notified: false, published: false };
  const posted = await postCommentNotice({ session, ownerPodUrl: targetPod, postUrl: post.url, id, text, action });
  return { notified: posted.ok, published: false };
}

export async function addComment({ podUrl, session, post, ownerPodUrl, text, id }) {
  if (!session?.info?.webId) throw new Error('Sign in to comment');
  const body = cleanText(text);
  const postUrl = assertTurtleIri(post?.url);
  const commentId = id || newCommentId();
  const now = new Date().toISOString();
  const existing = await loadOwnComments(podUrl, session.fetch);
  const entry = { id: commentId, postUrl, text: body, date: now, modified: now, author: session.info.webId };
  await saveOwnComments({ podUrl, session, entries: [...existing, entry] });
  const me = session.info.webId;
  const author = Boolean(post?.ownerWebId) && samePerson(me, post.ownerWebId);
  let shared = true;
  if (author) {
    const current = await loadPublishedComments({ ownerPodUrl: podUrl, postUrl, fetchFn: session.fetch });
    const hides = await loadHides(podUrl, session.fetch).catch(() => []);
    const hiddenIds = hides.filter((hide) => hide.postUrl === postUrl).map((hide) => hide.id);
    const comments = applyCommentNotices(current.comments || [], [], { hiddenIds });
    if (!hiddenIds.includes(commentId)) comments.push(entry);
    const published = await publishCommentSet({
      ownerPodUrl: podUrl,
      session,
      post: { ...post, url: postUrl, ownerWebId: me },
      comments,
    });
    shared = published.shared;
  }
  const notice = author ? { notified: true, published: true } : await notifyAuthor({
    session,
    post: { ...post, url: postUrl },
    ownerPodUrl,
    id: commentId,
    text: body,
    action: 'add',
  });
  return { comment: entry, ...notice, shared };
}

export async function editOwnComment({ podUrl, session, post, ownerPodUrl, id, text }) {
  if (!session?.info?.webId) throw new Error('Sign in to edit a comment');
  const body = cleanText(text);
  const existing = await loadOwnComments(podUrl, session.fetch);
  let current = existing.find((entry) => entry.id === id);
  const author = Boolean(post?.ownerWebId) && samePerson(session.info.webId, post.ownerWebId);
  if (!current && author && post?.url) {
    const published = await loadPublishedComments({
      ownerPodUrl: podUrl,
      postUrl: post.url,
      fetchFn: session.fetch,
    });
    current = (published.comments || []).find((entry) => entry.id === id);
    if (current) existing.push({ ...current, postUrl: post.url });
  }
  if (!current) throw new Error('That comment is not in your Pod');
  const now = new Date().toISOString();
  const next = existing.map((entry) => (entry.id === id ? { ...entry, text: body, modified: now } : entry));
  await saveOwnComments({ podUrl, session, entries: next });
  const updated = next.find((entry) => entry.id === id);
  let shared = true;
  if (author) {
    const published = await loadPublishedComments({
      ownerPodUrl: podUrl,
      postUrl: current.postUrl,
      fetchFn: session.fetch,
    });
    const comments = (published.comments || []).map((comment) =>
      comment.id === id ? { ...comment, text: body, modified: now } : comment,
    );
    const result = await publishCommentSet({
      ownerPodUrl: podUrl,
      session,
      post: { ...post, url: current.postUrl, ownerWebId: session.info.webId },
      comments,
    });
    shared = result.shared;
  }
  const notice = author
    ? { notified: true, published: true }
    : await notifyAuthor({
        session,
        post: { ...post, url: current.postUrl },
        ownerPodUrl,
        id,
        text: body,
        action: 'edit',
      });
  return { comment: { ...updated, author: session.info.webId }, ...notice, shared };
}

export async function deleteOwnComment({ podUrl, session, post, ownerPodUrl, id }) {
  if (!session?.info?.webId) throw new Error('Sign in to delete a comment');
  const existing = await loadOwnComments(podUrl, session.fetch);
  let current = existing.find((entry) => entry.id === id);
  const author = Boolean(post?.ownerWebId) && samePerson(session.info.webId, post.ownerWebId);
  if (!current && author && post?.url) {
    current = { id, postUrl: post.url, text: '', date: '', modified: '' };
  }
  if (!current) throw new Error('That comment is not in your Pod');
  await saveOwnComments({
    podUrl,
    session,
    entries: existing.filter((entry) => entry.id !== id),
  });
  if (author) {
    const published = await loadPublishedComments({
      ownerPodUrl: podUrl,
      postUrl: current.postUrl,
      fetchFn: session.fetch,
    });
    await publishCommentSet({
      ownerPodUrl: podUrl,
      session,
      post: { ...post, url: current.postUrl, ownerWebId: session.info.webId },
      comments: (published.comments || []).filter((comment) => comment.id !== id),
    });
    return { deleted: true, notified: true, published: true };
  }
  const notice = await notifyAuthor({
    session,
    post: { ...post, url: current.postUrl },
    ownerPodUrl,
    id,
    text: '',
    action: 'remove',
  });
  return { deleted: true, ...notice };
}

export async function hideComment({ podUrl, session, post, comment }) {
  if (!session?.info?.webId) throw new Error('Sign in to hide a comment');
  if (post?.ownerWebId && !samePerson(session.info.webId, post.ownerWebId)) {
    throw new Error('Only the author can hide a comment');
  }
  const hides = await loadHides(podUrl, session.fetch);
  const nextHides = hides.some((hide) => hide.id === comment.id && hide.postUrl === post.url)
    ? hides
    : [...hides, { id: comment.id, postUrl: post.url }];
  await saveHides({ podUrl, session, entries: nextHides });
  const published = await loadPublishedComments({
    ownerPodUrl: podUrl,
    postUrl: post.url,
    fetchFn: session.fetch,
  });
  const comments = (published.comments || []).filter((item) => item.id !== comment.id);
  const result = await publishCommentSet({
    ownerPodUrl: podUrl,
    session,
    post: { ...post, ownerWebId: session.info.webId },
    comments,
  });
  return { hidden: true, shared: result.shared, comments };
}

export async function loadThread({ ownerPodUrl, postUrl, fetchFn, viewerPodUrl, viewerWebId, isAuthor = false }) {
  const published = await loadPublishedComments({ ownerPodUrl, postUrl, fetchFn });
  if (published.failed) return { comments: [], error: 'unavailable' };
  if (published.forbidden && !isAuthor) return { comments: [], error: 'private' };
  let hiddenIds = [];
  let blocked = null;
  if (isAuthor && viewerPodUrl) {
    try {
      const hides = await loadHides(viewerPodUrl, fetchFn);
      hiddenIds = hides.filter((hide) => hide.postUrl === postUrl).map((hide) => hide.id);
    } catch {
      hiddenIds = [];
    }
    blocked = await readBlocked(viewerPodUrl, fetchFn);
  }
  let comments = published.readable ? published.comments : [];
  if (isAuthor) {
    const legacy = await loadLegacyComments({ ownerPodUrl, postUrl, fetchFn });
    if (legacy.error === 'unavailable' && !published.readable && !published.missing) {
      return { comments: [], error: 'unavailable' };
    }
    if (!legacy.error) comments = mergeLegacy(comments, hiddenIds, legacy.comments);
  }
  let own = [];
  if (viewerPodUrl && viewerWebId) {
    try {
      own = (await loadOwnComments(viewerPodUrl, fetchFn))
        .filter((entry) => entry.postUrl === postUrl)
        .map((entry) => ({ ...entry, author: viewerWebId }));
    } catch {
      own = [];
    }
  }
  return {
    comments: presentThread({ published: comments, hiddenIds, own, blocked, viewerWebId }),
    error: null,
  };
}

/** Notifications read the published list, plus owner-only notes the author has not copied yet. */
export async function loadComments({ ownerPodUrl, postUrl, fetchFn }) {
  const published = await loadPublishedComments({ ownerPodUrl, postUrl, fetchFn });
  if (published.failed) return { comments: [], error: 'unavailable' };
  const legacy = await loadLegacyComments({ ownerPodUrl, postUrl, fetchFn });
  if (published.forbidden && legacy.error) return { comments: [], error: 'private' };
  if (!published.readable && !published.missing && legacy.error === 'unavailable') {
    return { comments: [], error: 'unavailable' };
  }
  const comments = mergeLegacy(published.readable ? published.comments : [], [], legacy.error ? [] : legacy.comments);
  return { comments, error: null };
}

export async function discoverableName(webId, fetchFn) {
  const handle = displayHandle(webId).handle || '';
  let pod = '';
  try {
    const url = new URL(webId);
    if (url.protocol === 'https:' || url.protocol === 'http:') pod = `${url.protocol}//${url.host}/`;
  } catch {
    return { name: '', handle, readable: false };
  }
  if (!pod) return { name: '', handle, readable: false };
  const response = await readText(`${pod}${PATHS.profile}`, fetchFn);
  if (!response.ok) return { name: '', handle, readable: false };
  const text = await response.text();
  const name = readLiteral(text, 'name');
  return { name, handle, readable: Boolean(name) };
}

export async function blockPerson({ podUrl, session, webId, post }) {
  if (!session?.info?.webId) throw new Error('Sign in to block someone');
  const person = normalizeWebId(webId) || webId;
  if (!person || samePerson(person, session.info.webId)) throw new Error('You cannot block yourself');
  assertTurtleIri(person);
  let existing;
  try {
    existing = await loadBlocks(podUrl, session.fetch);
  } catch {
    throw new Error('Could not read your blocks, so this one was not saved');
  }
  const webIds = isBlocked(person, existing) ? existing : [...existing, person];
  await saveBlocks({ podUrl, session, webIds });
  if (post?.url) {
    const published = await loadPublishedComments({
      ownerPodUrl: podUrl,
      postUrl: post.url,
      fetchFn: session.fetch,
    });
    if (published.readable || published.missing) {
      await publishCommentSet({
        ownerPodUrl: podUrl,
        session,
        post: { ...post, ownerWebId: session.info.webId },
        comments: (published.comments || []).filter((comment) => !samePerson(comment.author, person)),
      });
    }
    const likes = await loadLikeSet({ ownerPodUrl: podUrl, postUrl: post.url, fetchFn: session.fetch });
    if (likes.readable) {
      await publishLikeSet({
        ownerPodUrl: podUrl,
        session,
        post: { ...post, ownerWebId: session.info.webId },
        webIds: filterBlocked(likes.webIds, webIds),
      });
    }
  }
  return { webIds };
}

export function commentResultCopy(result, verb) {
  if (!result) return '';
  if (verb === 'add' && result.published && result.shared === false) {
    return 'Saved in your Pod. The audience update failed, so other people may not see it yet.';
  }
  if (result.published) {
    if (verb === 'delete') return 'Deleted from your Pod and from this post.';
    if (verb === 'edit') return 'Updated on your Pod and on this post.';
    return 'Published on this post.';
  }
  if (verb === 'delete') {
    return result.notified
      ? 'Deleted from your Pod. The author was notified.'
      : 'Deleted from your Pod. The author was not notified, so it may still show on the post.';
  }
  if (verb === 'edit') {
    return result.notified
      ? 'Updated in your Pod. The author was notified.'
      : 'Updated in your Pod. The author was not notified, so the post may still show the old text.';
  }
  return result.notified
    ? 'Saved in your Pod. The author was notified.'
    : 'Saved in your Pod. The author was not notified, so other people may not see it yet.';
}

export { filterBlocked };
