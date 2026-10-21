import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';
import { cardPhotoUrls, primaryPhotoUrl } from '../lib/album.js';
import { safeHttpUrl } from '../lib/urls.js';
import { postPath } from '../lib/navigation.js';
import {
  MAX_PINNED,
  isPinnable,
  movePinned,
  normalizePinned,
  togglePinned,
} from '../lib/profileExtras.js';
import { ChevronIcon } from './icons.jsx';

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

function labelOf(post) {
  return post.caption || post.title || post.body?.slice(0, 80) || 'Post';
}

/**
 * The chosen pins in order. Drag a tile sideways, use the arrow keys on it,
 * or press the arrows under it to move it.
 */
function PinOrder({ posts, onMove }) {
  const listRef = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [focusUrl, setFocusUrl] = useState('');
  const [announce, setAnnounce] = useState('');

  useEffect(() => {
    if (!focusUrl) return;
    listRef.current?.querySelector(`[data-pin="${CSS.escape(focusUrl)}"]`)?.focus();
  }, [focusUrl, posts]);

  const move = (from, to, keepFocus = true) => {
    const target = Math.max(0, Math.min(posts.length - 1, to));
    if (target === from) return from;
    onMove(from, target);
    if (keepFocus) setFocusUrl(posts[from].url);
    setAnnounce(`${labelOf(posts[from])} moved to ${target + 1} of ${posts.length}`);
    return target;
  };

  const moveRef = useRef(move);
  moveRef.current = move;
  useEffect(() => () => drag.current?.stop(), []);

  // Window listeners, not pointer capture: reordering moves the tile in the DOM, which drops capture.
  const onPointerDown = (e, index) => {
    if (e.button !== 0) return;
    const first = listRef.current?.children[0];
    const d = {
      index,
      startX: e.clientX,
      slot: (first?.offsetWidth || 96) + 12,
      url: posts[index].url,
    };
    const onMovePointer = (event) => {
      const steps = Math.round((event.clientX - d.startX) / d.slot);
      if (steps) {
        const next = moveRef.current(d.index, d.index + steps, false);
        d.startX += (next - d.index) * d.slot;
        d.index = next;
      }
      setDragging({ url: d.url, dx: event.clientX - d.startX });
    };
    const stop = () => {
      window.removeEventListener('pointermove', onMovePointer);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      drag.current = null;
      setDragging(null);
    };
    window.addEventListener('pointermove', onMovePointer);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
    drag.current = { stop };
    setDragging({ url: d.url, dx: 0 });
  };

  return (
    <div className="mt-4 rounded-2xl bg-ink-900 p-3">
      <p className="text-xs font-bold text-ink-200 mb-2">Order on your profile. Drag to reorder.</p>
      <ol ref={listRef} className="flex gap-3">
        {posts.map((post, i) => {
          const active = dragging?.url === post.url;
          return (
            <li key={post.url} className="w-24 shrink-0">
              <button
                type="button"
                data-pin={post.url}
                aria-label={`${i + 1} of ${posts.length}: ${labelOf(post)}. Use the left and right arrow keys to move it.`}
                onPointerDown={(e) => onPointerDown(e, i)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft') move(i, i - 1);
                  else if (e.key === 'ArrowRight') move(i, i + 1);
                  else return;
                  e.preventDefault();
                }}
                style={
                  active
                    ? { transform: `translateX(${dragging.dx}px) scale(1.06)`, transition: 'none' }
                    : undefined
                }
                className={`group/pin relative block w-full aspect-square overflow-hidden rounded-xl bg-ink-800 touch-none select-none cursor-grab ring-2 ring-accent transition-transform duration-200 ${
                  active ? 'z-10 cursor-grabbing shadow-lift' : ''
                }`}
              >
                <TileFace post={post} compact />
                <span className="absolute top-1 left-1 grid place-items-center w-6 h-6 rounded-full bg-accent text-plum text-xs font-extrabold">
                  {i + 1}
                </span>
              </button>
              <span className="mt-1.5 flex justify-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move ${labelOf(post)} earlier`}
                  className="grid place-items-center w-9 h-9 rounded-full text-ink-100 hover:bg-ink-800 disabled:opacity-30"
                >
                  <ChevronIcon direction="left" className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === posts.length - 1}
                  aria-label={`Move ${labelOf(post)} later`}
                  className="grid place-items-center w-9 h-9 rounded-full text-ink-100 hover:bg-ink-800 disabled:opacity-30"
                >
                  <ChevronIcon direction="right" className="w-4 h-4" />
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </div>
  );
}

/** Choose which public posts to pin. Contacts and Only me posts can't be pinned. */
export function PinPicker({ open, onClose, posts, pinned, onSave, saving = false }) {
  const choices = posts.filter(isPinnable);
  const usable = (list) =>
    normalizePinned(list).filter((url) => choices.some((post) => post.url === url));
  const [draft, setDraft] = useState(() => usable(pinned));
  useEffect(() => {
    if (open) setDraft(usable(pinned));
    // Reset only when the picker opens or the saved pins change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pinned]);
  const full = draft.length >= MAX_PINNED;
  const ordered = draft.map((url) => choices.find((post) => post.url === url)).filter(Boolean);

  return (
    <Modal open={open} onClose={onClose} title="Pin posts" maxWidth="max-w-lg">
      <p className="text-sm text-ink-100 leading-relaxed">
        Pick up to three. Only public posts can be pinned, so everyone who visits sees the same
        ones.
      </p>
      <p className="mt-2 text-sm font-bold" aria-live="polite">
        {draft.length} of {MAX_PINNED} pinned
      </p>
      {ordered.length > 1 && (
        <PinOrder
          posts={ordered}
          onMove={(from, to) => setDraft((list) => movePinned(list, from, to))}
        />
      )}
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
                  aria-label={labelOf(post)}
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
