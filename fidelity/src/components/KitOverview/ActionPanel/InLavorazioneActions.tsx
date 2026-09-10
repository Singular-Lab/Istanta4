import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import LoadingIcon from "@/components/Base/LoadingIcon";
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
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Elaborazione...
                </>
              ) : (
                <>
                  <Lucide icon="Eye" className="w-4 h-4 mr-2" />
                  Sottoponi a revisione
                </>
              )}
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
            <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
            Elimina Lavorazione
          </Button>
        </PermissionGate>
      </div>
      {hasAllFiles && (
        <div className="text-xs text-center text-success bg-success/10 py-2 rounded">
          <Lucide icon="CircleCheck" className="w-3 h-3 mr-1 inline" />
          Tutti i file sono stati caricati. Puoi procedere con la revisione.
        </div>
      )}
    </div>
  );
};

export default InLavorazioneActions;
