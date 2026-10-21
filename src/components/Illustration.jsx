import firstPost from '../assets/illustrations/first-post.svg';
import noFollowers from '../assets/illustrations/no-followers.svg';
import welcome from '../assets/illustrations/welcome.svg';
import whatsAPod from '../assets/illustrations/whats-a-pod.svg';

const ART = {
  'first-post': firstPost,
  'no-followers': noFollowers,
  welcome,
  'whats-a-pod': whatsAPod,
};

/** Brand spot illustration. Decorative unless `alt` is given. */
export default function Illustration({ name, alt = '', className = 'w-48' }) {
  const src = ART[name];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      width="600"
      height="450"
      decoding="async"
      draggable={false}
      className={`h-auto select-none dark:opacity-90 ${className}`}
    />
  );
}
