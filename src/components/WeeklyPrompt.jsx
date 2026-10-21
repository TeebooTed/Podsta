/**
 * Optional weekly photo prompt. The parent decides whether friends are active.
 */
export default function WeeklyPrompt({ prompt, onPost, onDismiss }) {
  if (!prompt?.title) return null;
  return (
    <section className="card p-5 mb-6" aria-labelledby="weekly-prompt-heading">
      <p className="text-xs font-extrabold uppercase tracking-wide text-ink-200">This week</p>
      <h2 id="weekly-prompt-heading" className="display-serif text-2xl text-ink-50 mt-1">
        {prompt.title}
      </h2>
      <p className="text-sm text-ink-100 leading-relaxed mt-1">{prompt.body}</p>
      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className="btn-primary" onClick={onPost}>
          Post a photo
        </button>
        <button type="button" className="btn-secondary" onClick={onDismiss}>
          Not this week
        </button>
      </div>
    </section>
  );
}
