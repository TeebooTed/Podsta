import { getSolidDataset, getThingAll, getStringNoLocale } from '@inrupt/solid-client';
import { resolveProfile } from './friends.js';
import { PATHS, FOAF } from './vocab.js';

/**
 * User discovery is the trickiest part of a decentralized social network.
 * We support three complementary strategies:
 *
 *   1. STATIC REGISTRY — A community-maintained JSON file hosted on a CDN
 *      (currently a GitHub raw URL) listing public WebIDs. Users opt in by
 *      submitting a PR or issue. This is the easiest discovery path for
 *      newcomers — visible to everyone, no friends required.
 *
 *   2. LOCAL REGISTRY — A bundled fallback list of WebIDs that ship with the
 *      app (defined here). Used when the remote registry is unreachable, and
 *      seeds the directory for new installs.
 *
 *   3. FRIENDS-OF-FRIENDS — For each of your existing friends, fetch their
 *      friends list (which is publicly readable if they've shared it) and
 *      surface anyone you don't know yet. This is how the network grows
 *      organically without a central authority.
 *
 *   4. MANUAL — Paste any WebID URL to add directly. Always works.
 *
 * The DiscoverPage UI exposes all four.
 */

// Replace this URL once you stand up an actual registry repo. The format:
//   [{ "webId": "...", "name": "...", "bio": "...", "avatarUrl": "...", "joinedAt": "YYYY-MM-DD" }, ...]
const REGISTRY_URL = 'https://cdn.jsdelivr.net/gh/podsta-app/registry@main/registry.json';
const REGISTRY_CACHE_KEY = 'podsta_registry_cache_v1';
const REGISTRY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SEED_PROFILES = [
  // These act as a fallback if the remote registry is unreachable.
  // Replace or extend with real public demo accounts.
  {
    webId: 'https://demo.inrupt.net/profile/card#me',
    name: 'Inrupt Demo',
    bio: 'A demonstration Solid Pod for exploring decentralized data.',
    avatarUrl: '',
    joinedAt: '2024-01-01',
  },
];

// Where users go to add themselves to the directory.
export const REGISTRY_SUBMIT_URL =
  'https://github.com/podsta-app/registry/issues/new?template=add-profile.yml';

/**
 * Fetch the community registry, with localStorage caching.
 */
export async function loadRegistry({ bustCache = false } = {}) {
  if (!bustCache) {
    try {
      const raw = localStorage.getItem(REGISTRY_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < REGISTRY_CACHE_TTL) {
          return { profiles: cached.profiles, source: 'cache' };
        }
      }
    } catch {
      localStorage.removeItem(REGISTRY_CACHE_KEY);
    }
  }

  try {
    const res = await fetch(`${REGISTRY_URL}?_=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Registry is not an array');
    localStorage.setItem(
      REGISTRY_CACHE_KEY,
      JSON.stringify({ ts: Date.now(), profiles: data }),
    );
    return { profiles: data, source: 'network' };
  } catch (err) {
    return {
      profiles: SEED_PROFILES,
      source: 'seed',
      error: err.message || 'Could not reach community registry',
    };
  }
}

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

  await Promise.allSettled(
    friends.map(async (friend) => {
      if (!friend.podUrl) return;
      try {
        const ds = fetchFn
          ? await getSolidDataset(`${friend.podUrl}${PATHS.contacts}`, { fetch: fetchFn })
          : await getSolidDataset(`${friend.podUrl}${PATHS.contacts}`);
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
      const profile = await resolveProfile(c.webId, fetchFn);
      return { ...profile, viaName: c.viaName, viaWebId: c.viaWebId };
    }),
  );

  return resolved;
}
