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
 * Resume any in-flight OIDC flow on app boot.
 * Call this once at startup, before reading session state.
 */
export async function restoreSession() {
  await handleIncomingRedirect({ restorePreviousSession: true });
  return getDefaultSession();
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
