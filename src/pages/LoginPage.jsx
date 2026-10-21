import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OTHER_PROVIDERS, RECOMMENDED_PROVIDER } from '../lib/provider.js';
import { PATHS } from '../lib/navigation.js';
import homeDesktop from '../../docs/screenshots/home-desktop.png';
import homePhone from '../../docs/screenshots/home-phone.png';
import profilePhone from '../../docs/screenshots/profile-phone.png';

const SHOTS = [
  {
    src: homeDesktop,
    alt: 'Home feed on a desktop, with a post of two photos and a like count.',
    caption: 'Home is the people you follow',
  },
  {
    src: homePhone,
    alt: 'The home feed on a phone, with Home, Discover, New post, and Profile along the bottom.',
    caption: 'The same feed on a phone',
  },
  {
    src: profilePhone,
    alt: 'A profile on a phone, with a name, a short bio, and a grid of posts.',
    caption: 'Your own posts stay on your profile',
  },
];

/**
 * Public landing, then existing-Pod sign-in.
 * The identity provider choice is open before anyone signs in.
 */
export default function LoginPage({ error, onLogin, busy = false }) {
  const [advanced, setAdvanced] = useState(true);
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
    <div className="min-h-screen px-4 pt-10 pb-16">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10 max-w-2xl">
          <div className="relative w-12 h-12 mb-4 flex items-center justify-center">
            <div className="absolute inset-0 bg-accent/20 rounded-full blur-xl"></div>
            <div className="relative w-12 h-12 rounded-full border-2 border-accent flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-accent"></div>
            </div>
          </div>
          <h1 className="display-serif text-5xl mb-3 tracking-tight">Podsta</h1>
          <p className="text-ink-100 text-lg leading-relaxed">
            Text and photo posts that live in your Solid Pod. There is no Podsta server and no Podsta account.
            You pick the identity provider.
          </p>
        </header>

        <section className="mb-12" aria-labelledby="about-heading">
          <h2 id="about-heading" className="display-serif text-3xl mb-3">
            What Podsta is
          </h2>
          <div className="max-w-2xl space-y-3 text-sm text-ink-100 leading-relaxed mb-8">
            <p>
              A new profile is Hidden. You can later share it with contacts, or with anyone. A post cannot be more
              open than the profile. Comments and likes stay in the writer's Pod. The author publishes the list
              they are willing to show.
            </p>
            <p>
              Solid Community is the host for a first Pod, because it uses Web Access Control. An existing Pod on
              any Web Access Control provider can sign in too. Paste that provider's address below.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3 list-none p-0 m-0">
            {SHOTS.map((shot) => (
              <li key={shot.caption} className="card overflow-hidden">
                <img src={shot.src} alt={shot.alt} className="w-full h-auto bg-ink-950" />
                <p className="px-3 py-2 text-sm text-ink-100">{shot.caption}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="max-w-md" aria-labelledby="signin-heading">
          <div className="card p-7">
            <h2 id="signin-heading" className="display-serif text-2xl mb-2 text-balance">
              Sign in with your Pod
            </h2>
            <p className="text-sm text-ink-100 mb-5 leading-relaxed">
              Podsta does not have its own accounts. Your posts live in a Solid Pod you control.{' '}
              {RECOMMENDED_PROVIDER.label} is the place to start. It uses Web Access Control, which this beta can
              share with.
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
                aria-controls="other-providers"
              >
                {advanced ? 'Hide other providers' : 'I use a different Pod host'}
              </button>
              {advanced && (
                <div id="other-providers" className="mt-3 space-y-2">
                  <p className="text-sm text-ink-100 leading-relaxed">
                    Choose your own identity provider. Sharing works when that server uses Web Access Control.
                  </p>
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
        </section>
      </div>
    </div>
  );
}
