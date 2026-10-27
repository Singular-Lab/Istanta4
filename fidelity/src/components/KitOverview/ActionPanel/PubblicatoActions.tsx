import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
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
      <Alert variant="soft-success" icona="CircleCheck" titolo="Kit pubblicato">
        Il kit è ora disponibile per l&apos;utilizzo
      </Alert>

      {/* Primary action - Download */}
      {onDownloadZip && (
        <PermissionGate permission={PERMISSIONS.FILE.DOWNLOAD} mode="disable">
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={onDownloadZip}
            loading={isDownloading}
          >
            {!isDownloading && <Lucide icon="Download" aria-hidden="true" className="mr-2 h-4 w-4" />}
            {isDownloading ? "Download in corso…" : "Scarica ZIP"}
          </Button>
        </PermissionGate>
      )}
    </div>
  );
};

export default PubblicatoActions;
