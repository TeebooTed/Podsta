import {
  createSolidDataset,
  createThing,
  getSolidDataset,
  getThing,
  saveSolidDatasetAt,
  setStringNoLocale,
  setThing,
} from '@inrupt/solid-client';
import { PATHS, PODSTA } from './vocab.js';

/**
 * Calm counts: other people do not see how many likes a post has.
 * The like itself still lives in the liker's pod. The author keeps a private copy
 * of the count. A new profile hides counts. A profile saved before this setting
 * keeps showing them until the person chooses otherwise.
 */

export function countsArePrivate({ stored = '', profileFound = false } = {}) {
  if (stored === 'yes') return true;
  if (stored === 'no') return false;
  return !profileFound;
}

export function parseHideLikeCounts(turtle) {
  const text = String(turtle || '');
  if (!text.trim()) return { profileFound: false, stored: '' };
  const match = text.match(/hideLikeCounts[^"\n]*"([^"]*)"/i);
  return { profileFound: true, stored: match ? match[1] : '' };
}

/**
 * 404 means there is no profile yet, so counts stay private.
 * Any other failure leaves the old behaviour: a count can be published.
 * A blip must not hide counts that an existing profile chose to show.
 */
export async function loadCountsPrivate(podUrl, fetchFn) {
  let response;
  try {
    response = await (fetchFn || fetch)(`${podUrl}${PATHS.profile}`, {
      headers: { Accept: 'text/turtle' },
      cache: 'no-store',
    });
  } catch {
    return false;
  }
  if (response.status === 404) return true;
  if (!response.ok) return false;
  return countsArePrivate(parseHideLikeCounts(await response.text()));
}

export async function saveHideLikeCounts({ podUrl, session, hide }) {
  const url = `${podUrl}${PATHS.profile}`;
  let ds;
  try {
    ds = await getSolidDataset(url, { fetch: session.fetch });
  } catch {
    ds = createSolidDataset();
  }
  const thing = getThing(ds, url) ?? createThing({ url });
  await saveSolidDatasetAt(
    url,
    setThing(ds, setStringNoLocale(thing, PODSTA.hideLikeCounts, hide ? 'yes' : 'no')),
    { fetch: session.fetch },
  );
}
