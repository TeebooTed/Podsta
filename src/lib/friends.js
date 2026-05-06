import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  removeThing,
  getThing,
  getThingAll,
  setStringNoLocale,
  getStringNoLocale,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, FOAF } from './vocab.js';
import { getPodUrlAll } from '@inrupt/solid-client';

/**
 * Friends are stored as a Turtle file in the user's own pod listing WebIDs
 * they follow. Each entry caches the friend's display name, avatar, and
 * pod URL to avoid re-resolving on every render — call refreshFriend() to
 * update if a friend changes their profile.
 */

function friendsUrl(podUrl) {
  return `${podUrl}${PATHS.contacts}`;
}

function friendThingUrl(podUrl, webId) {
  return `${friendsUrl(podUrl)}#${encodeURIComponent(webId)}`;
}

/**
 * Normalize a WebID — accept bare URLs and add #me if missing.
 */
export function normalizeWebId(input) {
  if (!input) return null;
  let s = input.trim();
  if (!s.startsWith('http://') && !s.startsWith('https://')) {
    s = 'https://' + s;
  }
  // Common pattern: profiles live at /profile/card#me
  if (!s.includes('#') && s.includes('/profile/card')) {
    s = s + '#me';
  }
  return s;
}

/**
 * Load a stranger's profile (display name + avatar + pod URL) from their WebID.
 * Used both when adding a friend and when rendering friend feed cards.
 */
export async function resolveProfile(webId, fetchFn) {
  try {
    const ds = fetchFn
      ? await getSolidDataset(webId, { fetch: fetchFn })
      : await getSolidDataset(webId);
    const thing = getThing(ds, webId);
    const name =
      (thing && (getStringNoLocale(thing, FOAF.name) || getStringNoLocale(thing, SCHEMA.name))) ||
      webId.split('/').filter(Boolean).slice(-2)[0] ||
      'Unknown';
    const avatarUrl = (thing && getStringNoLocale(thing, SCHEMA.image)) || '';

    let podUrl = null;
    try {
      const pods = fetchFn
        ? await getPodUrlAll(webId, { fetch: fetchFn })
        : await getPodUrlAll(webId);
      podUrl = pods[0] || null;
    } catch {
      // Some WebIDs don't expose pim:storage; fall back to deriving from WebID.
      try {
        const u = new URL(webId);
        podUrl = `${u.protocol}//${u.host}/`;
      } catch {
        podUrl = null;
      }
    }

    return { webId, name, avatarUrl, podUrl };
  } catch {
    return { webId, name: webId, avatarUrl: '', podUrl: null };
  }
}

export async function loadFriends({ podUrl, session }) {
  let ds;
  try {
    ds = await getSolidDataset(friendsUrl(podUrl), { fetch: session.fetch });
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    throw err;
  }

  return getThingAll(ds)
    .map((t) => ({
      webId: getStringNoLocale(t, FOAF.knows) || '',
      name: getStringNoLocale(t, FOAF.name) || '',
      avatarUrl: getStringNoLocale(t, SCHEMA.image) || '',
      podUrl: getStringNoLocale(t, SCHEMA.url) || '',
    }))
    .filter((f) => f.webId);
}

export async function addFriend({ podUrl, session, webId }) {
  const normalized = normalizeWebId(webId);
  if (!normalized) throw new Error('Invalid WebID');
  if (normalized === session.info.webId) {
    throw new Error("That's your own WebID");
  }

  // Resolve their profile so we can cache name/avatar/pod.
  const profile = await resolveProfile(normalized, session.fetch);

  let ds;
  try {
    ds = await getSolidDataset(friendsUrl(podUrl), { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  const thingUrl = friendThingUrl(podUrl, normalized);
  let thing = createThing({ url: thingUrl });
  thing = setStringNoLocale(thing, FOAF.knows, normalized);
  if (profile.name) thing = setStringNoLocale(thing, FOAF.name, profile.name);
  if (profile.avatarUrl) thing = setStringNoLocale(thing, SCHEMA.image, profile.avatarUrl);
  if (profile.podUrl) thing = setStringNoLocale(thing, SCHEMA.url, profile.podUrl);
  ds = setThing(ds, thing);

  await saveSolidDatasetAt(friendsUrl(podUrl), ds, { fetch: session.fetch });
  return profile;
}

export async function removeFriend({ podUrl, session, webId }) {
  let ds;
  try {
    ds = await getSolidDataset(friendsUrl(podUrl), { fetch: session.fetch });
  } catch {
    return;
  }
  const thingUrl = friendThingUrl(podUrl, webId);
  const thing = getThing(ds, thingUrl);
  if (!thing) return;
  ds = removeThing(ds, thing);
  await saveSolidDatasetAt(friendsUrl(podUrl), ds, { fetch: session.fetch });
}
