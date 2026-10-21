import mark from '../assets/podsta-mark.svg';

/** The pod mark that follows a pull-to-refresh, then spins while the feed reloads. */
export default function PullIndicator({ pull, ready, refreshing }) {
  const height = refreshing ? 56 : pull;
  if (!height) return null;
  const progress = Math.min(1, pull / 72);
  return (
    <div
      className="flex items-end justify-center overflow-hidden"
      style={{ height, transition: pull ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
      aria-hidden="true"
    >
      <span
        className={`mb-2 grid place-items-center w-10 h-10 rounded-full bg-ink-800 shadow-lift border border-ink-600/70 ${
          ready ? 'ring-2 ring-accent/60' : ''
        }`}
        style={refreshing ? undefined : { transform: `scale(${0.6 + progress * 0.4})`, opacity: 0.4 + progress * 0.6 }}
      >
        <img
          src={mark}
          alt=""
          className={`w-7 h-7 ${refreshing ? 'animate-spin-slow' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }}
        />
      </span>
    </div>
  );
}
