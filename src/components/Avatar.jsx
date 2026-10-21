import { useEffect, useState } from 'react';
import { initials, hashString } from '../lib/utils.js';
import { safeHttpUrl } from '../lib/urls.js';

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

// Plum initials on a brand color picked from the name, so one person keeps one color.
const TINTS = [
  'from-[#FF8A4C] to-[#FF6B57]',
  'from-[#FFD66E] to-[#FFC547]',
  'from-[#6FE6C0] to-[#3DD9A8]',
  'from-[#F7A1BD] to-[#EE6F98]',
  'from-[#FFB59E] to-[#FFC547]',
];

function Initials({ name, sizeClass, className }) {
  const tint = TINTS[Math.abs(Number.parseInt(hashString(name || '?'), 36) || 0) % TINTS.length];
  return (
    <div
      className={`${sizeClass} rounded-full bg-gradient-to-br ${tint}
                  text-plum font-display font-semibold flex items-center justify-center
                  ring-2 ring-ink-800 ${className}`}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}

export default function Avatar({ src, name, size = 'md', className = '' }) {
  const sizeClass = sizes[size] || sizes.md;
  const safeSrc = safeHttpUrl(src);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [safeSrc]);

  if (!safeSrc || broken) {
    return <Initials name={name} sizeClass={sizeClass} className={className} />;
  }

  return (
    <img
      src={safeSrc}
      alt={name || 'avatar'}
      loading="lazy"
      className={`${sizeClass} rounded-full object-cover bg-ink-700 ring-2 ring-ink-800 ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
