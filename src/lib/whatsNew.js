import { hasFinishedOnboarding } from './onboarding.js';

/** Bump when the list below changes, so people who saw the last one see it once more. */
export const WHATS_NEW_ID = '2026-10';
export const WHATS_NEW_KEY = 'podsta.whatsNew.seen';
export const WHATS_NEW_EVENT = 'podsta:whats-new';

export const WHATS_NEW = [
  {
    id: 'profile',
    tint: 'bg-sunshine',
    title: 'Covers and pins',
    body: 'Give your profile a cover photo and pin up to three public posts to the top.',
  },
  {
    id: 'card',
    tint: 'bg-accent',
    title: 'A card for your profile',
    body: 'Make a picture with your name and a QR code, then post it anywhere. It’s under Invite on your profile.',
  },
  {
    id: 'offline',
    tint: 'bg-mint',
    title: 'Works without a connection',
    body: 'A post, like or comment made offline waits on this device and sends when your pod answers.',
  },
  {
    id: 'photos',
    tint: 'bg-berry',
    title: 'Swipe, zoom and pull',
    body: 'Swipe through photos, pinch to zoom, and pull down to refresh on your phone.',
  },
  {
    id: 'location',
    tint: 'bg-plum dark:bg-cream',
    title: 'Your location stays with you',
    body: 'Podsta removes the camera location from photos before they leave your device.',
  },
];

/**
 * Shown once per list on this device. Someone still on the welcome tour is new,
 * so everything is new to them: the list is marked seen instead of stacking a second sheet.
 */
export function whatsNewState(storage, webId) {
  if (!storage || !webId) return 'skip';
  try {
    if (storage.getItem(WHATS_NEW_KEY) === WHATS_NEW_ID) return 'seen';
    return hasFinishedOnboarding(storage, webId) ? 'show' : 'new-user';
  } catch {
    return 'skip';
  }
}

export function markWhatsNewSeen(storage) {
  try {
    storage?.setItem(WHATS_NEW_KEY, WHATS_NEW_ID);
  } catch {
    // Private mode: it will show again next time, which is harmless.
  }
}

export function openWhatsNew() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(WHATS_NEW_EVENT));
}
