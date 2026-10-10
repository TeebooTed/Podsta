import { overwriteFile } from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { makePublic } from './acl.js';
import { assertTurtleIri } from './urls.js';
import { normalizeWebId, samePerson } from './webId.js';
import { resolveProfile } from './friends.js';

/**
 * A contact request is written by the sender, in the sender's Pod.
 * The recipient is never asked to accept a public write into their own Pod.
 *
 * The request file is world-readable so the recipient's app can find it
 * without a Podsta server. That is a privacy trade: the request is not secret.
 * Podsta also tries an authenticated post to the recipient's server inbox.
 * If that post fails, the request is still on the sender's Pod, and the
 * recipient sees it when they follow the sender.
 */

export function contactRequestsUrl(podUrl) {
  return `${podUrl}${PATHS.contactRequests}`;
}

/** The server inbox advertised as ldp:inbox. Not Podsta's podsta/inbox/ folder. */
export function serverInboxUrl(podUrl) {
  return `${podUrl}inbox/`;
}

function iso(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return date.toISOString();
}

function iriAfter(chunk, prop) {
  const match = chunk.match(new RegExp(`${prop}[^<\\n]*<([^>\\s]+)>`, 'i'));
  return match ? match[1] : '';
}

function stringAfter(chunk, prop) {
  const match = chunk.match(new RegExp(`${prop}[^"\\n]*"([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

export function serializeContactRequests(entries) {
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '',
  ];
  for (const entry of entries || []) {
    const author = assertTurtleIri(normalizeWebId(entry.authorWebId) || entry.authorWebId);
    const recipient = assertTurtleIri(normalizeWebId(entry.recipientWebId) || entry.recipientWebId);
    const created = iso(entry.created);
    lines.push(
      '[] a podsta:ContactRequest ;',
      `  schema:author <${author}> ;`,
      `  schema:recipient <${recipient}> ;`,
      `  schema:dateCreated "${created}" .`,
      '',
    );
  }
  return lines.join('\n');
}

export function parseContactRequests(text) {
  if (!text || !text.includes('ContactRequest')) return [];
  const chunks = text.split(/a\s+(?:podsta:ContactRequest|<https:\/\/podsta\.app\/vocab#ContactRequest>)/);
  const entries = [];
  for (const chunk of chunks.slice(1)) {
    const authorWebId = iriAfter(chunk, 'author');
    const recipientWebId = iriAfter(chunk, 'recipient');
    if (!authorWebId || !recipientWebId) continue;
    entries.push({
      authorWebId,
      recipientWebId,
      created: stringAfter(chunk, 'dateCreated'),
    });
  }
  return entries;
}

export function contactNoticeTurtle({ kind, authorWebId, recipientWebId, created, aboutUrl }) {
  const author = assertTurtleIri(normalizeWebId(authorWebId) || authorWebId);
  const recipient = assertTurtleIri(normalizeWebId(recipientWebId) || recipientWebId);
  const about = aboutUrl ? assertTurtleIri(aboutUrl) : '';
  const type = kind === 'approval' ? 'podsta:ContactApproval' : 'podsta:ContactRequest';
  const lines = [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    `<> a ${type} ;`,
    `  schema:author <${author}> ;`,
    `  schema:recipient <${recipient}> ;`,
  ];
  if (about) lines.push(`  schema:url <${about}> ;`);
  lines.push(`  schema:dateCreated "${iso(created)}" .`);
  return lines.join('\n');
}

export function parseNotice(text) {
  if (!text) return null;
  const approval = /a\s+(?:podsta:ContactApproval|<https:\/\/podsta\.app\/vocab#ContactApproval>)/.test(text);
  const request = /a\s+(?:podsta:ContactRequest|<https:\/\/podsta\.app\/vocab#ContactRequest>)/.test(text);
  if (!approval && !request) return null;
  const authorWebId = iriAfter(text, 'author');
  const recipientWebId = iriAfter(text, 'recipient');
  if (!authorWebId) return null;
  return {
    kind: approval ? 'contact-approval' : 'contact-request',
    authorWebId,
    recipientWebId,
    aboutUrl: iriAfter(text, 'url'),
    created: stringAfter(text, 'dateCreated'),
  };
}

export function parseContainedUrls(turtle) {
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
      if (inIri) {
        buf += char;
        continue;
      }
      if (char === '.' || char === ';') break;
    }
    match = re.exec(turtle);
  }
  return [...new Set(urls)];
}

export function resolveContained(baseUrl, urls) {
  return (urls || [])
    .map((url) => {
      try {
        return new URL(url, baseUrl).href;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function parseMemberIris(turtle) {
  if (!turtle) return [];
  const iris = [];
  const lines = turtle.split(/\n/);
  for (const line of lines) {
    if (!/hasMember/i.test(line)) continue;
    const tokens = line.match(/<([^>\s]+)>/g) || [];
    for (const token of tokens) {
      const iri = token.slice(1, -1);
      if (/hasMember/i.test(iri)) continue;
      iris.push(iri);
    }
  }
  return [...new Set(iris)];
}

/**
 * 401 and 403 are private. 404 is absent. Those are empty, not failures.
 * 304, 429, and a CORS-hidden response (status 0) must not look like an empty file,
 * or a flaky check wipes notifications that the previous check already found.
 */
export function responseDisposition(status) {
  if (status === 404 || status === 401 || status === 403) return 'absent';
  if (!status || status === 304 || status === 429) return 'unreadable';
  return 'read';
}

async function readText(url, fetchFn) {
  try {
    return await (fetchFn || fetch)(url, {
      headers: { Accept: 'text/turtle' },
      cache: 'no-store',
    });
  } catch (err) {
    // This host often omits CORS headers on 401, 404, and 429. The browser then
    // reports a network error for a file that is absent, private, or rate-limited.
    if (err?.name === 'TypeError' || err?.name === 'AbortError') {
      return { ok: false, status: 0, text: async () => '' };
    }
    throw err;
  }
}

async function readPublicFirst(url, fetchFn) {
  // These files are world-readable on purpose. A session fetch adds
  // Authorization and can fail a CORS preflight that a plain GET survives.
  const plain = await readText(url, fetch);
  if (plain.ok) return plain;
  if (!fetchFn || fetchFn === fetch) return plain;
  return readText(url, fetchFn);
}

export async function readContactRequests(podUrl, fetchFn) {
  const response = await readPublicFirst(contactRequestsUrl(podUrl), fetchFn);
  const disposition = responseDisposition(response.status);
  if (disposition === 'absent') return [];
  if (disposition === 'unreadable' || !response.ok) {
    throw new Error(`Contact requests responded ${response.status}`);
  }
  return parseContactRequests(await response.text());
}

export async function readGroupMembers(podUrl, fetchFn) {
  const response = await readPublicFirst(`${podUrl}${PATHS.contactsGroup}`, fetchFn);
  const disposition = responseDisposition(response.status);
  if (disposition === 'absent') return [];
  if (disposition === 'unreadable' || !response.ok) {
    throw new Error(`Contacts group responded ${response.status}`);
  }
  return parseMemberIris(await response.text());
}

export async function readInboxNotices(inboxUrl, fetchFn, limit = 15) {
  const response = await readText(inboxUrl, fetchFn);
  const disposition = responseDisposition(response.status);
  if (disposition === 'absent') return [];
  if (disposition === 'unreadable' || !response.ok) throw new Error(`Inbox responded ${response.status}`);
  const contained = resolveContained(inboxUrl, parseContainedUrls(await response.text())).slice(-limit);
  const notices = [];
  for (const url of contained) {
    try {
      const item = await readText(url, fetchFn);
      if (responseDisposition(item.status) === 'absent') continue;
      if (!item.ok) continue;
      const notice = parseNotice(await item.text());
      if (notice?.authorWebId) notices.push(notice);
    } catch {
      // One unreadable inbox item does not hide the rest.
    }
  }
  return notices;
}

export async function postInboxNotice({ inboxUrl, fetchFn, turtle }) {
  const response = await (fetchFn || fetch)(inboxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/turtle',
      Accept: 'text/turtle',
    },
    body: turtle,
  });
  return { ok: Boolean(response?.ok || response?.status === 201 || response?.status === 200), status: response?.status || 0 };
}

export async function saveOutgoingRequests({ podUrl, session, entries }) {
  const url = contactRequestsUrl(podUrl);
  const turtle = serializeContactRequests(entries);
  await overwriteFile(url, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: session.fetch,
  });
  await makePublic(url, session.info.webId, session);
  return url;
}

export async function sendContactRequest({ podUrl, session, targetWebId, now = () => new Date().toISOString() }) {
  const author = normalizeWebId(session?.info?.webId);
  const recipient = normalizeWebId(targetWebId);
  if (!author) throw new Error('Sign in before asking to be a contact');
  if (!recipient) throw new Error('That WebID is not a valid address');
  if (samePerson(author, recipient)) throw new Error('You are already you');

  const existing = await readContactRequests(podUrl, session.fetch);
  const kept = existing.filter((entry) => !samePerson(entry.recipientWebId, recipient));
  const created = iso(now());
  await saveOutgoingRequests({
    podUrl,
    session,
    entries: [...kept, { authorWebId: author, recipientWebId: recipient, created }],
  });

  let inboxDelivered = false;
  let inboxError = '';
  try {
    const profile = await resolveProfile(recipient, session.fetch);
    if (!profile.podUrl) throw new Error('No Pod for that WebID');
    const notice = contactNoticeTurtle({
      kind: 'request',
      authorWebId: author,
      recipientWebId: recipient,
      created,
      aboutUrl: contactRequestsUrl(podUrl),
    });
    const posted = await postInboxNotice({
      inboxUrl: serverInboxUrl(profile.podUrl),
      fetchFn: session.fetch,
      turtle: notice,
    });
    inboxDelivered = posted.ok;
    if (!posted.ok) inboxError = `Their inbox responded ${posted.status}`;
  } catch (err) {
    inboxError = err?.message || 'Their inbox did not accept the request';
  }

  return { targetWebId: recipient, inboxDelivered, inboxError };
}

export async function sendApprovalNotice({ session, targetWebId, now = () => new Date().toISOString() }) {
  const author = normalizeWebId(session?.info?.webId);
  const recipient = normalizeWebId(targetWebId);
  if (!author || !recipient) return { delivered: false, error: 'Missing WebID' };
  try {
    const profile = await resolveProfile(recipient, session.fetch);
    if (!profile.podUrl) return { delivered: false, error: 'No Pod for that WebID' };
    const notice = contactNoticeTurtle({
      kind: 'approval',
      authorWebId: author,
      recipientWebId: recipient,
      created: iso(now()),
    });
    const posted = await postInboxNotice({
      inboxUrl: serverInboxUrl(profile.podUrl),
      fetchFn: session.fetch,
      turtle: notice,
    });
    if (!posted.ok) return { delivered: false, error: `Their inbox responded ${posted.status}` };
    return { delivered: true, error: '' };
  } catch (err) {
    return { delivered: false, error: err?.message || 'Their inbox did not accept the notice' };
  }
}
