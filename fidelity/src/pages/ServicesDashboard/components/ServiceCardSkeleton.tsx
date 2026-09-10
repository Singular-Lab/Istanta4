const ServiceCardSkeleton: React.FC = () => {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-6 animate-pulse">
      <div className="w-14 h-14 rounded-xl bg-slate-200 mb-4" />
      <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
      <div className="h-4 bg-slate-100 rounded w-full mb-1" />
      <div className="h-4 bg-slate-100 rounded w-2/3 mb-4" />
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-slate-200" />
        <div className="h-3 bg-slate-100 rounded w-12" />
      </div>
    </div>
  );
};

export default ServiceCardSkeleton;
