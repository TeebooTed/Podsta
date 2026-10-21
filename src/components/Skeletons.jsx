/**
 * Placeholders in the shape of what is loading, so the page doesn't jump when it arrives.
 * All decorative: pair each with a visible or screen-reader status line.
 * The shimmer stops under reduced motion (see .skeleton in index.css).
 */

const bar = 'rounded-full skeleton';

/** A person card on Discover: avatar, name, handle, a line of bio, the follow button. */
export function SkeletonPeople({ count = 2 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card p-4 flex items-start gap-3">
          <div className="w-12 h-12 rounded-full skeleton shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className={`h-3 w-24 ${bar}`} />
            <div className={`h-2.5 w-32 ${bar}`} />
            <div className={`h-2.5 w-4/5 ${bar}`} />
          </div>
          <div className="w-20 h-9 rounded-full skeleton shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** Someone's profile header: big avatar, name, handle, two lines of bio. */
export function SkeletonProfileHeader() {
  return (
    <div className="card p-6 sm:p-8" aria-hidden="true">
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-24 h-24 rounded-full skeleton shrink-0" />
        <div className="flex-1 w-full space-y-3 pt-2">
          <div className={`h-6 w-44 ${bar}`} />
          <div className={`h-3 w-36 ${bar}`} />
          <div className={`h-3 w-full max-w-sm ${bar}`} />
          <div className={`h-3 w-2/3 max-w-xs ${bar}`} />
          <div className="h-11 w-28 rounded-full skeleton mt-4" />
        </div>
      </div>
    </div>
  );
}

/** A square photo grid, as on a profile. */
export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="aspect-square skeleton rounded-md sm:rounded-xl"
          style={{ animationDelay: `${i * 60}ms` }}
        />
      ))}
    </div>
  );
}

/** Rows in a list: a dot or avatar, a heading line and a detail line. */
export function SkeletonRows({ count = 3, avatar = false, card = true }) {
  return (
    <ul className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className={`flex gap-3 ${card ? 'card p-4' : 'py-1'}`}>
          <div
            className={`${avatar ? 'w-9 h-9' : 'w-2 h-2 mt-2'} rounded-full skeleton shrink-0`}
          />
          <div className="flex-1 space-y-2 pt-1">
            <div className={`h-3 ${i % 2 ? 'w-2/5' : 'w-1/2'} ${bar}`} />
            <div className={`h-2.5 ${i % 2 ? 'w-4/5' : 'w-3/5'} ${bar}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
