/** Placeholder in the shape of a feed post: author row, photo, action row, caption. */
export default function SkeletonCard() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="w-9 h-9 rounded-full skeleton" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-28 rounded-full skeleton" />
          <div className="h-2.5 w-16 rounded-full skeleton" />
        </div>
      </div>
      <div className="w-full aspect-[4/3] skeleton" />
      <div className="flex items-center gap-2 px-3 py-3">
        <div className="w-7 h-7 rounded-full skeleton" />
        <div className="w-7 h-7 rounded-full skeleton" />
        <div className="ml-auto w-7 h-7 rounded-full skeleton" />
      </div>
      <div className="px-4 pb-5 space-y-2">
        <div className="h-3 w-4/5 rounded-full skeleton" />
        <div className="h-3 w-1/2 rounded-full skeleton" />
      </div>
    </div>
  );
}
