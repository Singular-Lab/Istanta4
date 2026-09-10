import React, { useRef, useState } from 'react';
import { Link, useLoaderData, useRevalidator } from "react-router-dom";

// Base Components
import Badge from "@/components/Base/Badge";
import Button from "@/components/Base/Button";
import { Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";

// Assets

// Utilities and Types
import PageHeader from '@/components/Base/PageHeader';
import withSessionCheck from "@/components/SessionChecker";
import dayjs from 'dayjs';
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
        <div className="relative w-full h-32 bg-slate-100 rounded-md">
          <div className="absolute inset-0 flex items-center justify-center">
            <Lucide icon="Globe" className="w-12 h-12 text-slate-400" />
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center w-full h-full bg-gray-500">
        <Lucide icon="TriangleAlert" className="w-10 h-10 text-yellow-500" />
      </div>
    );
  };

  const renderWorkspaceContent = () => {
    if (item.workspaceApplicabili?.length && !item.disattivo_mancanza_referenze) {
      return (
        <div className="mt-4 flex flex-col space-y-3">
          {/* Pulsante per generare QR Code */}
          <div className="flex justify-center gap-2">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={() => {
                if (item.workspaceApplicabili && item.workspaceApplicabili.length > 0) {
                  onOpenQRCode(item.workspaceApplicabili, item);
                }
              }}
              className="flex items-center px-3 py-2"
            >
              <Lucide icon="QrCode" className="w-4 h-4 mr-2" />
              Genera QR Code
            </Button>

            {/* Selettore workspace esistente */}
            <Popover className="z-40">
              <Popover.Button as={Button} variant="outline-secondary" className="flex items-center justify-between px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 transition-colors">
                <span className="flex items-center">
                  Scegli workspace
                  <Lucide icon="ChevronDown" className="ml-2 w-4 h-4" />
                </span>
              </Popover.Button>
              <Popover.Panel>
                <div className="w-80">
                  {item.workspaceApplicabili.map((workspace, index) => (
                    <Link
                      key={index}
                      target="_blank"
                      rel="noopener noreferrer"
                      to={generaLinkDinamico(workspace, item)}
                      className="flex items-center px-4 py-2 hover:bg-slate-100 cursor-pointer transition-colors rounded truncate text-gray-700"
                    >
                      <Lucide icon="Layers" className="w-4 h-4 mr-2 text-primary" />
                      <span className="truncate">{workspace.nomeWorkspace}</span>
                    </Link>
                  ))}
                </div>
              </Popover.Panel>
            </Popover>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-4 text-center">
        <Badge opacity="70" border variant="warning">
          {item.messaggio}
        </Badge>
        <div className="my-4 text-center border-t border-dashed w-full flex flex-row justify-center">
          {item.disattivo_mancanza_workspace && (
            <a
              className="flex text-sm items-center mr-auto text-primary"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // TODO: Implement workspace creation logic
              }}
            >
              <Lucide icon="Download" className="w-4 h-4 stroke-[1.3] mr-1.5" />
              <span>Crea workspace</span>
            </a>
          )}
          {/* {item.disattivo_mancanza_referenze && (
                        <a
                            className="flex items-center"
                            href="#"
                            onClick={(e) => {
                                console.log("Richiedi pubblicazione");
                                e.preventDefault();
                                mutationDati.mutate(item.idKit);
                            }}
                        >
                            <Lucide icon="SquareKanban" className="w-4 h-4 stroke-[1.3] mr-1.5" />
                            <span>Richiedi pubblicazione</span>
                        </a>
                    )} */}
        </div>
      </div>
    );
  };

  return (
    <div className="col-span-12 my-4 sm:col-span-4 md:col-span-6 xl:col-span-4 p-5 box">
      <div className="overflow-hidden rounded-lg h-52 image-fit before:block before:absolute before:w-full before:h-full before:top-0 before:left-0 before:z-10 before:bg-gradient-to-t before:from-slate-900/90 before:to-black/20">
        {renderCardImage()}
        <div className="absolute bottom-0 z-10 w-full px-5 pb-6 text-white">
          <span className="block text-lg font-medium truncate">
            {item.nomeCanale} - {item.nomeArea}
          </span>
          {item.data_inizio_promo_corrente && item.data_fine_promo_corrente ? (
            <span className="mt-3 text-xs text-white/80">
              Promo corrente: dal&nbsp;
              {dayjs(item.data_inizio_promo_corrente).format('DD/MM/YYYY')}
              &nbsp;al&nbsp;
              {dayjs(item.data_fine_promo_corrente).format('DD/MM/YYYY')}
            </span>
          ) : (
            <span className="mt-3 text-xs text-white/80 italic">
              Nessuna promozione attiva al momento
            </span>
          )}
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Area:</span>
          <span className="text-sm text-gray-900">{item.nomeArea}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Canale:</span>
          <span className="text-sm text-gray-900">{item.nomeCanale}</span>
        </div>

        {renderWorkspaceContent()}
      </div>
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


  const renderNoDataMessage = () => (
    <div className="col-span-12 p-5">
      <div className="flex flex-col line-h items-center justify-center h-32">
        <Lucide icon="FileX2" className="w-10 h-10 mb-2 text-gray-500" />
        <span className="text-gray-500">Nessuna Webpliant disponibile</span>
        <span className="text-gray-400 text-xs">
          Nessuna pubblicazione di WebPliant disponibile.{" "}
          <a
            href="#"
            className="text-primary underline"
            onClick={(e) => {
              e.preventDefault();


            }}
          >
            Richiedi pubblicazione
          </a>
        </span>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6 p-6">
      <div className="col-span-12">
        <PageHeader
          title="Webpliant disponibili"
          description="Gestione Webpliant disponibili"
        />
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">

            <div className="overflow-visible">
              <div className="grid grid-cols-12 gap-x-4 px-5">
                {!allData?.length ? renderNoDataMessage() : (
                  allData.map((item, index) => (
                    <ChannelCard
                      key={index}
                      item={item}
                      generaLinkDinamico={generaLinkDinamico}
                      onOpenQRCode={openQRCode}
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Viewer Modal */}
      <QRCodeViewer
        isOpen={isQRCodeOpen}
        onClose={closeQRCode}
        workspaces={qrCodeDataRef.current.workspaces}
        channelItem={qrCodeDataRef.current.channelItem}
        generaLinkDinamico={generaLinkDinamico}
      />
    </div>
  );
}

export default withSessionCheck(Main);
