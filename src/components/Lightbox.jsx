import { useEffect, useState, useRef } from 'react';
import { relativeTime } from '../lib/utils.js';

/**
 * Full-screen photo lightbox with:
 *   - Keyboard navigation (Esc, Left, Right)
 *   - Mouse-wheel and double-click zoom
 *   - Touch swipe between photos and pinch-zoom on mobile
 */
export default function Lightbox({ posts, index, onClose, onNavigate }) {
  const post = posts[index];
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const touchStartX = useRef(null);
  const pinchStart = useRef(null);
  const panStart = useRef(null);
  const [imgUrl, setImgUrl] = useState(null);

  // Reset zoom when changing photos.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index]);

  // Resolve image URL: own posts have a Blob, feed posts have a public URL.
  useEffect(() => {
    if (!post) {
      setImgUrl(null);
      return;
    }
    if (post.mediaBlob) {
      const u = URL.createObjectURL(post.mediaBlob);
      setImgUrl(u);
      return () => URL.revokeObjectURL(u);
    }
    setImgUrl(post.mediaUrl || post.url);
  }, [post]);

  // Keyboard navigation.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1);
      if (e.key === 'ArrowRight' && index < posts.length - 1) onNavigate(index + 1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [index, posts.length, onClose, onNavigate]);

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
          className="px-4 py-1.5 bg-ink-800 rounded-lg hover:bg-ink-700 text-sm"
          aria-label="Close"
        >
          Close (Esc)
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 relative flex items-center justify-center px-4 overflow-hidden"
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
            className="lightbox-image max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
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
      <div className="p-6 max-w-3xl mx-auto w-full text-center" onClick={(e) => e.stopPropagation()}>
        {post.caption && <p className="text-ink-100 leading-relaxed text-balance">{post.caption}</p>}
        <p className="text-xs text-ink-400 mt-2">{relativeTime(post.dateCreated)}</p>
        {zoom > 1 && (
          <p className="text-xs text-ink-400 mt-1">
            Zoom: {Math.round(zoom * 100)}% — double-click to reset
          </p>
        )}
      </div>
    </div>
  );
}
