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
    title: 'Podsta opens Solid Community',
    body: 'The next page belongs to solidcommunity.net, not to Podsta. Choose Sign up there if you do not have an account yet. When the Pod exists, that site sends you back here.',
  },
  {
    id: 'account',
    title: 'Create the account with an email and a password',
    body: 'Solid Community stores that login. Podsta never sees the password. Accounts made there after December 2024 sign in with email.',
  },
  {
    id: 'pod',
    title: 'Create a Pod and pick a short name',
    body: 'That name becomes your address, like https://ada.solidcommunity.net/profile/card#me. In Podsta that shows up as @ada. You can change the display name later. The address stays.',
  },
  {
    id: 'return',
    title: 'Podsta looks for your WebID',
    body: 'A WebID is the address of your identity. When you land back here signed in, Podsta shows the WebID it received. If you closed the window early, come back and choose Sign in.',
  },
];

export const OTHER_PROVIDERS = [
  {
    url: 'https://solidweb.org',
    label: 'SolidWeb',
    hint: 'solidweb.org · Web Access Control',
  },
  {
    url: 'https://login.inrupt.com',
    label: 'Inrupt PodSpaces',
    hint: 'Uses access policies this beta cannot share with',
  },
];
