import mark from '../assets/podsta-mark.svg';
import WordmarkSvg from './WordmarkSvg.jsx';

// Heights keep the lockup at least 96px wide (brand/BRAND.md minimum).
const SIZES = {
  sm: { mark: 'w-8 h-8', lockup: 'h-8' },
  md: { mark: 'w-10 h-10', lockup: 'h-10' },
  lg: { mark: 'w-16 h-16', lockup: 'h-16' },
};

/**
 * The brand lockup from brand/: the pea-pod tile and the lowercase "podsta" wordmark, spaced as built.
 * One inline SVG: Plum type on light themes, Cream type in dark mode. Without the word, only the tile shows.
 */
export default function Logo({ size = 'sm', showWord = true, className = '' }) {
  const s = SIZES[size] || SIZES.sm;
  if (!showWord) {
    return (
      <img src={mark} alt="" width="64" height="64" className={`${s.mark} shrink-0 ${className}`} />
    );
  }
  return (
    <WordmarkSvg
      className={`${s.lockup} w-auto aspect-[4248/1020] shrink-0 text-plum dark:text-cream ${className}`}
    />
  );
}
