import { useEffect, useState } from 'react';
import { OFFLINE_COPY, QUEUED_COPY, outboxKindLabel, outboxLabel } from '../lib/outbox.js';

function previewUrl(item) {
  const file = item?.files?.[0];
  if (!file || typeof URL === 'undefined' || !URL.createObjectURL) return '';
  return URL.createObjectURL(file);
}

/**
 * Posts, likes, and comments that are still on this device.
 */
export default function OutboxBanner({ items = [], offline = false, flushing = false, onDiscard }) {
  const [previews, setPreviews] = useState({});

  useEffect(() => {
    const next = {};
    const created = [];
    for (const item of items) {
      const url = previewUrl(item);
      if (!url) continue;
      next[item.id] = url;
      created.push(url);
    }
    setPreviews(next);
    return () => {
      for (const url of created) URL.revokeObjectURL(url);
    };
  }, [items]);

  if (!items.length && !offline) return null;

  return (
    <section className="mb-6 card p-4 sm:p-5" aria-labelledby="outbox-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="outbox-heading" className="display-serif text-2xl">
          Waiting to send
        </h2>
        {flushing && <p className="text-sm text-ink-200">Sending…</p>}
      </div>
      <p className="text-sm text-ink-100 mt-2 leading-relaxed">{offline ? OFFLINE_COPY : QUEUED_COPY}</p>
      {items.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="Waiting to send">
          {items.map((item) => (
            <li key={item.id} className="flex gap-3 items-start rounded-lg border border-ink-700 p-3">
              {previews[item.id] ? (
                <img src={previews[item.id]} alt="" className="w-14 h-14 rounded-md object-cover shrink-0 bg-ink-800" />
              ) : (
                <span className="w-14 h-14 rounded-md bg-ink-800 shrink-0 grid place-items-center text-xs text-ink-200">
                  {outboxKindLabel(item)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink-50 break-words">{outboxLabel(item)}</p>
                <p className="text-xs text-ink-200 mt-1">
                  {outboxKindLabel(item)} · Waiting to send
                  {item.error ? ` · ${item.error}` : ''}
                </p>
              </div>
              <button type="button" className="btn-ghost text-xs shrink-0" onClick={() => onDiscard?.(item.id)}>
                Discard
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
