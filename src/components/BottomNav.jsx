import { NavLink } from 'react-router-dom';
import { PATHS, PHONE_NAV } from '../lib/navigation.js';

const ICONS = {
  [PATHS.home]: (
    <path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19v-8.5Z" />
  ),
  [PATHS.discover]: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  [PATHS.profile]: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20c.9-3.6 3.9-5.6 7.5-5.6s6.6 2 7.5 5.6" />
    </>
  ),
};

function NavIcon({ to, active }) {
  const shape = ICONS[to];
  if (!shape) return <span className="h-6" aria-hidden="true" />;
  return (
    <svg
      viewBox="0 0 24 24"
      className={`w-6 h-6 transition-transform duration-300 ease-spring ${active ? 'scale-110' : ''}`}
      fill={active ? 'currentColor' : 'none'}
      fillOpacity={active ? 0.18 : 0}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}

/**
 * Phone navigation. Desktop keeps the header. The bar clears the home indicator
 * via safe-area padding, and the page adds matching space above it.
 */
export default function BottomNav({ onCompose }) {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-ink-600/60 bg-ink-950/90 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="grid h-16" style={{ gridTemplateColumns: `repeat(${PHONE_NAV.length}, minmax(0, 1fr))` }}>
        {PHONE_NAV.map((item) =>
          item.action === 'compose' ? (
            <button
              key={item.label}
              type="button"
              onClick={onCompose}
              className="group flex flex-col items-center justify-center gap-0.5 min-h-12 text-ink-100"
            >
              <span
                className="w-11 h-9 rounded-2xl bg-gradient-to-br from-[#FF8A4C] via-accent to-berry text-cream text-2xl font-display leading-none flex items-center justify-center shadow-soft transition-transform duration-300 ease-spring group-active:scale-90"
                aria-hidden="true"
              >
                +
              </span>
              <span className="text-[11px] font-extrabold leading-none">{item.label}</span>
            </button>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 min-h-12 px-1 text-[11px] font-extrabold transition-colors ${
                  isActive ? 'text-accent-ink' : 'text-ink-300'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <NavIcon to={item.to} active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}
