import Alert from "@/components/Base/Alert";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import type { TonoStato } from "@/constants/stati";
import { formatDataOra } from "@/utils/format";
import { FC, useMemo } from "react";
import { EXPORT_DI_SISTEMA, STATO_LOG_FILE } from "../../../../lib/enums";
import { FileItemKit, OggettoTipiDiExport } from "../../../../lib/types";

interface CorreggoCardProps {
  correggoFile?: FileItemKit;
  filesData: FileItemKit[];
  tipiDiExportInKit?: OggettoTipiDiExport[];
}

const STATO_CONFIG: Record<string, { label: string; tono: TonoStato; icon: string }> = {
  [STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO]: { label: "In attesa", tono: "warning", icon: "Clock" },
  [STATO_LOG_FILE.CORREGGO_PUBBLICATO]: { label: "Pubblicato", tono: "success", icon: "CheckCircle2" },
  [STATO_LOG_FILE.CORREGGO_ERRORE]: { label: "Errore", tono: "danger", icon: "XCircle" },
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
    <Sezione icona="FileCheck" titolo="Correggo" descrizione="Stato pubblicazione PDF">
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-control border border-slate-100 bg-slate-50 p-3">
          <Lucide icon="FileText" aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-700" title={correggoFile.nome_originale || correggoFile.nome}>
              {correggoFile.nome}
            </p>
            {correggoFile.pages && (
              <p className="text-xs text-slate-500">{correggoFile.pages} {correggoFile.pages === 1 ? "pagina" : "pagine"}</p>
            )}
          </div>
        </div>

        <dl className="divide-y divide-slate-100">
          <div className="flex items-center justify-between py-2">
            <dt className="text-sm text-slate-500">Versione</dt>
            <dd className="text-sm font-semibold text-slate-700">v{versioneCorreggo ?? versione}</dd>
          </div>
          {config && (
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-slate-500">Stato</dt>
              <dd>
                <StatusBadge tono={config.tono} etichetta={config.label} icon={config.icon} />
              </dd>
            </div>
          )}
          {lastLogEntry && (
            <div className="flex items-center justify-between py-2">
              <dt className="text-sm text-slate-500">Ultimo aggiornamento</dt>
              <dd className="text-sm tabular-nums text-slate-700">{formatDataOra(lastLogEntry.data_notifica)}</dd>
            </div>
          )}
        </dl>

        {stato === STATO_LOG_FILE.CORREGGO_ERRORE && lastLogEntry?.messaggio && (
          <Alert variant="soft-danger" className="text-xs">
            {lastLogEntry.messaggio}
          </Alert>
        )}
      </div>
    </Sezione>
  );
};

export default CorreggoCard;
