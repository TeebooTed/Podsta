import { getSolidDataset, getThing, getStringNoLocale } from '@inrupt/solid-client';
import { resolveProfile } from './friends.js';
import { readPublicIndex } from './publicIndex.js';
import { FOAF, PATHS, SCHEMA } from './vocab.js';
import { withTimeout } from './timeoutFetch.js';
import { safeHttpUrl } from './urls.js';

/**
 * A stranger's view of a person. Reads the WebID only to find the Pod,
 * then the Podsta profile and the public index. Contacts-only posts are
 * not requested. A Hidden or Contacts profile that is not world-readable
 * comes back with profileShared false and no posts.
 */
export async function loadStranger({ webId, fetchFn }) {
  const identity = await resolveProfile(webId, fetchFn);
  const result = {
    webId,
    podUrl: identity.podUrl || '',
    name: '',
    bio: '',
    avatarUrl: '',
    posts: [],
    profileShared: false,
  };
  if (!identity.podUrl) return result;

  const timed = withTimeout(fetchFn || fetch);
  const profileUrl = `${identity.podUrl}${PATHS.profile}`;
  try {
    const ds = await getSolidDataset(profileUrl, { fetch: timed });
    const thing = getThing(ds, profileUrl);
    if (thing) {
      result.profileShared = true;
      result.name = getStringNoLocale(thing, FOAF.name) || '';
      result.bio = getStringNoLocale(thing, SCHEMA.description) || '';
      result.avatarUrl = safeHttpUrl(getStringNoLocale(thing, SCHEMA.image) || '') || '';
    }
  } catch {
    result.profileShared = false;
  }

  try {
    result.posts = await readPublicIndex(identity.podUrl, fetchFn);
  } catch {
    result.posts = [];
  }
  return result;
}
