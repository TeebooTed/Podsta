/**
 * A quiet idea for a photo. Skipping it lasts until next week, on this device only.
 * Nothing here asks the browser to notify anyone.
 */
export default function WeeklyPrompt({ prompt, onCompose, onDismiss }) {
  return (
    <section className="card p-5 sm:p-6 mb-6" aria-label="This week's photo prompt">
      <p className="text-xs font-extrabold uppercase tracking-wider text-ink-100">This week</p>
      <h2 className="display-serif text-3xl mt-1 text-ink-50">{prompt}</h2>
      <p className="text-sm text-ink-100 leading-relaxed mt-2">
        A photo idea, if you feel like it. Nothing is due, and skipping it stays on this device.
      </p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className="btn-primary" onClick={onCompose}>
          Make a post
        </button>
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          Not this week
        </button>
      </div>
    </section>
  );
}
