import { useState } from 'react';
import { login } from '../lib/auth.js';

const PROVIDERS = [
  { url: 'https://login.inrupt.com', label: 'Inrupt', hint: 'pod.inrupt.com (recommended)' },
  { url: 'https://solidcommunity.net', label: 'Solid Community', hint: 'solidcommunity.net' },
  { url: 'https://solidweb.org', label: 'SolidWeb', hint: 'solidweb.org' },
];

export default function LoginPage({ error }) {
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [customIssuer, setCustomIssuer] = useState('');

  const doLogin = async (issuer) => {
    setBusy(true);
    try {
      await login(issuer);
    } catch (err) {
      console.error('Login failed:', err);
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-10">
          <div className="inline-block mb-4">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl animate-pulse-soft"></div>
              <div className="relative w-12 h-12 rounded-full border-2 border-accent flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-accent"></div>
              </div>
            </div>
          </div>
          <h1 className="display-serif text-5xl mb-2 tracking-tight">Podsta</h1>
          <p className="text-ink-300 italic font-light">
            your posts. your pod. your rules.
          </p>
        </div>

        <div className="card p-7">
          <h2 className="display-serif text-2xl mb-2 text-balance">
            Sign in with your Solid Pod
          </h2>
          <p className="text-sm text-ink-400 mb-5 leading-relaxed">
            Podsta doesn't have accounts. Your data lives in a Solid Pod — a personal
            data store you control. Choose your provider to continue.
          </p>

          {error && (
            <p className="mb-4 text-sm text-accent bg-accent/10 border border-accent/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.url}
                onClick={() => doLogin(p.url)}
                disabled={busy}
                className="w-full text-left px-4 py-3 bg-ink-800/60 hover:bg-ink-700 border border-ink-700 hover:border-ink-600 rounded-lg transition disabled:opacity-50"
              >
                <div className="font-medium text-ink-50">{p.label}</div>
                <div className="text-xs text-ink-400 mt-0.5">{p.hint}</div>
              </button>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-ink-700">
            <button
              onClick={() => setAdvanced((v) => !v)}
              className="text-xs text-ink-400 hover:text-ink-200"
            >
              {advanced ? '− Hide' : '+ Use a custom provider'}
            </button>
            {advanced && (
              <div className="mt-3 space-y-2">
                <input
                  type="url"
                  value={customIssuer}
                  onChange={(e) => setCustomIssuer(e.target.value)}
                  placeholder="https://your-solid-provider.example"
                  className="input-field text-sm"
                />
                <button
                  onClick={() => customIssuer && doLogin(customIssuer)}
                  disabled={busy || !customIssuer}
                  className="btn-secondary w-full text-sm"
                >
                  Sign in with custom provider
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="text-center mt-6 text-xs text-ink-400">
          New to Solid?{' '}
          <a
            href="https://solidproject.org/users/get-a-pod"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-accent-light underline"
          >
            Get a free Pod →
          </a>
        </p>
      </div>
    </div>
  );
}
