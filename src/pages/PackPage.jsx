import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { displayHandle } from '../lib/handles.js';
import { parsePack } from '../lib/starterPack.js';
import { safeHttpUrl } from '../lib/urls.js';
import EmptyState from '../components/EmptyState.jsx';

/**
 * A shared starter pack. The file is read from the author's pod.
 * Following the people happens in the signed-in app, after this page.
 */
export default function PackPage({ onFollow, followBusy = false, signedIn = false }) {
  const [params] = useSearchParams();
  const fileUrl = safeHttpUrl(params.get('url') || '') || '';
  const [pack, setPack] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(Boolean(fileUrl));

  useEffect(() => {
    if (!fileUrl) {
      setLoading(false);
      setPack(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(fileUrl, { headers: { Accept: 'text/turtle' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`That pack responded ${response.status}`);
        const parsed = parsePack(await response.text());
        if (!parsed) throw new Error("That file isn't a starter pack.");
        return parsed;
      })
      .then((parsed) => {
        if (!cancelled) setPack(parsed);
      })
      .catch((err) => {
        if (!cancelled) {
          setPack(null);
          setError(err?.message || 'Could not read that starter pack');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (!fileUrl) {
    return (
      <EmptyState
        art="no-followers"
        title="This pack link is missing"
        message="Ask the person who made it for the link again."
      />
    );
  }

  if (loading) {
    return (
      <p className="text-sm text-ink-200" role="status">
        Reading the pack…
      </p>
    );
  }

  if (!pack) {
    return (
      <EmptyState
        art="no-followers"
        title="This pack didn't open"
        message={error || 'The file could not be read.'}
      />
    );
  }

  const author = displayHandle(pack.authorWebId);

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="pack-title">
      <h1 id="pack-title" className="display-serif text-4xl mb-2 text-balance">
        {pack.name}
      </h1>
      <p className="text-sm text-ink-100 mb-5">
        {author.qualified || 'Someone'} shared {pack.members.length}{' '}
        {pack.members.length === 1 ? 'person' : 'people'} to follow. The list lives in their pod.
      </p>
      <ul className="space-y-2 mb-6">
        {pack.members.map((webId) => {
          const names = displayHandle(webId);
          return (
            <li key={webId} className="text-sm">
              <span className="font-bold text-ink-50">{names.handle || webId}</span>
              {names.qualified && <span className="text-ink-200 ml-2">{names.qualified}</span>}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn-primary"
        disabled={followBusy || !pack.members.length}
        onClick={() => onFollow?.(pack.members)}
      >
        {followBusy
          ? 'Following…'
          : signedIn
            ? 'Follow these people'
            : 'Sign in to follow these people'}
      </button>
    </section>
  );
}
