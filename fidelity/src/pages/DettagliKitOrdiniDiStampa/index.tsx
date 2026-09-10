import Button from '@/components/Base/Button';
import { FormCheck, FormInput, FormSelect } from '@/components/Base/Form';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import PageHeader from '@/components/Base/PageHeader';
import Pagination from '@/components/Base/Pagination';
import withSessionCheck from "@/components/SessionChecker";
import Progress from '@/components/Base/Progress';
import EmptyState from '@/components/EmptyState';
import { PreviewImmaginePdf } from '@/components/PreviewImmaginePdf';
import { useFetchKitRuntimeFilesPaginated } from '@/query/query';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLoaderData } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import io from 'socket.io-client';
import { ItemDisposition } from '../../../lib/enums';
import { ServerCall } from '../../../lib/server_call';
import { FileItemKit, RUNTIME_KIT_MONGO } from '../../../lib/types';

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

type MergeApiResponse = {
  message?: string;
  canMerge?: boolean;
  success?: boolean;
  url_download?: string;
  downloadUrl?: string;
  url?: string;
  id_olimpo_cloud?: string;
  idOlimpoCloud?: string;
  nome?: string;
  fileName?: string;
};

type SelectedFileEntry = {
  selected: boolean;
  data: Pick<FileItemKit, 'id' | 'nome' | 'id_olimpo_cloud' | 'url_download'>;
};

const DettagliKitOrdiniDiStampa: React.FC = () => {
  const { kit, proprieta, idKit } = useLoaderData() as {
    kit: RUNTIME_KIT_MONGO;
    proprieta: {
      data: string[];
      success: boolean;
      timestamp: Date;
    };
    idKit: string;
  };

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

  // Selection state (cross-page)
  const [selectedFiles, setSelectedFiles] = useState<Record<string, SelectedFileEntry>>({});

  // Merge state
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showMergeResultDialog, setShowMergeResultDialog] = useState(false);
  const [mergeStep, setMergeStep] = useState<'idle' | 'checking' | 'check_ok' | 'merging' | 'success' | 'error'>('idle');
  const [mergeError, setMergeError] = useState<string>('');
  const [mergeInfo, setMergeInfo] = useState<string>('');
  const [mergedOutputName, setMergedOutputName] = useState<string>('');
  const [mergedDownloadUrl, setMergedDownloadUrl] = useState<string | null>(null);
  const [mergedDownloadName, setMergedDownloadName] = useState<string>('file-unito.pdf');
  const isPdfEqualityCheckAvailable = import.meta.env.VITE_ENABLE_PDF_EQUALITY_WS === 'true'
    && Boolean(import.meta.env.VITE_OLYMPUS_IP_ADDRESS_CORS);
  const pdfEqualityUnavailableMessage = 'Raggruppamento/controllo file uguali non disponibile su questo servizio: WebSocket Olimpo non attivo.';

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
  const totalPages = paginatedData?.totalPages ?? 0;
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

  // Pagination range computation
  const paginationRange = useMemo<(number | string)[]>(() => {
    if (totalPages <= 1) return [];
    const range: (number | string)[] = [];
    const delta = 1;
    const left = Math.max(2, page - delta);
    const right = Math.min(totalPages - 1, page + delta);

    range.push(1);
    if (left > 2) range.push('left-ellipsis');
    for (let i = left; i <= right; i++) range.push(i);
    if (right < totalPages - 1) range.push('right-ellipsis');
    if (totalPages > 1) range.push(totalPages);

    return range.filter((value, index, self) => self.indexOf(value) === index);
  }, [page, totalPages]);

  const canGoPrev = page > 1;
  const canGoNext = totalPages > 0 && page < totalPages;
  const showingFrom = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = totalItems === 0 ? 0 : Math.min(showingFrom + files.length - 1, totalItems);

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

  const formatDate = (dateString?: string | Date) => {
    if (!dateString) return 'N/D';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/D';
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value?: number) => {
    if (typeof value !== 'number') return null;
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
  };

  const getFileKey = (file: FileItemKit) => file.id || `${file.nome}-${file.id_runtime}`;

  const getStatusStyles = (status?: string) => {
    if (!status) {
      return 'bg-slate-100 text-slate-600 border-slate-200';
    }
    switch (status) {
      case 'IN_REVISIONE':
        return 'bg-pending/10 text-pending border-pending/20';
      case 'IN_LAVORAZIONE':
        return 'bg-danger/10 text-danger border-danger/20';
      case 'PUBBLICATO':
      case 'ACCETTATO':
        return 'bg-success/10 text-success border-success/20';
      case 'RIFIUTATO':
        return 'bg-danger/10 text-danger border-danger/20';
      default:
        return 'bg-info/10 text-info border-info/20';
    }
  };

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
    return 'Si e verificato un errore imprevisto.';
  };

  // Selection logic (cross-page aware)
  const selectedCount = Object.keys(selectedFiles).length;
  const selectedFilesData = useMemo(
    () => Object.values(selectedFiles).map((v) => v.data),
    [selectedFiles]
  );
  const visibleKeys = useMemo(() => files.map(getFileKey), [files]);
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => !!selectedFiles[key]);

  const toggleFileSelection = (file: FileItemKit) => {
    const key = getFileKey(file);
    setSelectedFiles((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          selected: true,
          data: { id: file.id, nome: file.nome, id_olimpo_cloud: file.id_olimpo_cloud, url_download: file.url_download },
        },
      };
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedFiles((prev) => {
      const next = { ...prev };
      const shouldSelectAll = !allVisibleSelected;
      files.forEach((file) => {
        const key = getFileKey(file);
        if (shouldSelectAll) {
          next[key] = {
            selected: true,
            data: { id: file.id, nome: file.nome, id_olimpo_cloud: file.id_olimpo_cloud, url_download: file.url_download },
          };
        } else {
          delete next[key];
        }
      });
      return next;
    });
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

      const contentType = response.headers['content-type'] || file.mime || 'application/pdf';
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

  // Merge flow
  const resetMergeFlow = () => {
    setMergeStep('idle');
    setMergeError('');
    setMergeInfo('');
    setMergedDownloadUrl(null);
    setMergedDownloadName('file-unito.pdf');
  };

  const handleCloseMergeDialog = () => {
    setShowMergeDialog(false);
    resetMergeFlow();
  };

  const startMergeFlow = () => {
    resetMergeFlow();
    setMergeError('');
    setMergeInfo('');
    if (!isPdfEqualityCheckAvailable) {
      setMergeStep('error');
      setMergeError(pdfEqualityUnavailableMessage);
      setShowMergeDialog(true);
      return;
    }
    if (selectedCount < 2) {
      setMergeError('Seleziona almeno 2 file per effettuare il controllo e l\'unione.');
      return;
    }
    setShowMergeDialog(true);
  };

  const handleCheckSelectedFiles = async () => {
    if (selectedCount < 2) return;
    if (!isPdfEqualityCheckAvailable) {
      setMergeStep('error');
      setMergeError(pdfEqualityUnavailableMessage);
      return;
    }
    setMergeStep('checking');
    setMergeError('');
    setMergeInfo('');

    try {
      const response = await ServerCall.post<MergeApiResponse>('/checkFilesEquality', {
        idKitRuntime: kit.guidId,
        files: selectedFilesData.map((file) => ({
          id: file.id,
          nome: file.nome,
          id_olimpo_cloud: file.id_olimpo_cloud,
          url_download: file.url_download,
        })),
      });

      if (response?.canMerge === false || response?.success === false) {
        setMergeStep('error');
        setMergeError(response?.message || 'Il server ha indicato che i file non sono compatibili per l\'unione.');
        return;
      }

      setMergeStep('check_ok');
      setMergeInfo(response?.message || 'Controllo completato con successo. Puoi procedere con l\'unione.');
    } catch (error: unknown) {
      setMergeStep('error');
      setMergeError(getErrorMessage(error));
    }
  };

  const resolveMergedDownloadUrl = (response: MergeApiResponse | null | undefined): string | null => {
    if (!response) return null;
    if (response.url_download) return response.url_download;
    if (response.downloadUrl) return response.downloadUrl;
    if (response.url) return response.url;
    if (response.id_olimpo_cloud) return `${ServerCall.getUrl()}/getFileFromOlimpo?id=${response.id_olimpo_cloud}`;
    if (response.idOlimpoCloud) return `${ServerCall.getUrl()}/getFileFromOlimpo?id=${response.idOlimpoCloud}`;
    return null;
  };

  const handleMergeSelectedFiles = async () => {
    if (mergeStep !== 'check_ok') return;
    setMergeStep('merging');
    setMergeError('');
    setMergeInfo('');

    const outputName = mergedOutputName.trim() || `kit-${kit.guidId?.slice(0, 8)}-merged.pdf`;

    try {
      const response = await ServerCall.post<MergeApiResponse>('/mergeFiles', {
        idKitRuntime: kit.guidId,
        outputName,
        files: selectedFilesData.map((file) => ({
          id: file.id,
          nome: file.nome,
          id_olimpo_cloud: file.id_olimpo_cloud,
          url_download: file.url_download,
        })),
      });

      const mergedUrl = resolveMergedDownloadUrl(response);
      setMergedDownloadUrl(mergedUrl);
      setMergedDownloadName(response?.nome || response?.fileName || outputName);
      setMergeStep('success');
      setMergeInfo(response?.message || 'File uniti correttamente.');
      setShowMergeDialog(false);
      setShowMergeResultDialog(true);
      setSelectedFiles({});
      setMergedOutputName('');
      filesQuery.refetch();
    } catch (error: unknown) {
      setMergeStep('error');
      setMergeError(getErrorMessage(error));
    }
  };

  const handleDownloadMergedFile = async () => {
    if (!mergedDownloadUrl) return;

    try {
      const response = await axios.get(mergedDownloadUrl, {
        responseType: 'arraybuffer',
        withCredentials: true,
      });
      const contentType = response.headers['content-type'] || 'application/pdf';
      const blob = new Blob([response.data], { type: contentType });
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = mergedDownloadName;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error: unknown) {
      setMergeError(getErrorMessage(error));
      setMergeStep('error');
    }
  };

  return (
    <>
      <div className="grid grid-cols-12 gap-y-10 gap-x-6">
        <div className="col-span-12">
          <PageHeader
            title={kit?.titolo || 'Dettaglio Kit'}
            description={`Visualizza i file associati al kit`}
          />

          <div className="mt-3.5">
            <div className="flex flex-col box box--stacked shadow-sm rounded-xl border border-slate-200/80">
              {/* Header con stats */}
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 p-6 border-b border-slate-200/60 bg-slate-50/40">
                <div className="flex items-center gap-x-3">
                  <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                    <Lucide icon="FolderOpen" className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">File del kit</h3>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {totalItems} file totali
                      {isFetching && !isLoading && (
                        <Lucide icon="Loader" className="w-3.5 h-3.5 animate-spin inline-block ml-2" />
                      )}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto lg:min-w-[520px]">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Lucide icon="Files" className="w-4 h-4 text-primary" />
                      <p className="text-xs text-slate-500">Totale file</p>
                    </div>
                    <p className="text-base font-semibold text-slate-800">{stats?.totalFiles ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Lucide icon="Clock" className="w-4 h-4 text-pending" />
                      <p className="text-xs text-slate-500">In revisione</p>
                    </div>
                    <p className="text-base font-semibold text-slate-800">{stats?.inRevisionCount ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Lucide icon="Tag" className="w-4 h-4 text-success" />
                      <p className="text-xs text-slate-500">Con referenza</p>
                    </div>
                    <p className="text-base font-semibold text-slate-800">{stats?.filesWithMetaCount ?? 0}</p>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center gap-2 mb-1">
                      <Lucide icon="CheckSquare" className="w-4 h-4 text-info" />
                      <p className="text-xs text-slate-500">Selezionati</p>
                    </div>
                    <p className="text-base font-semibold text-slate-800">{selectedCount}</p>
                  </div>
                </div>
              </div>

              {/* Toolbar: ricerca, filtri, view toggle, page size */}
              <div className="p-5 border-b border-slate-200/60 bg-slate-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_auto] gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Lucide icon="Filter" className="w-4 h-4" />
                      Proprieta
                    </label>
                    <FormSelect
                      value={searchProperty}
                      onChange={(e) => setSearchProperty(e.target.value)}
                      className="w-full"
                    >
                      <option value="">Tutte le proprieta</option>
                      {allSearchProperties.map((prop) => (
                        <option key={prop} value={prop}>
                          {PROPERTY_LABELS[prop] || prop}
                        </option>
                      ))}
                    </FormSelect>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                      <Lucide icon="Search" className="w-4 h-4" />
                      Cerca
                    </label>
                    <FormInput
                      type="text"
                      placeholder="Cerca per nome, referenza, reparto, tema..."
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="w-full"
                    />
                  </div>

                  <div className="flex items-end gap-2 flex-wrap">
                    <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
                      <Button
                        variant={itemDisposition === ItemDisposition.grid ? 'primary' : 'outline-secondary'}
                        onClick={() => setItemDisposition(ItemDisposition.grid)}
                        className="shadow-none"
                      >
                        <Lucide icon="LayoutGrid" className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={itemDisposition === ItemDisposition.list ? 'primary' : 'outline-secondary'}
                        onClick={() => setItemDisposition(ItemDisposition.list)}
                        className="shadow-none"
                      >
                        <Lucide icon="List" className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 whitespace-nowrap">Per pagina:</span>
                      <FormSelect
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="w-[70px] !py-1.5 text-sm"
                      >
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </FormSelect>
                    </div>

                    {(searchProperty || searchValue) && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setSearchProperty('');
                          setSearchValue('');
                        }}
                      >
                        <Lucide icon="X" className="w-4 h-4 mr-1.5" />
                        Pulisci filtri
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* File content area */}
              <div className="p-5 relative">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Lucide icon="Loader" className="w-8 h-8 animate-spin text-primary mb-3" />
                    <span className="text-sm text-slate-500">Caricamento file...</span>
                  </div>
                ) : files.length === 0 ? (
                  <EmptyState
                    icon="FileX"
                    title="Nessun file trovato"
                    description={debouncedSearch ? 'Nessun file corrisponde ai criteri di ricerca' : 'Non ci sono file disponibili per questo kit'}
                  />
                ) : (
                  <>
                    {isFetching && !isLoading && (
                      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs">
                        <Lucide icon="Loader" className="w-3.5 h-3.5 animate-spin" />
                        Aggiornamento...
                      </div>
                    )}

                    {itemDisposition === ItemDisposition.grid ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {files.map((file) => {
                          const meta = file.meta_olimpo_cloud || {};
                          const status = file.log?.stato;
                          const price = formatCurrency(meta.prezzo);
                          const fileKey = getFileKey(file);
                          const isSelected = !!selectedFiles[fileKey];

                          return (
                            <div
                              key={fileKey}
                              className={`relative flex flex-col p-4 rounded-xl transition-all border group ${isSelected
                                ? 'border-primary/40 bg-primary/[0.03] shadow-sm ring-1 ring-primary/20'
                                : 'border-slate-200 bg-white hover:border-primary/30 hover:shadow-md'
                                }`}
                            >
                              <div className="absolute top-3 left-3 z-10">
                                <FormCheck className="bg-white/90 rounded-md px-1">
                                  <FormCheck.Input
                                    type="checkbox"
                                    className="!rounded-md"
                                    checked={isSelected}
                                    onChange={() => toggleFileSelection(file)}
                                  />
                                </FormCheck>
                              </div>
                              <div
                                className="w-full h-36 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-200 overflow-hidden mb-3 cursor-pointer hover:border-primary/50 transition-colors pt-4"
                                onClick={() => {
                                  if (file.url) {
                                    setPreviewFile({ imageUrl: file.url, pages: file.pages || 1 });
                                  }
                                }}
                              >
                                {file.url ? (
                                  <img
                                    src={file.url}
                                    alt={file.nome}
                                    className="w-full h-full object-scale-down p-2"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Lucide
                                    icon={getFileIcon(file.nome)}
                                    className="w-12 h-12 stroke-[1.5] text-slate-400"
                                  />
                                )}
                              </div>

                              <div className="flex items-start justify-between gap-2 mb-1.5">
                                <div className="text-sm font-semibold text-slate-800 truncate" title={formatFileName(file.nome)}>
                                  {formatFileName(file.nome)}
                                </div>
                                <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${getStatusStyles(status)}`}>
                                  {(status || 'N/D').replace(/_/g, ' ')}
                                </span>
                              </div>

                              <div className="text-xs text-slate-500 truncate mb-2">
                                {file.tipo_export_codice || 'Tipo export non definito'}
                              </div>

                              <div className="space-y-1 text-xs text-slate-600 mb-3">
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
                                  className="text-xs w-full"
                                  size="sm"
                                >
                                  <Lucide icon="Download" className="w-3.5 h-3.5 mr-1.5" />
                                  Scarica
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/60">
                        {files.map((file) => {
                          const meta = file.meta_olimpo_cloud || {};
                          const status = file.log?.stato;
                          const fileKey = getFileKey(file);
                          const price = formatCurrency(meta.prezzo);
                          const isSelected = !!selectedFiles[fileKey];

                          return (
                            <div
                              key={fileKey}
                              className={`flex items-center py-3.5 transition-all px-3 rounded-lg ${isSelected
                                ? 'bg-primary/[0.03] ring-1 ring-primary/20'
                                : 'hover:bg-slate-50/80'
                                }`}
                            >
                              <FormCheck className="mr-3">
                                <FormCheck.Input
                                  type="checkbox"
                                  className="!rounded-md"
                                  checked={isSelected}
                                  onChange={() => toggleFileSelection(file)}
                                />
                              </FormCheck>
                              <div
                                className="flex items-center justify-center w-12 h-12 mr-4 bg-white rounded-lg border border-slate-200 cursor-pointer flex-shrink-0 hover:border-primary/50 transition-colors shadow-sm"
                                onClick={() => {
                                  if (file.url) {
                                    setPreviewFile({ imageUrl: file.url, pages: file.pages || 1 });
                                  }
                                }}
                              >
                                {file.url ? (
                                  <img
                                    src={file.url}
                                    alt={file.nome}
                                    className="w-full h-full object-contain p-1.5"
                                    loading="lazy"
                                  />
                                ) : (
                                  <Lucide
                                    icon={getFileIcon(file.nome)}
                                    className="w-6 h-6 stroke-[1.5] text-slate-400"
                                  />
                                )}
                              </div>

                              <div className="flex-grow min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="text-sm font-semibold text-slate-800 truncate" title={formatFileName(file.nome)}>
                                    {formatFileName(file.nome)}
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap ${getStatusStyles(status)}`}>
                                    {(status || 'N/D').replace(/_/g, ' ')}
                                  </span>
                                </div>

                                <div className="text-xs text-slate-500 mt-0.5">{file.tipo_export_codice || 'Tipo export non definito'}</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-600">
                                  {meta.codice_referenza && <span>Ref: <span className="font-medium">{meta.codice_referenza}</span></span>}
                                  {meta.ean_referenza && <span>EAN: <span className="font-medium">{meta.ean_referenza}</span></span>}
                                  {meta.reparto && <span className="truncate">Reparto: <span className="font-medium">{meta.reparto}</span></span>}
                                  {meta.tema && <span>Tema: <span className="font-medium">{meta.tema}</span></span>}
                                  {price && <span>Prezzo: <span className="font-medium">{price}</span></span>}
                                  <span>Ultimo update: <span className="font-medium">{formatDate(file.log?.data_registrazione)}</span></span>
                                </div>
                              </div>

                              <Button
                                onClick={handleDownloadSingleFile(file)}
                                variant="outline-secondary"
                                size="sm"
                                className="ml-3 text-xs whitespace-nowrap"
                              >
                                <Lucide icon="Download" className="w-4 h-4 mr-1.5" />
                                Scarica
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer: selezione + paginazione */}
              {(files.length > 0 || selectedCount > 0) && (
                <div className="p-5 border-t border-slate-200/80 bg-slate-50/40">
                  {/* Riga selezione */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <FormCheck className="flex items-center">
                        <FormCheck.Input
                          type="checkbox"
                          className="!rounded-md"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                        />
                        <FormCheck.Label className="ml-2 text-sm text-slate-700">
                          Seleziona tutti nella pagina ({files.length})
                        </FormCheck.Label>
                      </FormCheck>
                    </div>
                    <div className="sm:ml-auto flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-600">
                        {selectedCount} selezionati
                        {selectedCount > 0 && totalPages > 1 && (
                          <span className="text-slate-400 ml-1">(anche da altre pagine)</span>
                        )}
                      </span>
                      {selectedCount > 0 && (
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          onClick={() => setSelectedFiles({})}
                        >
                          <Lucide icon="X" className="w-3.5 h-3.5 mr-1" />
                          Deseleziona tutti
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        disabled={selectedCount < 2 || !isPdfEqualityCheckAvailable}
                        onClick={startMergeFlow}
                        title={!isPdfEqualityCheckAvailable ? pdfEqualityUnavailableMessage : undefined}
                      >
                        <Lucide icon="Send" className="w-4 h-4 mr-2" />
                        Controlla e unisci
                      </Button>
                    </div>
                  </div>

                  {/* Riga paginazione */}
                  {totalPages > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-200/60">
                      <div className="text-sm text-slate-500">
                        {totalItems > 0 ? (
                          <>
                            Mostrati <span className="font-semibold text-slate-700">{showingFrom}</span>
                            {' - '}
                            <span className="font-semibold text-slate-700">{showingTo}</span>
                            {' di '}
                            <span className="font-semibold text-slate-700">{totalItems}</span> file
                          </>
                        ) : (
                          'Nessun file da mostrare'
                        )}
                      </div>
                      {totalPages > 1 && (
                        <Pagination className="flex w-full justify-end sm:w-auto">
                          <Pagination.Link
                            onClick={() => canGoPrev && setPage((prev) => Math.max(1, prev - 1))}
                            className={!canGoPrev ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                          >
                            <Lucide icon="ChevronLeft" className="w-4 h-4" />
                          </Pagination.Link>
                          {paginationRange.map((item) =>
                            typeof item === 'number' ? (
                              <Pagination.Link
                                key={`page-${item}`}
                                active={item === page}
                                onClick={() => setPage(item)}
                                className="cursor-pointer"
                              >
                                {item}
                              </Pagination.Link>
                            ) : (
                              <Pagination.Link
                                key={item}
                                className="pointer-events-none select-none text-slate-400"
                              >
                                ...
                              </Pagination.Link>
                            )
                          )}
                          <Pagination.Link
                            onClick={() => canGoNext && setPage((prev) => prev + 1)}
                            className={!canGoNext ? 'opacity-40 pointer-events-none' : 'cursor-pointer'}
                          >
                            <Lucide icon="ChevronRight" className="w-4 h-4" />
                          </Pagination.Link>
                        </Pagination>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog merge */}
      <Dialog centered size="lg" open={showMergeDialog} onClose={handleCloseMergeDialog}>
        <Dialog.Panel className="p-2">
          <Dialog.Title>
            <h2 className="text-lg font-semibold ">Unione file selezionati</h2>
          </Dialog.Title>
          <Dialog.Description className="p-4">
            <div className="space-y-4">
              <div className="text-sm text-slate-600">
                Hai selezionato <span className="font-semibold text-slate-800">{selectedCount}</span> file.
                {isPdfEqualityCheckAvailable
                  ? 'Il flusso esegue prima un controllo di uguaglianza e, solo dopo esito positivo, abilita l\'unione.'
                  : pdfEqualityUnavailableMessage}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Nome file finale (opzionale)</label>
                <FormInput
                  value={mergedOutputName}
                  onChange={(e) => setMergedOutputName(e.target.value)}
                  placeholder={`kit-${kit.guidId?.slice(0, 8)}-merged.pdf`}
                  className="mt-2"
                  disabled={mergeStep === 'checking' || mergeStep === 'merging'}
                />
              </div>

              <div className="max-h-44 overflow-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3">
                <p className="text-xs text-slate-500 mb-2">File inclusi ({selectedCount})</p>
                <div className="space-y-1.5">
                  {selectedFilesData.map((file) => (
                    <div key={file.id || file.nome} className="text-sm text-slate-700 truncate">
                      {formatFileName(file.nome)}
                    </div>
                  ))}
                </div>
              </div>

              {mergeStep === 'checking' && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
                  Controllo file in corso...
                </div>
              )}

              {mergeStep === 'merging' && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Lucide icon="Loader" className="w-4 h-4 animate-spin" />
                  Unione file in corso...
                </div>
              )}

              {mergeInfo && (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                  {mergeInfo}
                </div>
              )}

              {mergeError && (
                <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                  {mergeError}
                </div>
              )}
            </div>
          </Dialog.Description>
          <Dialog.Footer className="p-4 border-t border-slate-200/60 bg-slate-50/50 flex justify-end gap-2">
            <Button
              variant="outline-secondary"
              onClick={handleCloseMergeDialog}
              disabled={mergeStep === 'checking' || mergeStep === 'merging'}
            >
              Chiudi
            </Button>
            <Button
              variant="outline-primary"
              onClick={handleCheckSelectedFiles}
              disabled={selectedCount < 2 || mergeStep === 'checking' || mergeStep === 'merging' || !isPdfEqualityCheckAvailable}
              title={!isPdfEqualityCheckAvailable ? pdfEqualityUnavailableMessage : undefined}
            >
              <Lucide icon="CircleCheck" className="w-4 h-4 mr-2" />
              Verifica file
            </Button>
            <Button
              variant="primary"
              onClick={handleMergeSelectedFiles}
              disabled={mergeStep !== 'check_ok' || !isPdfEqualityCheckAvailable}
              title={!isPdfEqualityCheckAvailable ? pdfEqualityUnavailableMessage : undefined}
            >
              <Lucide icon="Send" className="w-4 h-4 mr-2" />
              Unisci file
            </Button>
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

      {/* Dialog risultato merge */}
      <Dialog centered open={showMergeResultDialog} onClose={() => setShowMergeResultDialog(false)}>
        <Dialog.Panel className="p-2">
          <Dialog.Title>
            <h2 className="text-lg font-semibold px-4 pt-4">Risultato unione</h2>
          </Dialog.Title>
          <Dialog.Description className="p-4">
            {mergeStep === 'success' ? (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg border border-success/30 bg-success/10">
                  <Lucide icon="CircleCheck" className="w-5 h-5 text-success mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-success">Unione completata</p>
                    <p className="text-xs text-slate-600 mt-1">{mergeInfo || 'Il server ha generato il file unito.'}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">Nome file: <span className="font-medium text-slate-800">{mergedDownloadName}</span></p>
              </div>
            ) : (
              <div className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
                {mergeError || 'Operazione non completata.'}
              </div>
            )}
          </Dialog.Description>
          <Dialog.Footer className="p-4 border-t border-slate-200/60 bg-slate-50/50 flex justify-end gap-2">
            <Button variant="outline-secondary" onClick={() => setShowMergeResultDialog(false)}>
              Chiudi
            </Button>
            {mergeStep === 'success' && mergedDownloadUrl && (
              <Button variant="primary" onClick={handleDownloadMergedFile}>
                <Lucide icon="Download" className="w-4 h-4 mr-2" />
                Scarica file unito
              </Button>
            )}
          </Dialog.Footer>
        </Dialog.Panel>
      </Dialog>

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
