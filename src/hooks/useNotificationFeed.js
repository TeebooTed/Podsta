import { useCallback, useEffect, useRef, useState } from 'react';
import { collectNotifications, mergeNotificationPoll } from '../lib/notifications.js';
import { nextPollDelay } from '../lib/pollSchedule.js';
import { acknowledge as acknowledgeSeen, nextSeenAfterPoll, readSeen, unseenItems, writeSeen } from '../lib/seenState.js';
import { openSolidChannel } from '../lib/solidChannel.js';
import { serverInboxUrl } from '../lib/contactRequest.js';
import { PATHS } from '../lib/vocab.js';

/**
 * Poll while the tab is visible. A Solid notification channel, when the
 * provider accepts the session, only asks for an earlier poll.
 *
 * One in-flight check is shared per person and list. React StrictMode mounts
 * the effect twice; two checks at once get the Pod host to answer 429 and the
 * browser hides that response, which used to look like an empty inbox.
 */
const checksInFlight = new Map();

function collectOnce(key, run) {
  const current = checksInFlight.get(key);
  if (current) return current;
  const flight = Promise.resolve()
    .then(run)
    .finally(() => {
      if (checksInFlight.get(key) === flight) checksInFlight.delete(key);
    });
  checksInFlight.set(key, flight);
  return flight;
}

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
      itemsRef.current = [];
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
        const result = await collectOnce(`${webId}\n${friendKey}\n${postKey}`, () =>
          collectNotifications({
            webId,
            podUrl,
            friends,
            posts,
            session,
          }),
        );
        if (closed) return;
        const merged = mergeNotificationPoll(itemsRef.current, result.items, result);
        itemsRef.current = merged;
        const stored = readSeen(window.localStorage, webId);
        const nextSeen = nextSeenAfterPoll(stored, merged, result);
        if (!stored.initialized && nextSeen.initialized) {
          try {
            writeSeen(window.localStorage, webId, nextSeen);
          } catch {
            // Keep the baseline in memory for this tab.
          }
        }
        setItems(merged);
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
          // A wake that arrives mid-check must wait. An immediate second check
          // is what the Pod host answers with 429.
          const pause = failed ? Math.min(waitMs, 8000) : 1500;
          timer = setTimeout(() => {
            if (!closed) tick();
          }, pause);
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
