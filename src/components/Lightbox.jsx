import { useEffect, useState, useRef } from 'react';
import { getFile } from '@inrupt/solid-client';
import { photoUrls } from '../lib/album.js';
import { relativeTime } from '../lib/utils.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { ChevronIcon, CloseIcon } from './icons.jsx';

/**
 * Full-screen photo lightbox with:
 *   - Keyboard navigation (Esc, Left, Right)
 *   - Mouse-wheel and double-click zoom
 *   - Touch swipe that follows the finger: photos in a post first, then the next post
 *   - Pinch-zoom on mobile
 */
export default function Lightbox({ posts, index, onClose, onNavigate, session, footer = null }) {
  const post = posts[index];
  const frames = photoUrls(post);
  const [frame, setFrame] = useState(0);
  const frameUrl =
    frames[Math.min(frame, Math.max(frames.length - 1, 0))] || post?.mediaUrl || post?.url || '';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartX = useRef(null);
  const pinchStart = useRef(null);
  const panStart = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [enter, setEnter] = useState('');
  const panelRef = useRef(null);
  useFocusTrap(true, panelRef);

  // Reset zoom when changing photos.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFrame(0);
  }, [index]);

  useEffect(() => {
    setImgLoaded(false);
    setDragX(0);
  }, [imgUrl]);

  const step = (direction) => {
    if (direction > 0) {
      if (frame < frames.length - 1) setFrame(frame + 1);
      else if (index < posts.length - 1) onNavigate(index + 1);
      else return;
    } else {
      if (frame > 0) setFrame(frame - 1);
      else if (index > 0) onNavigate(index - 1);
      else return;
    }
    setEnter(direction > 0 ? 'right' : 'left');
  };
  const canStepBack = frame > 0 || index > 0;
  const canStepForward = frame < frames.length - 1 || index < posts.length - 1;

  // Public photos use their URL. Private photos are fetched only while the lightbox is open.
  useEffect(() => {
    if (!post) {
      setImgUrl(null);
      return undefined;
    }
    if (post.mediaBlob) {
      const u = URL.createObjectURL(post.mediaBlob);
      setImgUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    const direct = frameUrl;
    if (post.isPublic) {
      setImgUrl(direct);
      return undefined;
    }
    let cancelled = false;
    let objectUrl;
    (async () => {
      try {
        if (!session?.fetch) {
          setImgUrl(direct);
          return;
        }
        const file = await getFile(direct, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setImgUrl(objectUrl);
      } catch {
        if (!cancelled) setImgUrl(direct);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [post, session, frameUrl]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // step reads the same frame and index listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, posts.length, onClose, onNavigate, frame, frames.length]);

  if (!post) return null;

  // Touch / pinch handlers.
  const onTouchStart = (e) => {
    if (e.touches.length === 2) {
      pinchStart.current = {
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        ),
        zoom,
      };
    } else if (zoom > 1) {
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else {
      touchStartX.current = e.touches[0].clientX;
    }
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const next = Math.min(
        5,
        Math.max(1, pinchStart.current.zoom * (dist / pinchStart.current.dist)),
      );
      setZoom(next);
    } else if (zoom > 1 && panStart.current && e.touches.length === 1) {
      e.preventDefault();
      setPan({
        x: e.touches[0].clientX - panStart.current.x,
        y: e.touches[0].clientY - panStart.current.y,
      });
    } else if (zoom === 1 && touchStartX.current !== null && e.touches.length === 1) {
      const dx = e.touches[0].clientX - touchStartX.current;
      const blocked = (dx > 0 && !canStepBack) || (dx < 0 && !canStepForward);
      setDragX(blocked ? dx / 4 : dx);
    }
  };

  const onTouchEnd = (e) => {
    pinchStart.current = null;
    panStart.current = null;
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    setDragX(0);
    if (zoom > 1 || Math.abs(dx) < 50) return;
    step(dx < 0 ? 1 : -1);
  };

  const onWheel = (e) => {
    e.stopPropagation();
    const next = Math.min(5, Math.max(1, zoom - e.deltaY * 0.002));
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  };

  const onDoubleClick = (e) => {
    e.stopPropagation();
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else {
      setZoom(2.5);
    }
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="dark fixed inset-0 z-50 bg-ink-950/95 text-ink-100 backdrop-blur-md flex flex-col animate-fade-in"
      onClick={zoom === 1 ? onClose : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs font-bold text-ink-200 tabular-nums rounded-full bg-ink-800/80 px-3 py-1.5">
          {index + 1} of {posts.length}
        </div>
        <button
          onClick={onClose}
          className="grid place-items-center w-11 h-11 rounded-full bg-ink-800/80 text-ink-50 hover:bg-ink-700 transition-colors"
          aria-label="Close"
          title="Close (Esc)"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 min-h-0 relative flex items-center justify-center px-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Prev */}
        {index > 0 && (
          <button
            onClick={() => {
              setEnter('left');
              onNavigate(index - 1);
            }}
            className="absolute left-3 sm:left-5 z-10 hidden sm:grid place-items-center w-12 h-12 rounded-full bg-cream/90 text-plum shadow-lift hover:scale-105 active:scale-95 transition-transform"
            aria-label="Previous"
          >
            <ChevronIcon direction="left" className="w-6 h-6" />
          </button>
        )}

        {imgUrl ? (
          <div
            key={`${index}-${frame}`}
            className={`max-h-full max-w-full flex items-center justify-center ${
              enter === 'right'
                ? 'animate-slide-from-right'
                : enter === 'left'
                  ? 'animate-slide-from-left'
                  : 'animate-pop-in'
            }`}
            style={{
              transform: dragX ? `translateX(${dragX}px)` : undefined,
              transition: dragX ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <img
              src={imgUrl}
              onLoad={() => setImgLoaded(true)}
              alt={post.caption || 'Photo'}
              onWheel={onWheel}
              onDoubleClick={onDoubleClick}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: zoom === 1 ? 'transform 0.2s' : 'none',
                cursor: zoom > 1 ? 'grab' : 'zoom-in',
              }}
              className={`lightbox-image max-h-[calc(100dvh-14rem)] max-w-full object-contain rounded-2xl shadow-2xl transition-opacity duration-300 ${
                imgLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              draggable={false}
            />
          </div>
        ) : (
          <div className="w-80 max-w-full aspect-[4/3] skeleton rounded-2xl" />
        )}

        {/* Next */}
        {index < posts.length - 1 && (
          <button
            onClick={() => {
              setEnter('right');
              onNavigate(index + 1);
            }}
            className="absolute right-3 sm:right-5 z-10 hidden sm:grid place-items-center w-12 h-12 rounded-full bg-cream/90 text-plum shadow-lift hover:scale-105 active:scale-95 transition-transform"
            aria-label="Next"
          >
            <ChevronIcon direction="right" className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Caption / metadata */}
      <div
        className="shrink-0 p-4 sm:p-6 max-w-3xl mx-auto w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {post.caption && (
          <p className="text-ink-100 leading-relaxed text-balance">{post.caption}</p>
        )}
        {frames.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              aria-label="Previous photo"
              className="grid place-items-center w-11 h-11 rounded-full bg-ink-800 text-ink-50 hover:bg-ink-700 disabled:opacity-30 transition-colors"
              onClick={() => {
                setEnter('left');
                setFrame((value) => Math.max(0, value - 1));
              }}
              disabled={frame === 0}
            >
              <ChevronIcon direction="left" />
            </button>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {frames.map((url, i) => (
                <span
                  key={url}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === frame ? 'w-5 bg-accent' : 'w-1.5 bg-ink-400'}`}
                />
              ))}
            </div>
            <span className="sr-only" aria-live="polite">
              Photo {Math.min(frame + 1, frames.length)} of {frames.length}
            </span>
            <button
              type="button"
              aria-label="Next photo"
              className="grid place-items-center w-11 h-11 rounded-full bg-ink-800 text-ink-50 hover:bg-ink-700 disabled:opacity-30 transition-colors"
              onClick={() => {
                setEnter('right');
                setFrame((value) => Math.min(frames.length - 1, value + 1));
              }}
              disabled={frame >= frames.length - 1}
            >
              <ChevronIcon direction="right" />
            </button>
          </div>
        )}
        <p className="text-xs text-ink-200 mt-2">{relativeTime(post.dateCreated)}</p>
        {zoom > 1 && (
          <p className="text-xs text-ink-200 mt-1">
            Zoom: {Math.round(zoom * 100)}%. Double-click to reset.
          </p>
        )}
        {footer}
      </div>
    </div>
  );
}
