import { useEffect, useState } from 'react';
import { initials } from '../lib/utils.js';
import { safeHttpUrl } from '../lib/urls.js';

const sizes = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

function Initials({ name, sizeClass, className }) {
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
      className={`${sizeClass} rounded-full object-cover bg-ink-700 ring-1 ring-ink-600 ${className}`}
      onError={() => setBroken(true)}
    />
  );
}
