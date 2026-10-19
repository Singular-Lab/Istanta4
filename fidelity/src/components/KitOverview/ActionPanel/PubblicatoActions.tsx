import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import LoadingIcon from "@/components/Base/LoadingIcon";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/constants/permissions";
import { FC } from "react";

interface PubblicatoActionsProps {
  onDownloadZip?: () => void;
  isDownloading?: boolean;
}

/**
 * Action buttons for PUBBLICATO state
 * - Primary: Download ZIP
 * Niente "Rilavora": rilavorare elimina il runtime, e un runtime pubblicato non si elimina.
 */
const PubblicatoActions: FC<PubblicatoActionsProps> = ({
  onDownloadZip,
  isDownloading = false,
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
    </div>
  );
};

export default PubblicatoActions;
