import mark from '../assets/podsta-mark.svg';

const SIZES = {
  sm: { mark: 'w-8 h-8', word: 'text-2xl' },
  md: { mark: 'w-10 h-10', word: 'text-3xl' },
  lg: { mark: 'w-16 h-16', word: 'text-5xl' },
};

/**
 * The brand lockup: the pea-pod mark and lowercase "podsta" in Fredoka.
 * The word is live text so it follows the theme color.
 */
export default function Logo({ size = 'sm', showWord = true, className = '' }) {
  const s = SIZES[size] || SIZES.sm;
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={mark} alt="" width="64" height="64" className={`${s.mark} shrink-0 drop-shadow-sm`} />
      {showWord && (
        <span className={`font-display font-semibold lowercase leading-none tracking-tight text-ink-50 ${s.word}`}>
          podsta
        </span>
      )}
    </span>
  );
}
