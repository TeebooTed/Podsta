import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { discoverViaFriends, listingsFor } from '../lib/discover.js';
import { copyToClipboard } from '../lib/utils.js';
import { personPath } from '../lib/navigation.js';
import { displayHandle, parsePersonInput } from '../lib/handles.js';

/**
 * Find people by WebID. The directory lists people reached through a public
 * follow list who opted in with a listing card. There is no central phone book.
 */
export default function DiscoverPage({ session, friends, onAddFriend, addingWebId, showToast }) {
  const [foaf, setFoaf] = useState([]);
  const [directory, setDirectory] = useState([]);
  const [loadingFoaf, setLoadingFoaf] = useState(false);

  const [manualInput, setManualInput] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  useEffect(() => {
    if (!friends?.length) {
      setFoaf([]);
      setDirectory([]);
      setLoadingFoaf(false);
      return undefined;
    }
    let cancelled = false;
    setLoadingFoaf(true);
    const args = {
      friends,
      ownWebId: session?.info?.webId,
      fetchFn: session?.fetch,
    };
    discoverViaFriends(args)
      .then(async (people) => {
        if (cancelled) return;
        setFoaf(people);
        const listed = await listingsFor(people, session?.fetch);
        if (!cancelled) setDirectory(listed);
      })
      .finally(() => {
        if (!cancelled) setLoadingFoaf(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friends, session]);

  const friendSet = new Set(friends.map((f) => f.webId));
  const ownWebId = session?.info?.webId;

  const handleManualAdd = async (e) => {
    e?.preventDefault?.();
    const webId = parsePersonInput(manualInput);
    if (!webId) {
      showToast('Enter a WebID, or a handle like @ada or @ada@solidweb.org', 'error');
      return;
    }
    setManualBusy(true);
    try {
      await onAddFriend(webId);
      setManualInput('');
    } finally {
      setManualBusy(false);
    }
  };

  const copyWebId = async () => {
    const ok = await copyToClipboard(ownWebId || '');
    showToast(ok ? 'WebID copied' : 'Copy failed', ok ? 'success' : 'error');
  };

  const ProfileCard = ({ p, badge }) => (
    <div className="card p-4 flex items-start gap-3">
      <Avatar src={p.avatarUrl} name={p.name} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{p.name || 'Unknown'}</p>
          {badge && (
            <span className="text-xs bg-ink-700 text-ink-200 px-2 py-0.5 rounded">{badge}</span>
          )}
        </div>
        <p className="text-xs text-ink-200 truncate mt-0.5">{displayHandle(p.webId).qualified || p.webId}</p>
        {p.viaName && <p className="text-xs text-ink-300 mt-0.5">via {p.viaName}</p>}
        {p.bio && <p className="text-xs text-ink-200 mt-1.5 line-clamp-2">{p.bio}</p>}
        <Link to={personPath(p.webId)} className="inline-flex items-center min-h-8 text-xs text-ink-100 underline mt-1">
          View profile
        </Link>
      </div>
      <div className="shrink-0">
        {p.webId === ownWebId ? (
          <span className="text-xs text-ink-300 italic">You</span>
        ) : friendSet.has(p.webId) ? (
          <span className="text-xs text-signal">Following</span>
        ) : (
          <button
            type="button"
            onClick={() => onAddFriend(p.webId)}
            disabled={addingWebId === p.webId}
            className="min-h-8 px-3 py-1.5 bg-accent hover:bg-accent-light text-ink-950 rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {addingWebId === p.webId ? 'Following…' : 'Follow'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <h1 className="display-serif text-4xl">Discover</h1>
      <section className="card p-5">
        <h2 className="display-serif text-2xl mb-1">Your WebID</h2>
        <p className="text-sm text-ink-300 mb-4">
          This is the address people use to follow you. Send it to them, or paste theirs below.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <code className="text-xs font-mono bg-ink-900 px-3 py-2 rounded break-all flex-1">
            {ownWebId}
          </code>
          <button type="button" onClick={copyWebId} className="btn-primary shrink-0">
            Copy WebID
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="display-serif text-2xl mb-1">Follow someone</h2>
        <p className="text-sm text-ink-100 mb-4 leading-relaxed">
          Type <span className="font-medium">@ada</span> for someone on Solid Community,{' '}
          <span className="font-medium">@ada@another.host</span> for a different Pod host, or paste a WebID.
          A short name is only a guess from the address. Podsta does not keep a handle registry.
        </p>
        <form onSubmit={handleManualAdd} className="flex flex-col sm:flex-row gap-2">
          <label htmlFor="webid-input" className="sr-only">
            WebID to follow
          </label>
          <input
            id="webid-input"
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="@ada or https://ada.solidcommunity.net/profile/card#me"
            className="input-field flex-1 font-mono text-xs"
          />
          <button type="submit" disabled={manualBusy || !manualInput} className="btn-primary">
            {manualBusy ? 'Adding…' : 'Follow'}
          </button>
        </form>
      </section>

      {(loadingFoaf || foaf.length > 0) && (
        <section aria-busy={loadingFoaf}>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="display-serif text-2xl">People you may know</h2>
            <p className="text-xs text-ink-300">From published follow lists</p>
          </div>
          {loadingFoaf ? (
            <p className="text-sm text-ink-300 py-4">Looking through follow lists…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {foaf.map((p) => (
                <ProfileCard key={p.webId} p={p} badge="2nd" />
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="display-serif text-2xl mb-3">Directory</h2>
        {loadingFoaf ? (
          <p className="text-sm text-ink-200 py-4">Looking for public listings…</p>
        ) : directory.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {directory.map((p) => (
              <ProfileCard key={p.webId} p={p} badge="Listed" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="∅"
            title="No public directory yet"
            message="People appear here when you can reach them through a published follow list and they have opted in. Podsta has no central phone book. Paste a WebID you already know."
          />
        )}
      </section>
    </div>
  );
}
