import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { FC } from "react";

interface InLavorazioneActionsProps {
  hasUploads: boolean;
  hasAllFiles: boolean;
  onSubmitToReview: () => void;
  onDelete: () => void;
  isProcessing?: boolean;
}

/**
 * Action buttons for IN_LAVORAZIONE state
 * - Primary: Submit to review (if has uploads)
 * - Secondary: Delete lavorazione
 */
const InLavorazioneActions: FC<InLavorazioneActionsProps> = ({
  hasUploads,
  hasAllFiles,
  onSubmitToReview,
  onDelete,
  isProcessing = false
}) => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {hasUploads && (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.REVISIONE} mode="disable">
            <Button
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onSubmitToReview}
              loading={isProcessing}
            >
              {!isProcessing && <Lucide icon="Eye" aria-hidden="true" className="mr-2 h-4 w-4" />}
              {isProcessing ? "Elaborazione…" : "Sottoponi a revisione"}
            </Button>
          </PermissionGate>
        )}
        <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.ELIMINA}>
          <Button
            variant="outline-danger"
            size="sm"
            className={hasUploads ? "flex-shrink-0" : "flex-1"}
            onClick={onDelete}
            disabled={isProcessing}
          >
            <Lucide icon="Trash2" aria-hidden="true" className="mr-2 h-4 w-4" />
            Elimina lavorazione
          </Button>
        </PermissionGate>
      </div>
      {hasAllFiles && (
        <Alert variant="soft-success" icona="CircleCheck" className="text-xs">
          Tutti i file sono stati caricati. Puoi procedere con la revisione.
        </Alert>
      )}
    </div>
  );
};

export default InLavorazioneActions;
