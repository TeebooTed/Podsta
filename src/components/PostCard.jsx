import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import PhotoCarousel from './PhotoCarousel.jsx';
import LikeControl from './LikeControl.jsx';
import { ChatIcon, LinkIcon } from './icons.jsx';
import { cardPhotoUrls } from '../lib/album.js';
import SaveButton from './SaveButton.jsx';
import CaptionText from './CaptionText.jsx';
import ShareButton from './ShareButton.jsx';
import { sharePayload } from '../lib/shareOut.js';
import { currentAppRoot } from '../lib/appUrl.js';
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
  ownerHref,
  linkUrl,
  toggling,
  deleting,
  session,
  like,
  likeBusy = false,
  onToggleLike,
  saved = false,
  saveBusy = false,
  onToggleSave,
  onShareResult,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef(null);
  const menuRef = useRef(null);

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

  const images = cardPhotoUrls(post);
  const payload = sharePayload({
    origin: typeof window === 'undefined' ? '' : currentAppRoot(),
    post,
    authorName: ownerName || '',
  });

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
              <Link
                to={ownerHref}
                className="font-medium text-sm truncate block hover:text-accent-ink"
              >
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
        <PhotoCarousel
          urls={images}
          alt={post.caption ? `Open photo: ${post.caption}` : 'Open photo'}
          session={session}
          isPublic={Boolean(post.isPublic)}
          onOpen={() => onOpenLightbox?.()}
          onDoubleTap={
            onToggleLike
              ? () => {
                  if (!like?.liked && !likeBusy) onToggleLike(post);
                }
              : undefined
          }
        />
      ) : (
        <div className="px-5 py-4">
          {post.title && (
            <h2 className="display-serif text-2xl mb-2 leading-tight text-balance">{post.title}</h2>
          )}
          <div
            className={`text-ink-100 leading-relaxed whitespace-pre-wrap text-pretty ${
              !expanded && isLong ? 'line-clamp-3' : ''
            }`}
          >
            <CaptionText text={post.body || post.caption || ''} />
          </div>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-sm text-accent-ink hover:underline"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        className={`px-2 py-1.5 mt-auto flex flex-wrap items-center gap-1 ${
          post.type === 'photo' ? '' : 'border-t border-ink-600/50'
        }`}
      >
        {onToggleSave && (
          <SaveButton saved={saved} busy={saveBusy} onToggle={() => onToggleSave(post)} />
        )}
        <ShareButton payload={payload} onResult={onShareResult} />
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
                              ? 'bg-signal/10 text-signal border-signal/30 hover:bg-accent/10 hover:text-accent-ink hover:border-accent/30'
                              : 'bg-ink-700 text-ink-200 border-ink-600 hover:bg-ink-600'
                          }
                          disabled:opacity-50`}
            >
              {toggling ? 'Working…' : post.isPublic ? '✓ Public — make private' : 'Share publicly'}
            </button>

            {/* Comments */}
            {post.isPublic && (
              <button
                type="button"
                onClick={() => onShowComments?.(post)}
                className="min-h-8 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition"
                aria-label="View comments"
              >
                <ChatIcon className="w-4 h-4" />
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
                      className="w-full text-left px-3 py-2 text-sm text-accent-ink hover:bg-ink-700 transition border-t border-ink-700"
                    >
                      Delete
                    </button>
                  ) : (
                    <div className="px-3 py-2 border-t border-ink-700 space-y-1.5">
                      <p className="text-xs text-accent-ink">Delete permanently?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setConfirmDelete(false);
                            setMenuOpen(false);
                            onDelete?.(post);
                          }}
                          disabled={deleting}
                          className="flex-1 py-1 bg-accent hover:bg-accent-dark text-plum rounded text-xs disabled:opacity-50"
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
            {onShowComments && (
              <button
                type="button"
                onClick={() => onShowComments(post)}
                className="grid place-items-center w-11 h-11 rounded-full text-ink-100 hover:text-ink-50 hover:bg-ink-700 transition-colors"
              >
                <ChatIcon className="w-6 h-6" />
                <span className="sr-only">Comments</span>
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(linkUrl || post.url);
                onCopyLink?.(post, ok);
              }}
              className="ml-auto grid place-items-center w-11 h-11 rounded-full text-ink-100 hover:text-ink-50 hover:bg-ink-700 transition-colors"
              aria-label="Copy link"
            >
              <LinkIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      {/* Photo caption */}
      {post.type === 'photo' && post.caption && (
        <p className="px-4 pb-4 -mt-0.5 text-sm text-ink-100 leading-relaxed text-pretty">
          {ownerName && <span className="font-extrabold text-ink-50 mr-1.5">{ownerName}</span>}
          <CaptionText text={post.caption} />
        </p>
      )}
    </article>
  );
}
