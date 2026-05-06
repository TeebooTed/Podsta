import { useEffect } from 'react';

/**
 * A non-modal toast that auto-dismisses after `duration` ms or on click.
 * Stacked at the top-right.
 */
export default function Toast({ message, type = 'success', onDismiss, duration = 4000 }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const styles = {
    success: 'bg-signal/95 text-ink-900',
    error: 'bg-accent/95 text-ink-50',
    info: 'bg-ink-700/95 text-ink-50 border border-ink-600',
  };

  return (
    <div
      onClick={onDismiss}
      role="status"
      className={`fixed top-4 right-4 z-50 max-w-sm cursor-pointer
                  px-5 py-3 rounded-lg shadow-2xl text-sm font-medium
                  animate-slide-down ${styles[type] || styles.success}`}
    >
      {message}
    </div>
  );
}
