import { appRoot } from './appUrl.js';
import { sameOriginRedirect } from './invite.js';

/** The only origin that publishes public/solid-client-id.json. */
export const PAGES_ORIGIN = 'https://teebooted.github.io';
export const PAGES_PATH = '/Podsta/';

/**
 * Static Solid client identifier for the Pages app.
 * One redirect URI: the home URL. Invite and sign-up intent stay in
 * sessionStorage, because a client id document cannot list every WebID.
 */
export function clientIdDocument(origin = PAGES_ORIGIN, basePath = PAGES_PATH) {
  const root = appRoot(origin, basePath);
  const home = `${root}/`;
  return {
    '@context': 'https://www.w3.org/ns/solid/oidc-context.jsonld',
    client_id: `${root}/solid-client-id.json`,
    client_name: 'Podsta',
    client_uri: home,
    redirect_uris: [home],
    post_logout_redirect_uris: [home],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    scope: 'openid offline_access webid',
  };
}

/**
 * Login options for @inrupt/solid-client-authn-browser.
 * The Pages origin uses the static client id. Every other origin, including
 * localhost, keeps dynamic registration so an existing local redirect still works.
 */
export function oidcLoginRequest({ origin, basePath = '/', redirectUrl, oidcIssuer }) {
  const onPages = origin === PAGES_ORIGIN;
  const home = `${appRoot(origin, onPages ? PAGES_PATH : basePath)}/`;
  const clientId = onPages ? clientIdDocument().client_id : '';
  return {
    oidcIssuer,
    redirectUrl: clientId ? home : sameOriginRedirect(redirectUrl || home, origin),
    clientName: 'Podsta',
    ...(clientId ? { clientId } : {}),
  };
}
