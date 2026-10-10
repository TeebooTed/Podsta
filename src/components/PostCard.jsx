import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { getFile } from '@inrupt/solid-client';
import Avatar from './Avatar.jsx';
import LikeControl from './LikeControl.jsx';
import { relativeTime, copyToClipboard } from '../lib/utils.js';
import { withTimeout } from '../lib/timeoutFetch.js';

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
  ownerHref,
  linkUrl,
  toggling,
  deleting,
  session,
  like,
  likeBusy = false,
  onToggleLike,
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

  // Public files use the Pod URL. Private and contacts-only files need the session,
  // because a plain image request is anonymous and those ACLs will refuse it.
  useEffect(() => {
    if (post.type !== 'photo') return undefined;
    if (mode === 'own' && !visible) return undefined;
    if (post.mediaBlob) {
      const url = URL.createObjectURL(post.mediaBlob);
      setImgUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (post.isPublic) {
      setImgUrl(post.mediaUrl || post.url);
      return undefined;
    }
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        if (!session?.fetch) return;
        const file = await getFile(post.url, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setImgUrl(objectUrl);
      } catch {
        if (!cancelled) setImgUrl(null);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mode, post, visible, session]);

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

  const photoSrc = post.type === 'photo' ? (post.isPublic && mode !== 'own' ? post.mediaUrl || post.url : imgUrl) : null;

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
            {ownerHref ? (
              <Link to={ownerHref} className="font-medium text-sm truncate block hover:text-accent">
                {ownerName || 'You'}
              </Link>
            ) : (
              <p className="font-medium text-sm truncate">{ownerName || 'You'}</p>
            )}
            <p className="text-xs text-ink-300">{dateStr}</p>
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
        <button
          type="button"
          className="relative block w-full bg-ink-900 cursor-zoom-in"
          onClick={() => onOpenLightbox?.()}
          aria-label={post.caption ? `Open photo: ${post.caption}` : 'Open photo'}
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
        </button>
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
      <div className="px-4 py-3 mt-auto flex flex-wrap items-center gap-2 border-t border-ink-800/50">
        {onToggleLike && (
          <LikeControl
            liked={like?.liked}
            count={like?.count}
            names={like?.names}
            busy={likeBusy}
            onToggle={() => onToggleLike(post)}
          />
        )}
        {mode === 'own' ? (
          <>
            {/* Visibility toggle */}
            <button
              type="button"
              onClick={() => onTogglePublic?.(post)}
              disabled={toggling}
              className={`flex-1 min-h-8 px-3 py-1.5 rounded-lg text-xs font-medium transition border
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
                type="button"
                onClick={() => onShowComments?.(post)}
                className="min-h-8 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition"
                aria-label="View comments"
              >
                <span aria-hidden="true">💬</span>
              </button>
            )}

            {/* Overflow menu */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="min-h-8 min-w-8 px-2.5 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition"
                aria-label="More actions"
                aria-expanded={menuOpen}
              >
                <span aria-hidden="true">⋯</span>
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
                      type="button"
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
                          className="flex-1 py-1 bg-accent hover:bg-accent-dark text-ink-950 rounded text-xs disabled:opacity-50"
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
              type="button"
              onClick={() => onShowComments?.(post)}
              className="flex-1 min-h-8 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition"
            >
              <span aria-hidden="true">💬 </span>
              Comments
            </button>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(linkUrl || post.url);
                onCopyLink?.(post, ok);
              }}
              className="min-h-8 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition"
              aria-label="Copy link"
            >
              <span aria-hidden="true">🔗</span>
            </button>
          </>
        )}
      </div>
    </article>
  );
}
