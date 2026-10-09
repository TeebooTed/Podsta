import { useEffect, useId, useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

export default function Modal({ open, onClose, children, maxWidth = 'max-w-md', title }) {
  const panelRef = useRef(null);
  const titleId = useId();
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        className={`card w-full ${maxWidth} animate-slide-up my-auto max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-ink-700 flex items-center justify-between">
            <h2 id={titleId} className="display-serif text-2xl">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-8 min-w-8 text-ink-200 hover:text-ink-50 text-2xl leading-none p-1"
              aria-label="Close"
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
