import Skeleton from "@/components/Base/Skeleton";

const NewsCardSkeleton: React.FC = () => (
  <div aria-hidden="true" className="flex flex-col rounded-card border border-slate-200 bg-white p-5 shadow-card">
    {/* Badges row */}
    <div className="mb-3 flex items-center gap-2">
      <Skeleton className="h-4 w-24 rounded-full" />
    </div>
    {/* Titolo con icona */}
    <div className="mb-3 flex items-center gap-2.5">
      <Skeleton className="h-8 w-8 flex-none rounded-control" />
      <Skeleton className="h-4 w-2/3" />
    </div>
    {/* Contenuto */}
    <div className="mb-3 grow space-y-1.5">
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
    {/* Footer */}
    <div className="border-t border-slate-100 pt-1">
      <Skeleton className="mt-1 h-3 w-28" />
    </div>
  </div>
);

export default NewsCardSkeleton;
