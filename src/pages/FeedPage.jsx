import { useState, useEffect, useRef } from 'react';
import PostCard from '../components/PostCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Lightbox from '../components/Lightbox.jsx';
import CommentsDrawer from '../components/CommentsDrawer.jsx';
import Avatar from '../components/Avatar.jsx';
import { loadFriendFeed } from '../lib/feed.js';
import { loadPublicPost } from '../lib/posts.js';
import { shortWebId } from '../lib/utils.js';

/**
 * The "Friends" tab. Iterates each friend's public-index.ttl in parallel,
 * collects all entries, and renders them as cards. Photos load from their
 * public URLs; text posts get fetched lazily when the card scrolls into view.
 */
export default function FeedPage({ friends, session, onRemoveFriend, showToast }) {
  const [feedEntries, setFeedEntries] = useState([]);
  const [hydrated, setHydrated] = useState({}); // url → fully loaded post object
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | photo | text
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [commentsPost, setCommentsPost] = useState(null);
  const [pendingUnfollow, setPendingUnfollow] = useState(null);
  const hydratedRef = useRef({});

  useEffect(() => {
    if (!friends?.length) {
      setFeedEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadFriendFeed({ friends, session })
      .then((entries) => {
        setFeedEntries(entries);
      })
      .catch((err) => {
        console.error('Feed load failed:', err);
        showToast('Could not load some friends feeds', 'error');
      })
      .finally(() => setLoading(false));
  }, [friends, session, showToast]);

  // Fetch text bodies once. A failed post is not retried on every sibling update.
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

  const filtered = feedEntries.filter((e) => filter === 'all' || e.type === filter);

  // Build the renderable post objects, merging entry metadata + hydrated body for text posts.
  const renderablePosts = filtered.map((entry) => {
    const base = {
      id: entry.url,
      url: entry.url,
      type: entry.type,
      title: entry.title || '',
      caption: entry.caption || '',
      body: '',
      dateCreated: entry.dateCreated,
      isPublic: true,
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

  if (!friends?.length) {
    return (
      <EmptyState
        icon="✦"
        title="Your feed is empty"
        message="Follow some friends to see their posts here. Head to Discover to find people."
      />
    );
  }

  return (
    <>
      {/* Friends bar */}
      <section className="mb-6">
        <h2 className="text-xs font-medium text-ink-400 uppercase tracking-wider mb-3">
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

      {/* Filter chips */}
      <div className="flex gap-2 mb-5">
        {[
          { id: 'all', label: `All (${feedEntries.length})` },
          { id: 'photo', label: 'Photos' },
          { id: 'text', label: 'Text' },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setFilter(opt.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
              filter === opt.id
                ? 'bg-accent text-ink-950 border-accent'
                : 'bg-ink-800/60 text-ink-300 border-ink-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : renderablePosts.length === 0 ? (
        <EmptyState
          icon="◯"
          title="Nothing public yet"
          message="Your friends haven't shared any posts publicly. When they do, you'll see them here."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {renderablePosts.map((post) => (
            <PostCard
              key={post.url}
              post={post}
              mode="feed"
              ownerName={post._entry.ownerName}
              ownerAvatar={post._entry.ownerAvatar}
              onShowComments={(p) => setCommentsPost({ ...p, _ownerPodUrl: post._entry.ownerPodUrl })}
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
    </>
  );
}
