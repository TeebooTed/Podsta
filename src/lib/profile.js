import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThing,
  setStringNoLocale,
  getStringNoLocale,
  saveFileInContainer,
  createContainerAt,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, FOAF } from './vocab.js';
import { makePublic } from './acl.js';
import { resolveProfile } from './friends.js';

/**
 * Podsta-specific profile data lives at /podsta/profile.ttl and is publicly
 * readable so other users can see your name/bio/avatar. We don't write to the
 * user's WebID profile card directly — that requires extra ACL grants on most
 * pod servers and is risky to mess with.
 *
 * If the user has a name set on their WebID profile already (e.g. set during
 * Pod registration), we surface that as a fallback.
 */

function profileUrl(podUrl) {
  return `${podUrl}${PATHS.profile}`;
}

export async function loadProfile({ podUrl, session }) {
  // Try our podsta-specific profile first.
  try {
    const ds = await getSolidDataset(profileUrl(podUrl), { fetch: session.fetch });
    const thing = getThing(ds, profileUrl(podUrl));
    if (thing) {
      return {
        name: getStringNoLocale(thing, FOAF.name) || '',
        bio: getStringNoLocale(thing, SCHEMA.description) || '',
        avatarUrl: getStringNoLocale(thing, SCHEMA.image) || '',
      };
    }
  } catch {
    // Fall through to WebID-based lookup
  }

  // Fall back to WebID profile.
  if (session?.info?.webId) {
    const fromWebId = await resolveProfile(session.info.webId, session.fetch);
    return {
      name: fromWebId.name === fromWebId.webId ? '' : fromWebId.name,
      bio: '',
      avatarUrl: fromWebId.avatarUrl,
    };
  }
  return { name: '', bio: '', avatarUrl: '' };
}

export async function saveProfile({ podUrl, session, profile, ownerWebId }) {
  let ds;
  try {
    ds = await getSolidDataset(profileUrl(podUrl), { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  let thing = getThing(ds, profileUrl(podUrl)) ?? createThing({ url: profileUrl(podUrl) });
  thing = setStringNoLocale(thing, FOAF.name, profile.name || '');
  thing = setStringNoLocale(thing, SCHEMA.description, profile.bio || '');
  thing = setStringNoLocale(thing, SCHEMA.image, profile.avatarUrl || '');
  ds = setThing(ds, thing);

  await saveSolidDatasetAt(profileUrl(podUrl), ds, { fetch: session.fetch });

  // Make profile publicly readable so friends and discovery can see it.
  await makePublic(profileUrl(podUrl), ownerWebId, session);
}

/**
 * Upload a new avatar image and return its public URL.
 */
export async function uploadAvatar({ podUrl, session, file, ownerWebId }) {
  const container = `${podUrl}podsta/avatars/`;
  try {
    await createContainerAt(container, { fetch: session.fetch });
  } catch {
    // Probably exists.
  }

  const ext = file.type.split('/')[1] || 'jpg';
  const slug = `avatar-${Date.now()}.${ext}`;
  const saved = await saveFileInContainer(container, file, {
    slug,
    contentType: file.type,
    fetch: session.fetch,
  });
  const avatarUrl = saved?.internal_resourceInfo?.sourceIri;
  if (!avatarUrl) throw new Error('Avatar upload failed');

  await makePublic(avatarUrl, ownerWebId, session);
  return avatarUrl;
}
