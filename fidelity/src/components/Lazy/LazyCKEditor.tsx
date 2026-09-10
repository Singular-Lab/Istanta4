import { Suspense, lazy } from 'react';

// Lazy loading del componente CKEditor
const ClassicEditor = lazy(() => import('@/components/Base/Ckeditor/ClassicEditor'));

// Skeleton per il loading
const EditorSkeleton = () => (
  <div className="animate-pulse bg-slate-200 rounded-lg h-64 flex items-center justify-center">
    <div className="text-slate-500">Caricamento editor...</div>
  </div>
);

// Props interface per il CKEditor
interface CKEditorProps {
  key?: number | string;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  placeholder?: string;
}

// Wrapper con Suspense
const LazyCKEditor = (props: CKEditorProps) => {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <ClassicEditor {...props} />
    </Suspense>
  );
};

export default LazyCKEditor;
