import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { loadPublicPost } from '../lib/posts.js';
import { photoUrls } from '../lib/album.js';
import PhotoCarousel from '../components/PhotoCarousel.jsx';
import CommentsDrawer from '../components/CommentsDrawer.jsx';
import { safeHttpUrl } from '../lib/urls.js';
import { relativeTime } from '../lib/utils.js';
import { PATHS } from '../lib/navigation.js';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonCard from '../components/SkeletonCard.jsx';
import { samePerson } from '../lib/webId.js';
import SaveButton from '../components/SaveButton.jsx';
import { isSaved } from '../lib/saves.js';

/**
 * A Podsta address for one post. The raw Pod URL stays available as "Open original".
 */
export default function PostPage({ session, posts = [], podUrl, showToast, saves = null, savingUrl = '', onToggleSave }) {
  const [params] = useSearchParams();
  const url = params.get('url') || '';
  const own = posts.find((p) => p.url === url) || null;
  const [loaded, setLoaded] = useState(null);
  const [loading, setLoading] = useState(!own && Boolean(url));
  const [error, setError] = useState(!url);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    if (!url || own) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      let post = null;
      for (let attempt = 0; attempt < 5 && !post; attempt += 1) {
        if (cancelled) return;
        try {
          post = await loadPublicPost({
            url,
            type: url.match(/\.(jpe?g|png|gif|webp)$/i) ? 'photo' : 'text',
            fetchFn: session?.fetch,
          });
        } catch {
          post = null;
        }
        if (!post && attempt < 4)
          await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
      }
      if (cancelled) return;
      if (!post || (!post.body && !post.caption && post.type === 'text')) {
        setLoaded(post && post.type === 'photo' ? post : null);
        setError(!post);
      } else {
        setLoaded(post);
        setError(false);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [url, own, session]);

  const post = own || loaded;
  const onOwnPod = Boolean(podUrl && url.startsWith(podUrl));
  const original = safeHttpUrl(url);

  if (!url) {
    return (
      <EmptyState
        title="This link is missing its post"
        message="Something got cut off along the way. Ask for the link again."
        action={
          <Link to={PATHS.home} className="btn-primary">
            Back home
          </Link>
        }
      />
    );
  }

  return (
    <article className="max-w-lg mx-auto">
      <h1 className="display-serif text-4xl mb-4">{post?.title || 'Post'}</h1>
      <div role="status" className="sr-only">
        {loading ? 'Loading post' : ''}
      </div>
      {loading && <SkeletonCard />}
      {!loading && error && (
        <EmptyState
          title="This post isn't shared with you"
          message="It may be private, or their pod didn't answer. If you know them, ask them to add you as a contact."
          action={
            original && (
              <a
                href={original}
                className="btn-secondary"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open original
              </a>
            )
          }
        />
      )}
      {!loading && post && (
        <>
          {post.type === 'photo' && post.isPublic !== false && photoUrls(post).length > 0 && (
            <PhotoCarousel
              urls={photoUrls(post)}
              alt={post.caption || 'Photo'}
              session={session}
              isPublic
              fit="contain"
            />
          )}
          {post.type === 'photo' && post.isPublic === false && (
            <p className="text-sm text-ink-200">
              This photo is private on your pod. Open your profile to see it.
            </p>
          )}
          {post.caption && <p className="mt-4 text-ink-100 leading-relaxed">{post.caption}</p>}
          {post.body && (
            <p className="mt-4 text-ink-100 leading-relaxed whitespace-pre-wrap">{post.body}</p>
          )}
          <p className="text-xs text-ink-300 mt-3">{relativeTime(post.dateCreated)}</p>
          {onToggleSave && (
            <div className="mt-4">
              <SaveButton
                saved={isSaved(saves, post.url)}
                busy={savingUrl === post.url}
                onToggle={() => onToggleSave(post)}
              />
            </div>
          )}
          {original && (
            <a
              href={original}
              className="btn-ghost inline-flex mt-4"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open original
            </a>
          )}
          <button
            type="button"
            className="btn-secondary mt-4"
            onClick={() => setCommentsOpen(true)}
          >
            Comments
          </button>
        </>
      )}
      {commentsOpen && post && (
        <CommentsDrawer
          open
          post={{
            ...post,
            ownerWebId: post.ownerWebId || (own || onOwnPod ? session?.info?.webId : ''),
            audience: post.audience || (post.isPublic ? 'public' : 'private'),
          }}
          ownerPodUrl={
            post.ownerPodUrl ||
            (own || (session?.info?.webId && samePerson(post.ownerWebId, session.info.webId))
              ? podUrl
              : ownerPodFromUrl(post.url))
          }
          viewerPodUrl={podUrl}
          session={session}
          showToast={showToast}
          onClose={() => setCommentsOpen(false)}
        />
      )}
    </article>
  );
}

function ownerPodFromUrl(resourceUrl) {
  try {
    const url = new URL(resourceUrl);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return '';
  }
}
