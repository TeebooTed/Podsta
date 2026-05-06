import { useState, useMemo, useEffect, useRef } from 'react';
import PostCard from '../components/PostCard.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Lightbox from '../components/Lightbox.jsx';
import EditPostModal from '../components/EditPostModal.jsx';
import CommentsDrawer from '../components/CommentsDrawer.jsx';

/**
 * The "Home" tab — your own posts. We show photos and text posts together
 * in chronological order with filter and search controls.
 */
export default function HomePage({
  posts,
  loading,
  podUrl,
  session,
  onCompose,
  onTogglePublic,
  onEdit,
  onDelete,
  togglingUrls,
  deletingUrls,
  showToast,
}) {
  const [filter, setFilter] = useState('all'); // all | photo | text | public | private
  const [search, setSearch] = useState('');
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentsPost, setCommentsPost] = useState(null);
  const [visibleCount, setVisibleCount] = useState(24);
  const loadMoreRef = useRef(null);

  // Infinite scroll sentinel.
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((v) => v + 24);
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let result = posts;
    if (filter === 'photo' || filter === 'text') {
      result = result.filter((p) => p.type === filter);
    } else if (filter === 'public') {
      result = result.filter((p) => p.isPublic);
    } else if (filter === 'private') {
      result = result.filter((p) => !p.isPublic);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.caption || '').toLowerCase().includes(q) ||
          (p.title || '').toLowerCase().includes(q) ||
          (p.body || '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [posts, filter, search]);

  const photoPosts = filtered.filter((p) => p.type === 'photo');

  const handleSaveEdit = async (changes) => {
    setSavingEdit(true);
    try {
      await onEdit(editingPost, changes);
      setEditingPost(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyLink = async (post) => {
    try {
      await navigator.clipboard.writeText(post.url);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Could not copy — your browser blocked clipboard access', 'error');
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        title="Your story starts here"
        message="Upload a photo or write a post. Everything saves to your Pod — you decide what to share."
        action={
          <button onClick={onCompose} className="btn-primary">
            Create your first post
          </button>
        }
      />
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 flex gap-2 flex-wrap">
          {[
            { id: 'all', label: `All (${posts.length})` },
            { id: 'photo', label: 'Photos' },
            { id: 'text', label: 'Text' },
            { id: 'public', label: 'Public' },
            { id: 'private', label: 'Private' },
          ].map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition border ${
                filter === opt.id
                  ? 'bg-accent text-ink-50 border-accent'
                  : 'bg-ink-800/60 text-ink-300 border-ink-700 hover:border-ink-600'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search captions and posts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input-field max-w-xs"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="∅" title="No matches" message="Try a different filter or search." />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.slice(0, visibleCount).map((post) => (
              <PostCard
                key={post.url}
                post={post}
                mode="own"
                ownerName=""
                onTogglePublic={onTogglePublic}
                onEdit={setEditingPost}
                onDelete={onDelete}
                onCopyLink={handleCopyLink}
                onShowComments={(p) => setCommentsPost(p)}
                onOpenLightbox={() => {
                  if (post.type === 'photo') {
                    const idx = photoPosts.findIndex((p) => p.url === post.url);
                    if (idx >= 0) setLightboxIndex(idx);
                  }
                }}
                toggling={togglingUrls.has(post.url)}
                deleting={deletingUrls.has(post.url)}
              />
            ))}
          </div>
          <div ref={loadMoreRef} className="h-20" />
        </>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          posts={photoPosts}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}

      {editingPost && (
        <EditPostModal
          open
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={handleSaveEdit}
          saving={savingEdit}
        />
      )}

      {commentsPost && (
        <CommentsDrawer
          open
          post={commentsPost}
          ownerPodUrl={podUrl}
          session={session}
          onClose={() => setCommentsPost(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
