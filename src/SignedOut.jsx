import { lazy, Suspense, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import Toast from './components/Toast.jsx';
import Logo from './components/Logo.jsx';
import { appUrl, currentAppRoot } from './lib/appUrl.js';
import { inviteUrl, rememberFollow, rememberSignup, SIGNUP_KEY } from './lib/invite.js';
import { rememberInviteConnect } from './lib/inviteConnect.js';
import { packAppUrl, rememberPackFollow } from './lib/pack.js';
import { RECOMMENDED_PROVIDER } from './lib/provider.js';

const PersonPage = lazy(() => import('./pages/PersonPage.jsx'));
const PostPage = lazy(() => import('./pages/PostPage.jsx'));
const PackPage = lazy(() => import('./pages/PackPage.jsx'));

function Wordmark() {
  return (
    <p className="mb-6">
      <Link to="/" aria-label="Podsta home" className="inline-block rounded-xl">
        <Logo size="md" />
      </Link>
    </p>
  );
}

/**
 * Signed-out routes. This file does not import the Solid client.
 * Sign-in loads that code on the click, and an OIDC return loads the full app.
 */
export default function SignedOut({ error = '', onLogin, showToast: showToastProp }) {
  const [toast, setToast] = useState(null);
  const showToast =
    showToastProp ||
    ((message, type = 'info') => {
      setToast({ message, type, key: Date.now() });
    });

  const startLogin = async (issuer, redirectUrl) => {
    if (onLogin) return onLogin(issuer, redirectUrl);
    const { login } = await import('./lib/auth.js');
    return login(issuer, redirectUrl || appUrl('/'));
  };

  const startSignup = () => {
    rememberSignup(window.sessionStorage);
    return startLogin(RECOMMENDED_PROVIDER.issuer, appUrl('/start'));
  };

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-ink-50 focus:text-ink-950 focus:px-3 focus:py-2 focus:rounded"
      >
        Skip to content
      </a>
      <main id="main">
        <Suspense
          fallback={
            <p className="sr-only" role="status">
              Loading
            </p>
          }
        >
          <Routes>
            <Route
              path="/start"
              element={<SignupPage onBegin={startSignup} error={error || ''} />}
            />
            <Route
              path="/invite"
              element={
                <div className="min-h-screen px-4 pt-6 pb-16">
                  <div className="max-w-3xl mx-auto">
                    <Wordmark />
                    <PersonPage
                      session={null}
                      friends={[]}
                      signedIn={false}
                      addingWebId={null}
                      actionLabel="Sign in to connect"
                      onAddFriend={async (webId) => {
                        try {
                          window.sessionStorage.removeItem(SIGNUP_KEY);
                          rememberFollow(window.sessionStorage, webId);
                          rememberInviteConnect(window.sessionStorage, webId);
                          await startLogin(
                            RECOMMENDED_PROVIDER.issuer,
                            inviteUrl(currentAppRoot(), webId),
                          );
                        } catch (err) {
                          showToast(
                            "We couldn't sign you in. That account didn't answer or said no. Check the name and try again, or pick Solid Community under Advanced.",
                            'error',
                          );
                          console.error('Sign-up redirect failed:', err);
                        }
                      }}
                    />
                  </div>
                </div>
              }
            />
            <Route
              path="/post"
              element={
                <div className="min-h-screen px-4 pt-6 pb-16">
                  <div className="max-w-3xl mx-auto">
                    <Wordmark />
                    <PostPage session={null} posts={[]} podUrl="" showToast={showToast} />
                  </div>
                </div>
              }
            />
            <Route
              path="/pack"
              element={
                <div className="min-h-screen px-4 pt-6 pb-16">
                  <div className="max-w-3xl mx-auto">
                    <Wordmark />
                    <PackPage
                      session={null}
                      friends={[]}
                      signedIn={false}
                      onSignInToFollow={async (webIds, resourceUrl) => {
                        try {
                          rememberPackFollow(window.sessionStorage, webIds);
                          await startLogin(
                            RECOMMENDED_PROVIDER.issuer,
                            packAppUrl(currentAppRoot(), resourceUrl),
                          );
                        } catch (err) {
                          showToast(
                            "We couldn't sign you in. Your pod host didn't answer or said no. Check the address and try again, or pick Solid Community from the list.",
                            'error',
                          );
                          console.error('Sign-up redirect failed:', err);
                        }
                      }}
                    />
                  </div>
                </div>
              }
            />
            <Route
              path="*"
              element={
                <LoginPage
                  error={error}
                  onLogin={(issuer) => startLogin(issuer, appUrl('/'))}
                  onCreate={startSignup}
                />
              }
            />
          </Routes>
        </Suspense>
      </main>
      {toast && !showToastProp && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
