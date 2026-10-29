import BarraFiltri from '@/components/Base/BarraFiltri';
import Button from '@/components/Base/Button';
import CampoRicerca from '@/components/Base/CampoRicerca';
import { FormSelect } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import PageError from '@/components/Base/PageError';
import Pagina from '@/components/Base/Pagina';
import PaginazioneTabella from '@/components/Base/PaginazioneTabella';
import Sezione from '@/components/Base/Sezione';
import Spinner from '@/components/Base/Spinner';
import StatCard, { StatCardGrid } from '@/components/Base/StatCard';
import StatusBadge from '@/components/Base/StatusBadge';
import withSessionCheck from "@/components/SessionChecker";
import EmptyState from '@/components/EmptyState';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';
import type { TonoStato } from '@/constants/stati';
import { useFetchKitRuntimeFilesPaginated } from '@/query/query';
import { formatDataOra, formatNumero, VALORE_ASSENTE } from '@/utils/format';
import { twMerge } from '@/utils/twMerge';
import axios from 'axios';
import React, { useEffect, useMemo, useState } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { ItemDisposition, STATO_LOG_FILE } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { FileItemKit, RUNTIME_KIT } from '../../../lib/types';

const PROPERTY_LABELS: Record<string, string> = {
  nome: 'Nome file',
  tipo_export_codice: 'Tipo export',
  stato: 'Stato file',
  codice_referenza: 'Codice referenza',
  ean_referenza: 'EAN referenza',
  descrizione_uno: 'Descrizione',
  reparto: 'Reparto',
  settore: 'Settore',
  tema: 'Tema promo',
};

// Stati del log dei file: non fanno parte del catalogo condiviso, tono ed etichetta restano locali
const STATI_FILE: Record<string, { tono: TonoStato; etichetta: string }> = {
  [STATO_LOG_FILE.IN_ATTESA]: { tono: 'neutral', etichetta: 'In attesa' },
  [STATO_LOG_FILE.IN_REVISIONE]: { tono: 'brand', etichetta: 'In revisione' },
  [STATO_LOG_FILE.ACCETTATO]: { tono: 'success', etichetta: 'Accettato' },
  [STATO_LOG_FILE.PUBBLICATO]: { tono: 'success', etichetta: 'Pubblicato' },
  [STATO_LOG_FILE.ERRORE]: { tono: 'danger', etichetta: 'Errore' },
  [STATO_LOG_FILE.IN_ATTESA_DI_CORREGGO]: { tono: 'info', etichetta: 'In attesa di Correggo' },
  [STATO_LOG_FILE.CORREGGO_PUBBLICATO]: { tono: 'success', etichetta: 'Correggo pubblicato' },
  [STATO_LOG_FILE.CORREGGO_ERRORE]: { tono: 'danger', etichetta: 'Errore Correggo' },
  RIFIUTATO: { tono: 'danger', etichetta: 'Rifiutato' },
  IN_LAVORAZIONE: { tono: 'info', etichetta: 'In lavorazione' },
};

const descriviStatoFile = (stato?: string): { tono: TonoStato; etichetta: string } => {
  if (!stato) return { tono: 'neutral', etichetta: VALORE_ASSENTE };
  return Object.prototype.hasOwnProperty.call(STATI_FILE, stato)
    ? STATI_FILE[stato]
    : { tono: 'neutral', etichetta: stato.replace(/_/g, ' ') };
};

const VISTE = [
  { valore: ItemDisposition.grid, etichetta: 'Vista griglia', icona: 'LayoutGrid' },
  { valore: ItemDisposition.list, etichetta: 'Vista elenco', icona: 'List' },
] as const;

// Due comandi con sola icona: ognuno ha un nome e dice se è la vista attiva
const SceltaVista = ({ valore, onChange }: { valore: ItemDisposition; onChange: (vista: ItemDisposition) => void }) => (
  <div role="group" aria-label="Disposizione dei file" className="inline-flex rounded-control border border-slate-200 bg-slate-50 p-0.5">
    {VISTE.map((vista) => {
      const attiva = valore === vista.valore;
      return (
        <button
          key={vista.valore}
          type="button"
          aria-label={vista.etichetta}
          aria-pressed={attiva}
          title={vista.etichetta}
          onClick={() => onChange(vista.valore)}
          className={twMerge(
            'flex h-7 w-8 items-center justify-center rounded-control text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40',
            attiva && 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200'
          )}
        >
          <Lucide icon={vista.icona} aria-hidden="true" className="h-4 w-4" />
        </button>
      );
    })}
  </div>
);

const DettagliKitOrdiniDiStampa: React.FC = () => {
  const { kit, proprieta, idKit } = useLoaderData() as {
    kit: RUNTIME_KIT;
    proprieta: {
      data: string[];
      success: boolean;
      timestamp: Date;
    };
    idKit: string;
  };
  const navigate = useNavigate();

  // View & search state
  const [itemDisposition, setItemDisposition] = useState<ItemDisposition>(ItemDisposition.grid);
  const [searchProperty, setSearchProperty] = useState<string>('');
  const [searchValue, setSearchValue] = useState<string>('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedProperty, setDebouncedProperty] = useState('');

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ imageUrl: string; pages: number } | null>(null);

  // Debounce search (400ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchValue);
      setDebouncedProperty(searchProperty);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchValue, searchProperty]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedProperty, pageSize]);

  // React Query for paginated files
  const filesQuery = useFetchKitRuntimeFilesPaginated({
    id: idKit,
    page,
    pageSize,
    search: debouncedSearch,
    searchProperty: debouncedProperty,
  });

  const paginatedData = filesQuery.data;
  const files = useMemo(() => paginatedData?.files ?? [], [paginatedData?.files]);
  const totalItems = paginatedData?.totalItems ?? 0;
  const stats = paginatedData?.stats;
  const isLoading = filesQuery.isLoading;
  const isFetching = filesQuery.isFetching;

  // Page bounds safety
  useEffect(() => {
    if (!paginatedData) return;
    const metaTotalPages = paginatedData.totalPages ?? 0;
    if (metaTotalPages > 0 && page > metaTotalPages) {
      setPage(metaTotalPages);
    }
  }, [paginatedData, page]);

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'FileType';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'Image';
      case 'doc':
      case 'docx':
        return 'FileText';
      case 'xls':
      case 'xlsx':
        return 'FileSpreadsheet';
      case 'zip':
      case 'rar':
        return 'FileArchive';
      default:
        return 'File';
    }
  };

  const formatFileName = (fileName: string) => fileName.split(' (Lavorazione:')[0];

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number') return null;
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const getFileKey = (file: FileItemKit) => file.id || `${file.nome}-${file.id_runtime}`;

  const allSearchProperties = useMemo(() => {
    const systemProperties = [
      'nome',
      'tipo_export_codice',
      'stato',
      'codice_referenza',
      'ean_referenza',
      'descrizione_uno',
      'reparto',
      'settore',
      'tema',
    ];
    return Array.from(new Set([...systemProperties, ...(proprieta?.data || [])]));
  }, [proprieta?.data]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return 'Si è verificato un errore imprevisto.';
  };

  // Download handlers
  const handleDownloadSingleFile = (file: FileItemKit) => async () => {
    if (!file.id_olimpo_cloud && !file.url_download) return;

    try {
      let response;
      if (file.id_olimpo_cloud) {
        const url = ServerCall.getUrl();
        response = await axios.get(`${url}/getFileFromOlimpo?id=${file.id_olimpo_cloud}`, {
          responseType: 'arraybuffer',
          withCredentials: true,
        });
      } else {
        response = await axios.get(file.url_download as string, {
          responseType: 'arraybuffer',
          withCredentials: true,
        });
      }

      if (!response) return;

      const headerContentType = response.headers['content-type'];
      const contentType = (typeof headerContentType === 'string' && headerContentType) || file.mime || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = formatFileName(file.nome);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch {
      // no-op
    }
  };

  const fileVisibili = (file: FileItemKit) => ({
    meta: file.meta_olimpo_cloud || {},
    status: file.log?.stato,
    price: formatCurrency(file.meta_olimpo_cloud?.prezzo),
    fileKey: getFileKey(file),
  });

  const apriAnteprima = (file: FileItemKit) => {
    if (file.url) {
      setPreviewFile({ imageUrl: file.url, pages: file.pages || 1 });
    }
  };

  const filtriAttivi = Boolean(searchProperty || searchValue);

  return (
    <>
      <Pagina
        titolo={kit?.titolo || 'Dettaglio kit'}
        descrizione="Visualizza i file associati al kit"
        indietro={{ onClick: () => navigate(-1) }}
      >
        <StatCardGrid className="lg:grid-cols-3">
          <StatCard densita="compatta" etichetta="Totale file" valore={formatNumero(stats?.totalFiles ?? 0)} icona="Files" tono="brand" />
          <StatCard densita="compatta" etichetta="In revisione" valore={formatNumero(stats?.inRevisionCount ?? 0)} icona="Clock" tono="warning" />
          <StatCard densita="compatta" etichetta="Con referenza" valore={formatNumero(stats?.filesWithMetaCount ?? 0)} icona="Tag" tono="success" />
        </StatCardGrid>

        <Sezione
          senzaPadding
          titolo="File del kit"
          descrizione={
            <span className="inline-flex items-center gap-2">
              {formatNumero(totalItems)} file totali
              {isFetching && !isLoading && <Spinner size="sm" decorativo />}
            </span>
          }
        >
          <BarraFiltri
            destra={
              <>
                {filtriAttivi && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      setSearchProperty('');
                      setSearchValue('');
                    }}
                  >
                    <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Pulisci filtri
                  </Button>
                )}
                <SceltaVista valore={itemDisposition} onChange={setItemDisposition} />
              </>
            }
          >
            <FormSelect
              formSelectSize="sm"
              aria-label="Proprietà"
              value={searchProperty}
              onChange={(e) => setSearchProperty(e.target.value)}
              className="sm:w-52"
            >
              <option value="">Tutte le proprietà</option>
              {allSearchProperties.map((prop) => (
                <option key={prop} value={prop}>
                  {PROPERTY_LABELS[prop] || prop}
                </option>
              ))}
            </FormSelect>
            <CampoRicerca
              etichetta="Cerca file"
              placeholder="Nome, referenza, reparto, tema…"
              value={searchValue}
              onChange={setSearchValue}
              className="sm:w-80"
            />
          </BarraFiltri>

          {/* File del kit */}
          <div className="relative p-5">
            {isLoading ? (
              <div role="status" className="flex flex-col items-center justify-center py-16">
                <Spinner size="lg" decorativo className="mb-3" />
                <span className="text-sm text-slate-500">Caricamento file…</span>
              </div>
            ) : filesQuery.isError && !paginatedData ? (
              <PageError
                compatta
                titolo="Impossibile caricare i file del kit"
                motivo={getErrorMessage(filesQuery.error)}
                onRiprova={() => filesQuery.refetch()}
              />
            ) : files.length === 0 ? (
              <EmptyState
                compatta
                icon="FileX"
                title={debouncedSearch ? 'Nessun file trovato' : 'Nessun file nel kit'}
                description={debouncedSearch ? 'Nessun file corrisponde ai criteri di ricerca.' : 'Non ci sono file disponibili per questo kit.'}
              />
            ) : (
              <>
                {isFetching && !isLoading && (
                  <div role="status" className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
                    <Spinner size="sm" decorativo className="text-current" />
                    Aggiornamento…
                  </div>
                )}

                {itemDisposition === ItemDisposition.grid ? (
                  <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {files.map((file) => {
                      const { meta, status, price, fileKey } = fileVisibili(file);

                      return (
                        <li
                          key={fileKey}
                          className="group relative flex flex-col rounded-card border border-slate-200 bg-white p-4 transition-all hover:border-primary/30 hover:shadow-md"
                        >
                          <button
                            type="button"
                            aria-label={`Anteprima ${file.nome}`}
                            disabled={!file.url}
                            className="mb-3 flex h-36 w-full cursor-pointer items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-slate-50 transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 disabled:cursor-default disabled:hover:border-slate-200"
                            onClick={() => apriAnteprima(file)}
                          >
                            {file.url ? (
                              <img
                                src={file.url}
                                alt={file.nome}
                                className="h-full w-full object-scale-down p-2"
                                loading="lazy"
                              />
                            ) : (
                              <Lucide
                                icon={getFileIcon(file.nome)}
                                aria-hidden="true"
                                className="h-12 w-12 stroke-[1.5] text-slate-400"
                              />
                            )}
                          </button>

                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="truncate text-sm font-semibold text-slate-800" title={formatFileName(file.nome)}>
                              {formatFileName(file.nome)}
                            </div>
                            <StatusBadge {...descriviStatoFile(status)} />
                          </div>

                          <div className="mb-2 truncate text-xs text-slate-500">
                            {file.tipo_export_codice || 'Tipo export non definito'}
                          </div>

                          <div className="mb-3 space-y-1 text-xs text-slate-600">
                            {meta.codice_referenza && <p>Ref: <span className="font-medium">{meta.codice_referenza}</span></p>}
                            {meta.ean_referenza && <p>EAN: <span className="font-medium">{meta.ean_referenza}</span></p>}
                            {meta.reparto && <p className="truncate">Reparto: <span className="font-medium">{meta.reparto}</span></p>}
                            {meta.tema && <p>Tema: <span className="font-medium">{meta.tema}</span></p>}
                            {price && <p>Prezzo: <span className="font-medium">{price}</span></p>}
                            {file.pages ? <p>Pagine: <span className="font-medium">{file.pages}</span></p> : null}
                          </div>

                          <div className="mt-auto">
                            <Button
                              onClick={handleDownloadSingleFile(file)}
                              variant="outline-secondary"
                              size="sm"
                              className="w-full"
                            >
                              <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                              Scarica
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {files.map((file) => {
                      const { meta, status, price, fileKey } = fileVisibili(file);

                      return (
                        <li
                          key={fileKey}
                          className="flex items-center rounded-control px-3 py-3.5 transition-all hover:bg-slate-50"
                        >
                          <button
                            type="button"
                            aria-label={`Anteprima ${file.nome}`}
                            disabled={!file.url}
                            className="mr-4 flex h-12 w-12 flex-shrink-0 cursor-pointer items-center justify-center rounded-control border border-slate-200 bg-white shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40 disabled:cursor-default disabled:hover:border-slate-200"
                            onClick={() => apriAnteprima(file)}
                          >
                            {file.url ? (
                              <img
                                src={file.url}
                                alt={file.nome}
                                className="h-full w-full object-contain p-1.5"
                                loading="lazy"
                              />
                            ) : (
                              <Lucide
                                icon={getFileIcon(file.nome)}
                                aria-hidden="true"
                                className="h-6 w-6 stroke-[1.5] text-slate-400"
                              />
                            )}
                          </button>

                          <div className="min-w-0 flex-grow">
                            <div className="flex items-start justify-between gap-3">
                              <div className="truncate text-sm font-semibold text-slate-800" title={formatFileName(file.nome)}>
                                {formatFileName(file.nome)}
                              </div>
                              <StatusBadge {...descriviStatoFile(status)} />
                            </div>

                            <div className="mt-0.5 text-xs text-slate-500">{file.tipo_export_codice || 'Tipo export non definito'}</div>
                            <div className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-1 text-xs text-slate-600 md:grid-cols-2 lg:grid-cols-3">
                              {meta.codice_referenza && <span>Ref: <span className="font-medium">{meta.codice_referenza}</span></span>}
                              {meta.ean_referenza && <span>EAN: <span className="font-medium">{meta.ean_referenza}</span></span>}
                              {meta.reparto && <span className="truncate">Reparto: <span className="font-medium">{meta.reparto}</span></span>}
                              {meta.tema && <span>Tema: <span className="font-medium">{meta.tema}</span></span>}
                              {price && <span>Prezzo: <span className="font-medium">{price}</span></span>}
                              <span>Ultimo aggiornamento: <span className="font-medium tabular-nums">{formatDataOra(file.log?.data_registrazione)}</span></span>
                            </div>
                          </div>

                          <Button
                            onClick={handleDownloadSingleFile(file)}
                            variant="outline-secondary"
                            size="sm"
                            className="ml-3 whitespace-nowrap"
                          >
                            <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                            Scarica
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          <PaginazioneTabella
            className="border-t border-slate-100"
            totale={totalItems}
            pagina={page}
            dimensionePagina={pageSize}
            onCambiaPagina={setPage}
            onCambiaDimensione={setPageSize}
            opzioniDimensione={[12, 24, 48]}
          />
        </Sezione>
      </Pagina>

      {/* Preview immagine */}
      {previewFile && (
        <PreviewImmaginePdf
          imageUrl={previewFile.imageUrl}
          onClose={() => setPreviewFile(null)}
          totalPages={previewFile.pages}
        />
      )}
    </>
  );
};

export default withSessionCheck(DettagliKitOrdiniDiStampa);
