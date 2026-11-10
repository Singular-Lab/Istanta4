import Spinner from "@/components/Base/Spinner";
import { lazy, Suspense } from "react";

// Monaco arriva solo quando una sezione lo mostra: il resto della pagina non lo aspetta
const Editor = lazy(() => import("@monaco-editor/react"));

interface EditorCodiceProps {
  /** Nome per le tecnologie assistive, per esempio "Configurazione degli insight (JSON)". */
  etichetta: string;
  linguaggio: "json" | "css";
  valore: string;
  onChange: (valore: string) => void;
  altezza?: string;
}

/** Editor di codice (JSON o CSS) delle Impostazioni GDO. */
function EditorCodice({ etichetta, linguaggio, valore, onChange, altezza = "50vh" }: EditorCodiceProps) {
  return (
    <div role="group" aria-label={etichetta} className="overflow-hidden rounded-control border border-slate-200">
      <Suspense
        fallback={
          <div className="flex items-center justify-center" style={{ height: altezza }}>
            <Spinner etichetta="Caricamento dell'editor…" />
          </div>
        }
      >
        <Editor
          theme="vs-dark"
          height={altezza}
          language={linguaggio}
          value={valore}
          onChange={(nuovo) => onChange(nuovo ?? "")}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            formatOnPaste: true,
            tabSize: 2,
            ariaLabel: etichetta,
          }}
        />
      </Suspense>
    </div>
  );
}

export default EditorCodice;
