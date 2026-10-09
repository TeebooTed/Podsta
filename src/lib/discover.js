import { getSolidDataset, getThingAll, getStringNoLocale } from '@inrupt/solid-client';
import { resolveProfile } from './friends.js';
import { PATHS, FOAF } from './vocab.js';
import { withTimeout } from './timeoutFetch.js';
import { readListing } from './listing.js';

/**
 * Discovery is by WebID, plus people reached through a published follow list.
 * A public profile opts into a listing card. There is no central phone book.
 * Hidden and contacts profiles do not publish the follow list.
 */

/**
 * Friends-of-friends discovery. For each of your friends, read their
 * publicly-shared friends.ttl (if any) and collect any WebIDs you don't
 * already follow.
 *
 * Capped at `limit` results to avoid runaway fetches in dense networks.
 */
export async function discoverViaFriends({ friends, ownWebId, fetchFn, limit = 12 }) {
  if (!friends?.length) return [];

  const known = new Set([ownWebId, ...friends.map((f) => f.webId)]);
  const candidates = [];

  const timed = withTimeout(fetchFn || fetch);
  await Promise.allSettled(
    friends.map(async (friend) => {
      if (!friend.podUrl) return;
      try {
        const ds = await getSolidDataset(`${friend.podUrl}${PATHS.contacts}`, { fetch: timed });
        getThingAll(ds).forEach((t) => {
          const webId = getStringNoLocale(t, FOAF.knows);
          if (webId && !known.has(webId)) {
            known.add(webId);
            candidates.push({ webId, viaName: friend.name, viaWebId: friend.webId });
          }
        });
      } catch {
        // Friend's contacts list isn't public — that's fine, just skip.
      }
    }),
  );

  // Resolve profiles for the first N candidates so the UI can render cards.
  const resolved = await Promise.all(
    candidates.slice(0, limit).map(async (c) => {
      const profile = await resolveProfile(c.webId, timed);
      return { ...profile, viaName: c.viaName, viaWebId: c.viaWebId };
    }),
  );

  return resolved;
}

/**
 * Directory cards for people already reached through a published follow list.
 * Someone with a public profile still does not appear unless that path exists.
 */
export async function listingsFor(people, fetchFn) {
  const listed = [];
  for (const person of people || []) {
    if (!person.podUrl) continue;
    const card = await readListing(person.podUrl, fetchFn);
    if (!card) continue;
    listed.push({
      ...person,
      name: card.name || person.name,
      bio: card.bio || '',
      avatarUrl: card.avatarUrl || person.avatarUrl,
    });
  }
  return listed;
}
