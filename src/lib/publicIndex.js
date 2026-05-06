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
import { makePublic } from './acl.js';

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

function indexUrl(podUrl) {
  return `${podUrl}${PATHS.publicIndex}`;
}

function entryThingUrl(podUrl, postUrl) {
  // Stable, idempotent identifier — re-sharing the same post overwrites the entry.
  return `${indexUrl(podUrl)}#${encodeURIComponent(postUrl)}`;
}

/**
 * Read the public index for a given pod. Anyone can call this — it requires
 * no auth. Returns an array of { url, type, dateCreated, title, caption }.
 *
 * Pass `fetchFn` to use authenticated fetch (slightly higher rate limits on
 * some providers); omit it for anonymous fetch.
 */
export async function readPublicIndex(podUrl, fetchFn) {
  try {
    const ds = fetchFn
      ? await getSolidDataset(indexUrl(podUrl), { fetch: fetchFn })
      : await getSolidDataset(indexUrl(podUrl));
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
    // 404 → user has no public posts yet → empty list, not an error.
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    throw err;
  }
}

/**
 * Add or update an entry in the user's public index, then ensure the index
 * file itself is publicly readable.
 */
export async function addToPublicIndex(podUrl, entry, ownerWebId, session) {
  let ds;
  try {
    ds = await getSolidDataset(indexUrl(podUrl), { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  const thingUrl = entryThingUrl(podUrl, entry.url);
  let thing = getThing(ds, thingUrl) ?? createThing({ url: thingUrl });
  thing = setStringNoLocale(thing, SCHEMA.url, entry.url);
  thing = setStringNoLocale(thing, PODSTA.PostType, entry.type);
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, entry.dateCreated || new Date().toISOString());
  if (entry.title) thing = setStringNoLocale(thing, SCHEMA.name, entry.title);
  if (entry.caption) thing = setStringNoLocale(thing, SCHEMA.caption, entry.caption);

  ds = setThing(ds, thing);
  await saveSolidDatasetAt(indexUrl(podUrl), ds, { fetch: session.fetch });

  // First-time: ensure the index file itself is publicly readable.
  // (Re-running this is harmless — it just overwrites the ACL with the same content.)
  await makePublic(indexUrl(podUrl), ownerWebId, session);
}

/**
 * Remove an entry from the public index (called when a post is unshared or deleted).
 */
export async function removeFromPublicIndex(podUrl, postUrl, session) {
  let ds;
  try {
    ds = await getSolidDataset(indexUrl(podUrl), { fetch: session.fetch });
  } catch {
    return; // No index → nothing to remove.
  }

  const thingUrl = entryThingUrl(podUrl, postUrl);
  const thing = getThing(ds, thingUrl);
  if (!thing) return;

  ds = removeThing(ds, thing);
  await saveSolidDatasetAt(indexUrl(podUrl), ds, { fetch: session.fetch });
}
