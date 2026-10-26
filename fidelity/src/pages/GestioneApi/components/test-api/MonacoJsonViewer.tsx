import { useRef, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import clsx from "clsx";
import { monacoEditorTheme, monacoEditorOptions } from "../../constants";
import type { MonacoJsonViewerProps } from "../../types";

function MonacoJsonViewer({ value, searchTerm, className, height = "400px" }: MonacoJsonViewerProps) {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    // Configura il tema personalizzato per il JSON
    monaco.editor.defineTheme('custom-json', monacoEditorTheme);
    editor.updateOptions({ theme: 'custom-json' });
  };

  // Gestisce la ricerca nel testo
  useEffect(() => {
    if (editorRef.current && searchTerm && searchTerm.trim()) {
      const model = editorRef.current.getModel();
      if (model) {
        const matches = model.findMatches(searchTerm, false, true, false, null, true);
        if (matches.length > 0) {
          editorRef.current.setSelections(matches.map((match: any) => ({
            selectionStartLineNumber: match.range.startLineNumber,
            selectionStartColumn: match.range.startColumn,
            positionLineNumber: match.range.endLineNumber,
            positionColumn: match.range.endColumn
          })));
          editorRef.current.revealLineInCenter(matches[0].range.startLineNumber);
        }
      }
    } else if (editorRef.current) {
      // Rimuovi le selezioni se non c'è ricerca
      editorRef.current.setSelection({ startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
    }
  }, [searchTerm]);

  return (
    <div className={clsx("min-h-[300px] max-h-[600px] rounded-lg overflow-hidden", className)}>
      <Editor
        height={height}
        language="json"
        value={value || "// La risposta apparirà qui dopo il test"}
        theme="vs-dark"
        options={monacoEditorOptions}
        onMount={handleEditorDidMount}
      />
    </div>
  );
}

export default MonacoJsonViewer;
