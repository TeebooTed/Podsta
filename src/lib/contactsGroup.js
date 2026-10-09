import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  getUrlAll,
  addUrl,
  removeUrl,
  setUrl,
  createContainerAt,
} from '@inrupt/solid-client';
import { RDF_TYPE, VCARD } from './vocab.js';
import { contactIris, groupDocUrl, groupFragment } from './discoverability.js';
import { normalizeWebId } from './webId.js';
import { isNotFound } from './timeoutFetch.js';

/**
 * Approved contacts live in a vcard:Group at podsta/contacts/group.ttl#contacts.
 * WAC rules point at that group with acl:agentGroup.
 * This is not the follow list. Following someone does not add them here.
 */

async function ensureContactsContainer(podUrl, session) {
  const container = `${podUrl}podsta/contacts/`;
  try {
    await createContainerAt(container, { fetch: session.fetch });
  } catch {
    // Already there, or the server does not need an explicit container.
  }
}

async function loadGroupDataset(podUrl, session) {
  const doc = groupDocUrl(podUrl);
  try {
    const ds = await getSolidDataset(doc, { fetch: session.fetch });
    return { ds, doc, missing: false };
  } catch (err) {
    if (!isNotFound(err)) throw err;
    return { ds: createSolidDataset(), doc, missing: true };
  }
}

export async function loadContactMembers({ podUrl, session }) {
  try {
    const ds = await getSolidDataset(groupDocUrl(podUrl), { fetch: session.fetch });
    const thing = getThing(ds, groupFragment(podUrl));
    if (!thing) return [];
    return getUrlAll(thing, VCARD.hasMember);
  } catch (err) {
    if (isNotFound(err)) return [];
    throw err;
  }
}

export async function saveContactMembers({ podUrl, session, webIds }) {
  await ensureContactsContainer(podUrl, session);
  const { ds, doc } = await loadGroupDataset(podUrl, session);
  const thingUrl = groupFragment(podUrl);
  let thing = getThing(ds, thingUrl) ?? createThing({ url: thingUrl });
  thing = setUrl(thing, RDF_TYPE, VCARD.Group);

  const next = contactIris(
    (webIds || []).map((id) => normalizeWebId(id)).filter(Boolean),
  );
  const existing = getUrlAll(thing, VCARD.hasMember);
  for (const url of existing) {
    if (!next.includes(url)) thing = removeUrl(thing, VCARD.hasMember, url);
  }
  for (const url of next) {
    if (!existing.includes(url)) thing = addUrl(thing, VCARD.hasMember, url);
  }

  await saveSolidDatasetAt(doc, setThing(ds, thing), { fetch: session.fetch });
  return next;
}

export async function ensureContactsGroup({ podUrl, session }) {
  const { missing } = await loadGroupDataset(podUrl, session);
  if (!missing) return;
  await saveContactMembers({ podUrl, session, webIds: [] });
}
