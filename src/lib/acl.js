import { getSolidDataset, overwriteFile } from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import {
  aclGrantsPublicRead,
  assertAllSucceeded,
  groupReadTurtle,
  ownerOnlyTurtle,
  publicReadTurtle,
} from './aclTurtle.js';
import { isNotFound, withTimeout } from './timeoutFetch.js';

/**
 * Solid Web Access Control: a Turtle file at <resource>.acl.
 * Podsta's beta writes WAC only. Servers that use Access Control Policies
 * (including Inrupt PodSpaces) ignore these files.
 *
 * Templates live in aclTurtle.js so they can be tested without the Solid client.
 */

async function writeAcl(resourceUrl, turtle, fetchFn) {
  await overwriteFile(`${resourceUrl}.acl`, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: fetchFn,
  });
}

export async function makePublic(resourceUrl, ownerWebId, session) {
  await writeAcl(resourceUrl, publicReadTurtle(resourceUrl, ownerWebId), session.fetch);
}

export async function makePrivate(resourceUrl, ownerWebId, session) {
  await writeAcl(resourceUrl, ownerOnlyTurtle(resourceUrl, ownerWebId), session.fetch);
}

/** Read access for an approved contacts group. Not world-readable. */
export async function makeGroupReadable(resourceUrl, ownerWebId, groupUrl, session) {
  await writeAcl(
    resourceUrl,
    groupReadTurtle(resourceUrl, ownerWebId, groupUrl),
    session.fetch,
  );
}

/**
 * One audience applied to every sibling URL.
 * Missing files count as already private on unshare (404).
 */
export async function applyAudience(urls, audience, { ownerWebId, groupUrl, session }) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        if (audience === 'public') await makePublic(url, ownerWebId, session);
        else if (audience === 'contacts') {
          await makeGroupReadable(url, ownerWebId, groupUrl, session);
        } else await makePrivate(url, ownerWebId, session);
      } catch (err) {
        if (audience !== 'public' && audience !== 'contacts' && isNotFound(err)) return;
        throw err;
      }
    }),
  );
  assertAllSucceeded(results, audience === 'private' ? 'unshare' : 'share');
  return { ok: urls.length, failed: 0 };
}

/**
 * Replace whatever ACL is on the comments container with owner-only access,
 * including acl:default so child comment files lose any public Append grant.
 */
export async function lockCommentsToOwner(containerUrl, ownerWebId, session) {
  await writeAcl(
    containerUrl,
    ownerOnlyTurtle(containerUrl, ownerWebId, { inherit: true }),
    session.fetch,
  );
}

/** Best-effort cleanup for Pods that already have a comments container. */
export async function lockExistingComments({ podUrl, ownerWebId, session }) {
  const containerUrl = `${podUrl}${PATHS.comments}`;
  try {
    await getSolidDataset(containerUrl, { fetch: session.fetch });
  } catch (err) {
    if (isNotFound(err)) return;
    throw err;
  }
  await lockCommentsToOwner(containerUrl, ownerWebId, session);
}

export async function shareResources(urls, ownerWebId, session) {
  const results = await Promise.allSettled(
    urls.map((url) => makePublic(url, ownerWebId, session)),
  );
  assertAllSucceeded(results, 'share');
  return { ok: urls.length, failed: 0 };
}

export async function unshareResources(urls, ownerWebId, session) {
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      try {
        await makePrivate(url, ownerWebId, session);
      } catch (err) {
        // A photo with no caption has no .meta file. That is already private.
        if (isNotFound(err)) return;
        throw err;
      }
    }),
  );
  assertAllSucceeded(results, 'unshare');
  return { ok: urls.length, failed: 0 };
}

/**
 * Whether a resource is anonymously readable.
 * Prefer the owner's ACL document. Fall back to an anonymous HEAD when the
 * resource has no ACL of its own and may inherit one.
 * Network failures return false (treated as not publicly confirmed).
 */
export async function isPublic(resourceUrl, fetchFn) {
  const timed = withTimeout(fetchFn || fetch);
  try {
    const res = await timed(`${resourceUrl}.acl`, {
      headers: { Accept: 'text/turtle' },
    });
    if (res.ok) {
      const text = await res.text();
      return aclGrantsPublicRead(text);
    }
    if (res.status !== 404) return false;
  } catch {
    return false;
  }

  try {
    const head = await withTimeout(fetch)(resourceUrl, { method: 'HEAD' });
    return head.ok;
  } catch {
    return false;
  }
}

export { aclGrantsPublicRead };
