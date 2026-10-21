import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import EmptyState from './EmptyState.jsx';
import Lightbox from './Lightbox.jsx';
import { loadStranger } from '../lib/stranger.js';
import { displayHandle } from '../lib/handles.js';
import { samePerson } from '../lib/webId.js';
import { strangerNotice } from '../lib/invite.js';
import { safeHttpUrl } from '../lib/urls.js';
import { photoUrls, primaryPhotoUrl } from '../lib/album.js';
import { SkeletonGrid, SkeletonProfileHeader } from './Skeletons.jsx';
import { PATHS as ROUTES } from '../lib/navigation.js';
import PullIndicator from './PullIndicator.jsx';
import ProfileCover from './ProfileCover.jsx';
import PinnedPosts from './PinnedPosts.jsx';
import { pinnedFrom } from '../lib/profileExtras.js';
import { usePullToRefresh } from '../hooks/usePullToRefresh.js';

function loadPerson(webId, session) {
  return loadStranger({ webId, fetchFn: session?.fetch }).catch(() => ({
    webId,
    name: '',
    bio: '',
    avatarUrl: '',
    posts: [],
    profileShared: false,
  }));
}

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
  actionLabel = '',
  signedIn = false,
  selfWebId = '',
  onAskContact,
  askBusy = false,
  requestedWebIds = [],
}) {
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(null);
  const names = displayHandle(webId);

  const [refreshing, setRefreshing] = useState(false);
  const pullState = usePullToRefresh(
    async () => {
      setRefreshing(true);
      try {
        setPerson(await loadPerson(webId, session));
      } finally {
        setRefreshing(false);
      }
    },
    { enabled: Boolean(webId) && !loading && !refreshing, refreshing },
  );

  useEffect(() => {
    if (!webId) {
      setLoading(false);
      setPerson(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    loadPerson(webId, session)
      .then((loaded) => {
        if (!cancelled) setPerson(loaded);
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
        art="no-followers"
        title="This invite is missing someone"
        message="The link didn't say who it's for. Ask them to send it again, or paste their address on Discover."
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
  const avatarName = (person?.profileShared && person.name) || names.user || heading;
  const posts = person?.posts || [];
  const photos = posts
    .filter((post) => post.type === 'photo')
    .map((post) => ({
      ...post,
      isPublic: true,
      images: photoUrls({ ...post, type: 'photo', mediaUrl: post.images?.[0] || post.url }),
      mediaUrl: primaryPhotoUrl({ ...post, type: 'photo', mediaUrl: post.images?.[0] || post.url }),
      mediaBlob: null,
      caption: post.caption || '',
    }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PullIndicator {...pullState} />
      <div role="status" className="sr-only">
        {loading ? 'Loading profile' : ''}
      </div>
      {loading ? (
        <>
          <SkeletonProfileHeader />
          <SkeletonGrid count={6} />
        </>
      ) : (
        <section className="card overflow-hidden p-6 pt-0 sm:p-8 sm:pt-0">
          <ProfileCover
            url={person?.profileShared ? person.coverUrl : ''}
            className="-mx-6 sm:-mx-8 mb-4"
          />
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Avatar
              src={person?.profileShared ? person.avatarUrl : ''}
              name={avatarName}
              size="xl"
              className="relative -mt-14 sm:-mt-12 ring-4 ring-ink-800 shadow-lift shrink-0"
            />
            <div className="min-w-0 flex-1">
              <h1 className="display-serif text-4xl break-words">{heading}</h1>
              {names.qualified && <p className="text-sm text-ink-100 mt-1">{names.qualified}</p>}
              <p className="text-xs font-mono text-ink-200 mt-1 break-all">{webId}</p>
              {person?.profileShared && person.bio && (
                <p className="text-sm text-ink-100 mt-3 leading-relaxed">{person.bio}</p>
              )}
              {posts.length > 0 && (
                <p className="text-sm text-ink-300 mt-3">
                  {posts.length} public {posts.length === 1 ? 'post' : 'posts'}
                </p>
              )}
              {notice && <p className="text-sm text-ink-100 mt-3 leading-relaxed">{notice}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {following ? (
                  <span className="text-sm text-signal self-center">Following</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onFollow?.(webId)}
                    disabled={followBusy}
                    className="btn-primary"
                  >
                    {followBusy
                      ? actionLabel
                        ? 'Connecting…'
                        : 'Following…'
                      : actionLabel || (signedIn ? 'Follow' : 'Sign in to follow')}
                  </button>
                )}
                {signedIn &&
                  !samePerson(selfWebId, webId) &&
                  (requestedWebIds.some((id) => samePerson(id, webId)) ? (
                    <span className="text-sm text-signal self-center">Request sent</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAskContact?.(webId)}
                      disabled={askBusy}
                      className="btn-secondary"
                    >
                      {askBusy ? 'Sending…' : 'Ask to be a contact'}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {!loading && person?.profileShared && (
        <PinnedPosts
          posts={pinnedFrom(person.pinned, posts)}
          onOpen={(post) => {
            const idx = photos.findIndex((photo) => photo.url === post.url);
            if (idx >= 0) setPhotoIndex(idx);
          }}
        />
      )}

      {!loading && person?.profileShared && posts.length === 0 && (
        <EmptyState
          art="welcome"
          title="No public posts yet"
          message="When they share a post with everyone, it'll appear here."
        />
      )}

      {posts.length > 0 && (
        <ul className="grid grid-cols-3 gap-1 sm:gap-2">
          {posts.map((post) => (
            <li key={post.url}>
              <button
                type="button"
                className="group/tile relative block w-full aspect-square bg-ink-800 overflow-hidden text-left rounded-md sm:rounded-xl focus-visible:outline-offset-2"
                disabled={post.type !== 'photo'}
                onClick={() => {
                  const idx = photos.findIndex((photo) => photo.url === post.url);
                  if (idx >= 0) setPhotoIndex(idx);
                }}
                aria-label={
                  post.type === 'photo' ? post.caption || 'Open photo' : post.title || 'Note'
                }
              >
                {post.type === 'photo' &&
                safeHttpUrl(
                  primaryPhotoUrl({
                    ...post,
                    type: 'photo',
                    mediaUrl: post.images?.[0] || post.url,
                  }),
                ) ? (
                  <img
                    src={primaryPhotoUrl({
                      ...post,
                      type: 'photo',
                      mediaUrl: post.images?.[0] || post.url,
                    })}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover/tile:scale-[1.04] group-focus-visible/tile:scale-[1.04]"
                  />
                ) : (
                  <span className="absolute inset-0 p-2.5 sm:p-4 flex items-end bg-gradient-to-br from-sunshine to-accent-light font-display font-semibold text-sm sm:text-lg leading-snug text-plum line-clamp-4">
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
