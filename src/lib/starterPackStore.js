import { createContainerAt, overwriteFile } from '@inrupt/solid-client';
import { PATHS } from './vocab.js';
import { makePublic } from './acl.js';
import { serializePack } from './starterPack.js';

/** Write one public pack into the author's pod. The file URL is the share target. */
export async function saveStarterPack({ podUrl, session, name, members, now = () => Date.now() }) {
  if (!session?.info?.webId) throw new Error('Sign in to make a starter pack');
  const id = Number(now()).toString(36);
  const container = `${podUrl}${PATHS.packs}`;
  try {
    await createContainerAt(container, { fetch: session.fetch });
  } catch {
    // The folder is already there, or the host does not need it created.
  }
  const url = `${container}${id}.ttl`;
  const turtle = serializePack({
    name,
    authorWebId: session.info.webId,
    created: new Date(now()).toISOString(),
    members,
  });
  if (!turtle.includes('itemListElement')) {
    throw new Error('Choose at least one person to include');
  }
  await overwriteFile(url, new Blob([turtle], { type: 'text/turtle' }), {
    contentType: 'text/turtle',
    fetch: session.fetch,
  });
  await makePublic(url, session.info.webId, session);
  return { url, id };
}
