import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OTHER_PROVIDERS, RECOMMENDED_PROVIDER } from '../lib/provider.js';
import { PATHS } from '../lib/navigation.js';

/**
 * Existing-Pod sign-in. One recommended server, then other hosts.
 * People without a Pod take the separate guide.
 */
export default function LoginPage({ error, onLogin, busy = false }) {
  const [advanced, setAdvanced] = useState(false);
  const [customIssuer, setCustomIssuer] = useState('');
  const [localError, setLocalError] = useState(null);
  const [pending, setPending] = useState(false);

  const doLogin = async (issuer) => {
    setPending(true);
    setLocalError(null);
    try {
      await onLogin(issuer);
    } catch (err) {
      console.error('Login failed:', err);
      setLocalError(err?.message || 'Could not reach that provider. Check the address and try again.');
      setPending(false);
    }
  };

  const working = busy || pending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
          <p className="text-ink-200 italic font-light">your posts. your pod. your rules.</p>
        </div>

        <div className="card p-7">
          <h2 className="display-serif text-2xl mb-2 text-balance">Sign in with your Pod</h2>
          <p className="text-sm text-ink-100 mb-5 leading-relaxed">
            Podsta does not have its own accounts. Your posts live in a Solid Pod you control.
            {RECOMMENDED_PROVIDER.label} is the place to start. It uses Web Access Control, which this beta can share with.
          </p>

          {(error || localError) && (
            <p className="mb-4 text-sm text-ink-50 bg-accent/20 border border-accent/40 rounded-lg px-3 py-2" role="alert">
              {error || localError}
            </p>
          )}

          <button
            type="button"
            onClick={() => doLogin(RECOMMENDED_PROVIDER.issuer)}
            disabled={working}
            className="w-full text-left px-4 py-3 bg-accent hover:bg-accent-light text-ink-950 rounded-lg transition disabled:opacity-50"
          >
            <div className="font-medium">Sign in</div>
            <div className="text-xs mt-0.5">{RECOMMENDED_PROVIDER.host} · I already have a Pod</div>
          </button>

          <Link
            to={PATHS.start}
            className="mt-2 w-full text-left px-4 py-3 bg-ink-800/60 hover:bg-ink-700 border border-ink-600 rounded-lg transition block"
          >
            <div className="font-medium text-ink-50">I don't have a Pod</div>
            <div className="text-xs text-ink-200 mt-0.5">Create one on {RECOMMENDED_PROVIDER.label}, then come back</div>
          </Link>

          <div className="mt-4 pt-4 border-t border-ink-700">
            <button
              type="button"
              onClick={() => setAdvanced((value) => !value)}
              className="text-sm text-ink-100 hover:text-ink-50 min-h-8"
              aria-expanded={advanced}
            >
              {advanced ? 'Hide other providers' : 'I use a different Pod host'}
            </button>
            {advanced && (
              <div className="mt-3 space-y-2">
                {OTHER_PROVIDERS.map((provider) => (
                  <button
                    key={provider.url}
                    type="button"
                    onClick={() => doLogin(provider.url)}
                    disabled={working}
                    className="w-full text-left px-4 py-3 bg-ink-800/60 hover:bg-ink-700 border border-ink-700 hover:border-ink-600 rounded-lg transition disabled:opacity-50"
                  >
                    <div className="font-medium text-ink-50">{provider.label}</div>
                    <div className="text-xs text-ink-200 mt-0.5">{provider.hint}</div>
                  </button>
                ))}
                <label htmlFor="custom-issuer" className="block text-xs text-ink-200">
                  Provider address. Sharing works only if this server uses Web Access Control.
                </label>
                <input
                  id="custom-issuer"
                  type="url"
                  value={customIssuer}
                  onChange={(event) => setCustomIssuer(event.target.value)}
                  placeholder="https://your-solid-provider.example"
                  className="input-field text-sm"
                />
                <button
                  type="button"
                  onClick={() => customIssuer && doLogin(customIssuer)}
                  disabled={working || !customIssuer}
                  className="btn-secondary w-full text-sm"
                >
                  Sign in with custom provider
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
