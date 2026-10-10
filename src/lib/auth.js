import {
  getDefaultSession,
  handleIncomingRedirect,
  login as inruptLogin,
  logout as inruptLogout,
} from '@inrupt/solid-client-authn-browser';
import { getPodUrlAll } from '@inrupt/solid-client';
import { asPodRoot } from './urls.js';
import { withTimeout } from './timeoutFetch.js';
import { sameOriginRedirect } from './invite.js';
import { RECOMMENDED_PROVIDER } from './provider.js';

/**
 * RFC 7591 says client_secret_expires_at 0 means the secret does not expire.
 * solidcommunity.net sends 0. The browser auth library treats 0 as already
 * expired, drops the client, and tries to register again without a redirect
 * URI. That second registration is rejected, so the WebID never comes back.
 * Rewrite 0 to a year from now before the library stores it.
 */
export function registrationBodyWithUnexpiringSecret(body) {
  if (!body || typeof body !== 'object' || body.client_secret_expires_at !== 0) return body;
  return {
    ...body,
    client_secret_expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
  };
}

export function installOidcRegistrationFix() {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || window.fetch.__podstaOidc) return;
  const nativeFetch = window.fetch.bind(window);
  const wrapped = async (input, init) => {
    const response = await nativeFetch(input, init);
    const url = response.url || '';
    if (!url.includes('/.oidc/reg') || !response.ok) return response;
    const data = await response.clone().json().catch(() => null);
    const fixed = registrationBodyWithUnexpiringSecret(data);
    if (fixed === data) return response;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(JSON.stringify(fixed), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
  wrapped.__podstaOidc = true;
  window.fetch = wrapped;
}

installOidcRegistrationFix();

/**
 * Resume any in-flight OIDC flow on app boot.
 * Call this once at startup, before reading session state.
 */
let restorePromise;

async function restoreSessionOnce() {
  const session = getDefaultSession();
  let redirectError = '';
  const onError = (_code, description) => {
    redirectError = description instanceof Error ? description.message : String(description || _code || '');
  };
  session.events.on('error', onError);
  await handleIncomingRedirect({ restorePreviousSession: true });
  if (redirectError && !session.info.isLoggedIn) {
    throw new Error(redirectError);
  }
  return session;
}

/**
 * One restore for this page load. React runs the boot effect twice in
 * development, and the Solid library ignores the second call while the first
 * token exchange is still going. Sharing the promise keeps that login.
 */
export function restoreSession() {
  if (!restorePromise) restorePromise = restoreSessionOnce();
  return restorePromise;
}

/**
 * Kick off the OIDC login flow.
 * The user is redirected to their identity provider; on return, restoreSession() picks up.
 */
export async function login(oidcIssuer = RECOMMENDED_PROVIDER.issuer, redirectUrl) {
  const origin = window.location.origin;
  await inruptLogin({
    oidcIssuer,
    redirectUrl: sameOriginRedirect(redirectUrl || `${origin}/`, origin),
    clientName: 'Podsta',
  });
}

export async function logout() {
  await inruptLogout();
}

/**
 * Look up the user's primary Pod URL from their WebID profile.
 * Most users have one Pod; we always pick the first.
 * Returns null if the profile lists no pods (rare — usually a misconfigured WebID).
 */
export async function findPodUrl(session) {
  if (!session?.info?.webId) return null;
  const pods = await getPodUrlAll(session.info.webId, {
    fetch: withTimeout(session.fetch, 15000),
  });
  for (const pod of pods) {
    const root = asPodRoot(pod);
    if (root) return root;
  }
  return null;
}

export function getSession() {
  return getDefaultSession();
}
