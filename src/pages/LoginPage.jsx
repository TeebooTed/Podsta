import { useState } from 'react';
import { Link } from 'react-router-dom';
import { OTHER_PROVIDERS, RECOMMENDED_PROVIDER } from '../lib/provider.js';
import { PATHS } from '../lib/navigation.js';
import Logo from '../components/Logo.jsx';
import Illustration from '../components/Illustration.jsx';
import HeroCollage from '../components/HeroCollage.jsx';
import { LockIcon, PeopleIcon } from '../components/icons.jsx';
import mark from '../assets/podsta-mark.svg';
import homeDesktop from '../../docs/screenshots/home-desktop.webp';
import profilePhone from '../../docs/screenshots/profile-phone.webp';

const SHOTS = [
  {
    src: homeDesktop,
    width: 960,
    height: 600,
    alt: 'The home feed on a desktop: a photo post from a friend, with like, comment, and link buttons.',
    caption: 'Home is the people you follow, newest first',
  },
  {
    src: profilePhone,
    width: 480,
    height: 1038,
    alt: "A friend's profile on a phone: their name, a one-line bio, Following, and a grid of their photos.",
    caption: 'Profiles come straight from each pod',
  },
];

const BENEFITS = [
  {
    title: 'Your photos stay yours',
    body: "Every photo, caption and comment you write is saved in your pod. Podsta reads it from there and doesn't keep a copy anywhere else.",
    tint: 'bg-sunshine',
    icon: <img src={mark} alt="" className="w-8 h-8" width="32" height="32" />,
  },
  {
    title: 'Private until you say so',
    body: "New profiles start hidden and new posts start as Only me. When you're ready, share a post with the people you approve, or with everyone.",
    tint: 'bg-mint',
    icon: <LockIcon className="w-7 h-7 text-plum" />,
  },
  {
    title: 'Friends, the old-fashioned way',
    body: 'Follow people by their address or an invite link, or scan their QR code. Your feed shows posts from people you follow, newest first, with no strangers pushed in.',
    tint: 'bg-accent',
    icon: <PeopleIcon className="w-7 h-7 text-plum" />,
  },
];

const KEYS = [
  {
    id: 'private',
    label: 'Only me',
    sentence: 'Only you hold a key. The post is in your pod and nobody else can open it.',
    who: ['you'],
  },
  {
    id: 'contacts',
    label: 'Contacts',
    sentence:
      "You and the people you've approved get a key. Following you doesn't count as approval.",
    who: ['you', 'contacts'],
  },
  {
    id: 'public',
    label: 'Public',
    sentence: 'The locker is open to anyone with the link.',
    who: ['you', 'contacts', 'everyone'],
  },
];

const PEOPLE = [
  { id: 'you', label: 'You', initials: 'You', tint: 'from-accent to-sunshine' },
  { id: 'contacts', label: 'Approved contacts', initials: '2', tint: 'from-mint to-sunshine' },
  { id: 'everyone', label: 'Everyone else', initials: '∞', tint: 'from-berry to-accent' },
];

const FAQ = [
  {
    q: 'What happens to my photos if Podsta disappears?',
    a: 'They stay in your pod. Podsta never had its own copy, so there is nothing to lose on our side. Your photos are ordinary image files in a "podsta" folder in your pod, and your pod host keeps them for as long as your account lasts. You would need another pod-friendly tool, or your pod host\'s own file browser, to look at them without Podsta.',
  },
  {
    q: 'Who can see my photos?',
    a: "You choose for each post. Only me means only you. Contacts means people you have approved, and following someone doesn't approve them. Public means anyone with the link. Your profile setting sets the limit: a hidden profile can only make Only me posts. Before a photo leaves your device, Podsta redraws it and removes the camera location and other photo details, so they never reach your pod.",
  },
  {
    q: 'Is Podsta free?',
    a: "Podsta has no accounts, no subscriptions and no paid features. It's also open source under the MIT license. Your pod comes from a pod host, and each host sets its own terms, so check theirs when you sign up.",
  },
  {
    q: 'How do I get a pod?',
    a: 'Tap "I don\'t have a pod." Podsta walks you over to Solid Community, where you make an account with an email and a password and pick a short name. Then Solid Community sends you back, signed in. Podsta never sees your password.',
  },
  {
    q: 'Can I use a pod I already have?',
    a: "Yes, if your pod host uses the same sharing system Solid Community does (it's called Web Access Control). Solid Community and SolidWeb both work. Inrupt PodSpaces uses a different system, so sharing doesn't work there yet.",
  },
  {
    q: 'Can I move to a different pod host later?',
    a: "Your posts are plain files, so they can be copied from one pod to another. Podsta doesn't have a move button yet, though. Your address would also change with the new host, so friends would need your new invite link to keep following you.",
  },
  {
    q: 'How do people find me?',
    a: "There's no central list of names. Share your invite link or your QR code, or send someone your address. Your short name, like @ada, comes from your address. It isn't a username anyone else can claim.",
  },
  {
    q: 'Does hiding my profile hide my address?',
    a: "No. Your address stays visible even when your profile is hidden. It's the public link to your pod, so anyone who already has it can still see that it exists. Hidden keeps your Podsta profile and posts private, and nobody is told you're here.",
  },
  {
    q: 'How do I know when someone comments or likes my post?',
    a: 'Podsta checks for news about once a minute while the tab is open, and lights the bell when something new turns up: posts from people you follow, comments on your posts, and contact requests.',
  },
];

function KeyPicker() {
  const [choice, setChoice] = useState('contacts');
  const current = KEYS.find((key) => key.id === choice) || KEYS[0];
  return (
    <div className="card p-5 sm:p-6">
      <p id="key-picker-label" className="font-display font-semibold text-xl text-ink-50 mb-3">
        Who gets a key?
      </p>
      <div className="flex flex-wrap gap-2 mb-5" role="group" aria-labelledby="key-picker-label">
        {KEYS.map((key) => (
          <button
            key={key.id}
            type="button"
            aria-pressed={choice === key.id}
            onClick={() => setChoice(key.id)}
            className={`min-h-11 px-4 rounded-full text-sm font-extrabold border-2 transition-colors ${
              choice === key.id
                ? 'bg-plum text-cream border-plum dark:bg-cream dark:text-plum dark:border-cream'
                : 'border-ink-600 text-ink-100 hover:border-ink-400'
            }`}
          >
            {key.label}
          </button>
        ))}
      </div>
      <ul className="flex items-start justify-around gap-2 mb-4">
        {PEOPLE.map((person) => {
          const allowed = current.who.includes(person.id);
          return (
            <li key={person.id} className="flex flex-col items-center gap-2 w-24 text-center">
              <span
                className={`relative grid place-items-center w-14 h-14 rounded-full font-display font-semibold text-plum transition duration-300 ease-out ${
                  allowed
                    ? `bg-gradient-to-br ${person.tint} scale-100 shadow-soft`
                    : 'bg-ink-700 text-ink-300 scale-90 grayscale'
                }`}
                aria-hidden="true"
              >
                {person.initials}
                <span
                  className={`absolute -bottom-1 -right-1 grid place-items-center w-6 h-6 rounded-full border-2 border-ink-800 text-xs transition ${
                    allowed ? 'bg-mint text-plum' : 'bg-ink-600 text-ink-200'
                  }`}
                >
                  {allowed ? '✓' : <LockIcon className="w-3 h-3" />}
                </span>
              </span>
              <span className="text-xs font-bold text-ink-100 leading-tight">
                {person.label}
                <span className="sr-only">{allowed ? ': can see it' : ': cannot see it'}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-100 leading-relaxed min-h-[2.75rem]" aria-live="polite">
        {current.sentence}
      </p>
    </div>
  );
}

/**
 * Public landing, then existing-Pod sign-in.
 * The identity provider choice is open before anyone signs in.
 */
export default function LoginPage({ error, onLogin, busy = false }) {
  const [advanced, setAdvanced] = useState(false);
  const [customIssuer, setCustomIssuer] = useState('');
  const [localError, setLocalError] = useState(null);
  const [pending, setPending] = useState(false);

  const doLogin = async (issuer) => {
    setPending(true);
    setLocalError(null);
    try {
      await onLogin(issuer);
    } catch (err) {
      console.error('Login failed:', err);
      setLocalError(
        "We couldn't sign you in. Your pod host didn't answer or said no. Check the address and try again, or pick Solid Community from the list.",
      );
      setPending(false);
    }
  };

  const working = busy || pending;
  const shownError = error || localError;

  return (
    <div className="min-h-screen overflow-x-clip">
      {/* Hero */}
      <section className="px-4 pt-8 sm:pt-12 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <h1>
              <Logo size="md" />
              <span className="block mt-8 font-display font-semibold text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tight text-ink-50 text-balance">
                <span className="block">Your photos.</span>
                <span className="block">Your pod.</span>
                <span className="block bg-gradient-to-r from-accent-ink via-berry-ink to-accent-ink bg-clip-text text-transparent">
                  Your rules.
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-100 leading-relaxed text-pretty">
              Podsta is a photo and note sharing app. Everything you post is saved in your own pod,
              a personal storage space on the web. Podsta has no server of its own and keeps no
              copy. You decide who sees each post.
            </p>
            {shownError && (
              <p
                className="mt-6 max-w-xl text-sm text-ink-50 bg-accent/20 border border-accent/40 rounded-2xl px-4 py-3"
                role="alert"
              >
                {shownError}
              </p>
            )}
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => doLogin(RECOMMENDED_PROVIDER.issuer)}
                disabled={working}
                className="btn-primary text-base px-7 py-3.5"
              >
                {working ? 'Opening your pod host…' : 'Sign in'}
              </button>
              <Link to={PATHS.start} className="btn-secondary text-base px-7 py-3.5">
                Get a pod
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-200">
              Signs in with {RECOMMENDED_PROVIDER.host}.{' '}
              <a
                href="#sign-in"
                onClick={() => setAdvanced(true)}
                className="underline decoration-2 underline-offset-2 hover:text-ink-50"
              >
                Use a different pod host
              </a>
            </p>
            <ul className="mt-8 flex flex-wrap gap-2 text-xs font-extrabold text-ink-100">
              <li className="chip bg-ink-800 border border-ink-600/70">No Podsta account</li>
              <li className="chip bg-ink-800 border border-ink-600/70">No ads, no tracking</li>
              <li className="chip bg-ink-800 border border-ink-600/70">Open source (MIT)</li>
            </ul>
          </div>
          <HeroCollage />
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 pb-20" aria-labelledby="why-heading">
        <div className="max-w-6xl mx-auto">
          <h2 id="why-heading" className="sr-only">
            Why Podsta
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="card p-6 transition duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <span
                  className={`grid place-items-center w-14 h-14 rounded-2xl ${benefit.tint} mb-4 -rotate-3`}
                  aria-hidden="true"
                >
                  {benefit.icon}
                </span>
                <h3 className="font-display font-semibold text-xl text-ink-50 mb-2">
                  {benefit.title}
                </h3>
                <p className="text-sm text-ink-100 leading-relaxed">{benefit.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What's a pod */}
      <section
        className="px-4 py-20 bg-ink-900/60 border-y border-ink-600/50"
        aria-labelledby="pod-heading"
      >
        <div className="max-w-6xl mx-auto grid gap-10 lg:grid-cols-2 items-center">
          <div>
            <Illustration name="whats-a-pod" className="w-56 sm:w-64 -ml-4 mb-2" />
            <h2
              id="pod-heading"
              className="font-display font-semibold text-4xl sm:text-5xl text-ink-50 mb-5 tracking-tight"
            >
              What's a pod?
            </h2>
            <div className="space-y-4 text-ink-100 leading-relaxed max-w-xl text-pretty">
              <p>
                A pod is your own little storage space on the web, a bit like a personal locker. You
                get one from a pod host, the same way you get an email account from an email
                provider.
              </p>
              <p>
                When you post on Podsta, your photos and notes go into your locker. Podsta is the
                window you look through. You choose who gets a key: just you, the people you
                approve, or everyone.
              </p>
              <p>
                Because your things live in your pod, other apps that work with pods can be allowed
                in too. And if you stop using Podsta one day, your posts are still sitting in your
                pod, where you left them.
              </p>
            </div>
          </div>
          <KeyPicker />
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-20" aria-labelledby="how-heading">
        <div className="max-w-6xl mx-auto">
          <h2
            id="how-heading"
            className="font-display font-semibold text-4xl text-ink-50 mb-10 tracking-tight"
          >
            Up and running in three steps
          </h2>
          <ol className="grid gap-6 sm:grid-cols-3">
            {[
              [
                'Get a pod',
                "Make one on Solid Community with an email and a password. It's quick. Already have one? Skip ahead.",
              ],
              ['Sign in to Podsta', 'Sign in with your pod. Podsta never sees your password.'],
              [
                'Post and share',
                'Add up to ten photos or a short note. It starts as Only me. Share it when you want to.',
              ],
            ].map(([title, body], i) => (
              <li key={title} className="relative pl-16">
                <span
                  className="absolute left-0 top-0 grid place-items-center w-12 h-12 rounded-full bg-sunshine text-plum font-display font-semibold text-xl shadow-soft"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <h3 className="font-display font-semibold text-xl text-ink-50 mb-1.5">{title}</h3>
                <p className="text-sm text-ink-100 leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* A look inside */}
      <section className="px-4 pb-20" aria-labelledby="look-heading">
        <div className="max-w-6xl mx-auto">
          <h2
            id="look-heading"
            className="font-display font-semibold text-4xl text-ink-50 mb-8 tracking-tight"
          >
            A look inside
          </h2>
          <ul className="grid gap-6 md:grid-cols-[2fr_1fr] items-start">
            {SHOTS.map((shot) => (
              <li key={shot.caption}>
                <figure className="card overflow-hidden p-2">
                  <img
                    src={shot.src}
                    alt={shot.alt}
                    width={shot.width}
                    height={shot.height}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-auto rounded-2xl bg-ink-950"
                  />
                  <figcaption className="px-3 pt-3 pb-1.5 text-sm font-bold text-ink-100">
                    {shot.caption}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ + sign in */}
      <section className="px-4 pb-20" aria-labelledby="faq-heading">
        <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[1.2fr_0.8fr] items-start">
          <div>
            <h2
              id="faq-heading"
              className="font-display font-semibold text-4xl text-ink-50 mb-6 tracking-tight"
            >
              Questions, answered
            </h2>
            <div className="space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group card px-5 py-1 open:shadow-lift transition-shadow"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none py-3.5 font-display font-semibold text-lg text-ink-50 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span
                      className="grid place-items-center shrink-0 w-8 h-8 rounded-full bg-ink-700 text-ink-50 text-xl leading-none transition-transform duration-300 group-open:rotate-45"
                      aria-hidden="true"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 text-sm text-ink-100 leading-relaxed text-pretty">{item.a}</p>
                </details>
              ))}
            </div>
          </div>

          <section
            id="sign-in"
            className="lg:sticky lg:top-6 scroll-mt-6"
            aria-labelledby="signin-heading"
          >
            <div className="card p-7 relative overflow-hidden">
              <Illustration name="welcome" className="w-36 -mt-3 -ml-3 mb-1" />
              <h2
                id="signin-heading"
                className="font-display font-semibold text-3xl text-ink-50 mb-2 text-balance"
              >
                Sign in with your pod
              </h2>
              <p className="text-sm text-ink-100 mb-5 leading-relaxed">
                Podsta doesn't have its own accounts. Your photos and posts live in a pod you
                control. New here? We'll help you get one in a couple of minutes.
              </p>

              <button
                type="button"
                onClick={() => doLogin(RECOMMENDED_PROVIDER.issuer)}
                disabled={working}
                className="w-full text-left px-5 py-3.5 bg-accent hover:bg-accent-light text-plum rounded-2xl shadow-soft transition disabled:opacity-50"
              >
                <span className="block font-extrabold">Sign in</span>
                <span className="block text-xs mt-0.5">
                  {RECOMMENDED_PROVIDER.host} · I already have a pod
                </span>
              </button>

              <Link
                to={PATHS.start}
                className="mt-2 w-full text-left px-5 py-3.5 bg-ink-800 hover:bg-ink-700 border border-ink-600 rounded-2xl transition block"
              >
                <span className="block font-extrabold text-ink-50">I don't have a pod</span>
                <span className="block text-xs text-ink-200 mt-0.5">
                  Make one on {RECOMMENDED_PROVIDER.label}, then come back
                </span>
              </Link>

              <div className="mt-4 pt-4 border-t border-ink-600/70">
                <button
                  type="button"
                  onClick={() => setAdvanced((value) => !value)}
                  className="text-sm font-bold text-ink-100 hover:text-ink-50 min-h-11"
                  aria-expanded={advanced}
                  aria-controls="other-providers"
                >
                  {advanced ? 'Hide other hosts' : 'I use a different pod host'}
                </button>
                {advanced && (
                  <div id="other-providers" className="mt-2 space-y-2 animate-slide-down">
                    <p className="text-sm text-ink-100 leading-relaxed">
                      Podsta works with pod hosts that share posts the same way Solid Community
                      does.
                    </p>
                    {OTHER_PROVIDERS.map((provider) => (
                      <button
                        key={provider.url}
                        type="button"
                        onClick={() => doLogin(provider.url)}
                        disabled={working}
                        className="w-full text-left px-4 py-3 bg-ink-800 hover:bg-ink-700 border border-ink-600 rounded-2xl transition disabled:opacity-50"
                      >
                        <span className="block font-bold text-ink-50">{provider.label}</span>
                        <span className="block text-xs text-ink-200 mt-0.5">{provider.hint}</span>
                      </button>
                    ))}
                    <label htmlFor="custom-issuer" className="block text-xs text-ink-200 pt-2">
                      Your pod host's web address. Sharing works only if this host uses Web Access
                      Control.
                    </label>
                    <input
                      id="custom-issuer"
                      type="url"
                      value={customIssuer}
                      onChange={(event) => setCustomIssuer(event.target.value)}
                      placeholder="https://your-pod-host.example"
                      className="input-field text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => customIssuer && doLogin(customIssuer)}
                      disabled={working || !customIssuer}
                      className="btn-secondary w-full text-sm"
                    >
                      Sign in with this host
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>

      <footer className="px-4 py-10 border-t border-ink-600/50">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between text-sm text-ink-200">
          <Logo size="sm" />
          <p>
            Open source under the MIT license.{' '}
            <a
              href="https://github.com/TeebooTed/Podsta"
              className="underline decoration-2 underline-offset-2 hover:text-ink-50"
            >
              Source on GitHub
            </a>
            . No ads, no tracking.
          </p>
        </div>
      </footer>
    </div>
  );
}
