import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  addComment,
  blockPerson,
  commenterLabel,
  commentResultCopy,
  deleteOwnComment,
  discoverableName,
  editOwnComment,
  hideComment,
  loadThread,
  refreshOwnedCommentSets,
} from '../lib/comments.js';
import { addReport } from '../lib/blocks.js';
import { relativeTime } from '../lib/utils.js';
import { MAX_COMMENT_LENGTH } from '../lib/vocab.js';
import { samePerson } from '../lib/webId.js';
import Avatar from './Avatar.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap.js';

/**
 * Comments are written in the commenter's Pod. The author publishes the list
 * with the same audience as the post. This drawer never asks the server to
 * let a stranger write the author's Pod.
 */
export default function CommentsDrawer({
  open,
  onClose,
  post,
  ownerPodUrl,
  viewerPodUrl,
  session,
  showToast,
  onBlocksChanged,
}) {
  const [comments, setComments] = useState([]);
  const [names, setNames] = useState({});
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [editText, setEditText] = useState('');
  const [pendingId, setPendingId] = useState('');
  const [status, setStatus] = useState('');
  const panelRef = useRef(null);
  const titleId = useId();
  useFocusTrap(open, panelRef);

  const me = session?.info?.webId || '';
  const authorWebId = post?.ownerWebId || '';
  const isAuthor = Boolean(me && authorWebId) && samePerson(me, authorWebId);
  const signedIn = Boolean(session?.info?.isLoggedIn && me && viewerPodUrl);

  const reload = useCallback(async () => {
    if (!post?.url || !ownerPodUrl) return;
    if (isAuthor && viewerPodUrl && session?.fetch) {
      try {
        await refreshOwnedCommentSets({
          podUrl: viewerPodUrl,
          session,
          posts: [{ ...post, ownerWebId: authorWebId || me }],
        });
      } catch {
        // The list below still shows whatever is already published.
      }
    }
    const { comments: next, error } = await loadThread({
      ownerPodUrl,
      postUrl: post.url,
      fetchFn: session?.fetch,
      viewerPodUrl,
      viewerWebId: me,
      isAuthor,
    });
    setComments(next);
    setLoadError(error);
  }, [post, ownerPodUrl, isAuthor, viewerPodUrl, session, authorWebId, me]);

  useEffect(() => {
    if (!open || !post?.url) return undefined;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setStatus('');
    setEditingId('');
    setPendingId('');
    reload()
      .catch(() => {
        if (!cancelled) setLoadError('unavailable');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, post?.url, reload]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    const ids = [...new Set(comments.map((comment) => comment.author).filter((id) => id && !samePerson(id, me)))];
    (async () => {
      const next = {};
      for (const id of ids) {
        try {
          next[id] = await discoverableName(id, session?.fetch || fetch);
        } catch {
          next[id] = { name: '', handle: '', readable: false };
        }
      }
      if (!cancelled) setNames(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, comments, session, me]);

  useEffect(() => {
    if (!open) return undefined;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const postForWrite = {
    ...post,
    ownerWebId: authorWebId || (isAuthor ? me : ''),
    url: post?.url,
  };

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    setStatus('');
    try {
      const result = await addComment({
        podUrl: viewerPodUrl,
        session,
        post: postForWrite,
        ownerPodUrl,
        text,
      });
      setText('');
      const message = commentResultCopy(result, 'add');
      setStatus(message);
      showToast?.(message, result.notified || result.published ? 'success' : 'info');
      await reload();
    } catch (err) {
      const message = err.message || 'Could not save that comment';
      setStatus(message);
      showToast?.(`Comment failed: ${message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (comment) => {
    setPendingId(comment.id);
    setStatus('');
    try {
      const result = await editOwnComment({
        podUrl: viewerPodUrl,
        session,
        post: postForWrite,
        ownerPodUrl,
        id: comment.id,
        text: editText,
      });
      const message = commentResultCopy(result, 'edit');
      setStatus(message);
      showToast?.(message, result.notified || result.published ? 'success' : 'info');
      setEditingId('');
      await reload();
    } catch (err) {
      const message = err.message || 'Could not update that comment';
      setStatus(message);
      showToast?.(`Edit failed: ${message}`, 'error');
    } finally {
      setPendingId('');
    }
  };

  const handleDelete = async (comment) => {
    setPendingId(comment.id);
    setStatus('');
    try {
      const result = await deleteOwnComment({
        podUrl: viewerPodUrl,
        session,
        post: postForWrite,
        ownerPodUrl,
        id: comment.id,
      });
      const message = commentResultCopy(result, 'delete');
      setStatus(message);
      showToast?.(message, result.notified || result.published ? 'success' : 'info');
      await reload();
    } catch (err) {
      const message = err.message || 'Could not delete that comment';
      setStatus(message);
      showToast?.(`Delete failed: ${message}`, 'error');
    } finally {
      setPendingId('');
    }
  };

  const handleHide = async (comment) => {
    setPendingId(comment.id);
    setStatus('');
    try {
      await hideComment({
        podUrl: viewerPodUrl,
        session,
        post: postForWrite,
        comment: { ...comment, postUrl: post.url },
      });
      setStatus('Hidden. It no longer appears on this post.');
      showToast?.('Hidden. It no longer appears on this post.');
      await reload();
    } catch (err) {
      const message = err.message || 'Could not hide that comment';
      setStatus(message);
      showToast?.(`Hide failed: ${message}`, 'error');
    } finally {
      setPendingId('');
    }
  };

  const handleBlock = async (comment) => {
    setPendingId(comment.id);
    setStatus('');
    try {
      await blockPerson({
        podUrl: viewerPodUrl,
        session,
        webId: comment.author,
        post: postForWrite,
      });
      setStatus('Blocked. Their comments and likes are hidden.');
      showToast?.('Blocked. Their comments and likes are hidden.');
      onBlocksChanged?.();
      await reload();
    } catch (err) {
      const message = err.message || 'Could not block that person';
      setStatus(message);
      showToast?.(`Block failed: ${message}`, 'error');
    } finally {
      setPendingId('');
    }
  };

  const handleReport = async (comment) => {
    setPendingId(comment.id);
    setStatus('');
    try {
      await addReport({
        podUrl: viewerPodUrl,
        session,
        comment: { ...comment, postUrl: post.url },
      });
      setStatus('Saved a private report in your Pod. Podsta has nowhere to send it.');
      showToast?.('Saved a private report in your Pod. Podsta has nowhere to send it.');
    } catch (err) {
      const message = err.message || 'Could not save that report';
      setStatus(message);
      showToast?.(`Report failed: ${message}`, 'error');
    } finally {
      setPendingId('');
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
        <header className="px-5 py-4 border-b border-ink-700 flex items-center justify-between gap-3">
          <div>
            <h2 id={titleId} className="display-serif text-xl">
              Comments
            </h2>
            <p className="text-xs text-ink-200">
              Each comment stays in the commenter's Pod. This list uses the same audience as the post.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 text-ink-200 hover:text-ink-50 text-2xl leading-none"
            aria-label="Close comments"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {status && (
            <p className="text-sm text-ink-100 bg-ink-800 border border-ink-600 rounded-lg px-3 py-2" role="status">
              {status}
            </p>
          )}
          {loading ? (
            <p className="text-ink-200 text-sm text-center py-8">Loading comments…</p>
          ) : loadError === 'private' ? (
            <p className="text-ink-100 text-sm text-center py-8">
              Comments on this post are not available to you.
            </p>
          ) : loadError === 'partial' ? null : loadError ? (
            <p className="text-ink-100 text-sm text-center py-8" role="alert">
              Could not load comments. The Pod did not respond, or refused the request.
            </p>
          ) : comments.length === 0 ? (
            <p className="text-ink-200 text-sm text-center py-8">No comments yet.</p>
          ) : (
            comments.map((comment) => {
              const known = names[comment.author] || {};
              const label = commenterLabel({
                webId: comment.author,
                me,
                name: known.name,
                nameReadable: known.readable,
              });
              const mine = samePerson(comment.author, me);
              const busy = pendingId === comment.id;
              return (
                <article key={comment.id || `${comment.author}-${comment.date}`} className="flex gap-3">
                  <Avatar name={label.primary} size="sm" />
                  <div className="flex-1 bg-ink-800 rounded-xl px-4 py-2.5 min-w-0">
                    <div className="flex items-baseline justify-between gap-2 mb-0.5">
                      <p className="text-xs font-medium text-ink-50 truncate">
                        {label.primary}
                        {label.handle && label.primary !== label.handle ? (
                          <span className="text-ink-200 font-normal"> {label.handle}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-ink-200 shrink-0">{relativeTime(comment.modified || comment.date)}</p>
                    </div>
                    {editingId === comment.id ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          handleEdit(comment);
                        }}
                      >
                        <label htmlFor={`edit-${comment.id}`} className="sr-only">
                          Edit comment
                        </label>
                        <textarea
                          id={`edit-${comment.id}`}
                          value={editText}
                          onChange={(event) => setEditText(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
                          rows={3}
                          className="input-field resize-none mb-2"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" className="btn-primary py-1.5 px-3 text-xs" disabled={busy || !editText.trim()}>
                            {busy ? 'Saving…' : 'Save edit'}
                          </button>
                          <button type="button" className="btn-secondary py-1.5 px-3 text-xs" onClick={() => setEditingId('')}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="text-sm text-ink-100 leading-relaxed whitespace-pre-wrap">{comment.text}</p>
                    )}
                    {comment.status === 'hidden' && (
                      <p className="text-xs text-ink-200 mt-1">The author hid this comment. Other people cannot see it on the post.</p>
                    )}
                    {comment.status === 'unpublished' && (
                      <p className="text-xs text-ink-200 mt-1">
                        This comment is not on the published list. Other people cannot see it there yet.
                      </p>
                    )}
                    {signedIn && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {mine && (
                          <button
                            type="button"
                            className="min-h-8 px-2 text-xs text-ink-100 underline"
                            onClick={() => {
                              setEditingId(comment.id);
                              setEditText(comment.text || '');
                              setPendingId('');
                            }}
                          >
                            Edit
                          </button>
                        )}
                        {mine && pendingId !== `delete:${comment.id}` && (
                          <button
                            type="button"
                            className="min-h-8 px-2 text-xs text-ink-100 underline"
                            onClick={() => setPendingId(`delete:${comment.id}`)}
                          >
                            Delete
                          </button>
                        )}
                        {mine && pendingId === `delete:${comment.id}` && (
                          <>
                            <button
                              type="button"
                              className="btn-primary py-1 px-3 text-xs"
                              disabled={busy}
                              onClick={() => handleDelete(comment)}
                            >
                              {busy ? 'Deleting…' : 'Confirm delete'}
                            </button>
                            <button type="button" className="btn-secondary py-1 px-3 text-xs" onClick={() => setPendingId('')}>
                              Cancel
                            </button>
                          </>
                        )}
                        {isAuthor && comment.status === 'published' && pendingId !== `hide:${comment.id}` && (
                          <button
                            type="button"
                            className="min-h-8 px-2 text-xs text-ink-100 underline"
                            onClick={() => setPendingId(`hide:${comment.id}`)}
                          >
                            Hide
                          </button>
                        )}
                        {isAuthor && pendingId === `hide:${comment.id}` && (
                          <button type="button" className="btn-primary py-1 px-3 text-xs" disabled={busy} onClick={() => handleHide(comment)}>
                            {busy ? 'Hiding…' : 'Confirm hide'}
                          </button>
                        )}
                        {isAuthor && !mine && (
                          <button
                            type="button"
                            className="min-h-8 px-2 text-xs text-ink-100 underline"
                            disabled={busy}
                            onClick={() => handleReport(comment)}
                          >
                            Report
                          </button>
                        )}
                        {isAuthor && !mine && pendingId !== `block:${comment.id}` && (
                          <button
                            type="button"
                            className="min-h-8 px-2 text-xs text-ink-100 underline"
                            onClick={() => setPendingId(`block:${comment.id}`)}
                          >
                            Block
                          </button>
                        )}
                        {isAuthor && pendingId === `block:${comment.id}` && (
                          <button
                            type="button"
                            className="btn-primary py-1 px-3 text-xs"
                            disabled={busy}
                            onClick={() => handleBlock(comment)}
                          >
                            {busy ? 'Blocking…' : 'Confirm block'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {signedIn ? (
          <form
            className="p-4 border-t border-ink-700"
            onSubmit={(event) => {
              event.preventDefault();
              handleSubmit();
            }}
          >
            <label htmlFor="comment-text" className="block text-xs font-medium text-ink-200 mb-1.5">
              Comment
            </label>
            <textarea
              id="comment-text"
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_COMMENT_LENGTH))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) handleSubmit();
              }}
              placeholder="Write a comment"
              rows={2}
              className="input-field resize-none mb-2"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-ink-200">
                {text.length}/{MAX_COMMENT_LENGTH}
              </span>
              <button type="submit" disabled={submitting || !text.trim()} className="btn-primary py-1.5 px-4 text-xs">
                {submitting ? 'Posting…' : 'Post comment'}
              </button>
            </div>
          </form>
        ) : (
          <p className="p-4 border-t border-ink-700 text-center text-sm text-ink-100">Sign in to comment.</p>
        )}
      </aside>
    </div>
  );
}
