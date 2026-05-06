import { readPublicIndex } from './publicIndex.js';
import { resolveProfile } from './friends.js';

/**
 * Build the friend feed by reading each friend's public-index.ttl in parallel,
 * then resolving any missing profile metadata.
 *
 * This is the cross-pod glue that finally makes the social network work:
 *   1. For each friend, fetch their public index (a single small Turtle file).
 *   2. Each entry in the index is denormalized — it already has the URL, type,
 *      title, caption, and timestamp. So in the typical case we DON'T need to
 *      fetch the full post content to render the feed card. Photos are loaded
 *      via <img src> directly using their public URL.
 *   3. Merge all entries, sort by date, return.
 *
 * Failures on individual friends are isolated — if Bob's pod is offline, you
 * still see Alice's posts.
 */
export async function loadFriendFeed({ friends, session }) {
  if (!friends?.length) return [];

  const perFriendResults = await Promise.allSettled(
    friends.map(async (friend) => {
      // We need a pod URL to read the index. If it's missing from our cache,
      // re-resolve the profile.
      let podUrl = friend.podUrl;
      if (!podUrl) {
        const profile = await resolveProfile(friend.webId, session?.fetch);
        podUrl = profile.podUrl;
        if (!podUrl) return [];
      }

      const entries = await readPublicIndex(podUrl, session?.fetch);
      return entries.map((entry) => ({
        ...entry,
        ownerWebId: friend.webId,
        ownerName: friend.name || friend.webId,
        ownerAvatar: friend.avatarUrl || '',
        ownerPodUrl: podUrl,
      }));
    }),
  );

  const all = perFriendResults
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value);

  return all.sort((a, b) => (b.dateCreated || '').localeCompare(a.dateCreated || ''));
}
