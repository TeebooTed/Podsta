import { useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
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
          <Link to={PATHS.home} aria-label="Podsta home" className="inline-block rounded-xl">
            <Logo size="md" />
          </Link>
        </p>
        <div className="card p-6 sm:p-8">
          <h1 className="display-serif text-4xl mb-2 text-balance">Let's get you a pod</h1>
          <p className="text-sm text-ink-100 leading-relaxed mb-6">
            A pod is your own place on the web for posts. We recommend {RECOMMENDED_PROVIDER.label}.
            It's quick and it works well with Podsta.
          </p>

          {(error || localError) && (
            <p
              className="mb-4 text-sm text-ink-50 bg-accent/20 border border-accent/40 rounded-lg px-3 py-2"
              role="alert"
            >
              {error || localError}
            </p>
          )}

          <ol className="space-y-4 mb-6">
            {SIGNUP_STEPS.map((step, index) => (
              <li key={step.id} className="flex gap-3">
                <span className="shrink-0 w-8 h-8 rounded-full bg-accent text-plum font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-medium text-ink-50">{step.title}</h2>
                  <p className="text-sm text-ink-100 leading-relaxed mt-1 break-words">
                    {step.body}
                  </p>
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
            {busy || starting ? 'Opening Solid Community…' : 'Continue to Solid Community'}
          </button>

          <p className="mt-5 text-sm">
            <Link
              to={PATHS.home}
              className="text-ink-100 underline min-h-8 inline-flex items-center"
            >
              I already have a pod
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
