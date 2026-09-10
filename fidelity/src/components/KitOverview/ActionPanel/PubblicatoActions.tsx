import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import LoadingIcon from "@/components/Base/LoadingIcon";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { FC } from "react";

interface PubblicatoActionsProps {
  onDownloadZip?: () => void;
  onRework: () => void;
  isDownloading?: boolean;
  isProcessing?: boolean;
}

/**
 * Action buttons for PUBBLICATO state
 * - Primary: Download ZIP
 * - Secondary: Rework kit
 */
const PubblicatoActions: FC<PubblicatoActionsProps> = ({
  onDownloadZip,
  onRework,
  isDownloading = false,
  isProcessing = false
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Success banner */}
      <div className="text-center bg-success/10 py-3 rounded-lg">
        <Lucide icon="CircleCheck" className="w-5 h-5 mx-auto text-success mb-2" />
        <p className="text-sm font-medium text-success">Kit Pubblicato</p>
        <p className="text-xs text-slate-600">
          Il kit è ora disponibile per l'utilizzo
        </p>
      </div>

      {/* Primary action - Download */}
      {onDownloadZip && (
        <PermissionGate permission={PERMISSIONS.FILE.DOWNLOAD} mode="disable">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={onDownloadZip}
            disabled={isDownloading}
          >
            {isDownloading ? (
              <>
                <LoadingIcon icon="oval" className="w-4 h-4 mr-2" />
                Download in corso...
              </>
            ) : (
              <>
                <Lucide icon="Download" className="w-4 h-4 mr-2" />
                Scarica ZIP
              </>
            )}
          </Button>
        </PermissionGate>
      )}

      {/* Secondary action - Rework */}
      <PermissionGate permission={PERMISSIONS.KIT_RUNTIME.RIPORTA_IN_LAVORAZIONE} mode="disable">
        <Button
          variant="outline-warning"
          size="sm"
          className="w-full"
          onClick={onRework}
          disabled={isProcessing}
        >
          <Lucide icon="RotateCcw" className="w-4 h-4 mr-2" />
          Rilavora Kit
        </Button>
      </PermissionGate>
    </div>
  );
};

export default PubblicatoActions;
