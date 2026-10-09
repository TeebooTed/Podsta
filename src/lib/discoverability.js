import { PATHS } from './vocab.js';
import { assertTurtleIri } from './urls.js';

/**
 * Who can find this profile, and the ceiling for per-post visibility.
 *
 * hidden   — not listed. Posts stay Only me.
 * contacts — approved people can read shared posts. Not a follow-list grant.
 * public   — profile, follow list, and listing are world-readable.
 *
 * A new profile starts hidden. Raising the level does not publish posts
 * that were Only me or Contacts. Lowering it rewrites anything more open.
 *
 * Contacts-only cannot hide the WebID document. That file lives on the
 * identity provider and is almost always world-readable.
 */

export const LEVELS = ['hidden', 'contacts', 'public'];
export const AUDIENCES = ['private', 'contacts', 'public'];
export const DEFAULT_LEVEL = 'hidden';

const RANK = { private: 0, contacts: 1, public: 2 };
const CEILING = { hidden: 0, contacts: 1, public: 2 };

export const LEVEL_OPTIONS = [
  {
    id: 'public',
    label: 'Public',
    description:
      'Listed for people who can reach a public follow list. Anyone with your WebID can read your profile and your public posts. Podsta has no central phone book.',
  },
  {
    id: 'contacts',
    label: 'Contacts only',
    description:
      'Only people you explicitly approve can discover your shared posts. Following someone does not approve them. While this is on, the approved list is world-readable, because Solid checks that group file to decide who may read.',
  },
  {
    id: 'hidden',
    label: 'Hidden',
    description:
      'Not listed. Reachable only by someone who already has your WebID or a direct link. Your WebID document stays on your identity provider and is usually still readable.',
  },
];

export const AUDIENCE_OPTIONS = [
  { id: 'private', label: 'Only me', description: 'Only you can read this post.' },
  { id: 'contacts', label: 'Contacts', description: 'People you have approved can read this post.' },
  { id: 'public', label: 'Public', description: 'Anyone can read this post.' },
];

export function groupDocUrl(podUrl) {
  return `${podUrl}${PATHS.contactsGroup}`;
}

export function groupFragment(podUrl) {
  return `${groupDocUrl(podUrl)}#contacts`;
}

export function normalizeLevel(value) {
  return LEVELS.includes(value) ? value : null;
}

export function normalizeAudience(value) {
  return AUDIENCES.includes(value) ? value : null;
}

export function audienceAllowed(level, audience) {
  const ceiling = CEILING[level];
  const rank = RANK[audience];
  if (ceiling == null || rank == null) return false;
  return rank <= ceiling;
}

/** Drop a post audience that sits above the profile ceiling. */
export function clampAudience(level, audience) {
  const current = normalizeAudience(audience) || 'private';
  if (audienceAllowed(level, current)) return current;
  if (level === 'contacts') return 'contacts';
  return 'private';
}

export function currentAudience(post) {
  return normalizeAudience(post?.audience) || (post?.isPublic ? 'public' : 'private');
}

export function postsToRewrite(level, posts) {
  return (posts || []).filter(
    (post) => clampAudience(level, currentAudience(post)) !== currentAudience(post),
  );
}

/**
 * World-read wins. A stored "public" tag is ignored when the ACL is not public,
 * so a failed share cannot look successful. Contacts is only trusted when the
 * file is not world-readable.
 */
export function effectiveAudience({ stored, isPublic }) {
  if (isPublic) return 'public';
  if (normalizeAudience(stored) === 'contacts') return 'contacts';
  return 'private';
}

/**
 * No stored level: a profile or public index that is already world-readable
 * stays Public, so an upgrade does not quietly unpublish. Otherwise Hidden.
 */
export function resolveLevel({ stored, profilePublic, indexPublic }) {
  const known = normalizeLevel(stored);
  if (known) return { level: known, inferred: false };
  if (profilePublic || indexPublic) return { level: 'public', inferred: true };
  return { level: DEFAULT_LEVEL, inferred: true };
}

/** Profile document and avatar follow the level. The follow list does not. */
export function profileAudience(level) {
  if (level === 'public') return 'public';
  if (level === 'contacts') return 'contacts';
  return 'private';
}

/** Who you follow is published only when the profile itself is public. */
export function followListAudience(level) {
  return level === 'public' ? 'public' : 'private';
}

/**
 * Community Solid servers read the group document as the requester.
 * It has to be world-readable whenever an ACL points at the group.
 * Membership is then not a secret.
 */
export function groupShouldBePublic(level, audiences) {
  if (level === 'contacts') return true;
  return (audiences || []).some((audience) => audience === 'contacts');
}

export function ceilingNote(level) {
  if (level === 'hidden') {
    return 'Your profile is Hidden. Change discoverability on your profile to share.';
  }
  if (level === 'contacts') {
    return 'Your profile is Contacts only, so a public post is not available.';
  }
  return '';
}

export function composerChoices(level) {
  const resolved = normalizeLevel(level) || DEFAULT_LEVEL;
  return AUDIENCE_OPTIONS.map((option) => ({
    ...option,
    enabled: audienceAllowed(resolved, option.id),
  }));
}

/** Checked WebIDs safe to write into the group document. */
export function contactIris(webIds, assertIri = assertTurtleIri) {
  const seen = new Set();
  const out = [];
  for (const raw of webIds || []) {
    if (!raw || seen.has(raw)) continue;
    seen.add(raw);
    out.push(assertIri(raw));
  }
  return out;
}
