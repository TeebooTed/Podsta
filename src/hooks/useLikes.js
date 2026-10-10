import { useEffect, useRef, useState } from 'react';
import {
  loadLikeSet,
  loadOwnLikes,
  presentLikes,
  refreshOwnedLikeSets,
  setOwnLike,
} from '../lib/likes.js';
import { samePerson } from '../lib/webId.js';
import { isBlocked, loadBlocks } from '../lib/blocks.js';

const ownReads = new Map();

function readOwnLikes(podUrl, fetchFn) {
  const current = ownReads.get(podUrl);
  if (current) return current;
  const pending = loadOwnLikes(podUrl, fetchFn).finally(() => {
    if (ownReads.get(podUrl) === pending) ownReads.delete(podUrl);
  });
  ownReads.set(podUrl, pending);
  return pending;
}

/**
 * Own likes come from this Pod. Counts come from the author's published list.
 */
export function useLikes({ enabled, session, podUrl, webId, posts, blockRevision = 0 }) {
  const [entries, setEntries] = useState([]);
  const [entriesConfirmed, setEntriesConfirmed] = useState(false);
  const [blocked, setBlocked] = useState([]);
  const [sets, setSets] = useState({});
  const [busyUrl, setBusyUrl] = useState('');
  const generation = useRef(0);
  const postKey = (posts || []).map((post) => `${post.url}|${post.ownerPodUrl || ''}|${post.ownerWebId || ''}`).join('\n');

  useEffect(() => {
    if (!enabled || !session?.fetch || !podUrl || !webId) {
      setEntries([]);
      setEntriesConfirmed(false);
      setSets({});
      return undefined;
    }
    let closed = false;
    const seen = generation.current;
    (async () => {
      try {
        let own;
        try {
          own = await readOwnLikes(podUrl, session.fetch);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          if (closed || seen !== generation.current) return;
          own = await readOwnLikes(podUrl, session.fetch);
        }
        if (closed || seen !== generation.current) return;
        setEntries(own);
        setEntriesConfirmed(true);
        try {
          const blocks = await loadBlocks(podUrl, session.fetch);
          if (!closed && seen === generation.current) setBlocked(blocks);
        } catch {
          // A missed block list must not be treated as "nobody is blocked".
        }
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
        if (!closed && seen === generation.current) setSets(next);
      } catch {
        // A failed read keeps whatever was already on screen.
      }
    })();
    return () => {
      closed = true;
    };
    // postKey stands in for the post list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session, podUrl, webId, postKey, blockRevision]);

  const view = (post) =>
    presentLikes({
      webIds: (sets[post?.url]?.webIds || []).filter((id) => !isBlocked(id, blocked)),
      readable: Boolean(sets[post?.url]?.readable),
      mine: entries.some((entry) => entry.postUrl === post?.url),
      me: webId,
    });

  const toggle = async (post) => {
    if (!post?.url || busyUrl) return null;
    const liked = !entries.some((entry) => entry.postUrl === post.url);
    generation.current += 1;
    setBusyUrl(post.url);
    try {
      const result = await setOwnLike({
        podUrl,
        session,
        post: { ...post, ownerWebId: post.ownerWebId || webId },
        ownerPodUrl: post.ownerPodUrl,
        liked,
        knownEntries: entriesConfirmed ? entries : undefined,
      });
      setEntries(result.entries);
      setEntriesConfirmed(true);
      if (Array.isArray(result.webIds)) {
        setSets((previous) => ({ ...previous, [post.url]: { webIds: result.webIds, readable: true } }));
      }
      const ownerPod = post.ownerPodUrl || podUrl;
      const published = await loadLikeSet({
        ownerPodUrl: ownerPod,
        postUrl: post.url,
        fetchFn: session.fetch,
      }).catch(() => null);
      if (published?.readable) {
        setSets((previous) => ({ ...previous, [post.url]: published }));
      }
      return result;
    } finally {
      setBusyUrl('');
    }
  };

  return { view, toggle, busyUrl };
}
