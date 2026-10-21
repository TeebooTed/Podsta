import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import { displayHandle } from '../lib/handles.js';
import { resolveProfile } from '../lib/friends.js';
import { samePerson } from '../lib/webId.js';
import { loadPack, urlFromPack } from '../lib/pack.js';

function personLabel(webId, name) {
  if (!name || name === webId || name === 'Unknown' || name === 'profile' || /^https?:\/\//i.test(name)) {
    return displayHandle(webId).handle || 'Someone';
  }
  return name;
}

/**
 * A starter pack opened from a link. Follow uses the same rules as any other follow.
 */
export default function PackPage({
  session,
  friends = [],
  signedIn = false,
  addingWebId = '',
  followingAll = false,
  notice = '',
  onFollow,
  onFollowAll,
  onSignInToFollow,
}) {
  const [params] = useSearchParams();
  const resourceUrl = urlFromPack(params.toString());
  const [webIds, setWebIds] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(Boolean(resourceUrl));
  const [error, setError] = useState(resourceUrl ? '' : 'This link does not point at a starter pack.');

  useEffect(() => {
    if (!resourceUrl) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const members = await loadPack(resourceUrl, session?.fetch);
        if (cancelled) return;
        setWebIds(members);
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "That pack didn't load.");
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resourceUrl, session]);

  useEffect(() => {
    if (!webIds.length) return undefined;
    let cancelled = false;
    (async () => {
      const next = {};
      for (let index = 0; index < webIds.length; index += 6) {
        const slice = webIds.slice(index, index + 6);
        const cards = await Promise.all(slice.map((webId) => resolveProfile(webId, session?.fetch)));
        if (cancelled) return;
        for (const card of cards) next[card.webId] = card;
        setProfiles({ ...next });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [webIds, session]);

  const followOne = (webId) => {
    if (!signedIn) {
      onSignInToFollow?.([webId], resourceUrl);
      return;
    }
    onFollow?.(webId);
  };

  const followAll = () => {
    if (!signedIn) {
      onSignInToFollow?.(webIds, resourceUrl);
      return;
    }
    onFollowAll?.(webIds);
  };

  const busy = followingAll || Boolean(addingWebId);

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="display-serif text-4xl">Starter pack</h1>
        {webIds.length > 0 && (
          <button type="button" className="btn-primary shrink-0" onClick={followAll} disabled={busy}>
            {followingAll ? 'Following…' : signedIn ? 'Follow all' : 'Sign in to follow all'}
          </button>
        )}
      </div>
      <p className="text-sm text-ink-100 leading-relaxed mb-6">
        This list lives in someone's pod. Podsta doesn't keep a directory. Following shows their
        public posts on Home. A Hidden or Contacts profile stays private.
      </p>
      {notice && (
        <p className="mb-6 card p-4 text-sm text-ink-50" role="status">
          {notice}
        </p>
      )}
      {loading && (
        <p className="text-sm text-ink-300" role="status">
          Opening this pack…
        </p>
      )}
      {error && (
        <p className="text-sm text-accent-ink" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && webIds.length === 0 && (
        <p className="text-sm text-ink-300">This pack doesn't list anyone yet.</p>
      )}
      {webIds.length > 0 && (
        <ul className="divide-y divide-ink-700">
          {webIds.map((webId) => {
            const card = profiles[webId];
            const label = personLabel(webId, card?.name);
            const handle = displayHandle(webId).qualified || webId;
            const isSelf = signedIn && samePerson(webId, session?.info?.webId);
            const isFollowing = friends.some((friend) => samePerson(friend.webId, webId));
            return (
              <li key={webId} className="flex items-center gap-3 py-3">
                <Avatar src={card?.avatarUrl || ''} name={label} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{label}</p>
                  <p className="text-xs text-ink-300 truncate">{handle}</p>
                </div>
                {isSelf ? (
                  <span className="text-sm text-ink-300">This is you</span>
                ) : isFollowing ? (
                  <span className="text-sm text-signal">Following</span>
                ) : (
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => followOne(webId)}
                    disabled={busy}
                  >
                    {addingWebId === webId ? 'Following…' : signedIn ? 'Follow' : 'Sign in to follow'}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!signedIn && webIds.length > 0 && (
        <p className="mt-4 text-xs text-ink-300">Sign in and Podsta follows the people you pick.</p>
      )}
    </div>
  );
}
