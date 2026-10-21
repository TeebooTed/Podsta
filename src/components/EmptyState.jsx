import Illustration from './Illustration.jsx';

const SPARKLES = [
  { pos: 'left-[6%] top-[14%]', size: 'w-5 h-5', color: 'text-sunshine', delay: '0s' },
  { pos: 'right-[8%] top-[6%]', size: 'w-3.5 h-3.5', color: 'text-berry', delay: '0.9s' },
  { pos: 'right-[2%] top-[58%]', size: 'w-4 h-4', color: 'text-mint', delay: '1.7s' },
  { pos: 'left-[12%] bottom-[8%]', size: 'w-3 h-3', color: 'text-accent', delay: '2.4s' },
];

function Sparkle({ className, style }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0c.6 6.2 5.8 11.4 12 12-6.2.6-11.4 5.8-12 12-.6-6.2-5.8-11.4-12-12C6.2 11.4 11.4 6.2 12 0z" />
    </svg>
  );
}

/**
 * Empty state with a brand spot illustration (`art`) or a glyph (`icon`), a title, and an optional action.
 * A soft glow and a few twinkling sparkles keep it friendly; they hold still for reduced motion.
 */
export default function EmptyState({ art, icon = '◉', title, message, action }) {
  return (
    <div className="text-center py-12 px-4 animate-fade-in">
      <div className={`relative mx-auto ${art ? 'w-60 sm:w-72 mb-2' : 'w-28 mb-4'}`}>
        <span
          className="absolute inset-[12%] rounded-full bg-sunshine/20 dark:bg-sunshine/10 blur-2xl"
          aria-hidden="true"
        />
        {SPARKLES.map((sparkle) => (
          <Sparkle
            key={sparkle.pos}
            className={`absolute ${sparkle.pos} ${sparkle.size} ${sparkle.color} opacity-80 motion-safe:animate-twinkle`}
            style={{ animationDelay: sparkle.delay }}
          />
        ))}
        {art ? (
          <Illustration
            name={art}
            className="relative w-52 sm:w-60 mx-auto motion-safe:animate-float"
          />
        ) : (
          <div
            className="relative mx-auto my-6 grid place-items-center w-16 h-16 rounded-full bg-sunshine/25 font-display text-3xl text-plum dark:text-sunshine select-none motion-safe:animate-float"
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
      </div>
      <h3 className="font-display font-semibold text-2xl text-ink-50 mb-2 text-balance">{title}</h3>
      <span className="flex justify-center gap-1.5 mb-3" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-accent" />
        <span className="w-1.5 h-1.5 rounded-full bg-sunshine" />
        <span className="w-1.5 h-1.5 rounded-full bg-mint" />
      </span>
      {message && (
        <p className="text-ink-200 text-sm max-w-sm mx-auto mb-6 leading-relaxed text-pretty">
          {message}
        </p>
      )}
      {action}
    </div>
  );
}
