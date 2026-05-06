import { overwriteFile } from '@inrupt/solid-client';

/**
 * Solid uses Web Access Control (WACL) — a Turtle file at <resource>.acl that
 * declares who can read/write/control the resource. We write these as raw
 * Turtle because that's both reliable and provider-portable; the higher-level
 * solid-client ACL helpers vary in support across pod servers.
 *
 * IMPORTANT: when sharing a photo or post, you must apply the same ACL to ALL
 * sibling resources (the binary file, the .meta caption file, and the comments
 * collection). We expose `shareResource` and `unshareResource` which take a
 * list of related URLs and toggle them atomically.
 */

const PUBLIC_TURTLE = (resourceUrl, ownerWebId) => `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resourceUrl}> ;
  acl:agent <${ownerWebId}> ;
  acl:mode acl:Read, acl:Write, acl:Control .

<#public>
  a acl:Authorization ;
  acl:accessTo <${resourceUrl}> ;
  acl:agentClass foaf:Agent ;
  acl:mode acl:Read .
`.trim();

const PRIVATE_TURTLE = (resourceUrl, ownerWebId) => `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resourceUrl}> ;
  acl:agent <${ownerWebId}> ;
  acl:mode acl:Read, acl:Write, acl:Control .
`.trim();

/**
 * Comments need a special ACL: the owner has full control, but the public can
 * APPEND (write new comments) without read of others' work in some setups.
 * For simplicity and visibility we grant public Read+Append.
 */
const PUBLIC_COMMENTABLE_TURTLE = (resourceUrl, ownerWebId) => `
@prefix acl: <http://www.w3.org/ns/auth/acl#> .
@prefix foaf: <http://xmlns.com/foaf/0.1/> .

<#owner>
  a acl:Authorization ;
  acl:accessTo <${resourceUrl}> ;
  acl:default <${resourceUrl}> ;
  acl:agent <${ownerWebId}> ;
  acl:mode acl:Read, acl:Write, acl:Control .

<#public>
  a acl:Authorization ;
  acl:accessTo <${resourceUrl}> ;
  acl:default <${resourceUrl}> ;
  acl:agentClass foaf:Agent ;
  acl:mode acl:Read, acl:Append .
`.trim();

async function writeAcl(resourceUrl, turtle, fetchFn) {
  await overwriteFile(`${resourceUrl}.acl`, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: fetchFn,
  });
}

/**
 * Make a resource publicly readable.
 */
export async function makePublic(resourceUrl, ownerWebId, session) {
  await writeAcl(resourceUrl, PUBLIC_TURTLE(resourceUrl, ownerWebId), session.fetch);
}

/**
 * Revoke public access — only the owner can read.
 */
export async function makePrivate(resourceUrl, ownerWebId, session) {
  await writeAcl(resourceUrl, PRIVATE_TURTLE(resourceUrl, ownerWebId), session.fetch);
}

/**
 * Make a container public-readable AND public-appendable (for comments).
 * `default` directive cascades the rule to all children.
 */
export async function makeCommentable(containerUrl, ownerWebId, session) {
  await writeAcl(containerUrl, PUBLIC_COMMENTABLE_TURTLE(containerUrl, ownerWebId), session.fetch);
}

/**
 * Share a post — applies public ACL to the post resource and any siblings
 * (e.g. the .meta sidecar for photo captions). Failures on individual
 * resources are logged but don't abort the others.
 */
export async function shareResources(urls, ownerWebId, session) {
  const results = await Promise.allSettled(
    urls.map((url) => makePublic(url, ownerWebId, session)),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === urls.length) {
    throw new Error(`Failed to share: ${failed[0].reason?.message || 'unknown'}`);
  }
  return { ok: results.length - failed.length, failed: failed.length };
}

export async function unshareResources(urls, ownerWebId, session) {
  const results = await Promise.allSettled(
    urls.map((url) => makePrivate(url, ownerWebId, session)),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length === urls.length) {
    throw new Error(`Failed to unshare: ${failed[0].reason?.message || 'unknown'}`);
  }
  return { ok: results.length - failed.length, failed: failed.length };
}

/**
 * Check if a resource is publicly readable, by attempting an unauthenticated fetch.
 * This is best-effort: a 200 means definitely public, anything else is "not public
 * to anonymous browsers" but might still be visible to authenticated friends.
 */
export async function isPublic(resourceUrl) {
  try {
    const res = await fetch(resourceUrl, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Bulk public-check for many URLs in parallel.
 */
export async function checkPublicMany(urls) {
  const entries = await Promise.all(
    urls.map(async (u) => [u, await isPublic(u)]),
  );
  return Object.fromEntries(entries);
}
