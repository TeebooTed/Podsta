import { useState, useEffect } from 'react';
import Avatar from '../components/Avatar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { loadRegistry, discoverViaFriends, REGISTRY_SUBMIT_URL } from '../lib/discover.js';
import { normalizeWebId } from '../lib/friends.js';
import { shortWebId } from '../lib/utils.js';

/**
 * Three discovery modes in one page:
 *   1. Manual — paste any WebID
 *   2. Friends-of-friends — automatic from current network
 *   3. Community directory — opt-in registry
 */
export default function DiscoverPage({ session, friends, onAddFriend, addingWebId, showToast }) {
  const [registry, setRegistry] = useState([]);
  const [registrySource, setRegistrySource] = useState('cache');
  const [registryError, setRegistryError] = useState(null);
  const [loadingRegistry, setLoadingRegistry] = useState(true);

  const [foaf, setFoaf] = useState([]);
  const [loadingFoaf, setLoadingFoaf] = useState(false);

  const [search, setSearch] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [manualBusy, setManualBusy] = useState(false);

  // Initial registry load.
  useEffect(() => {
    setLoadingRegistry(true);
    loadRegistry()
      .then(({ profiles, source, error }) => {
        setRegistry(profiles);
        setRegistrySource(source);
        if (error) setRegistryError(error);
      })
      .finally(() => setLoadingRegistry(false));
  }, []);

  // Friends-of-friends — recompute when friends change.
  useEffect(() => {
    if (!friends?.length) {
      setFoaf([]);
      return;
    }
    setLoadingFoaf(true);
    discoverViaFriends({
      friends,
      ownWebId: session?.info?.webId,
      fetchFn: session?.fetch,
    })
      .then(setFoaf)
      .finally(() => setLoadingFoaf(false));
  }, [friends, session]);

  const refreshRegistry = async () => {
    setLoadingRegistry(true);
    setRegistryError(null);
    const { profiles, source, error } = await loadRegistry({ bustCache: true });
    setRegistry(profiles);
    setRegistrySource(source);
    if (error) setRegistryError(error);
    setLoadingRegistry(false);
  };

  const friendSet = new Set(friends.map((f) => f.webId));
  const ownWebId = session?.info?.webId;

  const filteredRegistry = registry.filter(
    (p) =>
      p.webId !== ownWebId &&
      (search === '' || (p.name || '').toLowerCase().includes(search.toLowerCase())),
  );

  const handleManualAdd = async (e) => {
    e?.preventDefault?.();
    const webId = normalizeWebId(manualInput);
    if (!webId) {
      showToast('Please enter a WebID URL', 'error');
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

  const ProfileCard = ({ p, badge }) => (
    <div className="card p-4 flex items-start gap-3">
      <Avatar src={p.avatarUrl} name={p.name} size="lg" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm truncate">{p.name || 'Unknown'}</p>
          {badge && (
            <span className="text-xs bg-ink-700 text-ink-300 px-2 py-0.5 rounded">{badge}</span>
          )}
        </div>
        <p className="text-xs text-ink-400 truncate font-mono mt-0.5">{shortWebId(p.webId)}</p>
        {p.viaName && <p className="text-xs text-ink-500 mt-0.5">via {p.viaName}</p>}
        {p.bio && <p className="text-xs text-ink-300 mt-1.5 line-clamp-2">{p.bio}</p>}
      </div>
      <div className="shrink-0">
        {p.webId === ownWebId ? (
          <span className="text-xs text-ink-400 italic">You</span>
        ) : friendSet.has(p.webId) ? (
          <span className="text-xs text-signal">✓ Following</span>
        ) : (
          <button
            onClick={() => onAddFriend(p.webId)}
            disabled={addingWebId === p.webId}
            className="px-3 py-1.5 bg-accent hover:bg-accent-light rounded-lg text-xs font-medium transition disabled:opacity-50"
          >
            {addingWebId === p.webId ? 'Following…' : '+ Follow'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Manual WebID add */}
      <section className="card p-5">
        <h2 className="display-serif text-2xl mb-1">Find someone by WebID</h2>
        <p className="text-sm text-ink-400 mb-4">
          A WebID is the unique URL of a Solid identity, e.g.{' '}
          <code className="text-xs bg-ink-900 px-1.5 py-0.5 rounded font-mono">
            https://alice.solidcommunity.net/profile/card#me
          </code>
          . Paste any WebID below to follow them.
        </p>
        <form onSubmit={handleManualAdd} className="flex gap-2">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="https://example.com/profile/card#me"
            className="input-field flex-1 font-mono text-xs"
          />
          <button type="submit" disabled={manualBusy || !manualInput} className="btn-primary">
            {manualBusy ? 'Adding…' : 'Follow'}
          </button>
        </form>
      </section>

      {/* Friends of friends */}
      {(loadingFoaf || foaf.length > 0) && (
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="display-serif text-2xl">People you may know</h2>
            <p className="text-xs text-ink-400">via your network</p>
          </div>
          {loadingFoaf ? (
            <p className="text-sm text-ink-400 py-4">Searching your friends' networks…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {foaf.map((p) => (
                <ProfileCard key={p.webId} p={p} badge="2nd" />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Community directory */}
      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="display-serif text-2xl">Community directory</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshRegistry}
              disabled={loadingRegistry}
              className="btn-ghost text-xs"
              title="Refresh"
            >
              ↻ Refresh
            </button>
            <a
              href={REGISTRY_SUBMIT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-xs"
            >
              + List yourself
            </a>
          </div>
        </div>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="input-field mb-4 max-w-sm"
        />

        {registryError && (
          <p className="text-xs text-amber-400 mb-3 italic">
            {registryError} — showing fallback profiles.
          </p>
        )}
        {registrySource === 'cache' && (
          <p className="text-xs text-ink-500 mb-3 italic">Showing cached results.</p>
        )}

        {loadingRegistry ? (
          <p className="text-sm text-ink-400 py-8 text-center">Loading directory…</p>
        ) : filteredRegistry.length === 0 ? (
          <EmptyState
            icon="∅"
            title={search ? 'No matches' : 'Directory is empty'}
            message={
              search
                ? 'Try a different search term.'
                : 'Be the first to list yourself in the community directory.'
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredRegistry.map((p) => (
              <ProfileCard key={p.webId} p={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
