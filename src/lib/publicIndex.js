import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  removeThing,
  getThingAll,
  setStringNoLocale,
  getStringNoLocale,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, PODSTA } from './vocab.js';
import { makeGroupReadable, makePublic } from './acl.js';
import { withTimeout } from './timeoutFetch.js';

/**
 * THE KEY INSIGHT for cross-pod feeds:
 *
 * On Solid, you can make individual files public (e.g. /podsta/photos/abc.jpg),
 * but you CANNOT necessarily list a container's contents to the public — that's
 * controlled by the container's own ACL, which most pod servers don't expose
 * publicly by default. So even if Alice's photos are individually public,
 * Bob has no way to ENUMERATE them.
 *
 * Our solution: every user maintains a single `public-index.ttl` file in their
 * pod that LISTS the URLs of all their public posts. This file itself is public-
 * readable, so any authenticated or anonymous visitor can fetch it and discover
 * what to load. When you share a post, we add it here. When you unshare, we
 * remove it.
 *
 * Each entry in the index records:
 *   - url:        The post resource URL
 *   - type:       "photo" | "text"
 *   - dateCreated: ISO timestamp (for sorting)
 *   - title:      For text posts, an optional title
 *   - caption:    For photos, the caption (denormalized for speed; saves a fetch)
 */

function indexUrl(podUrl, path = PATHS.publicIndex) {
  return `${podUrl}${path}`;
}

function entryThingUrl(podUrl, postUrl, path = PATHS.publicIndex) {
  // Stable, idempotent identifier — re-sharing the same post overwrites the entry.
  return `${indexUrl(podUrl, path)}#${encodeURIComponent(postUrl)}`;
}

/**
 * Read the public index for a given pod. Anyone can call this — it requires
 * no auth. Returns an array of { url, type, dateCreated, title, caption }.
 *
 * Pass `fetchFn` to use authenticated fetch (slightly higher rate limits on
 * some providers); omit it for anonymous fetch.
 */
async function readIndex(podUrl, path, fetchFn) {
  const timed = withTimeout(fetchFn || fetch);
  try {
    const ds = await getSolidDataset(indexUrl(podUrl, path), { fetch: timed });
    return getThingAll(ds)
      .map((t) => ({
        url: getStringNoLocale(t, SCHEMA.url) || '',
        type: getStringNoLocale(t, PODSTA.PostType) || 'photo',
        dateCreated: getStringNoLocale(t, SCHEMA.dateCreated) || '',
        title: getStringNoLocale(t, SCHEMA.name) || '',
        caption: getStringNoLocale(t, SCHEMA.caption) || '',
      }))
      .filter((e) => e.url)
      .sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
  } catch (err) {
    // 404 → nothing listed yet → empty list, not an error.
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    throw err;
  }
}

export async function readPublicIndex(podUrl, fetchFn) {
  return readIndex(podUrl, PATHS.publicIndex, fetchFn);
}

/**
 * Contacts-only posts. A 401/403 means the viewer is not in the group:
 * that is an empty list for them, not a sign that the Pod is offline.
 * Timeouts and other failures still throw so the caller can decide.
 */
export async function readContactsIndex(podUrl, fetchFn) {
  try {
    return await readIndex(podUrl, PATHS.contactsIndex, fetchFn);
  } catch (err) {
    const status = err?.statusCode || err?.response?.status;
    if (status === 401 || status === 403) return [];
    throw err;
  }
}

/**
 * Add or update an entry in the user's public index, then ensure the index
 * file itself is publicly readable.
 */
async function addToIndex(podUrl, path, entry, session, lock) {
  const url = indexUrl(podUrl, path);
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  const thingUrl = entryThingUrl(podUrl, entry.url, path);
  let thing = getThing(ds, thingUrl) ?? createThing({ url: thingUrl });
  thing = setStringNoLocale(thing, SCHEMA.url, entry.url);
  thing = setStringNoLocale(thing, PODSTA.PostType, entry.type);
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, entry.dateCreated || new Date().toISOString());
  // Always write title and caption, including empty strings, so an edit can clear them.
  thing = setStringNoLocale(thing, SCHEMA.name, entry.title || '');
  thing = setStringNoLocale(thing, SCHEMA.caption, entry.caption || '');

  ds = setThing(ds, thing);
  await saveSolidDatasetAt(url, ds, { fetch: session.fetch });
  await lock(url);
}

export async function addToPublicIndex(podUrl, entry, ownerWebId, session) {
  await addToIndex(podUrl, PATHS.publicIndex, entry, session, (url) =>
    makePublic(url, ownerWebId, session),
  );
}

export async function addToContactsIndex(podUrl, entry, ownerWebId, groupUrl, session) {
  await addToIndex(podUrl, PATHS.contactsIndex, entry, session, (url) =>
    makeGroupReadable(url, ownerWebId, groupUrl, session),
  );
}

/**
 * Remove an entry from the public index (called when a post is unshared or deleted).
 */
async function removeFromIndex(podUrl, path, postUrl, session) {
  const url = indexUrl(podUrl, path);
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    return; // No index → nothing to remove.
  }

  const thingUrl = entryThingUrl(podUrl, postUrl, path);
  const thing = getThing(ds, thingUrl);
  if (!thing) return;

  ds = removeThing(ds, thing);
  await saveSolidDatasetAt(url, ds, { fetch: session.fetch });
}

export async function removeFromPublicIndex(podUrl, postUrl, session) {
  await removeFromIndex(podUrl, PATHS.publicIndex, postUrl, session);
}

export async function removeFromContactsIndex(podUrl, postUrl, session) {
  await removeFromIndex(podUrl, PATHS.contactsIndex, postUrl, session);
}
