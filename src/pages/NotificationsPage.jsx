import { Link } from 'react-router-dom';
import { pollStatusCopy } from '../lib/pollSchedule.js';
import { relativeTime } from '../lib/utils.js';
import { samePerson } from '../lib/webId.js';
import { unseenItems } from '../lib/seenState.js';

export default function NotificationsPage({
  items = [],
  seen,
  channelConnected = false,
  failing = false,
  error = '',
  checking = false,
  contacts = [],
  onAcknowledge,
  onRefresh,
  onApprove,
  approvingWebId = '',
}) {
  const unseen = new Set(unseenItems(items, seen).map((item) => item.id));

  return (
    <section className="max-w-xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="display-serif text-4xl">Notifications</h1>
        <div className="flex flex-wrap gap-2">
          {unseen.size > 0 && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => onAcknowledge?.(items.map((item) => item.id))}
            >
              Mark as read
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onRefresh} disabled={checking}>
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>
      </div>
      <p className="text-sm text-ink-200 mt-3 leading-relaxed">{pollStatusCopy({ channelConnected, failing })}</p>
      <p className="sr-only" aria-live="polite">
        {checking ? 'Checking for notifications' : error || (unseen.size ? `${unseen.size} new` : '')}
      </p>
      {error && (
        <p className="mt-4 text-sm text-accent" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 && !checking && (
        <div className="card mt-8 p-8 text-center">
          <h2 className="display-serif text-2xl text-ink-50">Nothing new</h2>
          <p className="text-sm text-ink-200 mt-2 leading-relaxed">
            New posts from people you follow, comments on your posts, and contact requests show up here.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3" aria-label="Notifications">
        {items.map((item) => {
          const isNew = unseen.has(item.id);
          const approved = item.kind === 'contact-request' && contacts.some((id) => samePerson(id, item.actorWebId));
          return (
            <li key={item.id} className="card p-4">
              <div className="flex gap-3 min-w-0">
                <span
                  className={`mt-2 w-2 h-2 rounded-full shrink-0 ${isNew ? 'bg-accent' : 'bg-transparent'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  {item.href ? (
                    <Link to={item.href} className="font-medium text-ink-50 break-words hover:text-accent-light">
                      {isNew && <span className="sr-only">New. </span>}
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-ink-50 break-words">{item.title}</p>
                  )}
                  {item.detail && <p className="text-sm text-ink-200 mt-1 break-words">{item.detail}</p>}
                  {item.created && <p className="text-xs text-ink-200 mt-2">{relativeTime(item.created)}</p>}
                  {item.kind === 'contact-request' && (
                    <div className="mt-3">
                      {approved ? (
                        <span className="text-sm text-signal">Approved</span>
                      ) : (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={approvingWebId === item.actorWebId}
                          onClick={() => onApprove?.(item.actorWebId)}
                        >
                          {approvingWebId === item.actorWebId ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
