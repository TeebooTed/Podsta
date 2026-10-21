const base = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
};

export function HeartIcon({ filled = false, className = 'w-5 h-5', ...rest }) {
  return (
    <svg {...base} fill={filled ? 'currentColor' : 'none'} className={className} {...rest}>
      <path d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2 0 3.6 1.1 4.8 2.8C13.2 5.1 14.8 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z" />
    </svg>
  );
}

export function ChatIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M20.5 11.6c0 4.3-3.8 7.7-8.5 7.7-1.2 0-2.3-.2-3.3-.6L3.5 20l1.3-3.8c-.8-1.3-1.3-2.8-1.3-4.5C3.5 7.3 7.3 3.9 12 3.9s8.5 3.4 8.5 7.7z" />
    </svg>
  );
}

export function LinkIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} className={className}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
    </svg>
  );
}

export function ChevronIcon({ direction = 'right', className = 'w-5 h-5' }) {
  return (
    <svg {...base} strokeWidth={2.5} className={className}>
      {direction === 'left' ? <path d="M15 5l-7 7 7 7" /> : <path d="M9 5l7 7-7 7" />}
    </svg>
  );
}

export function CloseIcon({ className = 'w-5 h-5' }) {
  return (
    <svg {...base} strokeWidth={2.5} className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function StackIcon({ className = 'w-4 h-4' }) {
  return (
    <svg {...base} className={className}>
      <rect x="7" y="7" width="13" height="13" rx="3" fill="currentColor" stroke="none" />
      <path d="M4 15.5V6.5A2.5 2.5 0 0 1 6.5 4h9" />
    </svg>
  );
}

export function LockIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

export function PeopleIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.6.8 2.7 2.6 3 5.2" />
    </svg>
  );
}
