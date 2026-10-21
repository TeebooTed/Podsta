import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';
import { cardPhotoUrls, primaryPhotoUrl } from '../lib/album.js';
import { safeHttpUrl } from '../lib/urls.js';
import { postPath } from '../lib/navigation.js';
import { MAX_PINNED, isPinnable, normalizePinned, togglePinned } from '../lib/profileExtras.js';

function PinIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M15.5 2.6a1.4 1.4 0 0 0-2 0l-.9.9a1.4 1.4 0 0 0-.3 1.5l.4.9-3.6 3.6-2.6-.5a1.4 1.4 0 0 0-1.3.4l-.9.9a1.4 1.4 0 0 0 0 2l3.2 3.2-4.6 4.6a1 1 0 1 0 1.4 1.4l4.6-4.6 3.2 3.2a1.4 1.4 0 0 0 2 0l.9-.9c.3-.3.5-.8.4-1.3l-.5-2.6 3.6-3.6.9.4c.5.2 1.1.1 1.5-.3l.9-.9a1.4 1.4 0 0 0 0-2z" />
    </svg>
  );
}

function tileSrc(post) {
  if (post.type !== 'photo') return '';
  return safeHttpUrl(cardPhotoUrls(post)[0] || primaryPhotoUrl(post)) || '';
}

function TileFace({ post, compact = false }) {
  const src = tileSrc(post);
  const text = post.caption || post.title || '';
  return (
    <>
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover/pin:scale-[1.04] group-focus-visible/pin:scale-[1.04]"
        />
      ) : (
        <span className="absolute inset-0 p-3 flex items-end bg-gradient-to-br from-sunshine to-accent-light font-display font-semibold text-sm sm:text-base leading-snug text-plum line-clamp-5">
          {post.title || post.body?.slice(0, 120) || post.caption || 'Note'}
        </span>
      )}
      {src && text && !compact && (
        <span className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8 bg-gradient-to-t from-plum/80 to-transparent text-left text-xs font-bold text-cream line-clamp-2">
          {text}
        </span>
      )}
    </>
  );
}

/**
 * Up to three posts someone chose to greet visitors with, shown above their grid.
 * `onOpen` opens a photo in place; otherwise a tile links to the post page.
 */
export default function PinnedPosts({ posts, onOpen, onEdit, ownerView = false }) {
  if (!posts.length && !ownerView) return null;
  return (
    <section aria-labelledby="pinned-heading">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="pinned-heading" className="display-serif text-2xl flex items-center gap-2">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-sunshine text-plum">
            <PinIcon />
          </span>
          Pinned
        </h2>
        {onEdit && (
          <button type="button" onClick={onEdit} className="btn-secondary text-sm">
            {posts.length ? 'Edit pins' : 'Choose posts'}
          </button>
        )}
      </div>
      {posts.length ? (
        <ul className="grid grid-cols-3 gap-2 sm:gap-3">
          {posts.map((post) => {
            const label =
              post.caption ||
              post.title ||
              post.body?.slice(0, 80) ||
              (post.type === 'photo' ? 'Photo' : 'Note');
            const tileClass =
              'group/pin relative block w-full aspect-[4/5] overflow-hidden rounded-2xl bg-ink-800 shadow-soft focus-visible:outline-offset-2';
            return (
              <li key={post.url}>
                {onOpen && post.type === 'photo' ? (
                  <button
                    type="button"
                    className={tileClass}
                    onClick={() => onOpen(post)}
                    aria-label={`Pinned: ${label}`}
                  >
                    <TileFace post={post} />
                  </button>
                ) : (
                  <Link
                    to={postPath(post.url)}
                    className={tileClass}
                    aria-label={`Pinned: ${label}`}
                  >
                    <TileFace post={post} />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-ink-700 px-4 py-5 text-sm text-ink-100 leading-relaxed">
          Pin up to three public posts. They sit at the top of your profile, so visitors see your
          favourites first.
        </p>
      )}
    </section>
  );
}

/** Choose which public posts to pin. Contacts and Only me posts can't be pinned. */
export function PinPicker({ open, onClose, posts, pinned, onSave, saving = false }) {
  const [draft, setDraft] = useState(() => normalizePinned(pinned));
  useEffect(() => {
    if (open) setDraft(normalizePinned(pinned));
  }, [open, pinned]);
  const choices = posts.filter(isPinnable);
  const full = draft.length >= MAX_PINNED;

  return (
    <Modal open={open} onClose={onClose} title="Pin posts" maxWidth="max-w-lg">
      <p className="text-sm text-ink-100 leading-relaxed">
        Pick up to three. Only public posts can be pinned, so everyone who visits sees the same
        ones.
      </p>
      <p className="mt-2 text-sm font-bold" aria-live="polite">
        {draft.length} of {MAX_PINNED} pinned
      </p>
      {choices.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-2">
          {choices.map((post) => {
            const order = draft.indexOf(post.url);
            const on = order >= 0;
            return (
              <li key={post.url}>
                <button
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => setDraft((list) => togglePinned(list, post.url))}
                  aria-label={post.caption || post.title || post.body?.slice(0, 80) || 'Post'}
                  className={`group/pin relative block w-full aspect-square overflow-hidden rounded-xl bg-ink-800 transition ${
                    on ? 'ring-4 ring-accent' : 'disabled:opacity-40'
                  }`}
                >
                  <TileFace post={post} compact />
                  {on && (
                    <span className="absolute top-1.5 left-1.5 grid place-items-center w-7 h-7 rounded-full bg-accent text-plum text-sm font-extrabold shadow-lift motion-safe:animate-pop-in">
                      {order + 1}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-2xl bg-ink-900 px-4 py-5 text-sm text-ink-100">
          No public posts yet. Share one with everyone, then pin it here.
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="btn-ghost">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving…' : 'Save pins'}
        </button>
      </div>
    </Modal>
  );
}
