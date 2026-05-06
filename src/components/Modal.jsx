import { useEffect } from 'react';

export default function Modal({ open, onClose, children, maxWidth = 'max-w-md', title }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
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
      className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`card w-full ${maxWidth} animate-slide-up`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-ink-700 flex items-center justify-between">
            <h2 className="display-serif text-2xl">{title}</h2>
            <button
              onClick={onClose}
              className="text-ink-300 hover:text-ink-50 text-2xl leading-none p-1"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
