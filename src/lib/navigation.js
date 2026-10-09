/** Routes and the words the shell uses. Kept pure so layout can be tested without a browser. */

export const PATHS = {
  home: '/',
  discover: '/discover',
  profile: '/profile',
  people: '/people',
  post: '/post',
};

export const DESKTOP_NAV = [
  { to: PATHS.home, label: 'Home', shortcut: 'h' },
  { to: PATHS.discover, label: 'Discover', shortcut: 'd' },
  { to: PATHS.profile, label: 'Profile', shortcut: 'p' },
];

/** Phone bar, left to right. New post is an action, not a route. */
export const PHONE_NAV = [
  { to: PATHS.home, label: 'Home' },
  { to: PATHS.discover, label: 'Discover' },
  { action: 'compose', label: 'New post' },
  { to: PATHS.profile, label: 'Profile' },
];

export function personPath(webId) {
  return `${PATHS.people}?webid=${encodeURIComponent(webId)}`;
}

export function postPath(resourceUrl) {
  return `${PATHS.post}?url=${encodeURIComponent(resourceUrl)}`;
}

export function appPostUrl(origin, resourceUrl) {
  const root = String(origin || '').replace(/\/$/, '');
  return `${root}${postPath(resourceUrl)}`;
}

export function sectionFromPath(pathname = '') {
  if (pathname.startsWith(PATHS.discover)) return 'discover';
  if (pathname.startsWith(PATHS.profile)) return 'profile';
  if (pathname.startsWith(PATHS.people)) return 'people';
  if (pathname.startsWith(PATHS.post)) return 'post';
  return 'home';
}

export function emptyFeedCopy() {
  return {
    title: 'Your feed starts with one person',
    message:
      'Copy your WebID and send it to someone you want to hear from, or follow a WebID you already know.',
    copyLabel: 'Copy my WebID',
    followLabel: 'Follow someone',
    followPath: PATHS.discover,
    composeLabel: 'Write a post instead',
  };
}

export function feedErrorCopy(unreachable = 0) {
  const count = Number(unreachable) || 0;
  return {
    title: 'The feed did not load',
    message:
      count > 0
        ? `${count} ${count === 1 ? 'Pod' : 'Pods'} did not respond in time. You can try again.`
        : 'Something went wrong while reading public posts. You can try again.',
    retryLabel: 'Try again',
  };
}
