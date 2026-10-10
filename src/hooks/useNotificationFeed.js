import { useCallback, useEffect, useRef, useState } from 'react';
import { collectNotifications } from '../lib/notifications.js';
import { nextPollDelay } from '../lib/pollSchedule.js';
import { acknowledge as acknowledgeSeen, baselineSeen, readSeen, unseenItems, writeSeen } from '../lib/seenState.js';
import { openSolidChannel } from '../lib/solidChannel.js';
import { serverInboxUrl } from '../lib/contactRequest.js';
import { PATHS } from '../lib/vocab.js';

/**
 * Poll while the tab is visible. A Solid notification channel, when the
 * provider accepts the session, only asks for an earlier poll.
 */
export function useNotificationFeed({ enabled, session, podUrl, webId, friends, posts }) {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState({ initialized: false, ids: [] });
  const [outgoingTargets, setOutgoingTargets] = useState([]);
  const [channelConnected, setChannelConnected] = useState(false);
  const [failing, setFailing] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const itemsRef = useRef([]);
  const refreshRef = useRef(async () => {});

  const friendKey = (friends || []).map((friend) => `${friend.webId}|${friend.podUrl || ''}`).join('\n');
  const postKey = (posts || []).map((post) => post.url).join('\n');

  const acknowledge = useCallback(
    (ids) => {
      setSeen((previous) => {
        const next = acknowledgeSeen(
          previous.initialized ? previous : { initialized: true, ids: [] },
          ids,
          itemsRef.current.map((item) => item.id),
        );
        try {
          writeSeen(window.localStorage, webId, next);
        } catch {
          // Private mode can reject the write. The badge still clears in memory.
        }
        return next;
      });
    },
    [webId],
  );

  useEffect(() => {
    if (!enabled || !session?.info?.isLoggedIn || !podUrl || !webId) {
      setItems([]);
      setSeen({ initialized: false, ids: [] });
      setOutgoingTargets([]);
      setChannelConnected(false);
      setFailing(false);
      setError('');
      return undefined;
    }

    let closed = false;
    let running = false;
    let queued = false;
    let waitMs = nextPollDelay();
    let connected = false;
    let failed = false;
    let timer = null;
    const controller = new AbortController();
    const channelHandles = [];

    function schedule() {
      clearTimeout(timer);
      if (closed || document.hidden) return;
      timer = setTimeout(() => {
        refreshRef.current();
      }, waitMs);
    }

    async function tick() {
      if (closed) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      setChecking(true);
      try {
        const result = await collectNotifications({
          webId,
          podUrl,
          friends,
          posts,
          session,
        });
        if (closed) return;
        const stored = readSeen(window.localStorage, webId);
        const nextSeen = stored.initialized ? stored : baselineSeen(result.items);
        if (!stored.initialized) {
          try {
            writeSeen(window.localStorage, webId, nextSeen);
          } catch {
            // Keep the baseline in memory for this tab.
          }
        }
        itemsRef.current = result.items;
        setItems(result.items);
        setSeen(nextSeen);
        setOutgoingTargets(result.outgoingTargets || []);
        failed = Boolean(result.failedAll);
        setFailing(failed);
        setError(failed ? 'Podsta could not reach the Pods it checks.' : '');
        waitMs = nextPollDelay({
          failed,
          previousDelay: waitMs,
          channelConnected: connected,
        });
      } catch (err) {
        if (closed) return;
        failed = true;
        setFailing(true);
        setError(err?.message || 'Podsta could not check for notifications.');
        waitMs = nextPollDelay({
          failed: true,
          previousDelay: waitMs,
          channelConnected: connected,
        });
      } finally {
        running = false;
        setChecking(false);
        if (closed) return;
        if (queued) {
          queued = false;
          tick();
        } else {
          schedule();
        }
      }
    }

    refreshRef.current = tick;

    function onVisible() {
      if (!document.hidden) tick();
    }

    async function connectChannel() {
      const topics = [serverInboxUrl(podUrl), `${podUrl}${PATHS.comments}`];
      for (const topic of topics) {
        if (closed) return;
        try {
          const handle = await openSolidChannel({
            fetchFn: session.fetch,
            resourceUrl: topic,
            signal: controller.signal,
            onWake: () => {
              if (!closed) tick();
            },
          });
          if (closed) {
            handle.close();
            return;
          }
          if (handle.connected) {
            channelHandles.push(handle);
            connected = true;
            setChannelConnected(true);
            waitMs = nextPollDelay({ failed, channelConnected: true });
            return;
          }
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      if (!closed) setChannelConnected(false);
    }

    document.addEventListener('visibilitychange', onVisible);
    tick();
    connectChannel();

    return () => {
      closed = true;
      clearTimeout(timer);
      controller.abort();
      for (const handle of channelHandles) handle.close();
      document.removeEventListener('visibilitychange', onVisible);
    };
    // friendKey and postKey stand in for the arrays so a new array identity
    // from an unrelated render does not restart the channel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, session, podUrl, webId, friendKey, postKey]);

  const refresh = useCallback(() => refreshRef.current(), []);
  const unseenCount = unseenItems(items, seen).length;

  return {
    items,
    seen,
    unseenCount,
    outgoingTargets,
    channelConnected,
    failing,
    error,
    checking,
    acknowledge,
    refresh,
  };
}
