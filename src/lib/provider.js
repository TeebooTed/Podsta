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
    title: 'Tap Sign up on the next page.',
    body: "That page is Solid Community's Log in screen. Tap Sign up, not Log in.",
  },
  {
    id: 'account',
    title: 'Register with your email and a password.',
    body: 'Solid Community keeps your login. Podsta never sees your password.',
  },
  {
    id: 'pod',
    title: 'Create a pod before anything else.',
    body: "On Your account, tap Create pod and pick a short name. It becomes your address, and in Podsta you'll show up as @yourname. Leave the address choice as it is. Skip Continue authentication until the pod exists. If you continue first, Solid Community says no address is assigned and you can't finish.",
  },
  {
    id: 'return',
    title: 'Come back here and tap Sign in.',
    body: 'Solid Community does not send you back on its own. Open Podsta again, tap Sign in, choose the address you just made, and tap Authorize. Use the same email and password if it asks.',
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
