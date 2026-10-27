import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { FC } from "react";

interface InLavorazioneConErroriActionsProps {
  acceptedCount: number;
  isLavorazioneAutomatica: boolean;
  rejectedCount: number;
  stagedFilesCount: number;
  onUploadAndSubmit: () => void;
  onDelete: () => void;
  onRework: () => void;
  isProcessing?: boolean;
}

/**
 * Action buttons for IN_LAVORAZIONE_CON_ERRORI state
 * - Primary: Upload corrections and submit to review
 * - Secondary: Delete, Rework
 */
const InLavorazioneConErroriActions: FC<InLavorazioneConErroriActionsProps> = ({
  acceptedCount,
  rejectedCount,
  isLavorazioneAutomatica,
  stagedFilesCount,
  onUploadAndSubmit,
  onDelete,
  onRework,
  isProcessing = false
}) => {
  const hasStaged = stagedFilesCount > 0;
  const canSubmit = hasStaged || rejectedCount === 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Error warning banner */}
      <Alert variant="soft-danger" icona="CircleX" titolo="Kit con errori">
        {rejectedCount} file rifiutati da correggere
      </Alert>

      {/* Primary action */}
      <div className="flex gap-2">
        {isLavorazioneAutomatica ? (
          <Alert variant="soft-warning" icona="TriangleAlert" className="w-full text-xs">
            Per la lavorazione automatica devi riesportare il file da InDesign e ricaricarlo.
          </Alert>
        ) : (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.REVISIONE} mode="disable">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onUploadAndSubmit}
              disabled={!canSubmit}
              loading={isProcessing}
            >
              {!isProcessing && <Lucide icon="Eye" aria-hidden="true" className="mr-2 h-4 w-4" />}
              {isProcessing ? "Elaborazione…" : "Carica i file e manda in revisione"}
            </Button>
          </PermissionGate>
        )}
      </div>

      {/* Secondary actions */}
      <div className="flex gap-2">
        <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.ELIMINA}>
          <Button
            variant="outline-danger"
            size="sm"
            className="flex-1"
            onClick={onDelete}
            disabled={isProcessing}
          >
            <Lucide icon="Trash2" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Elimina
          </Button>
        </PermissionGate>
        <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.ELIMINA} mode="disable">
          <Button
            variant="outline-danger"
            size="sm"
            className="flex-1"
            onClick={onRework}
            disabled={isProcessing}
          >
            <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Rilavora
          </Button>
        </PermissionGate>
      </div>

      {/* Status info */}
      {!isLavorazioneAutomatica && (
        <div className="rounded-control bg-slate-50 py-2 text-center text-xs text-slate-500">
          <span className="font-medium text-success">{acceptedCount}</span> approvati •
          <span className="font-medium text-danger ml-1">{rejectedCount}</span> rifiutati
          {stagedFilesCount > 0 && (
            <>
              <span className="mx-1">•</span>
              <span className="font-medium text-info">{stagedFilesCount}</span> pronti per caricamento
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default InLavorazioneConErroriActions;
