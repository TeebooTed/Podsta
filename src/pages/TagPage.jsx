import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { loadFriendFeed } from '../lib/feed.js';
import { normalizeTag, postsForTag } from '../lib/hashtags.js';
import { isSaved } from '../lib/saves.js';
import { PATHS, appPostUrl } from '../lib/navigation.js';
import { currentAppRoot } from '../lib/appUrl.js';

/**
 * One tag, from posts this person can already read.
 * Private posts of other people are absent because they are not in a shared index.
 */
export default function TagPage({
  session,
  friends = [],
  posts = [],
  saves = null,
  savingUrl = '',
  onToggleSave,
  showToast,
}) {
  const [params] = useSearchParams();
  const tag = normalizeTag(params.get('name') || '');
  const [followed, setFollowed] = useState([]);
  const [loading, setLoading] = useState(Boolean(friends.length));

  useEffect(() => {
    if (!friends.length) {
      setFollowed([]);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    loadFriendFeed({ friends, session })
      .then(({ entries }) => {
        if (!cancelled) setFollowed(entries);
      })
      .catch(() => {
        if (!cancelled) setFollowed([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friends, session]);

  const visible = tag ? postsForTag(tag, { own: posts, followed }) : [];

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="display-serif text-4xl mb-2">{tag ? `#${tag}` : 'Tag'}</h1>
      <p className="text-sm text-ink-200 mb-6 leading-relaxed">
        This page lists posts you can already read. It does not search other Pods, and a tag on a private post stays on that Pod.
      </p>
      {!tag && (
        <EmptyState
          title="Missing tag"
          message="Open a #tag from a caption."
          action={
            <Link to={PATHS.home} className="btn-primary">
              Back home
            </Link>
          }
        />
      )}
      {tag && loading && <div className="card aspect-[4/3] skeleton" role="status" aria-label="Loading tagged posts" />}
      {tag && !loading && visible.length === 0 && (
        <EmptyState
          title={`No #${tag} posts you can read`}
          message="When you or someone you follow uses this tag on a post you are allowed to see, it will show up here."
        />
      )}
      {tag && !loading && visible.length > 0 && (
        <div className="space-y-5">
          {visible.map((post) => (
            <PostCard
              key={post.url}
              post={post}
              mode={post.ownerWebId ? 'feed' : 'view'}
              ownerName={post.ownerName || ''}
              ownerAvatar={post.ownerAvatar || ''}
              ownerHref={post.ownerWebId ? `/people?webid=${encodeURIComponent(post.ownerWebId)}` : ''}
              linkUrl={appPostUrl(currentAppRoot(), post.url)}
              session={session}
              saved={isSaved(saves, post.url)}
              saveBusy={savingUrl === post.url}
              onToggleSave={onToggleSave}
              onShareResult={(result) => {
                if (result.reason === 'dismissed') return;
                if (!result.ok) showToast?.('Could not share that post', 'error');
                else showToast?.(result.method === 'share' ? 'Shared' : 'Link copied');
              }}
              onCopyLink={(_, ok) => showToast?.(ok ? 'Link copied' : 'Copy failed', ok ? 'success' : 'error')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
