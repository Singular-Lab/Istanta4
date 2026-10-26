import { ChartProps } from '@/components/Base/Chart';
import { Suspense, lazy } from 'react';

// Lazy loading del componente Chart
const Chart = lazy(() => import('@/components/Base/Chart'));

// Skeleton per il loading
const ChartSkeleton = () => (
  <div className="animate-pulse bg-slate-200 rounded-lg h-64 flex items-center justify-center">
    <div className="text-slate-500">Caricamento grafico...</div>
  </div>
);

// Wrapper con Suspense
const LazyChart = (props: ChartProps) => {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <Chart {...props} />
    </Suspense>
  );
};

export default LazyChart;
