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
      'Anyone with your address can see your profile and your public posts. People who follow your friends may spot you too.',
  },
  {
    id: 'contacts',
    label: 'Contacts only',
    description:
      "People you approve can see the posts you share with them. Following you doesn't count as approval. Heads-up: the list of who you've approved can be seen by others, because that's how your pod checks who's allowed in.",
  },
  {
    id: 'hidden',
    label: 'Hidden',
    description:
      "Nobody's told you're here. Only people who already have your address or a direct link can reach you. Your posts stay Only me. Your address itself stays visible, even when your profile is hidden.",
  },
];

export const AUDIENCE_OPTIONS = [
  { id: 'private', label: 'Only me', description: 'Only you can read this post.' },
  {
    id: 'contacts',
    label: 'Contacts',
    description: 'People you have approved can read this post.',
  },
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
