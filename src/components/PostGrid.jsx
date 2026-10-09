import { useEffect, useState } from 'react';
import { getFile } from '@inrupt/solid-client';
import Lightbox from './Lightbox.jsx';
import Modal from './Modal.jsx';
import EditPostModal from './EditPostModal.jsx';
import CommentsDrawer from './CommentsDrawer.jsx';
import EmptyState from './EmptyState.jsx';
import { relativeTime } from '../lib/utils.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { safeHttpUrl } from '../lib/urls.js';

function TileImage({ post, session }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (post.mediaBlob) {
      const url = URL.createObjectURL(post.mediaBlob);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    const direct = post.mediaUrl || post.url;
    if (post.isPublic && safeHttpUrl(direct)) {
      setSrc(direct);
      return undefined;
    }
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        if (!session?.fetch) return;
        const file = await getFile(direct, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [post, session]);

  if (!src) return <div className="absolute inset-0 skeleton" />;
  return <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />;
}

/**
 * Own posts as a square grid. A photo opens the lightbox. A note opens a reader.
 * Sharing, editing, and deleting stay on that opened post.
 */
export default function PostGrid({
  posts,
  loading,
  session,
  podUrl,
  onCompose,
  onTogglePublic,
  onEdit,
  onDelete,
  togglingUrls,
  deletingUrls,
  showToast,
}) {
  const [openUrl, setOpenUrl] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [commentsPost, setCommentsPost] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const photos = posts.filter((p) => p.type === 'photo');
  const openPost = posts.find((p) => p.url === openUrl) || null;
  const photoIndex = openPost?.type === 'photo' ? photos.findIndex((p) => p.url === openPost.url) : -1;

  const handleSaveEdit = async (changes) => {
    setSavingEdit(true);
    try {
      await onEdit(editingPost, changes);
      setEditingPost(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const actions = (post) => (
    <div className="mt-4 flex flex-wrap gap-2 justify-center">
      <button
        type="button"
        onClick={() => onTogglePublic(post)}
        disabled={togglingUrls?.has(post.url)}
        className="btn-secondary text-xs"
      >
        {togglingUrls?.has(post.url) ? 'Working…' : post.isPublic ? 'Make private' : 'Share publicly'}
      </button>
      <button type="button" onClick={() => setEditingPost(post)} className="btn-secondary text-xs">
        Edit
      </button>
      {post.isPublic && (
        <button type="button" onClick={() => setCommentsPost(post)} className="btn-secondary text-xs">
          Comments
        </button>
      )}
      {confirmDelete ? (
        <button
          type="button"
          onClick={() => {
            setConfirmDelete(false);
            setOpenUrl(null);
            onDelete(post);
          }}
          disabled={deletingUrls?.has(post.url)}
          className="min-h-8 px-3 rounded-lg bg-accent text-ink-950 text-xs font-medium"
        >
          {deletingUrls?.has(post.url) ? 'Deleting…' : 'Confirm delete'}
        </button>
      ) : (
        <button type="button" onClick={() => setConfirmDelete(true)} className="btn-ghost text-xs text-accent">
          Delete
        </button>
      )}
    </div>
  );

  if (loading && posts.length === 0) {
    return (
      <div className="grid grid-cols-3 gap-1 sm:gap-2" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square skeleton" />
        ))}
      </div>
    );
  }

  if (!loading && posts.length === 0) {
    return (
      <EmptyState
        title="Nothing here yet"
        message="Photos and notes you write show up in this grid. New posts stay private until you share them."
        action={
          <button type="button" onClick={onCompose} className="btn-primary">
            Create your first post
          </button>
        }
      />
    );
  }

  return (
    <>
      <ul className="grid grid-cols-3 gap-1 sm:gap-2">
        {posts.map((post) => {
          const label =
            post.type === 'photo'
              ? post.caption || 'Photo'
              : post.title || post.body?.slice(0, 80) || 'Note';
          return (
            <li key={post.url}>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setOpenUrl(post.url);
                }}
                className="relative block w-full aspect-square bg-ink-800 overflow-hidden text-left"
                aria-label={`${post.isPublic ? 'Public' : 'Private'} post: ${label}`}
              >
                {post.type === 'photo' ? (
                  <TileImage post={post} session={session} />
                ) : (
                  <span className="absolute inset-0 p-2 sm:p-3 flex items-end">
                    <span className="display-serif text-sm sm:text-base text-ink-100 line-clamp-4">
                      {post.title || post.body}
                    </span>
                  </span>
                )}
                {!post.isPublic && (
                  <span className="absolute top-1 left-1 text-[10px] uppercase tracking-wide bg-ink-950/80 text-ink-100 px-1.5 py-0.5 rounded">
                    Private
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {photoIndex >= 0 && (
        <Lightbox
          posts={photos}
          index={photoIndex}
          session={session}
          onClose={() => setOpenUrl(null)}
          onNavigate={(next) => setOpenUrl(photos[next]?.url || null)}
          footer={actions(photos[photoIndex])}
        />
      )}

      {openPost?.type === 'text' && (
        <Modal open onClose={() => setOpenUrl(null)} title={openPost.title || 'Note'} maxWidth="max-w-lg">
          <p className="text-ink-100 leading-relaxed whitespace-pre-wrap">{openPost.body}</p>
          <p className="text-xs text-ink-300 mt-3">{relativeTime(openPost.dateCreated)}</p>
          {actions(openPost)}
        </Modal>
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
          canComment
          session={session}
          onClose={() => setCommentsPost(null)}
          showToast={showToast}
        />
      )}
    </>
  );
}
