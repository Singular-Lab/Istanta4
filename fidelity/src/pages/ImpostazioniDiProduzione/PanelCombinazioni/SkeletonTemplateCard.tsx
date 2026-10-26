export default function SkeletonTemplateCard() {
  return (
    <div className="relative flex flex-col p-5 bg-white border border-slate-200/80 rounded-xl shadow-sm animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-200 shrink-0" />
          <div>
            <div className="h-4 w-32 bg-slate-200 rounded mb-1.5" />
            <div className="h-3 w-20 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="w-7 h-7 rounded-full bg-slate-200 shrink-0" />
      </div>
      {/* Badge */}
      <div className="h-5 w-20 bg-slate-200 rounded-full mb-4" />
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-slate-50 rounded-lg p-3">
            <div className="h-3 w-14 bg-slate-200 rounded mb-1.5" />
            <div className="h-4 w-10 bg-slate-200 rounded" />
          </div>
        ))}
      </div>
      {/* Footer */}
      <div className="h-8 bg-slate-200 rounded-lg" />
    </div>
  );
}
