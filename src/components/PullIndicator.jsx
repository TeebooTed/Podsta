import mark from '../assets/podsta-mark.svg';

const RING = 2 * Math.PI * 22;

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The pod mark that follows a pull-to-refresh. A coral ring fills as you pull, the mark
 * bounces when letting go will refresh, then spins while the page reloads.
 * With reduced motion the mark stays still and the label carries the state.
 */
export default function PullIndicator({ pull, ready, refreshing, threshold = 72 }) {
  const height = refreshing ? 76 : pull;
  if (!height) return null;
  const progress = refreshing ? 1 : Math.min(1, pull / threshold);
  const still = prefersReducedMotion();
  const label = refreshing ? 'Refreshing…' : ready ? 'Let go to refresh' : 'Pull to refresh';
  return (
    <div
      className="flex flex-col items-center justify-end overflow-hidden"
      style={{ height, transition: pull ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      aria-hidden="true"
    >
      <span
        key={ready || refreshing ? 'ready' : 'pulling'}
        className={`relative grid place-items-center w-12 h-12 rounded-full bg-ink-800 shadow-lift ${
          ready && !refreshing ? 'animate-pull-bounce' : ''
        }`}
        style={
          refreshing
            ? undefined
            : { transform: `scale(${0.6 + progress * 0.4})`, opacity: 0.4 + progress * 0.6 }
        }
      >
        <svg viewBox="0 0 48 48" className="absolute inset-0 w-full h-full -rotate-90">
          <circle cx="24" cy="24" r="22" fill="none" strokeWidth="3" className="stroke-ink-600" />
          <circle
            cx="24"
            cy="24"
            r="22"
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-accent"
            strokeDasharray={RING}
            strokeDashoffset={RING * (1 - progress)}
          />
        </svg>
        <img
          src={mark}
          alt=""
          className={`relative w-7 h-7 ${refreshing && !still ? 'animate-spin-slow' : ''}`}
          style={refreshing || still ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </span>
      <span
        className="mt-1.5 mb-2 text-[11px] font-extrabold text-ink-200"
        style={{ opacity: progress }}
      >
        {label}
      </span>
    </div>
  );
}
