import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusable(root) {
  if (!root) return [];
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.getAttribute('aria-hidden') !== 'true');
}

/**
 * Move focus into a dialog and keep Tab inside it until the dialog closes.
 * Restores focus to whatever was active before the dialog opened.
 */
export function useFocusTrap(active, containerRef) {
  const previous = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const root = containerRef.current;
    if (!root) return undefined;

    previous.current = document.activeElement;
    if (!root.hasAttribute('tabindex')) root.setAttribute('tabindex', '-1');
    root.focus();

    const onKey = (event) => {
      if (event.key !== 'Tab') return;
      const items = focusable(root);
      if (!items.length) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement;
      if (event.shiftKey && (current === first || current === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKey);
    return () => {
      root.removeEventListener('keydown', onKey);
      const back = previous.current;
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, [active, containerRef]);
}
