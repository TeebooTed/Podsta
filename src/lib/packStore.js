import { createContainerAt, overwriteFile } from '@inrupt/solid-client';
import { makePublic } from './acl.js';
import { packResourceUrl, serializePack } from './pack.js';

async function ensurePackContainer(podUrl, fetchFn) {
  const root = String(podUrl || '');
  const container = `${root.endsWith('/') ? root : `${root}/`}podsta/packs/`;
  try {
    await createContainerAt(container, { fetch: fetchFn });
  } catch {
    // The folder may already exist, or the host creates it when the file is saved.
  }
}

/** Write the pack into this pod and make that one file world-readable. */
export async function savePack({ podUrl, session, webIds }) {
  const url = packResourceUrl(podUrl);
  const body = serializePack(webIds);
  await ensurePackContainer(podUrl, session.fetch);
  await overwriteFile(url, new Blob([body], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: session.fetch,
  });
  try {
    await makePublic(url, session.info.webId, session);
  } catch {
    throw new Error('The pack was saved, but it is not public yet. Try saving again.');
  }
  return url;
}
