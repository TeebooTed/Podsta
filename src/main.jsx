import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { routerBasename } from './lib/appUrl.js';
import { hasStoredSession } from './lib/sessionHint.js';
import { registerServiceWorker } from './lib/pwa.js';
import SignedOut from './SignedOut.jsx';
import './styles/index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

function render(node) {
  root.render(
    <React.StrictMode>
      <BrowserRouter basename={routerBasename(import.meta.env.BASE_URL)}>{node}</BrowserRouter>
    </React.StrictMode>,
  );
}

function Booting() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-live="polite">
      <p className="text-ink-300 text-sm">Resuming session…</p>
    </div>
  );
}

registerServiceWorker();

const stored = hasStoredSession(
  typeof window === 'undefined' ? null : window.localStorage,
  typeof window === 'undefined' ? '' : window.location.search,
);

if (stored) {
  render(<Booting />);
  import('./App.jsx').then(({ default: App }) => render(<App />));
} else {
  render(<SignedOut />);
}
