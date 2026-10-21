import Illustration from './Illustration.jsx';

/**
 * Empty state with a brand spot illustration (`art`) or a glyph (`icon`), a title, and an optional action.
 */
export default function EmptyState({ art, icon = '◉', title, message, action }) {
  return (
    <div className="text-center py-12 px-4 animate-fade-in">
      {art ? (
        <Illustration name={art} className="w-52 sm:w-60 mx-auto mb-2 motion-safe:animate-float" />
      ) : (
        <div
          className="mx-auto mb-4 grid place-items-center w-16 h-16 rounded-full bg-sunshine/25 font-display text-3xl text-plum dark:text-sunshine select-none"
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <h3 className="font-display font-semibold text-2xl text-ink-50 mb-2 text-balance">{title}</h3>
      {message && (
        <p className="text-ink-200 text-sm max-w-sm mx-auto mb-6 leading-relaxed text-pretty">
          {message}
        </p>
      )}
      {action}
    </div>
  );
}
