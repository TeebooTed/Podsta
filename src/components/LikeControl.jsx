import { useState } from 'react';

/**
 * Like button, count, and names.
 * The count is omitted when this Pod has not published a list the viewer can read.
 */
export default function LikeControl({ liked = false, count = null, names = [], busy = false, onToggle }) {
  const [open, setOpen] = useState(false);
  const countLabel = typeof count === 'number' ? `${count} ${count === 1 ? 'like' : 'likes'}` : 'Like count not published yet';

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={`min-h-11 px-3 rounded-lg text-sm ${liked ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-50'}`}
          aria-pressed={liked}
          disabled={busy}
          onClick={onToggle}
        >
          {busy ? 'Saving…' : liked ? 'Liked' : 'Like'}
        </button>
        {typeof count === 'number' && (
          <span className="text-sm text-ink-100 px-1" aria-label={countLabel}>
            {count}
          </span>
        )}
        {names.length > 0 && (
          <button
            type="button"
            className="min-h-11 px-2 text-sm text-ink-200"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            Who
          </button>
        )}
      </div>
      {open && names.length > 0 && (
        <ul className="mt-1 space-y-1" aria-label="People who liked this">
          {names.map((name) => (
            <li key={name} className="text-sm text-ink-100 break-words">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
