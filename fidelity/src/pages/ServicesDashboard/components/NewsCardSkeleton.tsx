const NewsCardSkeleton: React.FC = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse flex flex-col">
    {/* Badges row */}
    <div className="flex items-center gap-2 mb-3">
      <div className="h-4 w-24 bg-slate-100 rounded-full" />
    </div>
    {/* Titolo con icona */}
    <div className="flex items-center gap-2.5 mb-3">
      <div className="w-8 h-8 rounded-lg bg-slate-100 shrink-0" />
      <div className="h-4 bg-slate-200 rounded w-2/3" />
    </div>
    {/* Contenuto */}
    <div className="space-y-1.5 mb-3 grow">
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-4/5" />
      <div className="h-3 bg-slate-100 rounded w-3/5" />
    </div>
    {/* Footer */}
    <div className="pt-1 border-t border-slate-100">
      <div className="h-3 bg-slate-100 rounded w-28" />
    </div>
  </div>
);

export default NewsCardSkeleton;
