import Button from "@/components/Base/Button";
import LoadingIcon from "@/components/Base/LoadingIcon";
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
      <div className="text-center bg-danger/10 py-3 rounded-lg">
        <Lucide icon="CircleX" className="w-5 h-5 mx-auto text-danger mb-2" />
        <p className="text-sm font-medium text-danger">Kit con Errori</p>
        <p className="text-xs text-slate-600">
          {rejectedCount} file rifiutati da correggere
        </p>
      </div>

      {/* Primary action */}
      <div className="flex gap-2">
        {isLavorazioneAutomatica ? (
          <div className="w-full text-center bg-warning/10 border border-warning/20 py-2.5 px-3 rounded-lg">
            <p className="text-xs text-warning font-medium">
              Per la lavorazione automatica devi riesportare il file da InDesign e ricaricarlo.
            </p>
          </div>
        ) : (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.REVISIONE} mode="disable">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onUploadAndSubmit}
              disabled={isProcessing || !canSubmit}
            >
              {isProcessing ? (
                <>
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Elaborazione...
                </>
              ) : (
                <>
                  <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                  Carica i file e manda in revisione
                </>
              )}
            </Button>
          </PermissionGate>
        )}
      </div>

      {/* Secondary actions */}
      <div className="flex gap-2">
        <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.ELIMINA}>
          <Button
            variant="outline-secondary"
            size="xs"
            className="flex-1"
            onClick={onDelete}
            disabled={isProcessing}
          >
            <Lucide icon="Trash2" className="w-3 h-3 mr-1" />
            Elimina
          </Button>
        </PermissionGate>
        <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE} mode="disable">
          <Button
            variant="outline-warning"
            size="xs"
            className="flex-1"
            onClick={onRework}
            disabled={isProcessing}
          >
            <Lucide icon="RotateCcw" className="w-3 h-3 mr-1" />
            Rilavora
          </Button>
        </PermissionGate>
      </div>

      {/* Status info */}
      {!isLavorazioneAutomatica && (
        <div className="text-xs text-center text-slate-500 bg-slate-50 py-2 rounded">
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
