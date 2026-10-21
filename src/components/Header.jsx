import { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import NotifyBell from './NotifyBell.jsx';
import Logo from './Logo.jsx';
import ThemeSwitch from './ThemeSwitch.jsx';
import { displayHandle } from '../lib/handles.js';
import { safeHttpUrl } from '../lib/urls.js';
import { DESKTOP_NAV, PATHS } from '../lib/navigation.js';

export default function Header({ session, profile, podUrl, onLogout, onCompose, unseenCount = 0, theme }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const safePod = safeHttpUrl(podUrl);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-ink-950/85 backdrop-blur-md border-b border-ink-600/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <LinkHome />

        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {DESKTOP_NAV.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              title={`Press '${tab.shortcut}'`}
              className={({ isActive }) =>
                `px-4 py-2 rounded-full text-sm font-extrabold transition-colors ${
                  isActive ? 'text-plum bg-sunshine' : 'text-ink-300 hover:text-ink-50 hover:bg-ink-700/70'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <NotifyBell unseenCount={unseenCount} />
          <button
            type="button"
            onClick={onCompose}
            className="btn-primary hidden md:inline-flex items-center gap-1.5"
            title="New post (press 'n')"
          >
            <span className="text-lg leading-none" aria-hidden="true">
              +
            </span>
            <span>New post</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full hover:ring-2 hover:ring-accent/50 transition min-h-11 min-w-11 flex items-center justify-center"
              aria-label="Account menu"
              aria-expanded={menuOpen}
            >
              <Avatar src={profile?.avatarUrl} name={profile?.name || 'You'} size="md" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 card overflow-hidden animate-slide-down">
                <div className="px-4 py-3 border-b border-ink-600/70">
                  <p className="font-medium text-ink-50 truncate">{profile?.name || 'Anonymous'}</p>
                  <p className="text-xs text-ink-200 truncate">{displayHandle(session?.info?.webId).qualified || session?.info?.webId}</p>
                </div>
                {theme && (
                  <div className="px-4 py-3 border-b border-ink-600/70 flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-ink-300">Appearance</span>
                    <ThemeSwitch preference={theme.preference} onChange={theme.choose} compact />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(PATHS.profile);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-700/70 transition"
                >
                  Edit profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(PATHS.saved);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition"
                >
                  Saved posts
                </button>
                {safePod && (
                  <a
                    href={safePod}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 text-sm hover:bg-ink-700/70 transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open my Pod ↗
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-bold text-accent-ink hover:bg-ink-700/70 transition border-t border-ink-600/70"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function LinkHome() {
  return (
    <NavLink to={PATHS.home} className="shrink-0 rounded-xl transition-transform hover:-rotate-2 hover:scale-105" aria-label="Podsta home">
      <Logo size="sm" />
    </NavLink>
  );
}
