import { NavLink } from 'react-router-dom';
import { PATHS } from '../lib/navigation.js';
import { badgeLabel, badgeText } from '../lib/notifications.js';

export default function NotifyBell({ unseenCount = 0 }) {
  const countLabel = badgeText(unseenCount);
  return (
    <NavLink
      to={PATHS.notifications}
      className="relative min-h-11 min-w-11 inline-flex items-center justify-center rounded-full text-ink-100 hover:text-ink-50 hover:bg-ink-800/50"
      aria-label={badgeLabel(unseenCount)}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13.5 6 9.5Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path d="M10 18.5a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {countLabel && (
        <span className="absolute top-1 right-0 min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-accent text-ink-950 text-[10px] font-semibold leading-none flex items-center justify-center">
          {countLabel}
        </span>
      )}
    </NavLink>
  );
}
