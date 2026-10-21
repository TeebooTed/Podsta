import { THEME_CHOICES } from '../lib/theme.js';

function Icon({ id }) {
  if (id === 'light') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" />
      </svg>
    );
  }
  if (id === 'dark') {
    return (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
        <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" />
    </svg>
  );
}

/** Auto / Light / Dark, as a radio group. */
export default function ThemeSwitch({ preference, onChange, compact = false }) {
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex p-1 gap-0.5 rounded-full bg-ink-900 border border-ink-600/70">
      {THEME_CHOICES.map((choice) => {
        const selected = preference === choice.id;
        return (
          <button
            key={choice.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={compact ? `${choice.label} theme` : undefined}
            title={`${choice.label} theme`}
            onClick={() => onChange(choice.id)}
            className={`inline-flex items-center gap-1.5 min-h-9 rounded-full text-xs font-extrabold transition duration-200 ${
              compact ? 'px-2.5' : 'px-3'
            } ${selected ? 'bg-ink-800 text-ink-50 shadow-soft' : 'text-ink-300 hover:text-ink-50'}`}
          >
            <Icon id={choice.id} />
            {!compact && <span>{choice.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
