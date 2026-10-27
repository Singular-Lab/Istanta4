import React, { useRef, useState } from 'react';
import { Link, useLoaderData, useRevalidator } from "react-router-dom";

// Base Components
import Alert from "@/components/Base/Alert";
import Button from "@/components/Base/Button";
import { Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import EmptyState from "@/components/EmptyState";

// Utilities and Types
import withSessionCheck from "@/components/SessionChecker";
import { formatData } from "@/utils/format";
import { TIPO_PAGINA } from '../../../lib/enums';
import QRCodeViewer from '../../components/Base/QRCodeViewer';

// Interfaces for Type Safety
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

// Dynamic Link Generation Function
function generaLinkDinamico(workspace: Workspace, data: ChannelItem): string {
  const link = new URL("/webpliant/volantino", window.location.origin);

  link.searchParams.append('id', workspace.idWorkspace);

  if (data.idArea) link.searchParams.append('idArea', data.idArea);
  if (data.idCanale) link.searchParams.append('idCanale', data.idCanale);
  if (workspace.idGDO) link.searchParams.append('idGDO', workspace.idGDO);

  const homepage = workspace.webpliant.find(x => x.tipo === TIPO_PAGINA.HOMEPAGE);
  if (homepage) link.searchParams.append('idPagina', homepage.id);

  return link.toString();
}

// Channel Card Component
const ChannelCard: React.FC<{
  item: ChannelItem;
  generaLinkDinamico: (workspace: Workspace, data: ChannelItem) => string;
  onOpenQRCode: (workspaces: Workspace[], channelItem: ChannelItem) => void;
}> = ({ item, generaLinkDinamico, onOpenQRCode }) => {
  const revalidate = useRevalidator();

  const renderCardImage = () => {
    if (!item.disattivo_mancanza_workspace && !item.disattivo_mancanza_referenze) {
      return (
        <div className="relative w-full h-32 bg-slate-100 rounded-control">
          <div className="absolute inset-0 flex items-center justify-center">
            <Lucide icon="Globe" aria-hidden="true" className="w-12 h-12 text-slate-400" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-500">
        <Lucide icon="TriangleAlert" aria-hidden="true" className="w-10 h-10 text-warning" />
      </div>
    );
  };

  const renderWorkspaceContent = () => {
    if (item.workspaceApplicabili?.length && !item.disattivo_mancanza_referenze) {
      return (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {/* Pulsante per generare QR Code */}
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={() => {
              if (item.workspaceApplicabili && item.workspaceApplicabili.length > 0) {
                onOpenQRCode(item.workspaceApplicabili, item);
              }
            }}
          >
            <Lucide icon="QrCode" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
            Genera QR Code
          </Button>

          {/* Selettore workspace esistente */}
          <Popover className="z-40">
            <Popover.Button as={Button} variant="outline-secondary" size="sm">
              Scegli workspace
              <Lucide icon="ChevronDown" aria-hidden="true" className="ml-1.5 h-3.5 w-3.5" />
            </Popover.Button>
            <Popover.Panel>
              <div className="w-80">
                {item.workspaceApplicabili.map((workspace, index) => (
                  <Link
                    key={index}
                    target="_blank"
                    rel="noopener noreferrer"
                    to={generaLinkDinamico(workspace, item)}
                    className="flex items-center px-4 py-2 hover:bg-slate-100 cursor-pointer transition-colors rounded-control truncate text-sm text-slate-700"
                  >
                    <Lucide icon="Layers" aria-hidden="true" className="w-4 h-4 mr-2 text-primary" />
                    <span className="truncate">{workspace.nomeWorkspace}</span>
                  </Link>
                ))}
              </div>
            </Popover.Panel>
          </Popover>
        </div>
      );
    }

    return (
      <div className="mt-4 space-y-3">
        {item.messaggio && (
          <Alert variant="soft-warning" icona="TriangleAlert" className="text-sm">
            {item.messaggio}
          </Alert>
        )}
        {item.disattivo_mancanza_workspace && (
          <div className="border-t border-dashed border-slate-200 pt-3">
            <Link
              className="inline-flex text-sm items-center text-primary hover:underline"
              to="/webliant/impostazioni-webpliant"
            >
              <Lucide icon="Download" aria-hidden="true" className="w-4 h-4 mr-1.5" />
              <span>Crea workspace</span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="col-span-12 md:col-span-6 xl:col-span-4 rounded-card border border-slate-200 bg-white p-4">
      <div className="overflow-hidden rounded-card h-52 image-fit before:block before:absolute before:w-full before:h-full before:top-0 before:left-0 before:z-10 before:bg-gradient-to-t before:from-slate-900/90 before:to-black/20">
        {renderCardImage()}
        <div className="absolute bottom-0 z-10 w-full px-5 pb-6 text-white">
          <h3 className="title-card truncate text-base text-white">
            {item.nomeCanale} - {item.nomeArea}
          </h3>
          {item.data_inizio_promo_corrente && item.data_fine_promo_corrente ? (
            <span className="mt-3 text-xs text-white/80">
              Promo corrente: dal&nbsp;
              {formatData(item.data_inizio_promo_corrente)}
              &nbsp;al&nbsp;
              {formatData(item.data_fine_promo_corrente)}
            </span>
          ) : (
            <span className="mt-3 text-xs text-white/80 italic">
              Nessuna promozione attiva al momento
            </span>
          )}
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Area</dt>
          <dd className="text-slate-800">{item.nomeArea}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-slate-500">Canale</dt>
          <dd className="text-slate-800">{item.nomeCanale}</dd>
        </div>
      </dl>

      {renderWorkspaceContent()}
    </div>
  );
};

function Main() {
  const [daterange, setDaterange] = useState("");
  const { allData } = useLoaderData() as { allData: ChannelItem[] };

  // Stato per gestire il QR code viewer
  const qrCodeDataRef = useRef<{
    workspaces: Workspace[];
    channelItem: ChannelItem | null;
    selectedWorkspace: Workspace | null;
  }>({
    workspaces: [],
    channelItem: null,
    selectedWorkspace: null
  });
  const [isQRCodeOpen, setIsQRCodeOpen] = useState(false);

  // Funzioni per gestire il QR code viewer
  const openQRCode = (workspaces: Workspace[], channelItem: ChannelItem) => {
    qrCodeDataRef.current = {
      workspaces,
      channelItem,
      selectedWorkspace: workspaces.length > 0 ? workspaces[0] : null
    };

    setIsQRCodeOpen(true); // questo fa re-render
  };

  const closeQRCode = () => {
    setIsQRCodeOpen(false);
  };


  return (
    <Pagina titolo="Webpliant disponibili" descrizione="Gestione Webpliant disponibili">
      <Sezione>
        {!allData?.length ? (
          <EmptyState
            compatta
            icon="FileX"
            title="Nessuna Webpliant disponibile"
            description="Nessuna pubblicazione di WebPliant disponibile."
          />
        ) : (
          <div className="grid grid-cols-12 gap-4">
            {allData.map((item, index) => (
              <ChannelCard
                key={index}
                item={item}
                generaLinkDinamico={generaLinkDinamico}
                onOpenQRCode={openQRCode}
              />
            ))}
          </div>
        )}
      </Sezione>

      {/* QR Code Viewer Modal */}
      <QRCodeViewer
        isOpen={isQRCodeOpen}
        onClose={closeQRCode}
        workspaces={qrCodeDataRef.current.workspaces}
        channelItem={qrCodeDataRef.current.channelItem}
        generaLinkDinamico={generaLinkDinamico}
      />
    </Pagina>
  );
}

export default withSessionCheck(Main);
