import { useCallback, useEffect, useRef, useState } from 'react';
import { getFile } from '@inrupt/solid-client';
import { safeHttpUrl } from '../lib/urls.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { useInView } from '../hooks/useInView.js';
import { ChevronIcon, HeartIcon } from './icons.jsx';

const DOUBLE_TAP_MS = 280;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/** Loads one photo once `load` turns true, then keeps it. Private photos are fetched with the session. */
function usePhotoSource(url, { load, isPublic, session }) {
  const [src, setSrc] = useState('');
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (load) setWanted(true);
  }, [load]);

  useEffect(() => {
    if (!url || !wanted) {
      if (!url) setSrc('');
      return undefined;
    }
    if (isPublic) {
      setSrc(url);
      return undefined;
    }
    let cancelled = false;
    let objectUrl = '';
    (async () => {
      try {
        if (!session?.fetch) return;
        const file = await getFile(url, { fetch: withTimeout(session.fetch, 30000) });
        if (cancelled) return;
        objectUrl = URL.createObjectURL(file);
        setSrc(objectUrl);
      } catch {
        if (!cancelled) setSrc('');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, wanted, isPublic, session]);

  return src;
}

function Slide({ url, alt, load, isPublic, session, fit, onRatio, onActivate, focusable }) {
  const src = usePhotoSource(url, { load, isPublic, session });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => setLoaded(false), [src]);

  const image = src ? (
    <img
      src={src}
      alt={alt}
      decoding="async"
      draggable={false}
      onLoad={(event) => {
        setLoaded(true);
        const { naturalWidth: w, naturalHeight: h } = event.currentTarget;
        if (w && h) onRatio?.(w / h);
      }}
      className={`absolute inset-0 w-full h-full select-none transition-opacity duration-500 ease-out ${
        fit === 'contain' ? 'object-contain' : 'object-cover'
      } ${loaded ? 'opacity-100' : 'opacity-0'}`}
    />
  ) : (
    <span className="sr-only">{alt}</span>
  );

  return (
    <div className="relative w-full shrink-0 h-full">
      {!loaded && <div className="absolute inset-0 skeleton" aria-hidden="true" />}
      {onActivate ? (
        <button
          type="button"
          tabIndex={focusable ? 0 : -1}
          className="absolute inset-0 block w-full h-full cursor-zoom-in focus-visible:outline-offset-[-4px]"
          onClick={onActivate}
        >
          {image}
        </button>
      ) : (
        image
      )}
    </div>
  );
}

/**
 * One photo, or a swipeable row of them.
 * Phones swipe with native scroll snapping. Arrows and the arrow keys move one photo at a time.
 * The frame takes the first photo's shape, kept between portrait 4:5 and wide 1.91:1.
 * With `onDoubleTap`, a double tap (or double click) likes the photo and a single tap opens it.
 */
export default function PhotoCarousel({
  urls = [],
  alt = 'Photo',
  descriptions = [],
  session,
  isPublic = false,
  onOpen,
  onDoubleTap,
  fit = 'cover',
}) {
  const photos = urls.filter((url) => safeHttpUrl(url));
  const photoKey = photos.join('|');
  const many = photos.length > 1;
  const [frame, setFrame] = useState(0);
  const [ratio, setRatio] = useState(4 / 3);
  const [burst, setBurst] = useState(0);
  const [viewRef, visible] = useInView();
  const trackRef = useRef(null);
  const tapTimer = useRef(null);
  const prevRef = useRef(null);
  const nextRef = useRef(null);
  const index = photos.length ? Math.min(frame, photos.length - 1) : 0;

  useEffect(() => {
    setFrame(0);
    if (trackRef.current) trackRef.current.scrollLeft = 0;
  }, [photoKey]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  useEffect(() => {
    if (!burst) return undefined;
    const timer = setTimeout(() => setBurst(0), 950);
    return () => clearTimeout(timer);
  }, [burst]);

  const onFirstRatio = useCallback(
    (value) => {
      const [min, max] = fit === 'contain' ? [0.6, 2] : [0.8, 1.91];
      setRatio(Math.min(max, Math.max(min, value)));
    },
    [fit],
  );

  const goTo = (next) => {
    const track = trackRef.current;
    const target = Math.max(0, Math.min(photos.length - 1, next));
    if (!track) return;
    track.scrollTo({
      left: target * track.clientWidth,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
    setFrame(target);
    // The arrow at an end hides, so hand focus to the one that still moves.
    if (target === 0 && document.activeElement === prevRef.current) nextRef.current?.focus();
    if (target === photos.length - 1 && document.activeElement === nextRef.current)
      prevRef.current?.focus();
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track || !track.clientWidth) return;
    const next = Math.round(track.scrollLeft / track.clientWidth);
    if (next !== frame) setFrame(next);
  };

  const onKeyDown = (event) => {
    if (!many) return;
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goTo(index - 1);
    }
  };

  const activate = (event) => {
    // Keyboard and assistive-tech clicks report detail 0: open straight away.
    if (!onDoubleTap || event.detail === 0) {
      onOpen?.();
      return;
    }
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setBurst((value) => value + 1);
      onDoubleTap();
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      onOpen?.();
    }, DOUBLE_TAP_MS);
  };

  const altFor = (i) => {
    const text = descriptions[i] || alt;
    return many ? `${text}, photo ${i + 1} of ${photos.length}` : text;
  };

  const frameStyle =
    fit === 'contain' ? { aspectRatio: ratio, maxHeight: '80vh' } : { aspectRatio: ratio };

  return (
    <div
      ref={viewRef}
      className="relative bg-ink-900 group/photo overflow-hidden"
      style={frameStyle}
      {...(many
        ? { role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Photos', onKeyDown }
        : {})}
    >
      <div
        ref={trackRef}
        className="snap-track no-scrollbar h-full"
        onScroll={many ? onScroll : undefined}
      >
        {photos.map((url, i) => (
          <Slide
            key={url}
            url={url}
            alt={altFor(i)}
            load={visible && Math.abs(i - index) <= 1}
            isPublic={isPublic}
            session={session}
            fit={fit}
            onRatio={i === 0 ? onFirstRatio : undefined}
            onActivate={onOpen ? activate : undefined}
            focusable={i === index}
          />
        ))}
        {photos.length === 0 && <div className="w-full h-full skeleton" aria-hidden="true" />}
      </div>

      {burst > 0 && (
        <span
          key={burst}
          className="pointer-events-none absolute inset-0 grid place-items-center"
          aria-hidden="true"
        >
          <HeartIcon
            filled
            className="w-24 h-24 text-accent drop-shadow-[0_6px_18px_rgba(43,27,61,0.45)] animate-heart-burst"
            strokeWidth={1.2}
          />
        </span>
      )}

      {many && (
        <>
          <span className="sr-only" aria-live="polite">
            Photo {index + 1} of {photos.length}
          </span>
          <span
            className="pointer-events-none absolute top-3 right-3 rounded-full bg-plum/70 backdrop-blur-sm px-2.5 py-1 text-xs font-bold text-cream tabular-nums"
            aria-hidden="true"
          >
            {index + 1}/{photos.length}
          </span>
          <button
            type="button"
            ref={prevRef}
            aria-label="Previous photo"
            aria-disabled={index === 0}
            tabIndex={index === 0 ? -1 : 0}
            onClick={() => goTo(index - 1)}
            className={`absolute left-2 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-cream/90 text-plum shadow-lift transition duration-200 ease-out hover:scale-105 active:scale-95 [@media(hover:hover)]:opacity-0 group-hover/photo:opacity-100 focus-visible:opacity-100 ${
              index === 0 ? '!opacity-0 pointer-events-none' : ''
            }`}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            ref={nextRef}
            aria-label="Next photo"
            aria-disabled={index === photos.length - 1}
            tabIndex={index === photos.length - 1 ? -1 : 0}
            onClick={() => goTo(index + 1)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-10 h-10 rounded-full bg-cream/90 text-plum shadow-lift transition duration-200 ease-out hover:scale-105 active:scale-95 [@media(hover:hover)]:opacity-0 group-hover/photo:opacity-100 focus-visible:opacity-100 ${
              index === photos.length - 1 ? '!opacity-0 pointer-events-none' : ''
            }`}
          >
            <ChevronIcon direction="right" />
          </button>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5"
            aria-hidden="true"
          >
            {photos.map((url, i) => (
              <span
                key={url}
                className={`h-1.5 rounded-full transition-all duration-300 ease-out shadow-sm ${
                  i === index ? 'w-5 bg-cream' : 'w-1.5 bg-cream/55'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
