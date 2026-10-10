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
import { photoUrls, primaryPhotoUrl } from '../lib/album.js';
import { audienceAllowed, ceilingNote, AUDIENCE_OPTIONS } from '../lib/discoverability.js';
import LikeControl from './LikeControl.jsx';

function TileImage({ post, session }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    if (post.mediaBlob) {
      const url = URL.createObjectURL(post.mediaBlob);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
    const direct = primaryPhotoUrl(post) || post.mediaUrl || post.url;
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
  onSetAudience,
  discoverability = 'hidden',
  onEdit,
  onDelete,
  togglingUrls,
  deletingUrls,
  showToast,
  likeFor,
  onToggleLike,
  likeBusyUrl = '',
  onBlocksChanged,
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
      {onToggleLike && (
        <LikeControl
          liked={likeFor?.(post)?.liked}
          count={likeFor?.(post)?.count}
          names={likeFor?.(post)?.names}
          busy={likeBusyUrl === post.url}
          onToggle={() => onToggleLike(post)}
        />
      )}
      <div className="flex flex-wrap gap-2 justify-center" role="group" aria-label="Who can see this post">
        {AUDIENCE_OPTIONS.map((option) => {
          const allowed = audienceAllowed(discoverability, option.id);
          const selected = (post.audience || (post.isPublic ? 'public' : 'private')) === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              disabled={!allowed || togglingUrls?.has(post.url)}
              onClick={() => {
                if (!selected) onSetAudience(post, option.id);
              }}
              className={`min-h-8 px-3 rounded-lg text-xs font-medium border ${
                selected
                  ? 'bg-accent text-ink-950 border-accent'
                  : 'bg-transparent text-ink-100 border-ink-600'
              } disabled:opacity-50`}
            >
              {togglingUrls?.has(post.url) && selected ? 'Working…' : option.label}
            </button>
          );
        })}
      </div>
      {ceilingNote(discoverability) && (
        <p className="w-full text-xs text-ink-200 text-center">{ceilingNote(discoverability)}</p>
      )}
      <button type="button" onClick={() => setEditingPost(post)} className="btn-secondary text-xs">
        Edit
      </button>
      <button
        type="button"
        onClick={() => setCommentsPost({ ...post, ownerWebId: session?.info?.webId || post.ownerWebId })}
        className="btn-secondary text-xs"
      >
        Comments
      </button>
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
          const count = post.type === 'photo' ? photoUrls(post).length : 0;
          const label =
            post.type === 'photo'
              ? count > 1
                ? `${count} photos${post.caption ? `: ${post.caption}` : ''}`
                : post.caption || 'Photo'
              : post.title || post.body?.slice(0, 80) || 'Note';
          const audience = post.audience || (post.isPublic ? 'public' : 'private');
          const visibility = audience === 'public' ? 'Public' : audience === 'contacts' ? 'Contacts' : 'Private';
          return (
            <li key={post.url}>
              <button
                type="button"
                onClick={() => {
                  setConfirmDelete(false);
                  setOpenUrl(post.url);
                }}
                className="relative block w-full aspect-square bg-ink-800 overflow-hidden text-left"
                aria-label={`${visibility} post: ${label}`}
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
                {count > 1 && (
                  <span className="absolute top-1 right-1 text-[10px] uppercase tracking-wide bg-ink-950/80 text-ink-50 px-1.5 py-0.5 rounded">
                    {count}
                  </span>
                )}
                {audience !== 'public' && (
                  <span className="absolute top-1 left-1 text-[10px] uppercase tracking-wide bg-ink-950/80 text-ink-100 px-1.5 py-0.5 rounded">
                    {audience === 'contacts' ? 'Contacts' : 'Private'}
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
          viewerPodUrl={podUrl}
          session={session}
          onClose={() => setCommentsPost(null)}
          showToast={showToast}
          onBlocksChanged={onBlocksChanged}
        />
      )}
    </>
  );
}
