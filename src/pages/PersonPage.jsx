import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getSolidDataset, getThing, getStringNoLocale } from '@inrupt/solid-client';
import Avatar from '../components/Avatar.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { resolveProfile } from '../lib/friends.js';
import { readPublicIndex } from '../lib/publicIndex.js';
import { PATHS, FOAF, SCHEMA } from '../lib/vocab.js';
import { withTimeout } from '../lib/timeoutFetch.js';
import { safeHttpUrl } from '../lib/urls.js';
import { shortWebId } from '../lib/utils.js';
import { PATHS as ROUTES } from '../lib/navigation.js';

/**
 * A public view of someone else's Podsta profile: name, bio, and the posts
 * they have listed in public-index.ttl. Follow lives here as well as on Discover.
 */
export default function PersonPage({ session, friends, onAddFriend, addingWebId }) {
  const [params] = useSearchParams();
  const webId = params.get('webid') || '';
  const [person, setPerson] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [photoIndex, setPhotoIndex] = useState(null);

  useEffect(() => {
    if (!webId) {
      setLoading(false);
      setError('missing');
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const profile = await resolveProfile(webId, session?.fetch);
      let bio = '';
      if (profile.podUrl) {
        try {
          const url = `${profile.podUrl}${PATHS.profile}`;
          const ds = await getSolidDataset(url, { fetch: withTimeout(session?.fetch || fetch) });
          const thing = getThing(ds, url);
          bio = (thing && (getStringNoLocale(thing, SCHEMA.description) || getStringNoLocale(thing, FOAF.name))) || '';
          const podName = thing && getStringNoLocale(thing, FOAF.name);
          if (podName) profile.name = podName;
          const avatar = thing && safeHttpUrl(getStringNoLocale(thing, SCHEMA.image) || '');
          if (avatar) profile.avatarUrl = avatar;
        } catch {
          bio = '';
        }
      }
      let entries = [];
      if (profile.podUrl) {
        try {
          entries = await readPublicIndex(profile.podUrl, session?.fetch);
        } catch {
          if (!cancelled) setError('unavailable');
        }
      } else if (!cancelled) {
        setError('unavailable');
      }
      if (cancelled) return;
      setPerson({ ...profile, bio: bio && bio !== profile.name ? bio : '' });
      setPosts(entries);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [webId, session]);

  if (!webId) {
    return (
      <EmptyState
        title="No person selected"
        message="Open someone from Discover, or paste their WebID there."
        action={
          <Link to={ROUTES.discover} className="btn-primary">
            Go to Discover
          </Link>
        }
      />
    );
  }

  const following = friends.some((f) => f.webId === webId);
  const photos = posts.filter((p) => p.type === 'photo').map((p) => ({
    ...p,
    isPublic: true,
    mediaUrl: p.url,
    mediaBlob: null,
    caption: p.caption || '',
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div role="status" className="sr-only">
        {loading ? 'Loading profile' : ''}
      </div>
      {loading ? (
        <div className="card p-8 h-40 skeleton" />
      ) : (
        <section className="card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Avatar src={person?.avatarUrl} name={person?.name} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="display-serif text-4xl">{person?.name || 'Profile'}</h1>
              <p className="text-xs font-mono text-ink-300 mt-1 break-all">{shortWebId(webId)}</p>
              {person?.bio && <p className="text-sm text-ink-200 mt-3 leading-relaxed">{person.bio}</p>}
              <div className="mt-4">
                {following ? (
                  <span className="text-sm text-signal">Following</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAddFriend(webId)}
                    disabled={addingWebId === webId}
                    className="btn-primary"
                  >
                    {addingWebId === webId ? 'Following…' : 'Follow'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {error === 'unavailable' && !loading && (
        <p className="text-sm text-ink-200" role="alert">
          Their Pod did not share a profile or a public index. You can still follow the WebID.
        </p>
      )}

      {!loading && posts.length === 0 && error !== 'missing' && (
        <EmptyState title="No public posts" message="When they share a post, it will appear in this grid." />
      )}

      {posts.length > 0 && (
        <ul className="grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((post) => (
            <li key={post.url}>
              <button
                type="button"
                className="relative block w-full aspect-square bg-ink-800 overflow-hidden text-left"
                disabled={post.type !== 'photo'}
                onClick={() => {
                  const idx = photos.findIndex((p) => p.url === post.url);
                  if (idx >= 0) setPhotoIndex(idx);
                }}
                aria-label={post.type === 'photo' ? post.caption || 'Open photo' : post.title || 'Note'}
              >
                {post.type === 'photo' && safeHttpUrl(post.url) ? (
                  <img src={post.url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <span className="absolute inset-0 p-2 flex items-end display-serif text-sm text-ink-100 line-clamp-4">
                    {post.title || post.caption || 'Note'}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {photoIndex !== null && (
        <Lightbox
          posts={photos}
          index={photoIndex}
          session={session}
          onClose={() => setPhotoIndex(null)}
          onNavigate={setPhotoIndex}
        />
      )}
    </div>
  );
}
