// Props interface per LeafletMapLoader
interface LeafletMapLoaderProps extends React.ComponentPropsWithoutRef<"div"> {
  init: (callback: (mapConfig: any) => any) => void;
  darkMode?: boolean;
}
import { Suspense, lazy } from 'react';

// Lazy loading del componente LeafletMap
const LeafletMapLoader = lazy(() => import('@/components/Base/LeafletMapLoader'));

// Skeleton per il loading
const MapSkeleton = () => (
  <div className="animate-pulse bg-slate-200 rounded-lg h-96 flex items-center justify-center">
    <div className="text-slate-500">Caricamento mappa...</div>
  </div>
);

// Wrapper con Suspense
const LazyLeafletMap = (props: LeafletMapLoaderProps) => {
  return (
    <Suspense fallback={<MapSkeleton />}>
      <LeafletMapLoader {...props} />
    </Suspense>
  );
};

export default LazyLeafletMap;
