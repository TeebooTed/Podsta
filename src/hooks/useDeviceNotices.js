import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { appUrl } from '../lib/appUrl.js';
import {
  NOTICE_OPEN_EVENT,
  SOCIAL_EVENT,
  applyAppBadge,
  deviceCandidates,
  devicePromptChoice,
  dismissPrompt,
  hasDismissedPrompt,
  hasSocial,
  readAnnounced,
  showDeviceNotices,
  takeFreshNotices,
  writeAnnounced,
} from '../lib/deviceNotices.js';

function permissionNow() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission || 'default';
}

/**
 * Badge and system notifications for items the existing poll already found.
 * The browser permission dialog opens only from the in-app Turn on button.
 */
export function useDeviceNotices({ enabled, webId, items, seen, unseenCount }) {
  const navigate = useNavigate();
  const [social, setSocial] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState(permissionNow);

  useEffect(() => {
    if (!webId || typeof window === 'undefined') {
      setSocial(false);
      setDismissed(false);
      return undefined;
    }
    const storage = window.localStorage;
    const sync = () => {
      setSocial(hasSocial(storage, webId));
      setDismissed(hasDismissedPrompt(storage, webId));
    };
    sync();
    window.addEventListener(SOCIAL_EVENT, sync);
    return () => window.removeEventListener(SOCIAL_EVENT, sync);
  }, [webId]);

  useEffect(() => {
    applyAppBadge(enabled ? unseenCount : 0);
  }, [enabled, unseenCount]);

  useEffect(() => {
    if (!enabled || permission !== 'granted' || !webId || !seen?.initialized) return undefined;
    const storage = window.localStorage;
    const decision = takeFreshNotices(readAnnounced(storage, webId), deviceCandidates(items, seen));
    writeAnnounced(storage, webId, decision.next);
    if (!decision.show.length) return undefined;
    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker?.getRegistration?.();
      if (cancelled) return;
      await showDeviceNotices(decision.show, {
        registration: registration?.showNotification ? registration : null,
        NotificationApi: typeof Notification === 'function' ? Notification : null,
        urlFor: (href) => (href ? appUrl(href) : appUrl('/')),
        onClick: (item) => {
          window.focus();
          if (item.href) navigate(item.href);
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, permission, webId, items, seen, navigate]);

  useEffect(() => {
    const open = (event) => {
      const href = event.detail?.href || event.data?.href;
      if (event.data?.type === 'podsta-notice' || event.type === NOTICE_OPEN_EVENT) {
        if (href) navigate(href);
      }
    };
    window.addEventListener(NOTICE_OPEN_EVENT, open);
    navigator.serviceWorker?.addEventListener?.('message', open);
    return () => {
      window.removeEventListener(NOTICE_OPEN_EVENT, open);
      navigator.serviceWorker?.removeEventListener?.('message', open);
    };
  }, [navigate]);

  const enable = useCallback(async () => {
    if (typeof Notification === 'undefined' || !Notification.requestPermission) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  const dismiss = useCallback(() => {
    dismissPrompt(webId);
    setDismissed(true);
  }, [webId]);

  return {
    ask: enabled && devicePromptChoice({ social, permission, dismissed }) === 'ask',
    enable,
    dismiss,
  };
}
