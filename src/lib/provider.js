/**
 * The one Pod host Podsta sends new people to.
 * solidcommunity.net is a Community Solid Server: it publishes WAC-Allow,
 * its account pages are live, and a Pod can be created there without a
 * separate confirmation email. Inrupt PodSpaces uses access policies this
 * app cannot share with, so it is not the signup path.
 */
export const RECOMMENDED_PROVIDER = {
  id: 'solidcommunity',
  issuer: 'https://solidcommunity.net',
  label: 'Solid Community',
  host: 'solidcommunity.net',
  registerUrl: 'https://solidcommunity.net/.account/login/password/register/',
  loginUrl: 'https://solidcommunity.net/.account/login/password/',
};

export const SIGNUP_STEPS = [
  {
    id: 'leave',
    title: "You'll hop over to Solid Community.",
    body: "The next page belongs to them. Choose Sign up if you're new.",
  },
  {
    id: 'account',
    title: 'Make an account with your email and a password.',
    body: 'Solid Community keeps your login. Podsta never sees your password.',
  },
  {
    id: 'pod',
    title: 'Pick a short name.',
    body: "It becomes your address, and in Podsta you'll show up as @yourname. You can change your display name any time. The short name stays.",
  },
  {
    id: 'return',
    title: 'Come back here.',
    body: 'Solid Community sends you back signed in. If you closed the window early, come back and tap Sign in.',
  },
];

export const OTHER_PROVIDERS = [
  {
    url: 'https://solidweb.org',
    label: 'SolidWeb',
    hint: 'solidweb.org. Works with Podsta.',
  },
  {
    url: 'https://login.inrupt.com',
    label: 'Inrupt PodSpaces',
    hint: "Sharing doesn't work here yet. You can sign in, but your posts can't reach anyone else.",
  },
];
