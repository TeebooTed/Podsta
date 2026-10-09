import { NavLink } from 'react-router-dom';
import { PHONE_NAV } from '../lib/navigation.js';

const linkClass = ({ isActive }) =>
  `flex flex-col items-center justify-center gap-0.5 min-h-12 px-1 text-xs font-medium ${
    isActive ? 'text-ink-50' : 'text-ink-300'
  }`;

/**
 * Phone navigation. Desktop keeps the header. The bar clears the home indicator
 * via safe-area padding, and the page adds matching space above it.
 */
export default function BottomNav({ onCompose }) {
  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-ink-800 bg-ink-950/95 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main"
    >
      <div className="grid grid-cols-4 h-16">
        {PHONE_NAV.map((item) =>
          item.action === 'compose' ? (
            <button
              key={item.label}
              type="button"
              onClick={onCompose}
              className="flex flex-col items-center justify-center gap-0.5 min-h-12 text-ink-100"
            >
              <span
                className="w-8 h-8 rounded-full bg-accent text-ink-950 text-lg leading-none flex items-center justify-center"
                aria-hidden="true"
              >
                +
              </span>
              <span className="text-xs font-medium leading-none">{item.label}</span>
            </button>
          ) : (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
              {({ isActive }) => (
                <>
                  <span
                    className={`h-0.5 w-6 rounded-full ${isActive ? 'bg-accent' : 'bg-transparent'}`}
                    aria-hidden="true"
                  />
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
