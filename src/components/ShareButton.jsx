import { shareOrCopy } from '../lib/shareOut.js';
import { copyToClipboard } from '../lib/utils.js';

/**
 * Hand a post to another app on this device, or copy the Podsta link.
 */
export default function ShareButton({ payload, onResult, className = '' }) {
  if (!payload) return null;
  const onClick = async () => {
    const share = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
      ? (data) => navigator.share(data)
      : null;
    const result = await shareOrCopy(payload, { share, copy: copyToClipboard });
    onResult?.(result);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 px-3 py-1.5 bg-ink-700 hover:bg-ink-600 rounded-lg text-xs text-ink-100 transition ${className}`}
    >
      Share
    </button>
  );
}
