import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import { relativeTime, copyToClipboard } from '../lib/utils.js';

/**
 * PostCard renders ONE post (photo or text) in feed-style.
 *
 * It supports three modes via the `mode` prop:
 *   - 'own':    user's own post — shows edit/delete/share controls
 *   - 'feed':   a friend's public post — shows author, comment button, no edit
 *   - 'view':   read-only embed (e.g. linked-to)
 *
 * For photos, we lazy-load the full-resolution blob only when the card is
 * actually visible in the viewport, to keep big galleries fast.
 */
export default function PostCard({
  post,
  mode = 'own',
  ownerName,
  ownerAvatar,
  onTogglePublic,
  onEdit,
  onDelete,
  onOpenLightbox,
  onShowComments,
  onCopyLink,
  toggling,
  deleting,
}) {
  const [imgUrl, setImgUrl] = useState(null);
  const [visible, setVisible] = useState(mode === 'feed'); // feed images load by URL directly, no observer needed
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const menuRef = useRef(null);

  // Lazy-load own-photo blob URLs only when visible.
  useEffect(() => {
    if (mode !== 'own' || post.type !== 'photo') return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [mode, post.type]);

  // Create object URL for own photos.
  useEffect(() => {
    if (mode !== 'own' || post.type !== 'photo' || !visible || !post.mediaBlob) return;
    const url = URL.createObjectURL(post.mediaBlob);
    setImgUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [mode, post.type, post.mediaBlob, visible]);

  // Close menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const h = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  const dateStr = relativeTime(post.dateCreated);
  const isLong = post.type === 'text' && post.body && post.body.length > 280;

  // Image src varies: own photos use blob URL, feed photos use the public pod URL directly.
  const photoSrc =
    post.type === 'photo' ? (mode === 'own' ? imgUrl : post.mediaUrl || post.url) : null;

  return (
    <article
      ref={cardRef}
      className="card overflow-hidden flex flex-col group/card animate-fade-in"
    >
      {/* Header: author + timestamp + controls */}
      {(mode === 'feed' || ownerName) && (
        <div className="flex items-center gap-3 px-4 pt-4 pb-2">
          <Avatar src={ownerAvatar} name={ownerName} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{ownerName || 'You'}</p>
            <p className="text-xs text-ink-400">{dateStr}</p>
          </div>
          {mode === 'own' && post.isPublic && (
            <span
              className="text-xs text-signal bg-signal/10 px-2 py-0.5 rounded-full"
              title="Public"
            >
              Public
            </span>
          )}
        </div>
      )}

      {/* Media or body */}
      {post.type === 'photo' ? (
        <div
          className="relative bg-ink-900 cursor-zoom-in"
          onClick={() => onOpenLightbox?.()}
        >
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={post.caption || 'Photo'}
              loading="lazy"
              className="w-full max-h-[600px] object-cover"
              onError={(e) => {
                // For feed images that fail (e.g. friend deleted post), hide.
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full aspect-[4/3] skeleton"></div>
          )}
        </div>
      ) : (
        <div className="px-5 py-4">
          {post.title && (
            <h2 className="display-serif text-2xl mb-2 leading-tight text-balance">
              {post.title}
            </h2>
          )}
          <div
            className={`text-ink-100 leading-relaxed whitespace-pre-wrap text-pretty ${
              !expanded && isLong ? 'line-clamp-3' : ''
            }`}
          >
            {post.body || post.caption || ''}
          </div>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-sm text-accent hover:text-accent-light"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Photo caption */}
      {post.type === 'photo' && post.caption && (
        <p className="px-4 pt-3 text-sm text-ink-100 leading-relaxed">{post.caption}</p>
      )}

      {/* Footer */}
      <div className="px-4 py-3 mt-auto flex items-center gap-2 border-t border-ink-800/50">
        {mode === 'own' ? (
          <>
            {/* Visibility toggle */}
            <button
              onClick={() => onTogglePublic?.(post)}
              disabled={toggling}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition border
                          ${
                            post.isPublic
                              ? 'bg-signal/10 text-signal border-signal/30 hover:bg-accent/10 hover:text-accent hover:border-accent/30'
                              : 'bg-ink-700 text-ink-200 border-ink-600 hover:bg-ink-600'
                          }
                          disabled:opacity-50`}
            >
              {toggling
                ? 'Working…'
                : post.isPublic
                  ? '✓ Public — make private'
                  : 'Share publicly'}
            </button>

            {/* Comments */}
            {post.isPublic && (
              <button
                onClick={() => onShowComments?.(post)}
                className="px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-200 transition"
                title="View comments"
              >
                💬
              </button>
            )}

            {/* Overflow menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="px-2.5 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-200 transition"
                aria-label="More actions"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute right-0 bottom-full mb-1 w-44 card overflow-hidden z-10 animate-slide-down">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit?.(post);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-ink-700 transition"
                  >
                    Edit
                  </button>
                  {post.isPublic && (
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onCopyLink?.(post);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-ink-700 transition"
                    >
                      Copy link
                    </button>
                  )}
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full text-left px-3 py-2 text-sm text-accent hover:bg-ink-700 transition border-t border-ink-700"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="px-3 py-2 border-t border-ink-700 space-y-1.5">
                      <p className="text-xs text-accent">Delete permanently?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setConfirmDelete(false);
                            setMenuOpen(false);
                            onDelete?.(post);
                          }}
                          disabled={deleting}
                          className="flex-1 py-1 bg-accent hover:bg-accent-dark rounded text-xs disabled:opacity-50"
                        >
                          {deleting ? '…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 py-1 bg-ink-700 hover:bg-ink-600 rounded text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          // Feed mode: comments + copy-link only.
          <>
            <button
              onClick={() => onShowComments?.(post)}
              className="flex-1 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-200 transition"
            >
              💬 Comments
            </button>
            <button
              onClick={async () => {
                const ok = await copyToClipboard(post.url);
                onCopyLink?.(post, ok);
              }}
              className="px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-200 transition"
              title="Copy link"
            >
              🔗
            </button>
          </>
        )}
      </div>
    </article>
  );
}
