import Skeleton from "@/components/Base/Skeleton";

const ServiceCardSkeleton: React.FC = () => {
  return (
    <div aria-hidden="true" className="rounded-card border border-slate-200 bg-white p-5 shadow-card">
      <Skeleton className="mb-4 h-12 w-12 rounded-card" />
      <Skeleton className="mb-2 h-5 w-3/4" />
      <Skeleton className="mb-1 h-4 w-full" />
      <Skeleton className="mb-4 h-4 w-2/3" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
};

export default ServiceCardSkeleton;
