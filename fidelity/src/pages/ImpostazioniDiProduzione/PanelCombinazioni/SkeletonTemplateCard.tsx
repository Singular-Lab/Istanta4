import Skeleton from '@/components/Base/Skeleton';

/** Segnaposto di una TemplateCard durante il caricamento. */
export default function SkeletonTemplateCard() {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-control" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 rounded-control" />
        ))}
      </div>
      <Skeleton className="h-8 rounded-control" />
    </div>
  );
}
