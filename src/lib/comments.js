import {
  getSolidDataset,
  saveSolidDatasetAt,
  createSolidDataset,
  createThing,
  setThing,
  getThingAll,
  setStringNoLocale,
  getStringNoLocale,
} from '@inrupt/solid-client';
import { PATHS, SCHEMA } from './vocab.js';

/**
 * Comments are stored in the POST OWNER's pod (not the commenter's), so they
 * stay attached to the post even if the commenter deletes their pod. The
 * comments container has an ACL granting public Read+Append (set when the
 * owner first shares any post — see lib/posts.js sharePost).
 *
 * Each post gets one Turtle file at /podsta/comments/<hash>.ttl containing
 * all its comments as separate Things. We hash the post URL to keep filenames
 * short and predictable.
 */

function hashPostUrl(url) {
  // Tiny djb2 hash — collisions don't matter here because the URL is also
  // stored as a property in each comment thing. Just need a stable filename.
  let h = 5381;
  for (const c of url) h = ((h << 5) + h) ^ c.charCodeAt(0);
  return (h >>> 0).toString(36);
}

function commentsFileUrl(ownerPodUrl, postUrl) {
  return `${ownerPodUrl}${PATHS.comments}${hashPostUrl(postUrl)}.ttl`;
}

export async function loadComments({ ownerPodUrl, postUrl, fetchFn }) {
  try {
    const ds = fetchFn
      ? await getSolidDataset(commentsFileUrl(ownerPodUrl, postUrl), { fetch: fetchFn })
      : await getSolidDataset(commentsFileUrl(ownerPodUrl, postUrl));
    return getThingAll(ds)
      .map((t) => ({
        text: getStringNoLocale(t, SCHEMA.text) || '',
        date: getStringNoLocale(t, SCHEMA.dateCreated) || '',
        author: getStringNoLocale(t, SCHEMA.author) || '',
      }))
      .filter((c) => c.text)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } catch (err) {
    if (err?.statusCode === 404 || err?.response?.status === 404) return [];
    return [];
  }
}

export async function postComment({ ownerPodUrl, postUrl, text, session }) {
  if (!text?.trim()) throw new Error('Comment cannot be empty');
  if (!session?.info?.webId) throw new Error('Must be logged in to comment');

  const fileUrl = commentsFileUrl(ownerPodUrl, postUrl);
  let ds;
  try {
    ds = await getSolidDataset(fileUrl, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }

  const ts = new Date().toISOString();
  let thing = createThing({ url: `${fileUrl}#${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
  thing = setStringNoLocale(thing, SCHEMA.text, text.trim());
  thing = setStringNoLocale(thing, SCHEMA.dateCreated, ts);
  thing = setStringNoLocale(thing, SCHEMA.author, session.info.webId);
  ds = setThing(ds, thing);

  await saveSolidDatasetAt(fileUrl, ds, { fetch: session.fetch });

  return { text: text.trim(), date: ts, author: session.info.webId };
}
