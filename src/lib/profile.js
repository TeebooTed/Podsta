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
  deleteFile,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA, FOAF, PODSTA } from './vocab.js';
import { applyAudience, isPublic } from './acl.js';
import { resolveProfile } from './friends.js';
import { safeHttpUrl } from './urls.js';
import {
  groupDocUrl,
  groupFragment,
  profileAudience,
  resolveLevel,
} from './discoverability.js';
import { ensureContactsGroup } from './contactsGroup.js';
import { makePublic } from './acl.js';

/**
 * Podsta-specific profile data lives at /podsta/profile.ttl. Visibility follows
 * the discoverability setting. A name-only save does not change that ACL.
 * We don't write to the WebID profile card — that needs extra grants and is
 * risky to mess with.
 *
 * If the user has a name set on their WebID profile already (e.g. set during
 * Pod registration), we surface that as a fallback.
 */

function profileUrl(podUrl) {
  return `${podUrl}${PATHS.profile}`;
}

async function withLevel(podUrl, session, fields, stored) {
  const [profilePublic, indexPublic] = await Promise.all([
    isPublic(profileUrl(podUrl), session.fetch),
    isPublic(`${podUrl}${PATHS.publicIndex}`, session.fetch),
  ]);
  const resolved = resolveLevel({ stored, profilePublic, indexPublic });
  return {
    name: fields.name || '',
    bio: fields.bio || '',
    avatarUrl: fields.avatarUrl || '',
    discoverability: resolved.level,
    discoverabilityInferred: resolved.inferred,
  };
}

export async function loadProfile({ podUrl, session }) {
  // Try our podsta-specific profile first.
  try {
    const ds = await getSolidDataset(profileUrl(podUrl), { fetch: session.fetch });
    const thing = getThing(ds, profileUrl(podUrl));
    if (thing) {
      return withLevel(podUrl, session, {
        name: getStringNoLocale(thing, FOAF.name) || '',
        bio: getStringNoLocale(thing, SCHEMA.description) || '',
        avatarUrl: getStringNoLocale(thing, SCHEMA.image) || '',
      }, getStringNoLocale(thing, PODSTA.discoverability) || '');
    }
  } catch {
    // Fall through to WebID-based lookup
  }

  // Fall back to WebID profile.
  if (session?.info?.webId) {
    const fromWebId = await resolveProfile(session.info.webId, session.fetch);
    return withLevel(podUrl, session, {
      name: fromWebId.name === fromWebId.webId ? '' : fromWebId.name,
      bio: '',
      avatarUrl: fromWebId.avatarUrl,
    }, '');
  }
  return withLevel(podUrl, session, { name: '', bio: '', avatarUrl: '' }, '');
}

export async function saveProfile({ podUrl, session, profile, ownerWebId, discoverability }) {
  let ds;
  try {
    ds = await getSolidDataset(profileUrl(podUrl), { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  const avatarUrl = profile.avatarUrl ? safeHttpUrl(profile.avatarUrl) : '';
  if (profile.avatarUrl && !avatarUrl) {
    throw new Error('Avatar URL must be an https URL');
  }

  let thing = getThing(ds, profileUrl(podUrl)) ?? createThing({ url: profileUrl(podUrl) });
  const previousLevel = getStringNoLocale(thing, PODSTA.discoverability) || '';
  thing = setStringNoLocale(thing, FOAF.name, profile.name || '');
  thing = setStringNoLocale(thing, SCHEMA.description, profile.bio || '');
  thing = setStringNoLocale(thing, SCHEMA.image, avatarUrl || '');
  // Only a discoverability save writes this. A name save must leave it, and the ACL, alone.
  if (discoverability) {
    thing = setStringNoLocale(thing, PODSTA.discoverability, discoverability);
  }
  ds = setThing(ds, thing);

  // Keep the dataset the server confirmed. A later revert has to diff against that,
  // not against the copy from before this write.
  ds = await saveSolidDatasetAt(profileUrl(podUrl), ds, { fetch: session.fetch });

  if (!discoverability) return;

  try {
    const audience = profileAudience(discoverability);
    if (audience === 'contacts') {
      await ensureContactsGroup({ podUrl, session });
      await makePublic(groupDocUrl(podUrl), ownerWebId, session);
    }
    await applyAudience([profileUrl(podUrl)], audience, {
      ownerWebId,
      groupUrl: groupFragment(podUrl),
      session,
    });
  } catch (err) {
    // The level is recorded only when the profile ACL matches it.
    // Rewrite the card so a failed ACL cannot leave the new level behind.
    await deleteFile(profileUrl(podUrl), { fetch: session.fetch }).catch(() => {});
    let rebuilt = createSolidDataset();
    let restored = createThing({ url: profileUrl(podUrl) });
    restored = setStringNoLocale(restored, FOAF.name, profile.name || '');
    restored = setStringNoLocale(restored, SCHEMA.description, profile.bio || '');
    restored = setStringNoLocale(restored, SCHEMA.image, avatarUrl || '');
    if (previousLevel) {
      restored = setStringNoLocale(restored, PODSTA.discoverability, previousLevel);
    }
    await saveSolidDatasetAt(profileUrl(podUrl), setThing(rebuilt, restored), { fetch: session.fetch });
    throw err;
  }
}

/**
 * Upload a new avatar image and return its public URL.
 */
export async function uploadAvatar({ podUrl, session, file, ownerWebId, discoverability = 'hidden' }) {
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

  const audience = profileAudience(discoverability);
  if (audience === 'contacts') {
    await ensureContactsGroup({ podUrl, session });
    await makePublic(groupDocUrl(podUrl), ownerWebId, session);
  }
  await applyAudience([avatarUrl], audience, {
    ownerWebId,
    groupUrl: groupFragment(podUrl),
    session,
  });
  return avatarUrl;
}
