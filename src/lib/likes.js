import { createContainerAt, getSolidDataset, overwriteFile } from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { applyAudience } from './acl.js';
import { assertTurtleIri } from './urls.js';
import { displayHandle } from './handles.js';
import { samePerson, normalizeWebId } from './webId.js';
import { groupFragment } from './discoverability.js';
import { resolveProfile } from './friends.js';

/**
 * A like is stored in the liker's Pod. The public cannot write the owner's Pod.
 * The owner copies likes they have seen into a per-post file and gives that file
 * the same audience as the post. Until the owner does that, other people may
 * not see the new count. The liker still sees their own like immediately.
 *
 * The liker's list stays private, so a like on a Hidden post is not published
 * by accident.
 */

function hashPostUrl(url) {
  let hash = 5381;
  for (const char of url) hash = ((hash << 5) + hash) ^ char.charCodeAt(0);
  return (hash >>> 0).toString(36);
}

export function ownLikesUrl(podUrl) {
  return `${podUrl}${PATHS.likes}`;
}

export function likeSetUrl(ownerPodUrl, postUrl) {
  return `${ownerPodUrl}${PATHS.likeSets}${hashPostUrl(postUrl)}.ttl`;
}

export function likeSetAudience(post) {
  if (post?.audience === 'public' || post?.audience === 'contacts' || post?.audience === 'private') {
    return post.audience;
  }
  return post?.isPublic ? 'public' : 'private';
}

export function serializeLikes(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const postUrl = assertTurtleIri(entry.postUrl);
    const created = entry.created ? new Date(entry.created) : new Date();
    if (Number.isNaN(created.getTime())) throw new Error('Invalid date');
    lines.push(
      '[] a podsta:Like ;',
      `  schema:about <${postUrl}> ;`,
      `  schema:dateCreated "${created.toISOString()}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseLikes(text) {
  if (!text || !text.includes('Like')) return [];
  const chunks = text.split(/a\s+(?:podsta:Like|<https:\/\/podsta\.app\/vocab#Like>)/);
  const entries = [];
  for (const chunk of chunks.slice(1)) {
    const about = chunk.match(/about[^<\n]*<([^>\s]+)>/i);
    const created = chunk.match(/dateCreated[^"\n]*"([^"]*)"/i);
    if (!about) continue;
    entries.push({ postUrl: about[1], created: created ? created[1] : '' });
  }
  return entries;
}

export function noticeTurtle({ authorWebId, postUrl, created, removed = false }) {
  const author = assertTurtleIri(normalizeWebId(authorWebId) || authorWebId);
  const about = assertTurtleIri(postUrl);
  const when = created ? new Date(created) : new Date();
  if (Number.isNaN(when.getTime())) throw new Error('Invalid date');
  return [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '<> a podsta:Like ;',
    `  schema:author <${author}> ;`,
    `  schema:about <${about}> ;`,
    `  schema:action "${removed ? 'remove' : 'add'}" ;`,
    `  schema:dateCreated "${when.toISOString()}" .`,
  ].join('\n');
}

export function parseLikeNotice(text) {
  if (!text || !/a\s+(?:podsta:Like|<https:\/\/podsta\.app\/vocab#Like>)/.test(text)) return null;
  const author = text.match(/author[^<\n]*<([^>\s]+)>/i);
  const about = text.match(/about[^<\n]*<([^>\s]+)>/i);
  const created = text.match(/dateCreated[^"\n]*"([^"]*)"/i);
  const action = text.match(/action[^"\n]*"([^"]*)"/i);
  if (!author || !about) return null;
  return {
    authorWebId: author[1],
    postUrl: about[1],
    created: created ? created[1] : '',
    removed: action?.[1] === 'remove',
  };
}

/** Apply inbox notices in time order. A later remove drops that person. */
export function applyLikeNotices(existing, notices) {
  let ids = absorbLikes({ existing });
  const ordered = [...(notices || [])].sort((a, b) => (a.created || '').localeCompare(b.created || ''));
  for (const notice of ordered) {
    if (!notice?.authorWebId) continue;
    if (notice.removed) ids = ids.filter((id) => !samePerson(id, notice.authorWebId));
    else ids = absorbLikes({ existing: ids, incoming: [notice.authorWebId] });
  }
  return ids;
}

export function absorbLikes({ existing = [], incoming = [], self = [] }) {
  const ids = [];
  for (const id of [...existing, ...incoming, ...self]) {
    if (!id || ids.some((item) => samePerson(item, id))) continue;
    ids.push(id);
  }
  return ids;
}

export function presentLikes({ webIds = [], readable = false, mine = false, me = '', nameFor }) {
  const label = (webId) => {
    if (samePerson(webId, me)) return 'You';
    if (nameFor) return nameFor(webId);
    return displayHandle(webId).handle || 'Someone';
  };
  const known = readable ? absorbLikes({ existing: webIds, self: mine ? [me] : [] }) : [];
  return {
    liked: Boolean(mine),
    count: readable ? known.length : null,
    names: readable ? known.map(label) : [],
    namesKnown: Boolean(readable),
  };
}

function serializeSet({ postUrl, webIds }) {
  const about = assertTurtleIri(postUrl);
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '<> a podsta:Like ;',
    `  schema:about <${about}> ;`,
  ];
  for (const webId of webIds || []) {
    const author = assertTurtleIri(normalizeWebId(webId) || webId);
    lines.push(`  schema:author <${author}> ;`);
  }
  lines.push(`  schema:dateCreated "${new Date().toISOString()}" .`);
  return lines.join('\n');
}

export function parseLikeSet(text) {
  const notice = parseLikeNotice(text);
  if (!notice) return { postUrl: '', webIds: [] };
  const webIds = [];
  const re = /author[^<\n]*<([^>\s]+)>/gi;
  let match = re.exec(text);
  while (match) {
    webIds.push(match[1]);
    match = re.exec(text);
  }
  return { postUrl: notice.postUrl, webIds: absorbLikes({ existing: webIds }) };
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

export async function loadOwnLikes(podUrl, fetchFn) {
  const response = await readText(ownLikesUrl(podUrl), fetchFn);
  // 401 and 403 are not an empty list. Treating them as empty would replace likes we could not see.
  if (response.status === 0 || response.status === 401 || response.status === 403) {
    throw new Error('Could not read your likes');
  }
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`Likes responded ${response.status}`);
  return parseLikes(await response.text());
}

export async function loadLikeSet({ ownerPodUrl, postUrl, fetchFn }) {
  const response = await readText(likeSetUrl(ownerPodUrl, postUrl), fetchFn);
  if (response.status === 404) return { webIds: [], readable: false, missing: true };
  if (response.status === 401 || response.status === 403 || response.status === 0) {
    return { webIds: [], readable: false };
  }
  if (!response.ok) return { webIds: [], readable: false };
  const parsed = parseLikeSet(await response.text());
  return { webIds: parsed.webIds, readable: true };
}

async function writeTurtle(url, turtle, session) {
  await overwriteFile(url, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: session.fetch,
  });
}

async function lockPrivate(url, session, podUrl) {
  try {
    await applyAudience([url], 'private', {
      ownerWebId: session.info.webId,
      groupUrl: groupFragment(podUrl),
      session,
    });
  } catch (err) {
    // The turtle is already stored. An ACL miss must not look like a lost like.
    // Parent rules on this host stay owner-only until the ACL write succeeds.
    if (!String(err?.message || '').includes('.acl')) throw err;
  }
}

export async function saveOwnLikes({ podUrl, session, entries }) {
  const url = ownLikesUrl(podUrl);
  await writeTurtle(url, serializeLikes(entries), session);
  await lockPrivate(url, session, podUrl);
  return url;
}

/** Create the private likes file only when it is absent. Never replaces an existing list. */
export async function createLikesFile({ podUrl, session, entries }) {
  const url = ownLikesUrl(podUrl);
  let response;
  try {
    response = await session.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
        'If-None-Match': '*',
      },
      body: serializeLikes(entries),
    });
  } catch (err) {
    if (err?.name === 'TypeError' || err?.name === 'AbortError') {
      throw new Error('Could not save that like. The Pod did not respond.');
    }
    throw err;
  }
  if (response.status === 412) {
    throw new Error('Could not read your likes, so this change was not saved');
  }
  if (!response.ok) throw new Error(`Could not save that like (${response.status || 'network'})`);
  await lockPrivate(url, session, podUrl);
  return url;
}

export async function publishLikeSet({ ownerPodUrl, session, post, webIds }) {
  if (!samePerson(session?.info?.webId, post?.ownerWebId) && post?.ownerWebId) {
    throw new Error('Only the author can publish who liked a post');
  }
  const container = `${ownerPodUrl}${PATHS.likeSets}`;
  try {
    await createContainerAt(container, { fetch: session.fetch });
  } catch {
    await getSolidDataset(container, { fetch: session.fetch });
  }
  const url = likeSetUrl(ownerPodUrl, post.url);
  await writeTurtle(url, serializeSet({ postUrl: post.url, webIds }), session);
  await applyAudience([url], likeSetAudience(post), {
    ownerWebId: session.info.webId,
    groupUrl: groupFragment(ownerPodUrl),
    session,
  });
  return { url, webIds };
}

export async function postLikeNotice({ session, ownerPodUrl, postUrl, removed = false }) {
  const turtle = noticeTurtle({
    authorWebId: session.info.webId,
    postUrl,
    created: new Date().toISOString(),
    removed,
  });
  const response = await session.fetch(`${ownerPodUrl}inbox/`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/turtle' },
    body: turtle,
  });
  return { ok: Boolean(response?.ok || response?.status === 201), status: response?.status || 0 };
}

export async function setOwnLike({ podUrl, session, post, ownerPodUrl, liked, knownEntries }) {
  const me = session?.info?.webId;
  if (!me) throw new Error('Sign in to like a post');
  const postUrl = assertTurtleIri(post?.url);
  let entries;
  if (Array.isArray(knownEntries)) {
    // This list was read successfully. Replacing the file cannot drop likes we have not seen.
    const without = knownEntries.filter((entry) => entry.postUrl !== postUrl);
    entries = liked ? [...without, { postUrl, created: new Date().toISOString() }] : without;
    await saveOwnLikes({ podUrl, session, entries });
  } else if (liked) {
    // A missing file often fails the CORS preflight, so a read error is not proof the file is empty.
    // Create it only if absent. An existing file is left untouched.
    entries = [{ postUrl, created: new Date().toISOString() }];
    await createLikesFile({ podUrl, session, entries });
  } else {
    const existing = await loadOwnLikes(podUrl, session.fetch);
    entries = existing.filter((entry) => entry.postUrl !== postUrl);
    await saveOwnLikes({ podUrl, session, entries });
  }

  let notified = false;
  let webIds = null;
  const mine = Boolean(post?.ownerWebId) && samePerson(me, post.ownerWebId);
  if (!mine) {
    try {
      let targetPod = ownerPodUrl;
      if (!targetPod && post.ownerWebId) {
        targetPod = (await resolveProfile(post.ownerWebId, session.fetch)).podUrl;
      }
      if (targetPod) {
        const posted = await postLikeNotice({ session, ownerPodUrl: targetPod, postUrl, removed: !liked });
        notified = posted.ok;
      }
    } catch {
      notified = false;
    }
  }
  if (mine) {
    try {
      const current = await loadLikeSet({ ownerPodUrl: podUrl, postUrl, fetchFn: session.fetch });
      webIds = absorbLikes({
        existing: current.webIds,
        self: liked ? [me] : [],
      }).filter((id) => liked || !samePerson(id, me));
      await publishLikeSet({
        ownerPodUrl: podUrl,
        session,
        post: { ...post, url: postUrl, ownerWebId: me },
        webIds,
      });
      notified = true;
    } catch {
      notified = false;
      webIds = null;
    }
  }
  return { liked, entries, notified, webIds };
}

export function containedLikeUrls(turtle, inboxUrl) {
  if (!turtle) return [];
  const urls = [];
  const re = /ldp:contains|<http:\/\/www\.w3\.org\/ns\/ldp#contains>/gi;
  let match = re.exec(turtle);
  while (match) {
    const rest = turtle.slice(match.index + match[0].length);
    let buf = '';
    let inIri = false;
    for (const char of rest) {
      if (char === '<') {
        inIri = true;
        buf = '';
        continue;
      }
      if (char === '>' && inIri) {
        if (buf) urls.push(buf);
        inIri = false;
        continue;
      }
      if (inIri) buf += char;
      else if (char === '.' || char === ';') break;
    }
    match = re.exec(turtle);
  }
  return [...new Set(urls)]
    .map((url) => {
      try {
        return new URL(url, inboxUrl).href;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function readInboxLikes(inboxUrl, fetchFn, limit = 15) {
  const response = await readText(inboxUrl, fetchFn);
  if (!response.ok) return [];
  const contained = containedLikeUrls(await response.text(), inboxUrl).slice(-limit);
  const notices = [];
  for (const url of contained) {
    try {
      const item = await readText(url, fetchFn);
      if (!item.ok) continue;
      const notice = parseLikeNotice(await item.text());
      if (notice) notices.push(notice);
    } catch {
      // One inbox item does not hide the rest.
    }
  }
  return notices;
}

export async function refreshOwnedLikeSets({ podUrl, session, posts, ownEntries }) {
  const me = session.info.webId;
  const notices = await readInboxLikes(`${podUrl}inbox/`, session.fetch);
  const published = [];
  for (const post of posts || []) {
    if (!post?.url) continue;
    const incoming = notices.filter((notice) => notice.postUrl === post.url);
    const selfLiked = (ownEntries || []).some((entry) => entry.postUrl === post.url);
    if (!incoming.length && !selfLiked) continue;
    const current = await loadLikeSet({ ownerPodUrl: podUrl, postUrl: post.url, fetchFn: session.fetch });
    let webIds = applyLikeNotices(current.webIds, incoming);
    webIds = selfLiked ? absorbLikes({ existing: webIds, self: [me] }) : webIds.filter((id) => !samePerson(id, me));
    await publishLikeSet({
      ownerPodUrl: podUrl,
      session,
      post: { ...post, ownerWebId: me },
      webIds,
    });
    published.push({ url: post.url, webIds });
  }
  return published;
}
