import { useEffect, useState, useRef } from 'react';
import { getFile } from '@inrupt/solid-client';
import { photoUrls } from '../lib/album.js';
import { relativeTime } from '../lib/utils.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { ChevronIcon, CloseIcon } from './icons.jsx';

const GAP = 24;
const SETTLE_MS = 280;
const DOUBLE_TAP_MS = 280;
const TAP_ZOOM = 2.5;
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
const MAX_ZOOM = 5;

/**
 * Keeps a zoomed photo covering the stage: its edges can't be pulled inside the stage edges.
 * With `give`, overshoot is allowed at a third of the finger's travel and snaps back on release.
 */
function limitPan(pan, zoom, stage, image, give = false) {
  if (!stage || !image) return pan;
  const axis = (value, stageSize, imageSize) => {
    const room = Math.max(0, (imageSize * zoom - stageSize) / 2);
    if (Math.abs(value) <= room) return value;
    const edge = Math.sign(value) * room;
    return give ? edge + (value - edge) / 3 : edge;
  };
  return {
    x: axis(pan.x, stage.clientWidth, image.offsetWidth),
    y: axis(pan.y, stage.clientHeight, image.offsetHeight),
  };
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

function framesOf(post) {
  const frames = photoUrls(post);
  if (frames.length) return frames;
  const direct = post?.mediaUrl || post?.url || '';
  return direct ? [direct] : [];
}

/** Public photos use their URL. Private photos are fetched with the session while the viewer is open. */
function useFrameSource(post, url, session) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!post || (!url && !post.mediaBlob)) {
      setSrc('');
      return undefined;
    }
    if (post.mediaBlob && framesOf(post).length <= 1) {
      const blobUrl = URL.createObjectURL(post.mediaBlob);
      setSrc(blobUrl);
      return () => URL.revokeObjectURL(blobUrl);
    }
    if (post.isPublic || !session?.fetch) {
      setSrc(url);
      return undefined;
    }
    let cancelled = false;
    let objectUrl = '';
    setSrc('');
    (async () => {
      try {
        const file = await getFile(url, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc(url);
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [post, url, session]);
  return src;
}

/** One photo in the filmstrip. Neighbours load too, so a swipe never lands on a blank frame. */
function Slide({ post, url, session, offset, imageStyle, alt, className = '' }) {
  const src = useFrameSource(post, url, session);
  const [loadedSrc, setLoadedSrc] = useState('');
  const loaded = Boolean(src) && loadedSrc === src;
  return (
    <div
      data-backdrop="1"
      className={`absolute inset-0 flex items-center justify-center px-4 ${offset ? '' : 'pointer-events-auto'} ${className}`}
      style={{
        transform: offset ? `translateX(calc(${offset * 100}% + ${offset * GAP}px))` : undefined,
      }}
      aria-hidden={offset ? 'true' : undefined}
    >
      {!loaded && <div className="absolute w-80 max-w-[80%] aspect-[4/3] skeleton rounded-2xl" />}
      {src && (
        <img
          src={src}
          alt={offset ? '' : alt}
          ref={(el) => {
            if (el?.complete && el.naturalWidth && loadedSrc !== src) setLoadedSrc(src);
          }}
          onLoad={() => setLoadedSrc(src)}
          draggable={false}
          decoding="async"
          style={imageStyle}
          className={`lightbox-image max-h-full max-w-full object-contain rounded-2xl shadow-2xl transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  );
}

function Thumb({ post, url, session, active, label, onSelect }) {
  const thumbs = Array.isArray(post?.thumbnails) ? post.thumbnails : [];
  const frames = framesOf(post);
  const thumbUrl = thumbs[frames.indexOf(url)] || url;
  const src = useFrameSource(post, thumbUrl, session);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={active ? 'true' : undefined}
      className={`relative shrink-0 w-11 h-11 rounded-lg overflow-hidden transition-all duration-200 ${
        active
          ? 'ring-2 ring-accent ring-offset-2 ring-offset-ink-950 scale-105'
          : 'opacity-60 hover:opacity-100'
      }`}
    >
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" draggable={false} />
      ) : (
        <span className="absolute inset-0 skeleton" />
      )}
    </button>
  );
}

/**
 * Full-screen photo viewer.
 *   - A filmstrip that follows the finger: photos in a post first, then the next post.
 *   - Swipe down (or up) to close. Esc, arrow keys and the buttons do the same on a keyboard.
 *   - Pinch, double-tap or double-click to zoom; wheel zoom on desktop.
 *   - Thumbnails for multi-photo posts.
 * With reduced motion, moves and closes happen at once instead of sliding.
 */
export default function Lightbox({ posts, index, onClose, onNavigate, session, footer = null }) {
  const post = posts[index];
  const frames = framesOf(post);
  const [frame, setFrame] = useState(0);
  const current = Math.min(frame, Math.max(frames.length - 1, 0));
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [settling, setSettling] = useState(false);
  const [enter, setEnter] = useState('');
  const gesture = useRef(null);
  const pinchStart = useRef(null);
  const panStart = useRef(null);
  const lastTap = useRef(null);
  const settleTimer = useRef(null);
  const stageRef = useRef(null);
  const panelRef = useRef(null);
  useFocusTrap(true, panelRef);

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [index, frame]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  const prevSlide =
    current > 0
      ? { post, url: frames[current - 1] }
      : index > 0
        ? { post: posts[index - 1], url: framesOf(posts[index - 1]).at(-1) }
        : null;
  const nextSlide =
    current < frames.length - 1
      ? { post, url: frames[current + 1] }
      : index < posts.length - 1
        ? { post: posts[index + 1], url: framesOf(posts[index + 1])[0] }
        : null;

  const commit = (direction) => {
    if (direction > 0) {
      if (current < frames.length - 1) setFrame(current + 1);
      else if (index < posts.length - 1) {
        setFrame(0);
        onNavigate(index + 1);
      }
    } else if (current > 0) setFrame(current - 1);
    else if (index > 0) {
      setFrame(Math.max(0, framesOf(posts[index - 1]).length - 1));
      onNavigate(index - 1);
    }
  };

  /** Buttons and keys: the new photo slides in from the side it came from. */
  const step = (direction) => {
    if (direction > 0 ? !nextSlide : !prevSlide) return;
    setEnter(direction > 0 ? 'right' : 'left');
    commit(direction);
  };

  const close = () => {
    clearTimeout(settleTimer.current);
    onClose();
  };

  const goToFrame = (target) => {
    if (target === current) return;
    setEnter(target > current ? 'right' : 'left');
    setFrame(target);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // step and close read the same frame and index listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, posts.length, onClose, onNavigate, current, frames.length]);

  if (!post) return null;

  const clampPan = (next, z = zoom, give = false) =>
    limitPan(
      next,
      z,
      stageRef.current,
      stageRef.current?.querySelector('div:not([aria-hidden]) > img'),
      give,
    );

  const zoomAt = (clientX, clientY) => {
    if (zoom > 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return setZoom(TAP_ZOOM);
    const dx = clientX - (rect.left + rect.width / 2);
    const dy = clientY - (rect.top + rect.height / 2);
    setZoom(TAP_ZOOM);
    setPan(clampPan({ x: dx * (1 - TAP_ZOOM), y: dy * (1 - TAP_ZOOM) }, TAP_ZOOM));
  };

  const onTouchStart = (e) => {
    if (settling) return;
    if (e.touches.length === 2) {
      gesture.current = null;
      setDrag({ x: 0, y: 0 });
      pinchStart.current = {
        dist: Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        ),
        zoom,
      };
      return;
    }
    const touch = e.touches[0];
    if (zoom > 1) {
      panStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
      return;
    }
    gesture.current = { x: touch.clientX, y: touch.clientY, t: performance.now(), axis: null };
  };

  const onTouchMove = (e) => {
    if (e.touches.length === 2 && pinchStart.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      const next = Math.min(
        MAX_ZOOM,
        Math.max(1, pinchStart.current.zoom * (dist / pinchStart.current.dist)),
      );
      setZoom(next);
      setPan((p) => clampPan(p, next));
      return;
    }
    const touch = e.touches[0];
    if (zoom > 1 && panStart.current) {
      setPan(
        clampPan(
          { x: touch.clientX - panStart.current.x, y: touch.clientY - panStart.current.y },
          zoom,
          true,
        ),
      );
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const dx = touch.clientX - g.x;
    const dy = touch.clientY - g.y;
    if (!g.axis && Math.hypot(dx, dy) > 8) g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (g.axis === 'x') {
      const blocked = (dx > 0 && !prevSlide) || (dx < 0 && !nextSlide);
      setDrag({ x: blocked ? dx / 4 : dx, y: 0 });
    } else if (g.axis === 'y') {
      setDrag({ x: 0, y: dy });
    }
  };

  const onTouchEnd = (e) => {
    pinchStart.current = null;
    panStart.current = null;
    if (zoom < 1.05 && zoom !== 1) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
    } else if (zoom > 1) {
      setPan((p) => clampPan(p));
    }
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - g.x;
    const dy = touch.clientY - g.y;
    const ms = Math.max(1, performance.now() - g.t);

    if (!g.axis) {
      const previous = lastTap.current;
      const now = performance.now();
      if (
        previous &&
        now - previous.t < DOUBLE_TAP_MS &&
        Math.hypot(touch.clientX - previous.x, touch.clientY - previous.y) < 30
      ) {
        lastTap.current = null;
        e.preventDefault();
        zoomAt(touch.clientX, touch.clientY);
      } else {
        lastTap.current = { t: now, x: touch.clientX, y: touch.clientY };
      }
      return;
    }

    const reduce = prefersReducedMotion();
    if (g.axis === 'y') {
      if (Math.abs(dy) > 110 || Math.abs(dy) / ms > 0.6) {
        if (reduce) return close();
        setSettling('moving');
        setDrag({ x: 0, y: Math.sign(dy) * window.innerHeight });
        settleTimer.current = setTimeout(close, SETTLE_MS * 0.8);
      } else {
        setDrag({ x: 0, y: 0 });
      }
      return;
    }

    const direction = dx < 0 ? 1 : -1;
    const target = direction > 0 ? nextSlide : prevSlide;
    const width = stageRef.current?.clientWidth || window.innerWidth;
    if (!target || (Math.abs(dx) < width * 0.2 && Math.abs(dx) / ms < 0.4)) {
      setDrag({ x: 0, y: 0 });
      return;
    }
    setEnter('');
    if (reduce) {
      setDrag({ x: 0, y: 0 });
      commit(direction);
      return;
    }
    setSettling('moving');
    setDrag({ x: -direction * (width + GAP), y: 0 });
    settleTimer.current = setTimeout(() => {
      setSettling('reset');
      setDrag({ x: 0, y: 0 });
      commit(direction);
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    }, SETTLE_MS);
  };

  const onWheel = (e) => {
    e.stopPropagation();
    const next = Math.min(MAX_ZOOM, Math.max(1, zoom - e.deltaY * 0.002));
    setZoom(next);
    setPan((p) => (next === 1 ? { x: 0, y: 0 } : clampPan(p, next)));
  };

  const tracking = (Boolean(gesture.current?.axis) && !settling) || settling === 'reset';
  const dismiss = Math.min(1, Math.abs(drag.y) / 400);
  const trackStyle = {
    transform:
      drag.x || drag.y
        ? `translate3d(${drag.x}px, ${drag.y}px, 0) scale(${1 - dismiss * 0.15})`
        : undefined,
    transition: tracking ? 'none' : `transform ${SETTLE_MS}ms ${EASE}`,
  };
  const imageStyle = {
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
    transition: pinchStart.current || panStart.current ? 'none' : `transform 0.25s ${EASE}`,
    cursor: zoom > 1 ? 'zoom-out' : 'zoom-in',
  };
  const alt = post.caption || 'Photo';
  const enterClass =
    enter === 'right'
      ? 'animate-slide-from-right'
      : enter === 'left'
        ? 'animate-slide-from-left'
        : '';

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className="dark fixed inset-0 z-50 text-ink-100 flex flex-col animate-fade-in"
    >
      <div
        className="absolute inset-0 bg-ink-950/95 backdrop-blur-md"
        style={{
          opacity: 1 - dismiss * 0.85,
          transition: tracking ? 'none' : `opacity ${SETTLE_MS}ms ${EASE}`,
        }}
        onClick={close}
        aria-hidden="true"
      />

      <div className="relative flex items-center justify-between p-4">
        <div className="text-xs font-bold text-ink-200 tabular-nums rounded-full bg-ink-800/80 px-3 py-1.5">
          {index + 1} of {posts.length}
        </div>
        <button
          onClick={close}
          className="grid place-items-center w-11 h-11 rounded-full bg-ink-800/80 text-ink-50 hover:bg-ink-700 transition-colors"
          aria-label="Close"
          title="Close (Esc)"
        >
          <CloseIcon />
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 overflow-hidden touch-none select-none"
        onClick={(e) => {
          if (e.target === e.currentTarget || e.target.dataset.backdrop) close();
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        onWheel={onWheel}
        onDoubleClick={(e) => {
          if (e.target.tagName === 'IMG') zoomAt(e.clientX, e.clientY);
        }}
      >
        <div className="absolute inset-0 pointer-events-none" style={trackStyle}>
          {[
            [prevSlide, -1],
            [{ post, url: frames[current] }, 0],
            [nextSlide, 1],
          ].map(([slide, offset]) =>
            slide ? (
              <Slide
                key={`${slide.post?.url}|${slide.url}`}
                post={slide.post}
                url={slide.url}
                session={session}
                offset={offset}
                imageStyle={offset ? undefined : imageStyle}
                alt={alt}
                className={offset ? '' : enterClass}
              />
            ) : null,
          )}
        </div>

        {prevSlide && (
          <button
            onClick={() => step(-1)}
            className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-10 hidden sm:grid place-items-center w-12 h-12 rounded-full bg-cream/90 text-plum shadow-lift hover:scale-105 active:scale-95 transition-transform"
            aria-label="Previous"
          >
            <ChevronIcon direction="left" className="w-6 h-6" />
          </button>
        )}
        {nextSlide && (
          <button
            onClick={() => step(1)}
            className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-10 hidden sm:grid place-items-center w-12 h-12 rounded-full bg-cream/90 text-plum shadow-lift hover:scale-105 active:scale-95 transition-transform"
            aria-label="Next"
          >
            <ChevronIcon direction="right" className="w-6 h-6" />
          </button>
        )}
      </div>

      <div
        className="relative shrink-0 p-4 sm:p-6 max-w-3xl mx-auto w-full text-center"
        style={{
          opacity: 1 - dismiss,
          transition: tracking ? 'none' : `opacity ${SETTLE_MS}ms ${EASE}`,
        }}
      >
        {frames.length > 1 && (
          <div className="mb-3 flex items-center justify-center gap-2">
            <button
              type="button"
              aria-label="Previous photo"
              className="grid place-items-center w-11 h-11 rounded-full bg-ink-800 text-ink-50 hover:bg-ink-700 disabled:opacity-30 transition-colors"
              onClick={() => goToFrame(Math.max(0, current - 1))}
              disabled={current === 0}
            >
              <ChevronIcon direction="left" />
            </button>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-1 py-2">
              {frames.map((url, i) => (
                <Thumb
                  key={url}
                  post={post}
                  url={url}
                  session={session}
                  active={i === current}
                  label={`Photo ${i + 1} of ${frames.length}`}
                  onSelect={() => goToFrame(i)}
                />
              ))}
            </div>
            <button
              type="button"
              aria-label="Next photo"
              className="grid place-items-center w-11 h-11 rounded-full bg-ink-800 text-ink-50 hover:bg-ink-700 disabled:opacity-30 transition-colors"
              onClick={() => goToFrame(Math.min(frames.length - 1, current + 1))}
              disabled={current >= frames.length - 1}
            >
              <ChevronIcon direction="right" />
            </button>
            <span className="sr-only" aria-live="polite">
              Photo {current + 1} of {frames.length}
            </span>
          </div>
        )}
        {post.caption && (
          <p className="text-ink-100 leading-relaxed text-balance">{post.caption}</p>
        )}
        <p className="text-xs text-ink-200 mt-2">{relativeTime(post.dateCreated)}</p>
        <p className="text-xs text-ink-200 mt-1 sm:hidden">
          {zoom > 1 ? 'Double-tap to zoom out.' : 'Swipe to browse. Swipe down to close.'}
        </p>
        {zoom > 1 && (
          <p className="text-xs text-ink-200 mt-1 hidden sm:block">
            Zoom: {Math.round(zoom * 100)}%. Double-click to reset.
          </p>
        )}
        {footer}
      </div>
    </div>
  );
}
