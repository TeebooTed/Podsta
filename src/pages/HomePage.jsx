import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Lightbox from '../components/Lightbox.jsx';
import CommentsDrawer from '../components/CommentsDrawer.jsx';
import Avatar from '../components/Avatar.jsx';
import { loadFriendFeed } from '../lib/feed.js';
import { loadPublicPost } from '../lib/posts.js';
import { shortWebId, copyToClipboard } from '../lib/utils.js';
import { appPostUrl, emptyFeedCopy, feedErrorCopy } from '../lib/navigation.js';

/**
 * Home is the following feed: one column, newest first.
 */
export default function HomePage({ friends, session, ownPostCount = 0, onRemoveFriend, onCompose, showToast }) {
  const [feedEntries, setFeedEntries] = useState([]);
  const [unreachable, setUnreachable] = useState(0);
  const [hydrated, setHydrated] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [pendingUnfollow, setPendingUnfollow] = useState(null);
  const hydratedRef = useRef({});
  const copy = emptyFeedCopy();

  const reload = useCallback(() => {
    hydratedRef.current = {};
    setHydrated({});
    setReloadKey((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!friends?.length) {
      setFeedEntries([]);
      setUnreachable(0);
      setFailed(false);
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    loadFriendFeed({ friends, session })
      .then(({ entries, unreachable: missed }) => {
        if (cancelled) return;
        setFeedEntries(entries);
        setUnreachable(missed);
        if (missed > 0 && entries.length === 0) setFailed(true);
      })
      .catch((err) => {
        console.error('Feed load failed:', err);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friends, session, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    feedEntries.forEach(async (entry) => {
      if (entry.type !== 'text') return;
      if (hydratedRef.current[entry.url]) return;
      hydratedRef.current[entry.url] = 'loading';
      const post = await loadPublicPost({
        url: entry.url,
        type: 'text',
        fetchFn: session?.fetch,
      });
      if (cancelled) return;
      if (post) {
        hydratedRef.current[entry.url] = 'done';
        setHydrated((h) => ({ ...h, [entry.url]: post }));
      } else {
        hydratedRef.current[entry.url] = 'error';
      }
    });
    return () => {
      cancelled = true;
    };
  }, [feedEntries, session]);

  const renderablePosts = feedEntries.map((entry) => {
    const base = {
      id: entry.url,
      url: entry.url,
      type: entry.type,
      title: entry.title || '',
      caption: entry.caption || '',
      body: '',
      dateCreated: entry.dateCreated,
      isPublic: entry.audience !== 'contacts',
      audience: entry.audience || 'public',
      mediaUrl: entry.url,
      mediaBlob: null,
    };
    if (entry.type === 'text' && hydrated[entry.url]) {
      base.body = hydrated[entry.url].body;
      base.title = hydrated[entry.url].title || base.title;
    }
    return { ...base, _entry: entry };
  });

  const photoPosts = renderablePosts.filter((p) => p.type === 'photo');
  const errorCopy = feedErrorCopy(unreachable);

  const copyWebId = async () => {
    const ok = await copyToClipboard(session?.info?.webId || '');
    showToast(ok ? 'WebID copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="display-serif text-4xl mb-6">Home</h1>

      {friends?.length > 0 && (
        <section className="mb-6" aria-label="Following">
          <h2 className="text-xs font-medium text-ink-300 uppercase tracking-wider mb-3">
            Following ({friends.length})
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {friends.map((f) => {
              const name = f.name || shortWebId(f.webId);
              const confirming = pendingUnfollow === f.webId;
              return (
                <div key={f.webId} className="shrink-0 flex flex-col items-center gap-1.5 w-[5.5rem]">
                  <Avatar src={f.avatarUrl} name={name} size="lg" />
                  <p className="text-xs text-ink-100 max-w-[5.5rem] truncate">{name}</p>
                  {confirming ? (
                    <div className="flex flex-col gap-1 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          onRemoveFriend(f.webId);
                          setPendingUnfollow(null);
                        }}
                        className="min-h-8 px-2 rounded-md bg-accent text-ink-950 text-xs font-medium"
                        aria-label={`Confirm unfollow ${name}`}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingUnfollow(null)}
                        className="min-h-8 px-2 rounded-md bg-ink-700 text-ink-100 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingUnfollow(f.webId)}
                      className="min-h-8 px-2 rounded-md border border-ink-600 text-ink-100 text-xs hover:border-accent hover:text-accent"
                      aria-label={`Unfollow ${name}`}
                    >
                      Unfollow
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {loading ? 'Loading the feed' : failed ? errorCopy.title : ''}
      </div>

      {loading ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !friends?.length ? (
        <EmptyState
          icon="✦"
          title={copy.title}
          message={copy.message}
          action={
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button type="button" onClick={copyWebId} className="btn-primary">
                {copy.copyLabel}
              </button>
              <Link to={copy.followPath} className="btn-secondary">
                {copy.followLabel}
              </Link>
              {ownPostCount === 0 && (
                <button type="button" onClick={onCompose} className="btn-ghost">
                  {copy.composeLabel}
                </button>
              )}
            </div>
          }
        />
      ) : failed ? (
        <EmptyState
          icon="!"
          title={errorCopy.title}
          message={errorCopy.message}
          action={
            <button type="button" onClick={reload} className="btn-primary">
              {errorCopy.retryLabel}
            </button>
          }
        />
      ) : renderablePosts.length === 0 ? (
        <EmptyState
          icon="◯"
          title="Nothing public yet"
          message="The people you follow have not shared a post. When they do, it will show up here."
          action={
            <Link to={copy.followPath} className="btn-secondary">
              {copy.followLabel}
            </Link>
          }
        />
      ) : (
        <>
          {unreachable > 0 && (
            <p className="mb-4 text-sm text-ink-200 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2" role="status">
              {feedErrorCopy(unreachable).message}{' '}
              <button type="button" onClick={reload} className="underline text-ink-50">
                Try again
              </button>
            </p>
          )}
          <div className="space-y-5">
            {renderablePosts.map((post) => (
              <PostCard
                key={post.url}
                post={post}
                mode="feed"
                ownerName={post._entry.ownerName}
                ownerAvatar={post._entry.ownerAvatar}
                ownerHref={`/people?webid=${encodeURIComponent(post._entry.ownerWebId)}`}
                linkUrl={appPostUrl(window.location.origin, post.url)}
                onShowComments={(p) =>
                  setCommentsPost({ ...p, _ownerPodUrl: post._entry.ownerPodUrl })
                }
                onCopyLink={(_, ok) =>
                  showToast(ok ? 'Link copied' : 'Copy failed', ok ? 'success' : 'error')
                }
                onOpenLightbox={() => {
                  if (post.type === 'photo') {
                    const idx = photoPosts.findIndex((p) => p.url === post.url);
                    if (idx >= 0) setLightboxIndex(idx);
                  }
                }}
              />
            ))}
          </div>
        </>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          posts={photoPosts}
          index={lightboxIndex}
          session={session}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {commentsPost && (
        <CommentsDrawer
          open
          post={commentsPost}
          ownerPodUrl={commentsPost._ownerPodUrl}
          canComment={false}
          session={session}
          onClose={() => setCommentsPost(null)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
