import { useCallback, useEffect, useRef, useState } from 'react';
import {
  browserOutbox,
  flushOutbox,
  notifyOutboxSent,
  sendOutboxItem,
} from '../lib/outbox.js';

/**
 * Loads the on-device queue and sends it when the browser comes back online.
 */
export function useOutbox({ enabled, session, podUrl, webId, onSent }) {
  const [items, setItems] = useState([]);
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const [flushing, setFlushing] = useState(false);
  const run = useRef(false);
  const ctx = useRef({});
  ctx.current = { session, podUrl, webId, onSent, enabled };

  const refresh = useCallback(async () => {
    if (!webId) {
      setItems([]);
      return;
    }
    const list = await browserOutbox().list(webId);
    setItems(list);
  }, [webId]);

  const discard = useCallback(
    async (id) => {
      await browserOutbox().remove(id);
      await refresh();
    },
    [refresh],
  );

  const flush = useCallback(async () => {
    const current = ctx.current;
    if (!current.enabled || !current.webId || !current.session || !current.podUrl) return;
    if (run.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    run.current = true;
    setFlushing(true);
    try {
      const result = await flushOutbox({
        webId: current.webId,
        store: browserOutbox(),
        send: (item) => sendOutboxItem(item, { session: current.session, podUrl: current.podUrl }),
      });
      if (result.sent) {
        notifyOutboxSent();
        await current.onSent?.();
      }
    } finally {
      run.current = false;
      setFlushing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onOnline = () => {
      setOffline(false);
      flush();
    };
    const onOffline = () => setOffline(true);
    const onChanged = () => {
      refresh();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('podsta-outbox-changed', onChanged);
    flush();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('podsta-outbox-changed', onChanged);
    };
  }, [enabled, flush, refresh]);

  return { items, offline, flushing, refresh, discard, flush };
}
