/**
 * First-run tour. Skippable at every step. Completion is stored per WebID
 * in the browser, not in the Pod, so skipping does not write anything.
 */

export const ONBOARDING_STEPS = [
  {
    id: 'pod',
    title: 'Your posts live in your Pod',
    body: 'A Pod is a personal store on the web. Podsta does not keep a copy. If you leave, the posts stay where they are.',
  },
  {
    id: 'name',
    title: 'What should people call you?',
    body: 'This name is saved in your Pod and shown next to posts you share. You can change it later on your profile.',
  },
  {
    id: 'webid',
    title: 'Your WebID is how people follow you',
    body: 'Send this address to someone. They paste it into Discover. A public profile can also be found through a published follow list. There is no central phone book.',
  },
  {
    id: 'visibility',
    title: 'Who can find you?',
    body: 'Hidden is the default. Contacts only means people you approve, not everyone you follow. Public lists you through published follow lists, and public posts are readable by anyone. If a change fails, Podsta says so instead of pretending it worked.',
  },
  {
    id: 'compose',
    title: 'Write the first one when you are ready',
    body: 'A photo or a short note is enough. You can skip this and come back from New post.',
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
