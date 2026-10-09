import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  setStringNoLocale,
  setUrl,
  getStringNoLocale,
  getUrl,
  deleteFile,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, FOAF, RDF_TYPE } from './vocab.js';
import { makePublic } from './acl.js';
import { isNotFound } from './timeoutFetch.js';
import { safeHttpUrl } from './urls.js';

/**
 * Opt-in directory card. World-readable only while discoverability is Public.
 * There is no central phone book: Discover shows this card when it is reached
 * through someone else's published follow list.
 */

function listingUrl(podUrl) {
  return `${podUrl}${PATHS.listing}`;
}

export async function writeListing({ podUrl, session, ownerWebId, profile }) {
  const url = listingUrl(podUrl);
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  let thing = getThing(ds, url) ?? createThing({ url });
  thing = setUrl(thing, RDF_TYPE, 'http://schema.org/Person');
  thing = setStringNoLocale(thing, FOAF.name, profile?.name || '');
  thing = setStringNoLocale(thing, SCHEMA.description, profile?.bio || '');
  if (ownerWebId) thing = setUrl(thing, SCHEMA.url, ownerWebId);
  const avatar = profile?.avatarUrl ? safeHttpUrl(profile.avatarUrl) : '';
  thing = setStringNoLocale(thing, SCHEMA.image, avatar || '');
  await saveSolidDatasetAt(url, setThing(ds, thing), { fetch: session.fetch });
  await makePublic(url, ownerWebId, session);
}

export async function removeListing({ podUrl, session }) {
  const url = listingUrl(podUrl);
  try {
    await deleteFile(url, { fetch: session.fetch });
  } catch (err) {
    if (!isNotFound(err)) throw err;
  }
  try {
    await deleteFile(`${url}.acl`, { fetch: session.fetch });
  } catch {
    // The card is already gone.
  }
}

/** Null when the person has not opted in, or the card cannot be read. */
export async function readListing(podUrl, fetchFn) {
  if (!podUrl) return null;
  try {
    const url = listingUrl(podUrl);
    const ds = await getSolidDataset(url, { fetch: fetchFn || fetch });
    const thing = getThing(ds, url);
    if (!thing) return null;
    return {
      name: getStringNoLocale(thing, FOAF.name) || '',
      bio: getStringNoLocale(thing, SCHEMA.description) || '',
      webId: getUrl(thing, SCHEMA.url) || '',
      avatarUrl: safeHttpUrl(getStringNoLocale(thing, SCHEMA.image) || '') || '',
      listed: true,
    };
  } catch {
    return null;
  }
}
