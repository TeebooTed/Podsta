import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFocusTrap } from '../hooks/useFocusTrap.js';
import { WHATS_NEW, WHATS_NEW_EVENT, markWhatsNewSeen, whatsNewState } from '../lib/whatsNew.js';
import { PATHS } from '../lib/navigation.js';
import { CloseIcon } from './icons.jsx';

const GLYPHS = {
  profile:
    'M5 4h14a2 2 0 0 1 2 2v9l-4.5-4.5-5 5-2.5-2.5L3 19V6a2 2 0 0 1 2-2zm3.5 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  card: 'M4 4h6v6H4zm2 2v2h2V6zm8-2h6v6h-6zm2 2v2h2V6zM4 14h6v6H4zm2 2v2h2v-2zm8-2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm-4 4h2v2h-2zm4 0h2v2h-2z',
  offline:
    'M7 18a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 19 9.5a4.25 4.25 0 0 1-.75 8.5zm5-10v5.6l-2-2-1.4 1.4 4.4 4.4 4.4-4.4-1.4-1.4-2 2V8z',
  photos:
    'M7 3h12a2 2 0 0 1 2 2v12h-2V5H7zM3 7h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z',
  location:
    'M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5z',
};

/**
 * A short sheet about recent changes. Opens by itself once per list for people who
 * already know the app, and again from anything that calls openWhatsNew().
 * A bottom sheet on phones, a centred card on wider screens.
 */
export default function WhatsNew({ webId }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const titleId = useId();
  const navigate = useNavigate();
  useFocusTrap(open, panelRef);

  useEffect(() => {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    const state = whatsNewState(storage, webId);
    if (state === 'new-user') markWhatsNewSeen(storage);
    if (state !== 'show') return undefined;
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [webId]);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(WHATS_NEW_EVENT, show);
    return () => window.removeEventListener(WHATS_NEW_EVENT, show);
  }, []);

  const close = () => {
    markWhatsNewSeen(window.localStorage);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      markWhatsNewSeen(window.localStorage);
      setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4 bg-ink-950/70 backdrop-blur-sm animate-fade-in"
      onClick={close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="card relative w-full sm:max-w-md max-h-[88vh] overflow-y-auto rounded-b-none sm:rounded-3xl px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:pt-6 motion-safe:animate-sheet-up sm:motion-safe:animate-slide-up"
      >
        <span
          className="mx-auto mb-4 block h-1.5 w-10 rounded-full bg-ink-600 sm:hidden"
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 grid place-items-center w-10 h-10 rounded-full text-ink-200 hover:text-ink-50 hover:bg-ink-900"
          aria-label="Close"
        >
          <CloseIcon />
        </button>
        <span className="inline-flex items-center rounded-full bg-sunshine px-2.5 py-0.5 text-xs font-extrabold text-plum">
          New
        </span>
        <h2 id={titleId} className="display-serif text-3xl mt-2">
          What’s new in Podsta
        </h2>
        <ul className="mt-5 space-y-4">
          {WHATS_NEW.map((item, i) => (
            <li
              key={item.id}
              className="flex gap-3.5 motion-safe:animate-slide-up"
              style={{ animationDelay: `${120 + i * 60}ms`, animationFillMode: 'both' }}
            >
              <span
                className={`shrink-0 grid place-items-center w-10 h-10 rounded-2xl ${item.tint} ${
                  item.id === 'location' ? 'text-cream dark:text-plum' : 'text-plum'
                }`}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d={GLYPHS[item.id]} />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold text-lg leading-tight">
                  {item.title}
                </span>
                <span className="block text-sm text-ink-100 leading-relaxed mt-0.5">
                  {item.body}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              close();
              navigate(PATHS.profile);
            }}
          >
            Open my profile
          </button>
          <button type="button" className="btn-primary" onClick={close}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
