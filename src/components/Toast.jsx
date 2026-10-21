import { useEffect } from 'react';

const STYLES = {
  success: { box: 'bg-mint text-plum', icon: '✓' },
  error: { box: 'bg-accent text-plum', icon: '!' },
  info: { box: 'bg-ink-800 text-ink-50 border border-ink-600', icon: 'i' },
};

/**
 * A non-modal toast that auto-dismisses after `duration` ms or on click.
 * Top-right on a desktop, above the tab bar on a phone.
 */
export default function Toast({ message, type = 'success', onDismiss, duration = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const style = STYLES[type] || STYLES.success;

  return (
    <div
      onClick={onDismiss}
      role="status"
      className={`fixed z-50 inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:inset-x-auto md:bottom-auto md:top-4 md:right-4 md:max-w-sm
                  cursor-pointer flex items-start gap-3 px-4 py-3 rounded-2xl shadow-lift text-sm font-bold
                  animate-pop-in ${style.box}`}
    >
      <span
        className="shrink-0 w-5 h-5 mt-px rounded-full bg-plum/15 flex items-center justify-center text-xs font-extrabold"
        aria-hidden="true"
      >
        {style.icon}
      </span>
      <span className="min-w-0">{message}</span>
    </div>
  );
}
