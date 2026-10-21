import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Lightbox from '../components/Lightbox.jsx';
import CommentsDrawer from '../components/CommentsDrawer.jsx';
import Avatar from '../components/Avatar.jsx';
import PullIndicator from '../components/PullIndicator.jsx';
import { loadFriendFeed } from '../lib/feed.js';
import { loadPublicPost } from '../lib/posts.js';
import { shortWebId, copyToClipboard } from '../lib/utils.js';
import { currentAppRoot } from '../lib/appUrl.js';
import { inviteUrl } from '../lib/invite.js';
import { appPostUrl, emptyFeedCopy, feedErrorCopy } from '../lib/navigation.js';
import { readSnapshot, snapshotKey, writeSnapshot } from '../lib/offlineStore.js';
import { plainText } from '../lib/text.js';
import { useLikes } from '../hooks/useLikes.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';
import { samePerson } from '../lib/webId.js';

/**
 * Home is the following feed: one column, newest first.
 */
export default function HomePage({
  friends,
  session,
  podUrl,
  ownPostCount = 0,
  onRemoveFriend,
  onCompose,
  showToast,
}) {
  const [feedEntries, setFeedEntries] = useState([]);
  const [unreachable, setUnreachable] = useState(0);
  const [hydrated, setHydrated] = useState({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [blockRevision, setBlockRevision] = useState(0);
  const [pendingUnfollow, setPendingUnfollow] = useState(null);
  const hydratedRef = useRef({});
  const copy = emptyFeedCopy();
  const likes = useLikes({
    enabled: Boolean(session?.info?.isLoggedIn && podUrl),
    session,
    podUrl,
    webId: session?.info?.webId || '',
    blockRevision,
    posts: feedEntries.map((entry) => ({
      url: entry.url,
      ownerWebId: entry.ownerWebId,
      ownerPodUrl: entry.ownerPodUrl,
      audience: entry.audience || 'public',
      isPublic: entry.audience !== 'contacts',
    })),
  });

  const onToggleLike = async (post) => {
    try {
      const result = await likes.toggle(post);
      if (!result) return;
      if (result.queued) {
        showToast("Saved on this device. It will send when your pod answers.", 'info');
        return;
      }
      if (!result.liked) showToast('Like removed');
      else if (result.notified) showToast('Liked');
      else if (!post.ownerWebId || samePerson(post.ownerWebId, session?.info?.webId)) {
        showToast("Liked on your pod. The count didn't update.", 'info');
      } else showToast("Liked on your pod. They'll see it next time their app checks.", 'info');
    } catch (err) {
      showToast(err.message || 'Could not save that like', 'error');
    }
  };

  const reload = useCallback(() => {
    hydratedRef.current = {};
    setHydrated({});
    setReloadKey((n) => n + 1);
  }, []);
  const refresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);
  const pullState = usePullToRefresh(refresh, {
    enabled: friends?.length > 0 && !refreshing,
    refreshing,
  });

  useEffect(() => {
    let cancelled = false;
    const webId = session?.info?.webId || '';
    (async () => {
      let hadCache = false;
      if (webId) {
        const cached = await readSnapshot(snapshotKey('feed', webId)).catch(() => null);
        if (!cancelled && cached?.entries?.length) {
          setFeedEntries(cached.entries);
          setFromCache(true);
          hadCache = true;
          setLoading(false);
        }
      }
      if (!friends?.length) {
        if (!hadCache) setFeedEntries([]);
        setUnreachable(0);
        setFailed(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!hadCache) setLoading(true);
      setFailed(false);
      try {
        const { entries, unreachable: missed } = await loadFriendFeed({ friends, session });
        if (cancelled) return;
        setFeedEntries(entries);
        setUnreachable(missed);
        setFromCache(false);
        if (missed > 0 && entries.length === 0) setFailed(true);
        if (webId) await writeSnapshot(snapshotKey('feed', webId), { entries }).catch(() => {});
      } catch (err) {
        console.error('Feed load failed:', err);
        if (!cancelled) setFailed(true);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    })();
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
      title: plainText(entry.title || ''),
      caption: plainText(entry.caption || ''),
      body: '',
      dateCreated: entry.dateCreated,
      isPublic: entry.audience !== 'contacts',
      audience: entry.audience || 'public',
      images: entry.images || [],
      thumbnails: entry.thumbnails || [],
      mediaUrl: entry.images?.[0] || entry.url,
      mediaBlob: null,
      ownerWebId: entry.ownerWebId,
      ownerPodUrl: entry.ownerPodUrl,
    };
    if (entry.type === 'text' && hydrated[entry.url]) {
      base.body = hydrated[entry.url].body;
      base.title = hydrated[entry.url].title || base.title;
    }
    return { ...base, _entry: entry };
  });

  const photoPosts = renderablePosts.filter((p) => p.type === 'photo');
  const errorCopy = feedErrorCopy(unreachable);

  const copyInvite = async () => {
    const webId = session?.info?.webId || '';
    const ok = webId ? await copyToClipboard(inviteUrl(currentAppRoot(), webId)) : false;
    showToast(
      ok ? 'Invite link copied' : "Couldn't copy that. Try selecting it instead.",
      ok ? 'success' : 'error',
    );
  };

  return (
    <div className="max-w-lg mx-auto">
      <PullIndicator {...pullState} />
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="display-serif text-4xl">Home</h1>
        {friends?.length > 0 && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="btn-ghost text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-4 h-4 ${refreshing ? 'animate-spin-slow' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 11a8 8 0 1 0-2.3 5.7" />
              <path d="M20 4v7h-7" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        )}
      </div>

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
                <div
                  key={f.webId}
                  className="shrink-0 flex flex-col items-center gap-1.5 w-[5.5rem]"
                >
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
                        className="min-h-8 px-2 rounded-md bg-accent text-plum text-xs font-medium"
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
                      className="min-h-8 px-2 rounded-md border border-ink-600 text-ink-100 text-xs hover:border-accent hover:text-accent-ink"
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

      {(fromCache || (failed && renderablePosts.length > 0)) && (
        <p
          className="mb-4 text-sm text-ink-100 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2"
          role="status"
        >
          {fromCache
            ? 'Showing the feed saved on this device.'
            : "Some pods didn't answer. Showing the posts that already loaded."}{' '}
          <button type="button" onClick={reload} className="underline text-ink-50">
            Try again
          </button>
        </p>
      )}

      {loading && renderablePosts.length === 0 ? (
        <div className="space-y-5">
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !friends?.length ? (
        <EmptyState
          art="no-followers"
          title={copy.title}
          message={copy.message}
          action={
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button type="button" onClick={copyInvite} className="btn-primary">
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
      ) : failed && renderablePosts.length === 0 ? (
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
          art="welcome"
          title="All quiet for now"
          message="The people you follow haven't shared anything with you yet. When they do, it'll show up here."
          action={
            <Link to={copy.followPath} className="btn-secondary">
              Follow someone else
            </Link>
          }
        />
      ) : (
        <>
          {unreachable > 0 && (
            <p
              className="mb-4 text-sm text-ink-200 bg-ink-800 border border-ink-700 rounded-lg px-3 py-2"
              role="status"
            >
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
                linkUrl={appPostUrl(currentAppRoot(), post.url)}
                onShowComments={(p) =>
                  setCommentsPost({
                    ...p,
                    ownerWebId: post._entry.ownerWebId,
                    audience: post._entry.audience || 'public',
                    _ownerPodUrl: post._entry.ownerPodUrl,
                  })
                }
                onCopyLink={(_, ok) =>
                  showToast(ok ? 'Link copied' : 'Copy failed', ok ? 'success' : 'error')
                }
                like={likes.view(post)}
                likeBusy={likes.busyUrl === post.url}
                onToggleLike={onToggleLike}
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
          viewerPodUrl={podUrl}
          session={session}
          onClose={() => setCommentsPost(null)}
          showToast={showToast}
          onBlocksChanged={() => setBlockRevision((value) => value + 1)}
        />
      )}
    </div>
  );
}
