import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import dayjs from "dayjs";
import "dayjs/locale/it";
import { FC, useMemo } from "react";
import { EXPORT_DI_SISTEMA, STATO_LOG_FILE } from "../../../../lib/enums";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";

dayjs.locale("it");

interface CorreggoCardProps {
  correggoFile?: FileItemKit;
  filesData: FileItemKit[];
  tipiDiExportInKit?: OggettoTipiDiExport[];
}

const STATO_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  [STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO]: {
    label: "In attesa",
    color: "text-amber-600",
    bg: "bg-amber-50 border-amber-200",
    icon: "Clock",
  },
  [STATO_LOG_FILE.CORREGGO_PUBBLICATO]: {
    label: "Pubblicato",
    color: "text-emerald-600",
    bg: "bg-emerald-50 border-emerald-200",
    icon: "CheckCircle2",
  },
  [STATO_LOG_FILE.CORREGGO_ERRORE]: {
    label: "Errore",
    color: "text-red-600",
    bg: "bg-red-50 border-red-200",
    icon: "XCircle",
  },
};

const CorreggoCard: FC<CorreggoCardProps> = ({ correggoFile: correggoFileProp, filesData, tipiDiExportInKit = [] }) => {
  const correggoFile = useMemo(() => {
    // Use pre-identified file if provided (preferred path)
    if (correggoFileProp) return correggoFileProp;
    // Fallback: search in filesData by codice or UUID lookup
    return filesData.find(f => {
      if (f.tipo_export_codice) return f.tipo_export_codice === EXPORT_DI_SISTEMA.CORREGGO;
      const exportType = tipiDiExportInKit.find(t => t.tipoDiExportGuidID === f.tipo_export);
      return exportType?.codice === EXPORT_DI_SISTEMA.CORREGGO;
    });
  }, [correggoFileProp, filesData, tipiDiExportInKit]);

  // Move hooks above any early return
  const log = correggoFile?.log;
  const stato = log?.stato;
  const versione = log?.versione ?? 1;

  // Get the latest CORREGGO-specific version from log entries
  const versioneCorreggo = useMemo(() => {
    if (!log?.logs?.length) return null;
    const lastEntry = [...log.logs].reverse().find(
      l => l.dettagli_aggiuntivi?.versione_pubblicata_correggo != null
    );
    return lastEntry?.dettagli_aggiuntivi?.versione_pubblicata_correggo ?? null;
  }, [log?.logs]);


  const lastLogEntry = log?.logs?.length ? log.logs[log.logs.length - 1] : null;
  const config = stato ? STATO_CONFIG[stato] : null;

  if (!correggoFile) return null;
  return (
    <div className="box box--stacked p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Lucide icon="FileCheck" className="h-5 w-5 text-violet-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-slate-800">Correggo</h3>
          <p className="text-xs text-slate-500">Stato pubblicazione PDF</p>
        </div>
      </div>

      {/* File Info */}
      <div className="space-y-3">
        {/* File Name */}
        <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-100">
          <Lucide icon="FileText" className="h-5 w-5 text-slate-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700 truncate" title={correggoFile.nome_originale || correggoFile.nome}>
              {correggoFile.nome}
            </p>
            {correggoFile.pages && (
              <p className="text-xs text-slate-400">{correggoFile.pages} {correggoFile.pages === 1 ? "pagina" : "pagine"}</p>
            )}
          </div>
        </div>

        {/* Version */}
        <div className="flex items-center justify-between py-2 border-b border-slate-100">
          <span className="text-sm text-slate-500">Versione</span>
          <span className="text-sm font-semibold text-slate-700">
            v{versioneCorreggo ?? versione}
          </span>
        </div>

        {/* Status */}
        {config && (
          <div className="flex items-center justify-between py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500">Stato</span>
            <span className={clsx(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
              config.bg, config.color
            )}>
              <Lucide icon={config.icon as any} className="h-3.5 w-3.5" />
              {config.label}
            </span>
          </div>
        )}

        {/* Last update */}
        {lastLogEntry && (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-500">Ultimo aggiornamento</span>
            <span className="text-sm text-slate-700">
              {dayjs(lastLogEntry.data_notifica).format("DD/MM/YYYY HH:mm")}
            </span>
          </div>
        )}

        {/* Error message if present */}
        {stato === STATO_LOG_FILE.CORREGGO_ERRORE && lastLogEntry?.messaggio && (
          <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <p className="text-xs text-red-600">{lastLogEntry.messaggio}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CorreggoCard;
