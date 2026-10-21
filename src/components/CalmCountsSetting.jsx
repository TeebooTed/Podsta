/**
 * Profile switch. On means other people do not see like counts.
 * The author still does. Likes stay in each person's own pod.
 */
export default function CalmCountsSetting({ hide = true, saving = false, onChange }) {
  return (
    <section className="card p-6 sm:p-8" aria-labelledby="calm-counts-heading">
      <h2 id="calm-counts-heading" className="display-serif text-2xl mb-2">
        Likes
      </h2>
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={hide}
          disabled={saving}
          onChange={(event) => onChange?.(event.target.checked)}
          className="mt-1 h-5 w-5 accent-accent shrink-0"
        />
        <span>
          <span className="block font-extrabold text-ink-50">Hide like counts</span>
          <span className="block text-sm text-ink-100 leading-relaxed mt-1">
            Only you see how many likes a post has. Other people can still like it. Likes stay in
            each person's own pod.
          </span>
        </span>
      </label>
      {saving && (
        <p className="text-sm text-ink-100 mt-3" aria-live="polite">
          Saving…
        </p>
      )}
    </section>
  );
}
