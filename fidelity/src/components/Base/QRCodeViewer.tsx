import React, { useEffect, useState } from 'react';
import type { QRCodeProps as QRCodeComponentProps } from 'react-qr-code';
import QRCodeModule from 'react-qr-code';
// @ts-ignore
import { twMerge } from 'tailwind-merge';
import { TIPO_PAGINA } from '../../../lib/enums';
import Button from './Button';
import FormSelect from './Form/FormSelect';
import Dialog from './Headless/Dialog';
import Lucide from './Lucide';

interface Workspace {
  idWorkspace: string;
  idGDO?: string;
  nomeWorkspace: string;
  webpliant: { id: string; tipo: TIPO_PAGINA }[];
  noWebpliant?: { success: boolean };
}

interface ChannelItem {
  idKit: string;
  idArea?: string;
  idCanale?: string;
  nomeCanale: string;
  nomeArea: string;
  workspaceApplicabili?: Workspace[];
  disattivo_mancanza_workspace?: boolean;
  disattivo_mancanza_referenze?: boolean;
  messaggio?: string;
  data_inizio_promo_corrente?: Date;
  data_fine_promo_corrente?: Date;
}

interface QRCodeViewerProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  channelItem: ChannelItem | null;
  generaLinkDinamico: (workspace: Workspace, data: ChannelItem) => string;
  size?: number;
  className?: string;
}

type QRCodeComponentType = React.ComponentType<QRCodeComponentProps>;

const resolveQRCodeComponent = (): QRCodeComponentType | null => {
  if (typeof QRCodeModule === 'function') {
    return QRCodeModule as unknown as QRCodeComponentType;
  }

  if (typeof QRCodeModule === 'object' && QRCodeModule) {
    const moduleObject = QRCodeModule as Record<string, unknown>;

    const defaultCandidate = moduleObject.default;
    if (typeof defaultCandidate === 'function') {
      return defaultCandidate as QRCodeComponentType;
    }

    const namedCandidate = moduleObject.QRCode;
    if (typeof namedCandidate === 'function') {
      return namedCandidate as QRCodeComponentType;
    }
  }

  return null;
};

const QRCodeComponent = resolveQRCodeComponent();

const QRCodeViewer: React.FC<QRCodeViewerProps> = ({
  isOpen = false,
  onClose,
  workspaces = [],
  channelItem,
  generaLinkDinamico,
  size = 200,
  className,
}) => {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | undefined>();

  useEffect(() => {
    if (!isOpen || workspaces.length === 0) {
      setCurrentWorkspace(undefined);
      return;
    }

    setCurrentWorkspace((previous) => {
      if (previous && workspaces.some((workspace) => workspace.idWorkspace === previous.idWorkspace)) {
        return previous;
      }
      return workspaces[0];
    });
  }, [isOpen, workspaces]);

  const currentUrl = currentWorkspace && channelItem ? generaLinkDinamico(currentWorkspace, channelItem) : '';
  const currentTitle = currentWorkspace && channelItem ? `${channelItem.nomeCanale} - ${currentWorkspace.nomeWorkspace}` : 'QR Code';
  const canRenderQRCode = Boolean(QRCodeComponent && currentWorkspace && currentUrl);

  const handleWorkspaceChange = (workspaceId: string) => {
    const selectedWorkspace = workspaces.find((workspace) => workspace.idWorkspace === workspaceId);
    setCurrentWorkspace(selectedWorkspace);
  };

  const downloadQRCode = () => {
    if (!canRenderQRCode) {
      return;
    }

    try {
      const svgElement = document.querySelector('.qr-code-svg') as SVGElement | null;
      if (!svgElement) {
        return;
      }

      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) {
        return;
      }

      const canvasSize = size || 200;
      canvas.width = canvasSize * 2;
      canvas.height = canvasSize * 2;

      const svgData = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
          if (!blob) {
            URL.revokeObjectURL(url);
            return;
          }

          const downloadLink = document.createElement('a');
          downloadLink.href = URL.createObjectURL(blob);
          downloadLink.download = `${currentTitle.replace(/\s+/g, '_')}_qrcode.png`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);

          URL.revokeObjectURL(url);
          URL.revokeObjectURL(downloadLink.href);
        }, 'image/png');
      };

      image.onerror = () => {
        URL.revokeObjectURL(url);
      };

      image.src = url;
    } catch {
      // Intentionally swallow failures to keep the dialog usable
    }
  };

  const publishQRCode = async () => {
    if (!currentUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(currentUrl);
    } catch {
      window.open(currentUrl, '_blank');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className={twMerge(['qr-code-dialog', className])}
    >
      <Dialog.Panel>
        <Dialog.Title>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
              QR Code - {channelItem?.nomeCanale || 'Canale'}
            </h3>
          </div>
        </Dialog.Title>

        <Dialog.Description>
          <div className="flex flex-col items-center space-y-6 p-6">
            {workspaces.length > 1 && (
              <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Seleziona Workspace:
                </label>
                <FormSelect
                  value={currentWorkspace?.idWorkspace || ''}
                  onChange={(event) => handleWorkspaceChange(event.target.value)}
                  className="w-full"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.idWorkspace} value={workspace.idWorkspace}>
                      {workspace.nomeWorkspace}
                    </option>
                  ))}
                </FormSelect>
              </div>
            )}

            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 min-h-[200px] flex items-center justify-center">
              {canRenderQRCode && QRCodeComponent ? (
                <QRCodeComponent
                  value={currentUrl}
                  size={size}
                  className="qr-code-svg"
                  style={{
                    height: 'auto',
                    maxWidth: '100%',
                    width: '100%',
                  }}
                  viewBox={`0 0 ${size} ${size}`}
                />
              ) : (
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <Lucide icon="QrCode" className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">QR Code non disponibile</p>
                  <p className="text-xs mt-1">Seleziona un workspace per generare il codice</p>
                </div>
              )}
            </div>

            <div className="w-full text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Scansiona il QR code con il tuo dispositivo mobile per accedere al Webpliant
                <FormSelect
                  className="w-full"
                  value={currentWorkspace?.idWorkspace || ''}
                  onChange={(event) => handleWorkspaceChange(event.target.value)}
                >
                  <option value="">Scegli un workspace</option>
                  {workspaces.map((workspace) => (
                    <option key={workspace.idWorkspace} value={workspace.idWorkspace}>
                      {workspace.nomeWorkspace}
                    </option>
                  ))}
                </FormSelect>
              </p>
            </div>
          </div>
        </Dialog.Description>

        <Dialog.Footer>
          <div className="flex justify-between w-full gap-3">
            <div className="flex gap-2">
              <Button
                variant="outline-secondary"
                onClick={downloadQRCode}
                className="flex items-center"
                disabled={!canRenderQRCode}
              >
                <Lucide icon="Download" className="w-4 h-4 mr-2" />
                Scarica QR Code
              </Button>

              <Button
                variant="outline-primary"
                onClick={publishQRCode}
                className="flex items-center"
                disabled={!currentUrl}
              >
                <Lucide icon="Share" className="w-4 h-4 mr-2" />
                Pubblica
              </Button>
            </div>

            <Button
              variant="primary"
              onClick={onClose}
            >
              Chiudi
            </Button>
          </div>
        </Dialog.Footer>
      </Dialog.Panel>
    </Dialog>
  );
};

export default QRCodeViewer;
