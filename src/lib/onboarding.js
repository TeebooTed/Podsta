/**
 * First-run tour. Skippable at every step. Completion is stored per WebID
 * in the browser, not in the Pod, so skipping does not write anything.
 */

export const ONBOARDING_STEPS = [
  {
    id: 'pod',
    title: 'Your posts live in your pod',
    body: "Your pod is your own storage space on the web. Podsta doesn't keep a copy. If you ever leave, your posts stay right where they are.",
  },
  {
    id: 'name',
    title: 'What should people call you?',
    body: "We'll save this name in your pod and show it next to your posts. You can change it on your profile.",
  },
  {
    id: 'webid',
    title: 'This is how friends follow you',
    // `@yourname` is replaced with the person's own short name.
    body: 'Send your invite link or show your QR code. People will see you as @yourname. The link carries your full address, so it always points to you.',
  },
  {
    id: 'visibility',
    title: 'Who can find you?',
    body: 'You start hidden. Change this whenever you like.',
  },
  {
    id: 'compose',
    title: 'Ready for your first post?',
    body: 'One photo or a short note is plenty. Add up to ten photos, crop or rotate them, and pick who sees it. New posts start as Only me.',
  },
];

export function onboardingStorageKey(webId) {
  return `podsta.onboarded.${webId}`;
}

export function hasFinishedOnboarding(storage, webId) {
  if (!storage || !webId) return true;
  try {
    return storage.getItem(onboardingStorageKey(webId)) === 'done';
  } catch {
    return true;
  }
}

export function markOnboardingDone(storage, webId) {
  if (!storage || !webId) return;
  storage.setItem(onboardingStorageKey(webId), 'done');
}
