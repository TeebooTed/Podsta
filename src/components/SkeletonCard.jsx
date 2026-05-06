export default function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="w-full aspect-[4/3] skeleton"></div>
      <div className="p-4 space-y-2">
        <div className="h-3 skeleton rounded w-3/4"></div>
        <div className="h-3 skeleton rounded w-1/2"></div>
        <div className="h-7 skeleton rounded mt-3"></div>
      </div>
    </div>
  );
}
