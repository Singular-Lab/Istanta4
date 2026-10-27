import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
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
              variant="primary"
              size="sm"
              className="flex-1"
              onClick={onPublish}
              loading={isProcessing}
            >
              {!isProcessing && <Lucide icon="FileCheck" aria-hidden="true" className="mr-2 h-4 w-4" />}
              {isProcessing ? "Pubblicazione…" : "Pubblica kit"}
            </Button>
          </PermissionGate>
        )}
        {hasRejected && (
          <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE} mode="disable">
            <Button
              variant="outline-secondary"
              size="sm"
              className="flex-1"
              onClick={onRejectAndRework}
              disabled={isProcessing}
            >
              <Lucide icon="ArrowLeft" aria-hidden="true" className="mr-2 h-4 w-4" />
              Riporta in lavorazione
            </Button>
          </PermissionGate>
        )}
      </div>
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
      <div className="rounded-control bg-slate-50 py-2 text-center text-xs text-slate-500">
        <span className="font-medium text-success">{acceptedCount}</span> approvati •
        <span className="font-medium text-danger ml-1">{rejectedCount}</span> rifiutati
      </div>
    </div>
  );
};

export default InRevisioneActions;
