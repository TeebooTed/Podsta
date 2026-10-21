import {
  buildAuthenticatedFetch,
  createDpopHeader,
  generateDpopKeyPair,
} from '@inrupt/solid-client-authn-core';
import { SOLID_ISSUER } from './solidServer.js';

async function readJson(url, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers || {}) },
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = text;
  }
  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    throw new Error(`Pod host answered ${response.status} for ${url}: ${detail.slice(0, 300)}`);
  }
  return body;
}

/**
 * Register an email login and a pod on the local Community Solid Server.
 * Returns the address Podsta will show for that person.
 */
export async function createPod({ email, password, name, issuer = SOLID_ISSUER }) {
  const index = await readJson(`${issuer}/.account/`);
  const created = await readJson(index.controls.account.create, { method: 'POST' });
  const auth = { authorization: `CSS-Account-Token ${created.authorization}` };
  const authed = await readJson(`${issuer}/.account/`, { headers: auth });
  await readJson(authed.controls.password.create, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const pod = await readJson(authed.controls.account.pod, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ name, settings: { linkStorage: true } }),
  });
  if (!pod.webId || !pod.pod) throw new Error('The pod host did not return an address');
  await allowInboxAppend({ issuer, auth, controls: authed.controls, webId: pod.webId, podUrl: pod.pod });
  return { email, password, name, webId: pod.webId };
}

/**
 * A stock Community Solid Server keeps the inbox owner-only.
 * Podsta tells the other person about a comment, a like, or a contact by
 * posting there, the same way Solid Community allows. This opens append only.
 */
async function allowInboxAppend({ issuer, auth, controls, webId, podUrl }) {
  const creds = await readJson(controls.account.clientCredentials, {
    method: 'POST',
    headers: { ...auth, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'podsta-e2e', webId }),
  });
  const dpopKey = await generateDpopKeyPair();
  const tokenUrl = `${issuer}/.oidc/token`;
  const basic = Buffer.from(`${encodeURIComponent(creds.id)}:${encodeURIComponent(creds.secret)}`).toString(
    'base64',
  );
  const token = await readJson(tokenUrl, {
    method: 'POST',
    headers: {
      authorization: `Basic ${basic}`,
      'content-type': 'application/x-www-form-urlencoded',
      dpop: await createDpopHeader(tokenUrl, 'POST', dpopKey),
    },
    body: 'grant_type=client_credentials&scope=webid',
  });
  const authFetch = await buildAuthenticatedFetch(token.access_token, { dpopKey });
  const acl = `@prefix acl: <http://www.w3.org/ns/auth/acl#>.
@prefix foaf: <http://xmlns.com/foaf/0.1/>.
<#owner>
    a acl:Authorization;
    acl:agent <${webId}>;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode acl:Read, acl:Write, acl:Control.
<#append>
    a acl:Authorization;
    acl:agentClass foaf:Agent;
    acl:accessTo <./>;
    acl:default <./>;
    acl:mode acl:Append.
`;
  const response = await authFetch(`${podUrl}inbox/.acl`, {
    method: 'PUT',
    headers: { 'content-type': 'text/turtle' },
    body: acl,
  });
  if (!response.ok && response.status !== 205) {
    const detail = await response.text();
    throw new Error(`Could not open the inbox for notices (${response.status}): ${detail.slice(0, 180)}`);
  }
}
