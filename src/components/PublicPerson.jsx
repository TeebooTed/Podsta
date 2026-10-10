import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import EmptyState from './EmptyState.jsx';
import Lightbox from './Lightbox.jsx';
import { loadStranger } from '../lib/stranger.js';
import { displayHandle } from '../lib/handles.js';
import { strangerNotice } from '../lib/invite.js';
import { safeHttpUrl } from '../lib/urls.js';
import { PATHS as ROUTES } from '../lib/navigation.js';

/**
 * Someone reached by an invite link or from Discover.
 * Hidden and Contacts profiles render as a handle and a Follow button.
 */
export default function PublicPerson({
  webId,
  session,
  friends = [],
  onFollow,
  followBusy = false,
  signedIn = false,
}) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(null);
  const names = displayHandle(webId);

  useEffect(() => {
    if (!webId) {
      setLoading(false);
      setPerson(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    loadStranger({ webId, fetchFn: session?.fetch })
      .then((loaded) => {
        if (!cancelled) setPerson(loaded);
      })
      .catch(() => {
        if (!cancelled) {
          setPerson({
            webId,
            name: '',
            bio: '',
            avatarUrl: '',
            posts: [],
            profileShared: false,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [webId, session]);

  if (!webId) {
    return (
      <EmptyState
        title="This invite is missing a person"
        message="Ask them for the link again, or paste a WebID on Discover."
        action={
          signedIn ? (
            <Link to={ROUTES.discover} className="btn-primary">
              Go to Discover
            </Link>
          ) : null
        }
      />
    );
  }

  const following = friends.some((friend) => friend.webId === webId);
  const notice = person ? strangerNotice(person) : '';
  const heading = (person?.profileShared && person.name) || names.handle || 'Profile';
  const posts = person?.posts || [];
  const photos = posts
    .filter((post) => post.type === 'photo')
    .map((post) => ({
      ...post,
      isPublic: true,
      mediaUrl: post.url,
      mediaBlob: null,
      caption: post.caption || '',
    }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div role="status" className="sr-only">
        {loading ? 'Loading profile' : ''}
      </div>
      {loading ? (
        <div className="card p-8 h-40 skeleton" aria-hidden="true" />
      ) : (
        <section className="card p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Avatar src={person?.profileShared ? person.avatarUrl : ''} name={heading} size="xl" />
            <div className="min-w-0 flex-1">
              <h1 className="display-serif text-4xl break-words">{heading}</h1>
              {names.qualified && (
                <p className="text-sm text-ink-100 mt-1">{names.qualified}</p>
              )}
              <p className="text-xs font-mono text-ink-200 mt-1 break-all">{webId}</p>
              {person?.profileShared && person.bio && (
                <p className="text-sm text-ink-100 mt-3 leading-relaxed">{person.bio}</p>
              )}
              {notice && <p className="text-sm text-ink-100 mt-3 leading-relaxed">{notice}</p>}
              <div className="mt-4">
                {following ? (
                  <span className="text-sm text-signal">Following</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFollow?.(webId)}
                    disabled={followBusy}
                    className="btn-primary"
                  >
                    {followBusy ? 'Following…' : signedIn ? 'Follow' : 'Sign in to follow'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && person?.profileShared && posts.length === 0 && (
        <EmptyState title="No public posts" message="When they share a post publicly, it will appear in this grid." />
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
                  const idx = photos.findIndex((photo) => photo.url === post.url);
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
