import { useEffect, useState, useRef } from 'react';
import { getFile } from '@inrupt/solid-client';
import { photoUrls } from '../lib/album.js';
import { relativeTime } from '../lib/utils.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

/**
 * Full-screen photo lightbox with:
 *   - Keyboard navigation (Esc, Left, Right)
 *   - Mouse-wheel and double-click zoom
 *   - Touch swipe between photos and pinch-zoom on mobile
 */
export default function Lightbox({ posts, index, onClose, onNavigate, session, footer = null }) {
  const post = posts[index];
  const frames = photoUrls(post);
  const [frame, setFrame] = useState(0);
  const frameUrl = frames[Math.min(frame, Math.max(frames.length - 1, 0))] || post?.mediaUrl || post?.url || '';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartX = useRef(null);
  const pinchStart = useRef(null);
  const panStart = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);
  const panelRef = useRef(null);
  useFocusTrap(true, panelRef);

  // Reset zoom when changing photos.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setFrame(0);
  }, [index]);

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
      if (e.key === 'ArrowLeft') {
        if (frame > 0) setFrame(frame - 1);
        else if (index > 0) onNavigate(index - 1);
      }
      if (e.key === 'ArrowRight') {
        if (frame < frames.length - 1) setFrame(frame + 1);
        else if (index < posts.length - 1) onNavigate(index + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
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
      const next = Math.min(5, Math.max(1, pinchStart.current.zoom * (dist / pinchStart.current.dist)));
      setZoom(next);
    } else if (zoom > 1 && panStart.current && e.touches.length === 1) {
      e.preventDefault();
      setPan({
        x: e.touches[0].clientX - panStart.current.x,
        y: e.touches[0].clientY - panStart.current.y,
      });
    }
  };

  const onTouchEnd = (e) => {
    pinchStart.current = null;
    panStart.current = null;
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (zoom > 1 || Math.abs(dx) < 50) return;
    if (dx < 0 && index < posts.length - 1) onNavigate(index + 1);
    if (dx > 0 && index > 0) onNavigate(index - 1);
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
      className="fixed inset-0 z-50 bg-ink-950/95 backdrop-blur-md flex flex-col animate-fade-in"
      onClick={zoom === 1 ? onClose : undefined}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-xs text-ink-300">
          {index + 1} of {posts.length}
        </div>
        <button
          onClick={onClose}
          className="min-h-8 px-4 py-1.5 bg-ink-800 rounded-lg hover:bg-ink-700 text-sm"
          aria-label="Close"
        >
          Close (Esc)
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
            onClick={() => onNavigate(index - 1)}
            className="absolute left-4 z-10 p-3 text-3xl text-ink-200 hover:text-ink-50 bg-ink-950/40 backdrop-blur-sm rounded-full hover:bg-ink-950/70 transition"
            aria-label="Previous"
          >
            ‹
          </button>
        )}

        {imgUrl ? (
          <img
            src={imgUrl}
            alt={post.caption || 'Photo'}
            onWheel={onWheel}
            onDoubleClick={onDoubleClick}
            style={{
              transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
              transition: zoom === 1 ? 'transform 0.2s' : 'none',
              cursor: zoom > 1 ? 'grab' : 'zoom-in',
            }}
            className="lightbox-image max-h-full max-w-full object-contain rounded-lg shadow-2xl"
            draggable={false}
          />
        ) : (
          <div className="w-96 h-64 skeleton rounded-lg" />
        )}

        {/* Next */}
        {index < posts.length - 1 && (
          <button
            onClick={() => onNavigate(index + 1)}
            className="absolute right-4 z-10 p-3 text-3xl text-ink-200 hover:text-ink-50 bg-ink-950/40 backdrop-blur-sm rounded-full hover:bg-ink-950/70 transition"
            aria-label="Next"
          >
            ›
          </button>
        )}
      </div>

      {/* Caption / metadata */}
      <div className="shrink-0 p-4 sm:p-6 max-w-3xl mx-auto w-full text-center" onClick={(e) => e.stopPropagation()}>
        {post.caption && <p className="text-ink-100 leading-relaxed text-balance">{post.caption}</p>}
        {frames.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2">
            <button
              type="button"
              className="min-h-11 px-3 rounded-lg bg-ink-800 text-ink-50 text-sm disabled:opacity-40"
              onClick={() => setFrame((value) => Math.max(0, value - 1))}
              disabled={frame === 0}
            >
              Previous photo
            </button>
            <span className="text-sm text-ink-100" aria-live="polite">
              Photo {Math.min(frame + 1, frames.length)} of {frames.length}
            </span>
            <button
              type="button"
              className="min-h-11 px-3 rounded-lg bg-ink-800 text-ink-50 text-sm disabled:opacity-40"
              onClick={() => setFrame((value) => Math.min(frames.length - 1, value + 1))}
              disabled={frame >= frames.length - 1}
            >
              Next photo
            </button>
          </div>
        )}
        <p className="text-xs text-ink-200 mt-2">{relativeTime(post.dateCreated)}</p>
        {zoom > 1 && (
          <p className="text-xs text-ink-200 mt-1">Zoom: {Math.round(zoom * 100)}%. Double-click to reset.</p>
        )}
        {footer}
      </div>
    </div>
  );
}
