import { normalizeWebId, samePerson } from './webId.js';
import { assertTurtleIri } from './urls.js';
import { addFriend, resolveProfile } from './friends.js';
import { loadContactMembers, saveContactMembers } from './contactsGroup.js';
import { postInboxNotice, serverInboxUrl } from './contactRequest.js';

/**
 * An invite connects both people.
 * The new person follows the inviter and approves them as a contact, then
 * posts a notice to the inviter's inbox. The inviter's own app follows back
 * and approves the new person. Nobody writes the other person's pod except
 * that inbox notice.
 */

export const INVITE_CONNECT_KEY = 'podsta.inviteConnect';

export function rememberInviteConnect(storage, webId) {
  const normalized = normalizeWebId(webId);
  if (!storage || !normalized) return;
  storage.setItem(INVITE_CONNECT_KEY, normalized);
}

export function consumeInviteConnect(storage) {
  if (!storage) return '';
  const value = storage.getItem(INVITE_CONNECT_KEY) || '';
  if (value) storage.removeItem(INVITE_CONNECT_KEY);
  return normalizeWebId(value) || '';
}

function iso(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error('Invalid date');
  return date.toISOString();
}

export function inviteAcceptTurtle({ authorWebId, recipientWebId, created }) {
  const author = assertTurtleIri(normalizeWebId(authorWebId) || authorWebId);
  const recipient = assertTurtleIri(normalizeWebId(recipientWebId) || recipientWebId);
  return [
    '@prefix schema: <http://schema.org/> .',
    '@prefix podsta: <https://podsta.app/vocab#> .',
    '<> a podsta:InviteAccept ;',
    `  schema:author <${author}> ;`,
    `  schema:recipient <${recipient}> ;`,
    `  schema:dateCreated "${iso(created)}" .`,
  ].join('\n');
}

export function parseInviteAccept(text) {
  if (!text || !/a\s+(?:podsta:InviteAccept|<https:\/\/podsta\.app\/vocab#InviteAccept>)/.test(text)) {
    return null;
  }
  const author = text.match(/author[^<\n]*<([^>\s]+)>/i);
  const recipient = text.match(/recipient[^<\n]*<([^>\s]+)>/i);
  const created = text.match(/dateCreated[^"\n]*"([^"]*)"/i);
  if (!author?.[1] || !recipient?.[1]) return null;
  return {
    kind: 'invite-accept',
    authorWebId: author[1],
    recipientWebId: recipient[1],
    created: created ? created[1] : '',
  };
}

/** What the person who opened the invite still needs to do. */
export function planInviteAccept({ me, inviter, following = false, contact = false }) {
  const target = normalizeWebId(inviter);
  if (!target || !me || samePerson(me, target)) {
    return { follow: false, contact: false, notify: false, webId: '' };
  }
  return {
    follow: !following,
    contact: !contact,
    notify: true,
    webId: target,
  };
}

/** What the inviter's app does when the notice arrives. No second notice. */
export function planInviteReturn({ me, invitee, following = false, contact = false }) {
  const target = normalizeWebId(invitee);
  if (!target || !me || samePerson(me, target)) {
    return { follow: false, contact: false, webId: '' };
  }
  return { follow: !following, contact: !contact, webId: target };
}

export async function sendInviteAccept({
  session,
  targetWebId,
  now = () => new Date().toISOString(),
}) {
  const author = normalizeWebId(session?.info?.webId);
  const recipient = normalizeWebId(targetWebId);
  if (!author) throw new Error('Sign in before using an invite');
  if (!recipient) throw new Error("That doesn't look like an address. Addresses start with https://");
  if (samePerson(author, recipient)) throw new Error('That invite is yours');

  const profile = await resolveProfile(recipient, session.fetch);
  if (!profile.podUrl) {
    return { delivered: false, error: "We couldn't find a pod at that address." };
  }
  const turtle = inviteAcceptTurtle({
    authorWebId: author,
    recipientWebId: recipient,
    created: now(),
  });
  const posted = await postInboxNotice({
    inboxUrl: serverInboxUrl(profile.podUrl),
    fetchFn: session.fetch,
    turtle,
  });
  return {
    delivered: posted.ok,
    error: posted.ok ? '' : `Their inbox responded ${posted.status}`,
  };
}

/**
 * Follow and approve one person, loading the contact list from the pod so a
 * stale screen cannot drop anyone else. `notify` posts the invite notice.
 */
export async function connectPair({
  podUrl,
  session,
  webId,
  discoverability,
  follow = true,
  contact = true,
  notify = false,
  followPerson = addFriend,
  loadContacts = loadContactMembers,
  saveContacts = saveContactMembers,
  sendNotice = sendInviteAccept,
}) {
  const target = normalizeWebId(webId);
  if (!target) throw new Error("That doesn't look like an address. Addresses start with https://");
  let followed = null;
  if (follow) {
    followed = await followPerson({ podUrl, session, webId: target, discoverability });
  }
  let contacts = null;
  if (contact) {
    const current = await loadContacts({ podUrl, session });
    const next = current.some((id) => samePerson(id, target)) ? current : [...current, target];
    contacts = await saveContacts({ podUrl, session, webIds: next });
  }
  let notice = null;
  if (notify) notice = await sendNotice({ session, targetWebId: target });
  return { webId: target, followed, contacts, notice };
}
