import { useState, useEffect, useRef } from 'react';
import Avatar from './Avatar.jsx';
import { shortWebId } from '../lib/utils.js';

const TABS = [
  { id: 'home', label: 'Home', shortcut: 'h' },
  { id: 'feed', label: 'Friends', shortcut: 'f' },
  { id: 'discover', label: 'Discover', shortcut: 'd' },
  { id: 'profile', label: 'Profile', shortcut: 'p' },
];

export default function Header({ session, profile, podUrl, currentTab, onTabChange, onLogout, onCompose }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-30 bg-ink-950/80 backdrop-blur-md border-b border-ink-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-md"></div>
            <div className="relative w-7 h-7 rounded-full border-2 border-accent flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
            </div>
          </div>
          <span className="display-serif text-2xl tracking-tight">Podsta</span>
        </div>

        {/* Tabs (desktop) */}
        <nav className="hidden md:flex items-center gap-1" aria-label="Main">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentTab === tab.id
                  ? 'text-ink-50 bg-ink-800'
                  : 'text-ink-300 hover:text-ink-50 hover:bg-ink-800/50'
              }`}
              title={`Press '${tab.shortcut}'`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right cluster */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCompose}
            className="btn-primary hidden sm:inline-flex items-center gap-1.5"
            title="New post (press 'n')"
          >
            <span className="text-base leading-none">+</span>
            <span>New post</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded-full hover:ring-2 hover:ring-accent/50 transition"
              aria-label="Account menu"
            >
              <Avatar src={profile?.avatarUrl} name={profile?.name || 'You'} size="md" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 card overflow-hidden animate-slide-down">
                <div className="px-4 py-3 border-b border-ink-700">
                  <p className="font-medium text-ink-50 truncate">
                    {profile?.name || 'Anonymous'}
                  </p>
                  <p className="text-xs text-ink-400 truncate font-mono">
                    {shortWebId(session?.info?.webId)}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onTabChange('profile');
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-ink-800 transition"
                >
                  Edit profile
                </button>
                {podUrl && (
                  <a
                    href={podUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 text-sm hover:bg-ink-800 transition"
                    onClick={() => setMenuOpen(false)}
                  >
                    Open my Pod ↗
                  </a>
                )}
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-accent hover:bg-ink-800 transition border-t border-ink-700"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile tabs */}
      <nav className="md:hidden flex border-t border-ink-800 bg-ink-950/50">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
              currentTab === tab.id ? 'text-accent' : 'text-ink-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
}
