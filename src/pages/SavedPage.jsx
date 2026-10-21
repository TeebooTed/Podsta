import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PostCard from '../components/PostCard.jsx';
import SaveButton from '../components/SaveButton.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { loadPublicPost } from '../lib/posts.js';
import { PATHS } from '../lib/navigation.js';
import { relativeTime } from '../lib/utils.js';

/**
 * Saved posts are URLs in the viewer's private Pod file.
 * A card is shown only when this session can still read the post.
 * Otherwise the row says it is unavailable and does not repeat the text or the photo.
 */
function UnavailableSave({ entry, busy, onForget }) {
  return (
    <article className="card p-4 flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-ink-100">This saved post is no longer available</p>
        <p className="text-xs text-ink-300 mt-1">
          {entry.savedAt ? `Saved ${relativeTime(entry.savedAt)}. ` : ''}
          It may be private now, or it was deleted. The caption and photo were not copied here.
        </p>
      </div>
      <SaveButton saved busy={busy} onToggle={onForget} />
    </article>
  );
}

function SavedCard({ entry, ownPost, session, busy, onToggleSave }) {
  const [loaded, setLoaded] = useState(ownPost || null);
  const [state, setState] = useState(ownPost ? 'ready' : 'loading');

  useEffect(() => {
    if (ownPost) {
      setLoaded(ownPost);
      setState('ready');
      return undefined;
    }
    let cancelled = false;
    setState('loading');
    loadPublicPost({
      url: entry.postUrl,
      type: entry.postUrl.match(/\.(jpe?g|png|gif|webp)$/i) ? 'photo' : 'text',
      fetchFn: session?.fetch,
    })
      .then((post) => {
        if (cancelled) return;
        if (!post || (post.type === 'text' && !post.body && !post.caption && !post.title)) {
          setLoaded(null);
          setState('unavailable');
          return;
        }
        setLoaded(post);
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, [entry.postUrl, ownPost, session]);

  if (state === 'loading') {
    return <div className="card aspect-[4/3] skeleton" role="status" aria-label="Loading saved post" />;
  }
  if (state !== 'ready' || !loaded) {
    return (
      <UnavailableSave
        entry={entry}
        busy={busy}
        onForget={() => onToggleSave({ url: entry.postUrl })}
      />
    );
  }
  return (
    <PostCard
      post={loaded}
      mode="view"
      session={session}
      saved
      saveBusy={busy}
      onToggleSave={onToggleSave}
    />
  );
}

export default function SavedPage({ session, posts = [], saves, error = false, savingUrl = '', onToggleSave }) {
  const ordered = [...(saves || [])].sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="display-serif text-4xl mb-2">Saved</h1>
      <p className="text-sm text-ink-200 mb-6 leading-relaxed">
        Saved posts stay in your Pod, as a private list of addresses. Podsta does not keep a copy of the photo or the caption.
      </p>
      {error && (
        <EmptyState
          title="Saved posts did not load"
          message="The list on your Pod could not be read, so nothing was changed."
        />
      )}
      {!error && saves === null && <div className="card aspect-[4/3] skeleton" role="status" aria-label="Loading saved posts" />}
      {!error && Array.isArray(saves) && ordered.length === 0 && (
        <EmptyState
          title="Nothing saved yet"
          message="Save a post from Home or from a profile. It will be here the next time you open Podsta, on this Pod."
          action={
            <Link to={PATHS.home} className="btn-primary">
              Back home
            </Link>
          }
        />
      )}
      {!error && ordered.length > 0 && (
        <div className="space-y-5">
          {ordered.map((entry) => (
            <SavedCard
              key={entry.postUrl}
              entry={entry}
              ownPost={posts.find((post) => post.url === entry.postUrl) || null}
              session={session}
              busy={savingUrl === entry.postUrl}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}
