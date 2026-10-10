import { useEffect, useState } from 'react';
import {
  loadLikeSet,
  loadOwnLikes,
  presentLikes,
  refreshOwnedLikeSets,
  setOwnLike,
} from '../lib/likes.js';
import { samePerson } from '../lib/webId.js';

/**
 * Own likes come from this Pod. Counts come from the author's published list.
 */
export function useLikes({ enabled, session, podUrl, webId, posts }) {
  const [entries, setEntries] = useState([]);
  const [sets, setSets] = useState({});
  const [busyUrl, setBusyUrl] = useState('');
  const postKey = (posts || []).map((post) => `${post.url}|${post.ownerPodUrl || ''}|${post.ownerWebId || ''}`).join('\n');

  useEffect(() => {
    if (!enabled || !session?.fetch || !podUrl || !webId) {
      setEntries([]);
      setSets({});
      return undefined;
    }
    let closed = false;
    (async () => {
      try {
        const own = await loadOwnLikes(podUrl, session.fetch);
        if (closed) return;
        setEntries(own);
        const mine = (posts || []).filter(
          (post) => post?.url && (!post.ownerWebId || samePerson(post.ownerWebId, webId)),
        );
        if (mine.length) {
          await refreshOwnedLikeSets({
            podUrl,
            session,
            posts: mine.slice(0, 12),
            ownEntries: own,
          }).catch(() => {});
        }
        const next = {};
        for (const post of (posts || []).slice(0, 12)) {
          if (!post?.url) continue;
          const ownerPod = post.ownerPodUrl || (samePerson(post.ownerWebId, webId) || !post.ownerWebId ? podUrl : '');
          if (!ownerPod) continue;
          next[post.url] = await loadLikeSet({
            ownerPodUrl: ownerPod,
            postUrl: post.url,
            fetchFn: session.fetch,
          });
        }
        if (!closed) setSets(next);
      } catch {
        // A failed read keeps whatever was already on screen.
      }
    })();
    return () => {
      closed = true;
    };
    // postKey stands in for the post list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session, podUrl, webId, postKey]);

  const view = (post) =>
    presentLikes({
      webIds: sets[post?.url]?.webIds || [],
      readable: Boolean(sets[post?.url]?.readable),
      mine: entries.some((entry) => entry.postUrl === post?.url),
      me: webId,
    });

  const toggle = async (post) => {
    if (!post?.url || busyUrl) return null;
    const liked = !entries.some((entry) => entry.postUrl === post.url);
    setBusyUrl(post.url);
    try {
      const result = await setOwnLike({
        podUrl,
        session,
        post: { ...post, ownerWebId: post.ownerWebId || webId },
        ownerPodUrl: post.ownerPodUrl,
        liked,
      });
      setEntries(result.entries);
      const ownerPod = post.ownerPodUrl || podUrl;
      const published = await loadLikeSet({
        ownerPodUrl: ownerPod,
        postUrl: post.url,
        fetchFn: session.fetch,
      });
      setSets((previous) => ({ ...previous, [post.url]: published }));
      return result;
    } finally {
      setBusyUrl('');
    }
  };

  return { view, toggle, busyUrl };
}
