import { useEffect, useId, useRef, useState } from 'react';
import { loadComments, postComment } from '../lib/comments.js';
import { relativeTime, shortWebId } from '../lib/utils.js';
import { MAX_COMMENT_LENGTH } from '../lib/vocab.js';
import Avatar from './Avatar.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

/**
 * A right-side drawer that loads and posts comments for a given post.
 * Comments live in the post-owner's pod, so we need their podUrl.
 */
export default function CommentsDrawer({
  open,
  onClose,
  post,
  ownerPodUrl,
  canComment = false,
  session,
  showToast,
}) {
  const [comments, setComments] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef(null);
  const titleId = useId();
  useFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open || !post) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    loadComments({ ownerPodUrl, postUrl: post.url, fetchFn: session?.fetch })
      .then(({ comments: next, error }) => {
        if (cancelled) return;
        setComments(next);
        setLoadError(error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, post, ownerPodUrl, session]);

  // Lock body scroll when drawer is open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      const newComment = await postComment({
        ownerPodUrl,
        postUrl: post.url,
        text,
        session,
      });
      setComments((prev) => [...prev, newComment]);
      setText('');
    } catch (err) {
      showToast(`Comment failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-ink-950/60 backdrop-blur-sm" onClick={onClose}></div>
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md bg-ink-900 border-l border-ink-700 flex flex-col animate-slide-up"
      >
        <header className="px-5 py-4 border-b border-ink-700 flex items-center justify-between">
          <div>
            <h2 id={titleId} className="display-serif text-xl">
              Comments
            </h2>
            <p className="text-xs text-ink-300">
              {canComment
                ? 'Only you can comment. Notes stay in your Pod.'
                : 'Only the post owner can comment.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-8 min-w-8 text-ink-200 hover:text-ink-50 text-2xl leading-none p-1"
            aria-label="Close comments"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-ink-300 text-sm text-center py-8">Loading…</p>
          ) : loadError === 'private' ? (
            <p className="text-ink-200 text-sm text-center py-8">
              Comments on this post are private to the owner.
            </p>
          ) : loadError ? (
            <p className="text-ink-200 text-sm text-center py-8" role="alert">
              Could not load comments. The Pod did not respond in time, or refused the request.
            </p>
          ) : comments.length === 0 ? (
            <p className="text-ink-300 text-sm text-center py-8">
              {canComment ? 'No comments yet.' : 'No public comments on this post.'}
            </p>
          ) : (
            comments.map((c, i) => (
              <div key={i} className="flex gap-3">
                <Avatar name={shortWebId(c.author)} size="sm" />
                <div className="flex-1 bg-ink-800 rounded-xl px-4 py-2.5">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className="text-xs font-medium text-accent truncate">
                      {c.author === session?.info?.webId ? 'You' : shortWebId(c.author)}
                    </p>
                    <p className="text-xs text-ink-300 shrink-0">{relativeTime(c.date)}</p>
                  </div>
                  <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">
                    {c.text}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {canComment && session?.info?.isLoggedIn ? (
          <div className="p-4 border-t border-ink-700">
            <label htmlFor="comment-text" className="sr-only">
              Comment
            </label>
            <textarea
              id="comment-text"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
              }}
              placeholder="Write a comment… (Ctrl+Enter to send)"
              rows={2}
              className="input-field resize-none mb-2"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-300">
                {text.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !text.trim()}
                className="btn-primary py-1.5 px-4 text-xs"
              >
                {submitting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-ink-700 text-center text-sm text-ink-200">
            {canComment ? 'Sign in to leave a comment' : 'You cannot comment on someone else’s post yet.'}
          </div>
        )}
      </aside>
    </div>
  );
}
