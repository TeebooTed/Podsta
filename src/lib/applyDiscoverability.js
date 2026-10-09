import { getSolidDataset } from '@inrupt/solid-client';
import { applyAudience, makePrivate, makePublic } from './acl.js';
import { saveProfile } from './profile.js';
import { ensureContactsGroup } from './contactsGroup.js';
import { setPostAudience } from './posts.js';
import { writeListing, removeListing } from './listing.js';
import { PATHS } from './vocab.js';
import { isNotFound } from './timeoutFetch.js';
import {
  clampAudience,
  currentAudience,
  followListAudience,
  groupDocUrl,
  groupFragment,
  groupShouldBePublic,
  normalizeLevel,
  postsToRewrite,
  profileAudience,
} from './discoverability.js';

/**
 * Apply a discoverability level to the Pod.
 * Posts above the new ceiling are rewritten. Posts below it are left alone,
 * so raising the level does not publish Only me or Contacts posts.
 * The stored level is written last. A failure throws and does not claim success.
 */
async function setExistingAcl(url, audience, ctx) {
  try {
    await getSolidDataset(url, { fetch: ctx.session.fetch });
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
  await applyAudience([url], audience, ctx);
}

export async function applyDiscoverability({ podUrl, session, ownerWebId, level, profile, posts }) {
  if (!normalizeLevel(level)) throw new Error('Unknown discoverability setting');

  const nextAudiences = (posts || []).map((post) => clampAudience(level, currentAudience(post)));
  const publishGroup = groupShouldBePublic(level, nextAudiences);
  const ctx = { ownerWebId, groupUrl: groupFragment(podUrl), session };

  let listingExisted = true;
  try {
    await getSolidDataset(`${podUrl}${PATHS.listing}`, { fetch: session.fetch });
  } catch (err) {
    if (isNotFound(err)) listingExisted = false;
    else throw err;
  }

  await ensureContactsGroup({ podUrl, session });
  if (publishGroup) {
    await makePublic(groupDocUrl(podUrl), ownerWebId, session);
  }

  const changing = postsToRewrite(level, posts || []);
  const failures = [];
  for (const post of changing) {
    try {
      await setPostAudience({
        post,
        audience: clampAudience(level, currentAudience(post)),
        level,
        podUrl,
        ownerWebId,
        session,
      });
    } catch (err) {
      failures.push(err);
    }
  }

  const steps = [];
  steps.push(
    setExistingAcl(`${podUrl}${PATHS.publicIndex}`, level === 'public' ? 'public' : 'private', ctx),
  );
  steps.push(
    setExistingAcl(
      `${podUrl}${PATHS.contactsIndex}`,
      nextAudiences.includes('contacts') ? 'contacts' : 'private',
      ctx,
    ),
  );
  if (profile?.avatarUrl && profile.avatarUrl.startsWith(podUrl)) {
    steps.push(applyAudience([profile.avatarUrl], profileAudience(level), ctx));
  }
  steps.push(setExistingAcl(`${podUrl}${PATHS.contacts}`, followListAudience(level), ctx));
  steps.push(
    level === 'public'
      ? writeListing({ podUrl, session, ownerWebId, profile })
      : removeListing({ podUrl, session }),
  );
  if (!publishGroup) {
    steps.push(makePrivate(groupDocUrl(podUrl), ownerWebId, session));
  }

  const settled = await Promise.allSettled(steps);
  const stepFailures = settled.filter((result) => result.status === 'rejected');
  if (failures.length || stepFailures.length) {
    const first = failures[0]?.message || stepFailures[0]?.reason?.message || 'unknown';
    const failed = failures.length + stepFailures.length;
    const total = changing.length + steps.length;
    if (failed === total) throw new Error(`Failed to update discoverability: ${first}`);
    throw new Error(`Discoverability incomplete (${failed} of ${total} failed): ${first}`);
  }

  try {
    await saveProfile({
      podUrl,
      session,
      ownerWebId,
      profile,
      discoverability: level,
    });
  } catch (err) {
    // A failed save must not leave a new public listing behind.
    if (!listingExisted) await removeListing({ podUrl, session }).catch(() => {});
    throw err;
  }
}
