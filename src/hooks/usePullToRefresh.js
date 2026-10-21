import { useEffect, useRef, useState } from 'react';

const TRIGGER = 72;
const MAX = 110;

/**
 * Touch pull-down at the top of the page calls `onRefresh`.
 * Returns how far the page is pulled (0..MAX) and whether a refresh is running.
 * Mouse, pen and keyboard users keep the visible "Refresh" button instead.
 */
export function usePullToRefresh(onRefresh, { enabled = true, refreshing = false } = {}) {
  const [pull, setPull] = useState(0);
  const start = useRef(null);
  const pullRef = useRef(0);
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return undefined;

    const onStart = (event) => {
      if (window.scrollY > 0 || event.touches.length !== 1) return;
      // An open dialog locks page scrolling; a swipe inside it belongs to the dialog.
      if (document.body.style.overflow === 'hidden') return;
      start.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onMove = (event) => {
      if (!start.current) return;
      const dy = event.touches[0].clientY - start.current.y;
      const dx = event.touches[0].clientX - start.current.x;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy) || window.scrollY > 0) {
        if (pullRef.current) {
          pullRef.current = 0;
          setPull(0);
        }
        if (dy < 0 || Math.abs(dx) > Math.abs(dy)) start.current = null;
        return;
      }
      // Resistance: the further you pull, the slower it follows.
      const next = Math.min(MAX, dy * 0.5);
      pullRef.current = next;
      setPull(next);
      if (event.cancelable && next > 4) event.preventDefault();
    };
    const onEnd = () => {
      if (!start.current) return;
      start.current = null;
      if (pullRef.current >= TRIGGER) refreshRef.current?.();
      pullRef.current = 0;
      setPull(0);
    };

    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { pull, ready: pull >= TRIGGER, refreshing, threshold: TRIGGER };
}
