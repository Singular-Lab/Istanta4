import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import LoadingIcon from "@/components/Base/LoadingIcon";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { FC } from "react";

interface InRevisioneActionsProps {
  acceptedCount: number;
  rejectedCount: number;
  onPublish: () => void;
  onRejectAndRework: () => void;
  onDelete: () => void;
  onRework: () => void;
  isProcessing?: boolean;
}

/**
 * Action buttons for IN_REVISIONE state
 * - Primary: Publish kit (if has accepted files)
 * - Secondary: Reject and send back to work (if has rejected files)
 * - Tertiary: Delete, Rework
 */
const InRevisioneActions: FC<InRevisioneActionsProps> = ({
  acceptedCount,
  rejectedCount,
  onPublish,
  onRejectAndRework,
  onDelete,
  onRework,
  isProcessing = false
}) => {
  const hasAccepted = acceptedCount > 0;
  const hasRejected = rejectedCount > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {hasAccepted && (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.PUBBLICA} mode="disable">
            <Button
              variant="success"
              size="sm"
              className="flex-1"
              onClick={onPublish}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                  Pubblicazione...
                </>
              ) : (
                <>
                  <Lucide icon="FileCheck" className="w-4 h-4 mr-2" />
                  Pubblica Kit
                </>
              )}
            </Button>
          </PermissionGate>
        )}
        {hasRejected && (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE} mode="disable">
            <Button
              variant="warning"
              size="sm"
              className="flex-1"
              onClick={onRejectAndRework}
              disabled={isProcessing}
            >
              <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
              Riporta in Lavorazione
            </Button>
          </PermissionGate>
        )}
      </div>
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
      <div className="text-xs text-center text-slate-500 bg-slate-50 py-2 rounded">
        <span className="font-medium text-success">{acceptedCount}</span> approvati •
        <span className="font-medium text-danger ml-1">{rejectedCount}</span> rifiutati
      </div>
    </div>
  );
};

export default InRevisioneActions;
