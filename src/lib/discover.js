import { getSolidDataset, getThingAll, getStringNoLocale } from '@inrupt/solid-client';
import { resolveProfile } from './friends.js';
import { PATHS, FOAF } from './vocab.js';
import { withTimeout } from './timeoutFetch.js';

/**
 * Discovery in this beta is manual: copy your WebID, or paste someone else's.
 * There is no community directory until one is hosted on purpose.
 * Friends-of-friends still runs, with a timeout, for people who have published
 * their follow list. Podsta does not publish that list itself.
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
