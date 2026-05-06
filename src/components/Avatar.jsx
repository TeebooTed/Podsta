import { initials } from '../lib/utils.js';

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export default function Avatar({ src, name, size = 'md', className = '' }) {
  const sizeClass = sizes[size] || sizes.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        loading="lazy"
        className={`${sizeClass} rounded-full object-cover bg-ink-700 ring-1 ring-ink-600 ${className}`}
        onError={(e) => {
          // If avatar fails to load, swap it for the initials fallback.
          e.currentTarget.style.display = 'none';
          e.currentTarget.nextSibling?.style?.removeProperty('display');
        }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br from-ink-600 to-ink-700
                  text-ink-100 font-semibold flex items-center justify-center
                  ring-1 ring-ink-600 ${className}`}
    >
      {initials(name)}
    </div>
  );
}
