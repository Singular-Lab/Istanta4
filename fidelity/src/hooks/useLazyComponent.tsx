import { lazy, useMemo } from 'react';

// Hook per il lazy loading dinamico dei componenti
export const useLazyComponent = (importPath: string) => {
  return useMemo(() => {
    return lazy(() => import(importPath));
  }, [importPath]);
};

// Hook specifico per i componenti pesanti
export const useHeavyComponent = (componentName: string) => {
  const componentMap: Record<string, string> = {
    'Chart': '@/components/Base/Chart',
    'LeafletMap': '@/components/Base/LeafletMapLoader',
    'CKEditor': '@/components/Base/Ckeditor/ClassicEditor',
    'MonacoEditor': '@monaco-editor/react',
  };

  return useLazyComponent(componentMap[componentName] || componentName);
};
