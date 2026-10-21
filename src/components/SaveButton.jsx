/**
 * Bookmark control. The list lives in the signed-in person's Pod.
 */
export default function SaveButton({ saved = false, busy = false, disabled = false, onToggle }) {
  const label = busy ? 'Saving' : saved ? 'Saved' : 'Save';
  return (
    <button
      type="button"
      aria-pressed={Boolean(saved)}
      aria-label={saved ? 'Remove from saved posts' : 'Save post'}
      disabled={busy || disabled}
      onClick={onToggle}
      className={`min-h-8 px-3 py-1.5 rounded-lg text-xs font-medium transition border disabled:opacity-50 ${
        saved
          ? 'bg-accent/15 text-accent border-accent/40'
          : 'bg-ink-700 text-ink-100 border-ink-600 hover:bg-ink-600'
      }`}
    >
      {label}
    </button>
  );
}
