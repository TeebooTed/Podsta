import { useRef, useState } from 'react';
import { HeartIcon } from './icons.jsx';

/**
 * Like button, count, and names.
 * The count is omitted when this Pod has not published a list the viewer can read.
 * While a like is saving, the heart shows the state being saved; it settles back if the save fails.
 */
export default function LikeControl({
  liked = false,
  count = null,
  names = [],
  busy = false,
  onToggle,
}) {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState(null);
  const [celebrate, setCelebrate] = useState(0);
  const shown = busy && intent !== null ? intent : liked;
  const hasCount = typeof count === 'number';
  const firstCount = useRef(count);
  const countMotion = count !== firstCount.current ? 'animate-count-up' : '';

  const toggle = () => {
    const next = !liked;
    setIntent(next);
    if (next) setCelebrate((value) => value + 1);
    onToggle?.();
  };

  return (
    <div className="min-w-0">
      <div className="flex items-center">
        <button
          type="button"
          className={`relative grid place-items-center w-11 h-11 rounded-full transition-colors duration-200 hover:bg-accent/10 disabled:cursor-progress ${
            shown ? 'text-accent' : 'text-ink-100 hover:text-accent-ink'
          }`}
          aria-pressed={liked}
          aria-busy={busy}
          disabled={busy}
          onClick={toggle}
        >
          <span className="sr-only">{busy ? 'Saving like' : 'Like'}</span>
          {celebrate > 0 && shown && (
            <span
              key={`ring-${celebrate}`}
              className="pointer-events-none absolute inset-1.5 rounded-full border-2 border-accent animate-like-ring"
              aria-hidden="true"
            />
          )}
          <HeartIcon
            key={`heart-${celebrate}`}
            filled={shown}
            className={`w-6 h-6 ${celebrate > 0 && shown ? 'animate-heart-pop' : ''} ${busy ? 'opacity-80' : ''}`}
          />
        </button>
        {hasCount &&
          (names.length > 0 ? (
            <button
              type="button"
              className="min-h-11 pr-2 text-sm font-bold text-ink-100 hover:text-ink-50 tabular-nums"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <span key={count} className={`inline-block ${countMotion}`}>
                {count}
              </span>
              <span className="sr-only"> {count === 1 ? 'like' : 'likes'}, show who</span>
            </button>
          ) : (
            <span className="pr-2 text-sm font-bold text-ink-100 tabular-nums">
              <span key={count} className={`inline-block ${countMotion}`}>
                {count}
              </span>
              <span className="sr-only"> {count === 1 ? 'like' : 'likes'}</span>
            </span>
          ))}
      </div>
      {open && names.length > 0 && (
        <ul
          className="mt-1 mb-1 flex flex-wrap gap-1.5 animate-slide-down"
          aria-label="People who liked this"
        >
          {names.map((name) => (
            <li key={name} className="chip bg-accent/10 text-ink-50 break-words max-w-full">
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
