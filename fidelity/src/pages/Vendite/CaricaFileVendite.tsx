import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { twMerge } from "@/utils/twMerge";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ACCEPT_VENDITE, COLONNE_TRACCIATO_GENERICO } from "./formato";

interface CaricaFileVenditeProps {
  /** Il file scelto o trascinato; il controllo del formato lo fa la pagina. */
  onFile: (file: File) => void;
  /** Nome del file in lettura o in anteprima. */
  nomeFile?: string | null;
  /** Durante la lettura o con un import in corso non si sceglie un altro file. */
  disabilitato?: boolean;
}

/**
 * Area di caricamento del file delle vendite: si trascina il file o lo si sceglie dal pulsante
 * (raggiungibile da tastiera). Spiega il tracciato atteso e che reimportare lo stesso periodo
 * sostituisce i dati.
 */
export function CaricaFileVendite({ onFile, nomeFile, disabilitato = false }: CaricaFileVenditeProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trascinamento, setTrascinamento] = useState(false);

  const scegli = (e: ChangeEvent<HTMLInputElement>) => {
    const scelto = e.target.files?.[0];
    e.target.value = ""; // per poter riscegliere lo stesso file
    if (scelto) onFile(scelto);
  };

  const lascia = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setTrascinamento(false);
    if (disabilitato) return;
    const scelto = e.dataTransfer.files?.[0];
    if (scelto) onFile(scelto);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
        <p>
          Il file contiene il sell-out della GDO: per ogni prodotto, punto vendita e periodo i pezzi venduti e, se c&apos;è,
          il valore in euro. Fidelity lo legge con il tracciato delle vendite del cliente; se il cliente non ne ha uno, con il
          tracciato generico, una riga per vendita con le colonne{" "}
          {COLONNE_TRACCIATO_GENERICO.map((colonna, i) => (
            <span key={colonna}>
              {i > 0 && (i === COLONNE_TRACCIATO_GENERICO.length - 1 ? " e " : ", ")}
              <code className="rounded bg-slate-100 px-1 py-0.5 text-xs text-slate-700 dark:bg-darkmode-400 dark:text-slate-200">
                {colonna}
              </code>
            </span>
          ))}{" "}
          (il valore è facoltativo).
        </p>
        <p>
          Prima di scrivere nulla la pagina mostra un&apos;anteprima con il tracciato riconosciuto e le righe scartate.{" "}
          <strong className="font-medium text-slate-700 dark:text-slate-200">
            Reimportare lo stesso prodotto, punto vendita e periodo sostituisce i dati già presenti.
          </strong>
        </p>
      </div>

      {/* Area di rilascio: il file si trascina qui o si sceglie dal pulsante */}
      <div
        data-testid="area-file-vendite"
        onDragOver={e => {
          e.preventDefault();
          if (!disabilitato) setTrascinamento(true);
        }}
        onDragLeave={() => setTrascinamento(false)}
        onDrop={lascia}
        aria-disabled={disabilitato || undefined}
        className={twMerge(
          "flex flex-col items-center gap-2 rounded-card border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition-colors dark:border-darkmode-400 dark:bg-darkmode-800/50",
          trascinamento && "border-primary bg-primary/5 dark:border-primary",
          disabilitato && "opacity-70"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_VENDITE}
          aria-label="File delle vendite"
          className="hidden"
          disabled={disabilitato}
          onChange={scegli}
        />
        <Lucide icon="FileSpreadsheet" aria-hidden="true" className="h-6 w-6 text-slate-400" />
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
          <strong className="text-slate-700 dark:text-slate-200">Trascina qui il file delle vendite</strong>
          <span className="text-slate-500">oppure</span>
          <Button size="sm" variant="outline-secondary" onClick={() => inputRef.current?.click()} disabled={disabilitato}>
            <Lucide icon="Upload" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Scegli il file
          </Button>
        </div>
        <div className="text-xs text-slate-500">Excel (.xlsx, .xls) o CSV</div>
        {nomeFile && (
          <div className="mt-1 max-w-md truncate text-xs font-medium text-slate-600 dark:text-slate-300" title={nomeFile}>
            {nomeFile}
          </div>
        )}
      </div>
    </div>
  );
}

export default CaricaFileVendite;
