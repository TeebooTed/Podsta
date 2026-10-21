/** Routes and the words the shell uses. Kept pure so layout can be tested without a browser. */

export const PATHS = {
  home: '/',
  discover: '/discover',
  profile: '/profile',
  people: '/people',
  post: '/post',
  start: '/start',
  invite: '/invite',
  notifications: '/notifications',
  saved: '/saved',
  tag: '/tag',
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

export function tagPath(tag) {
  const name = String(tag || '').trim().replace(/^#+/, '').toLocaleLowerCase();
  if (!name) return '';
  return `${PATHS.tag}?name=${encodeURIComponent(name)}`;
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
  if (pathname.startsWith(PATHS.start)) return 'start';
  if (pathname.startsWith(PATHS.invite)) return 'invite';
  if (pathname.startsWith(PATHS.notifications)) return 'notifications';
  if (pathname.startsWith(PATHS.saved)) return 'saved';
  if (pathname.startsWith(PATHS.tag)) return 'tag';
  return 'home';
}

export function emptyFeedCopy() {
  return {
    title: 'Your feed starts with one person',
    message:
      "Send your invite link to someone you'd like to hear from, or follow someone whose address you already have.",
    copyLabel: 'Copy my invite link',
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
        ? `${count} ${count === 1 ? 'pod' : 'pods'} didn't answer in time, so a few posts may be missing. Everything else is here.`
        : 'Something went wrong on our end. Your posts are safe in your pod. Try again, and if it keeps happening, reload the page.',
    retryLabel: 'Try again',
  };
}
