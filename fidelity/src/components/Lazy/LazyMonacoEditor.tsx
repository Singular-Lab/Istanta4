import { Suspense, lazy } from 'react';

// Lazy loading del Monaco Editor
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

// Skeleton per il loading
const MonacoSkeleton = () => (
  <div className="animate-pulse bg-slate-200 rounded-lg h-96 flex items-center justify-center">
    <div className="text-slate-500">Caricamento editor di codice...</div>
  </div>
);

// Props interface per Monaco Editor
interface MonacoEditorProps {
  height?: string | number;
  language?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  options?: any;
  className?: string;
}

// Wrapper con Suspense
const LazyMonacoEditor = (props: MonacoEditorProps) => {
  return (
    <Suspense fallback={<MonacoSkeleton />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
};

export default LazyMonacoEditor;
