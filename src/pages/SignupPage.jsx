import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RECOMMENDED_PROVIDER, SIGNUP_STEPS } from '../lib/provider.js';
import { PATHS } from '../lib/navigation.js';

/**
 * The no-Pod path. The account form stays on Solid Community.
 * Starting sign-in there is what brings a new WebID back to Podsta.
 */
export default function SignupPage({ onBegin, busy = false, error = '' }) {
  const [starting, setStarting] = useState(false);
  const [localError, setLocalError] = useState('');

  const begin = async () => {
    setStarting(true);
    setLocalError('');
    try {
      await onBegin();
    } catch (err) {
      setLocalError(err?.message || 'Could not open Solid Community. Try again.');
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <p className="text-center mb-6">
          <Link to={PATHS.home} className="display-serif text-3xl text-ink-50">
            Podsta
          </Link>
        </p>
        <div className="card p-6 sm:p-8">
          <h1 className="display-serif text-4xl mb-2 text-balance">I don't have a Pod</h1>
          <p className="text-sm text-ink-100 leading-relaxed mb-6">
            A Pod is your own place on the web for posts. Podsta recommends {RECOMMENDED_PROVIDER.label}{' '}
            ({RECOMMENDED_PROVIDER.host}) because that server uses Web Access Control, which is how Podsta shares posts.
          </p>

          {(error || localError) && (
            <p className="mb-4 text-sm text-ink-50 bg-accent/20 border border-accent/40 rounded-lg px-3 py-2" role="alert">
              {error || localError}
            </p>
          )}

          <ol className="space-y-4 mb-6">
            {SIGNUP_STEPS.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-accent text-ink-950 font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-ink-50">{step.title}</h2>
                  <p className="text-sm text-ink-100 leading-relaxed mt-1 break-words">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <button
            type="button"
            onClick={begin}
            disabled={busy || starting}
            className="btn-primary w-full"
          >
            {busy || starting ? 'Opening Solid Community…' : 'Continue on Solid Community'}
          </button>
          <p className="text-xs text-ink-200 mt-3 leading-relaxed">
            On their page, choose Sign up. After the Pod exists, sign in if they ask. Podsta reads the WebID from the return.
          </p>

          <p className="mt-5 text-sm">
            <Link to={PATHS.home} className="text-ink-100 underline min-h-8 inline-flex items-center">
              I already have a Pod
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
