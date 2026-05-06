/**
 * Reusable empty-state component with optional illustration and CTA.
 */
export default function EmptyState({ icon = '◉', title, message, action }) {
  return (
    <div className="text-center py-16 px-4">
      <div className="display-serif text-6xl text-ink-700 mb-3 select-none">{icon}</div>
      <h3 className="display-serif text-2xl text-ink-100 mb-2">{title}</h3>
      {message && <p className="text-ink-400 text-sm max-w-sm mx-auto mb-6">{message}</p>}
      {action}
    </div>
  );
}
