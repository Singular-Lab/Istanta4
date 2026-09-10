import { FC } from "react";
import { STATO_LAVORAZIONE_KIT_RUNTIME, TIPO_KIT_DESIGN } from "../../../../lib/enums";
import { ActionPanelProps } from "../types";
import InLavorazioneActions from "./InLavorazioneActions";
import InRevisioneActions from "./InRevisioneActions";
import InLavorazioneConErroriActions from "./InLavorazioneConErroriActions";
import PubblicatoActions from "./PubblicatoActions";

/**
 * ActionPanel - Orchestratore che sceglie quale componente di azioni renderizzare
 * in base allo stato della lavorazione.
 *
 * Stati:
 * - IN_LAVORAZIONE: Upload actions
 * - IN_REVISIONE: Review actions (publish, reject, rework)
 * - IN_LAVORAZIONE_CON_ERRORI: Error correction actions
 * - PUBBLICATO: Published actions (download, rework)
 */
const ActionPanel: FC<ActionPanelProps> = ({
  stato,
  canProceed,
  hasAccepted,
  tipoKit,
  hasRejected,
  filesCount,
  acceptedCount,
  rejectedCount,
  // Callbacks
  onStartRevision,
  onPublish,
  onRejectAndRework,
  onDelete,
  onRework,
  onDownloadZip,
  // Loading states
  isProcessing = false,
  isDownloading = false,
  // For error correction
  stagedFilesCount = 0
}) => {
  const renderContent = () => {
    switch (stato) {
      case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE:
        return (
          <InLavorazioneActions
            hasUploads={filesCount > 0}
            hasAllFiles={canProceed}
            onSubmitToReview={onStartRevision}
            onDelete={onDelete}
            isProcessing={isProcessing}
          />
        );

      case STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE:
        return (
          <InRevisioneActions
            acceptedCount={acceptedCount}
            rejectedCount={rejectedCount}
            onPublish={onPublish}
            onRejectAndRework={onRejectAndRework}
            onDelete={onDelete}
            onRework={onRework}
            isProcessing={isProcessing}
          />
        );

      case STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE_CON_ERRORI:
        return (
          <InLavorazioneConErroriActions
            isLavorazioneAutomatica={tipoKit == TIPO_KIT_DESIGN.AUTOMATICO}
            acceptedCount={acceptedCount}
            rejectedCount={rejectedCount}
            stagedFilesCount={stagedFilesCount}
            onUploadAndSubmit={onStartRevision}
            onDelete={onDelete}
            onRework={onRework}
            isProcessing={isProcessing}
          />
        );

      case STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO:
        return (
          <PubblicatoActions
            onDownloadZip={onDownloadZip}
            onRework={onRework}
            isDownloading={isDownloading}
            isProcessing={isProcessing}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="box my-5 mb-10">
      <div className="pt-5 p-4 mt-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default ActionPanel;

// Re-export individual components
export { default as InLavorazioneActions } from "./InLavorazioneActions";
export { default as InRevisioneActions } from "./InRevisioneActions";
export { default as InLavorazioneConErroriActions } from "./InLavorazioneConErroriActions";
export { default as PubblicatoActions } from "./PubblicatoActions";
