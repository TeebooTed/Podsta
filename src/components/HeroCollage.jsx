import { ChatIcon, HeartIcon, LinkIcon, LockIcon, PeopleIcon } from './icons.jsx';
import mark from '../assets/podsta-mark.svg';
import strawberries320 from '../assets/hero/strawberries-320.webp';
import strawberries560 from '../assets/hero/strawberries-560.webp';
import dog from '../assets/hero/dog-beach-320.webp';
import lake from '../assets/hero/lake-320.webp';
import picnic from '../assets/hero/picnic-320.webp';

function GlobeIcon({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

const CARDS = [
  {
    src: dog,
    caption: 'Beach day',
    side: 'left',
    chip: { label: 'Contacts', Icon: PeopleIcon, tint: 'bg-mint' },
    place: '-left-2 sm:left-0 top-4 sm:top-2 -rotate-[9deg]',
    fan: ['5rem', '3rem'],
    delay: '-1s',
  },
  {
    src: lake,
    caption: 'Sunrise',
    side: 'right',
    chip: { label: 'Only me', Icon: LockIcon, tint: 'bg-cream' },
    place: '-right-2 sm:right-0 top-0 rotate-[7deg]',
    fan: ['-5rem', '3rem'],
    delay: '-3s',
  },
  {
    src: picnic,
    caption: 'Picnic',
    side: 'right',
    chip: { label: 'Public', Icon: GlobeIcon, tint: 'bg-sunshine' },
    place: '-right-1 sm:right-4 bottom-2 rotate-[-5deg]',
    fan: ['-4rem', '-4rem'],
    delay: '-5s',
  },
];

/** A printed-photo card. The outer box is placed and tilted; the inner one fans in, then floats. */
function PhotoCard({ src, caption, chip, side, place, fan, delay, index }) {
  const { Icon } = chip;
  return (
    <div className={`absolute w-32 sm:w-40 lg:w-44 ${place}`}>
      <div
        className="motion-safe:animate-fan-in"
        style={{ '--fan-x': fan[0], '--fan-y': fan[1], animationDelay: `${150 + index * 120}ms` }}
      >
        <figure
          className="rounded-2xl bg-cream p-2 pb-3 shadow-lift motion-safe:animate-float"
          style={{ animationDelay: delay }}
        >
          <div className="relative">
            <img
              src={src}
              alt=""
              width="320"
              height="320"
              decoding="async"
              className="block w-full aspect-square object-cover rounded-xl bg-[#f7e6d8]"
            />
            <span
              className={`absolute top-2 ${side === 'left' ? 'left-2' : 'right-2'} inline-flex items-center gap-1 rounded-full ${chip.tint} text-plum px-2 py-0.5 text-[10px] font-extrabold shadow-soft`}
            >
              <Icon className="w-3 h-3" />
              {chip.label}
            </span>
          </div>
          <figcaption
            className={`mt-2 px-1 font-display font-semibold text-plum text-sm truncate ${side === 'left' ? 'text-left' : 'text-right'}`}
          >
            {caption}
          </figcaption>
        </figure>
      </div>
    </div>
  );
}

/** The phone in front: a live mock of a feed post rather than a screenshot, so it stays sharp and themed. */
function Phone() {
  return (
    <div className="relative z-10 mx-auto w-52 sm:w-60 lg:w-64 motion-safe:animate-pop-in">
      <div className="rounded-[2.4rem] bg-plum p-2 shadow-lift rotate-[2deg]">
        <div className="rounded-[2rem] overflow-hidden bg-ink-900 text-ink-50">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <img src={mark} alt="" className="w-6 h-6" />
            <span className="w-14 h-1.5 rounded-full bg-ink-700" />
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sunshine to-accent" />
          </div>
          <div className="mx-2 mb-2 rounded-2xl bg-ink-800 shadow-soft overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-gradient-to-br from-accent to-berry text-plum text-[10px] font-extrabold">
                CM
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-xs font-extrabold truncate">Cleo Marsh</span>
                <span className="block text-[10px] text-ink-200">@cleo · 2m</span>
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-mint text-plum px-2 py-0.5 text-[9px] font-extrabold">
                <PeopleIcon className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Contacts</span>
              </span>
            </div>
            <img
              src={strawberries560}
              srcSet={`${strawberries320} 320w, ${strawberries560} 560w`}
              sizes="(min-width: 1024px) 240px, (min-width: 640px) 224px, 192px"
              alt=""
              width="560"
              height="420"
              fetchPriority="high"
              decoding="async"
              className="block w-full aspect-[4/3] object-cover bg-[#f3c9b8]"
            />
            <div className="flex items-center gap-3 px-3 pt-2 text-ink-100">
              <span className="relative inline-flex items-center gap-1 text-accent">
                <HeartIcon filled className="w-5 h-5 motion-safe:animate-hero-like" />
                <span className="text-xs font-extrabold text-ink-100">12</span>
              </span>
              <ChatIcon className="w-5 h-5" />
              <LinkIcon className="w-5 h-5 ml-auto" />
            </div>
            <p className="px-3 pt-1 pb-3 text-[11px] text-ink-100">
              <span className="font-extrabold text-ink-50">Cleo</span> Strawberry season is here
            </p>
          </div>
          <div className="mx-2 h-14 rounded-t-2xl overflow-hidden opacity-80">
            <img
              src={picnic}
              alt=""
              width="320"
              height="320"
              decoding="async"
              className="w-full h-full object-cover object-top"
            />
          </div>
        </div>
      </div>
      <span className="absolute -left-4 sm:-left-12 -bottom-3 inline-flex items-center gap-1.5 rounded-full bg-sunshine text-plum shadow-lift px-3 py-1.5 text-sm font-extrabold motion-safe:animate-float">
        <img src={mark} alt="" className="w-5 h-5" /> In your pod
      </span>
    </div>
  );
}

/**
 * Landing hero art: sample photos fanned out around a phone showing a post.
 * Decorative (the headline and copy say the same in words). Cards fan in once,
 * then drift; with reduced motion everything simply sits in place.
 */
export default function HeroCollage() {
  return (
    <div
      className="relative mx-auto w-full max-w-[22rem] sm:max-w-[30rem] lg:max-w-[34rem] py-6 sm:py-10"
      aria-hidden="true"
    >
      <div className="absolute inset-6 rounded-full bg-gradient-to-br from-sunshine/60 via-accent/40 to-berry/40 blur-3xl" />
      {CARDS.map((card, index) => (
        <PhotoCard key={card.caption} {...card} index={index} />
      ))}
      <Phone />
    </div>
  );
}
