import Button from "@/components/Base/Button";
import { FormInput, FormSelect } from "@/components/Base/Form";
import { Menu, Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import PageHeader from "@/components/Base/PageHeader";
import Pagination from "@/components/Base/Pagination";
import EmptyState from "@/components/EmptyState";
import { useFetchAllContenutiDigitali, useFetchAree, useFetchCanali, useFetchFormati, useFetchLavorazioni, useFetchTipiExport } from "@/query/query";
import axios from "axios";
import React, { useMemo, useState } from "react";
import { EXPORT_DI_SISTEMA, ItemDisposition } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { FileItemKit } from "../../../lib/types";

const ContenutiDigitali: React.FC = () => {
  const [itemDisposition, setItemDisposition] = useState(ItemDisposition.grid);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [filters, setFilters] = useState<{
    idArea: string;
    idCanale: string;
    nome: string;
    idTipoExport: string;
    idFormato: string;
    idPuntoVendita: string;
    idLavorazione: string;
    idCombinazione: string;
    idDeclinazione: string;
  }>({
    idArea: '',
    idCanale: '',
    nome: '',
    idTipoExport: '',
    idFormato: '',
    idPuntoVendita: '',
    idLavorazione: '',
    idCombinazione: '',
    idDeclinazione: ''
  });
  const filesQuery = useFetchAllContenutiDigitali(page, pageSize, filters);
  // Compatibilità: appiattisci struttura gerarchica promos → file piatto
  const files = useMemo(() => ({
    ...filesQuery,
    data: filesQuery.data ? {
      ...filesQuery.data,
      files: filesQuery.data.promos?.flatMap(p => p.kits.flatMap(k => k.files)) as FileItemKit[] ?? []
    } : undefined
  }), [filesQuery]);
  const allPromo = useFetchLavorazioni();
  const allArea = useFetchAree();
  const allCanale = useFetchCanali();
  const allTipoExport = useFetchTipiExport();
  const allFormato = useFetchFormati();
  const cacheImage = (url: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
    });
  };

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

  const handleDownloadSingleFile = (file: FileItemKit) => async () => {
    if (!file.url) {
      console.error('URL del file non disponibile');
      return;
    }
    try {
      const url = ServerCall.getUrl()
      const response = await axios.get(
        `${url}/getFileFromOlimpo?id=${file.id_olimpo_cloud}`,
        {
          responseType: 'arraybuffer', // <--- fondamentale!
        }
      );

      if (!response) {
        console.error('Errore durante il download del file');
        return;
      }
      //@ts-ignore
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = file.nome;

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Errore durante il download del file:', error);
    }
  };

  const generateGhostFiles = (count: number) => {
    return Array.from({ length: count }, (_, index) => ({
      id: `ghost-${index}`,
      isGhost: true
    }));
  };

  // Render loading state based on current display mode
  const renderLoadingState = () => {
    const ghostFiles = generateGhostFiles(pageSize);

    if (itemDisposition === ItemDisposition.grid) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
          {ghostFiles.map((ghost) => (
            <div key={ghost.id} className="flex flex-col p-3 bg-slate-50 rounded-md border border-slate-200 animate-pulse">
              <div className="w-full h-40 flex items-center justify-center rounded bg-slate-200 mb-3">
                <Lucide icon="Image" className="w-12 h-12 text-slate-300 stroke-[1.3]" />
              </div>
              <div className="w-full h-4 bg-slate-200 rounded mb-2"></div>
              <div className="w-1/2 h-4 bg-slate-200 rounded mb-3"></div>
              <div className="w-full h-8 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    } else {
      return (
        <div className="divide-y divide-slate-200">
          {ghostFiles.map((ghost) => (
            <div key={ghost.id} className="flex items-center py-3 px-2 rounded-md animate-pulse">
              <div className="flex items-center justify-center w-10 h-10 mr-3 bg-slate-200 rounded">
                <Lucide icon="Image" className="w-5 h-5 text-slate-300 stroke-[1.3]" />
              </div>
              <div className="flex-grow min-w-0">
                <div className="w-48 h-4 bg-slate-200 rounded mb-2"></div>
              </div>
              <div className="ml-2 w-24 h-8 bg-slate-200 rounded"></div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        <PageHeader
          title="Contenuti Digitali"
          description="Gestione Contenuti Digitali"
        />
        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            <div className="flex flex-col p-5 sm:items-center sm:flex-row gap-y-2">
              <div>
                <div className="relative">
                  <Lucide
                    icon="Search"
                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                  />
                  <FormInput
                    type="text"
                    placeholder="Ricerca contenuti..."
                    className="pl-9 sm:w-64 rounded-[0.5rem]"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-x-3 gap-y-2 sm:ml-auto">
                <Menu>
                  <Menu.Button
                    as={Button}
                    disabled={files.data?.files.length == 0}
                    variant="outline-secondary"
                    className="w-full sm:w-auto"
                  >
                    <Lucide
                      icon="Download"
                      className="stroke-[1.3] w-4 h-4 mr-2"
                    />
                    Scarica
                    <div className="flex items-center justify-center h-5 px-1.5 ml-2 text-xs font-medium border rounded-full bg-slate-100">
                      {files.data?.files.length}
                    </div>
                  </Menu.Button>
                </Menu>
                <Popover className="inline-block">
                  {({ close }) => (
                    <>
                      <Popover.Button
                        as={Button}
                        variant="outline-secondary"
                        className="w-full sm:w-auto"
                      >
                        <Lucide
                          icon="ArrowDownWideNarrow"
                          className="stroke-[1.3] w-4 h-4 mr-2"
                        />
                        Filtra
                        <div className="flex items-center justify-center h-5 px-1.5 ml-2 text-xs font-medium border rounded-full bg-slate-100">
                          X
                        </div>
                      </Popover.Button>

                      <Popover.Panel placement="bottom-end" className={"mt-2"}>
                        <div className="p-2">
                          <div>
                            <div className="text-left text-slate-500">
                              Promozione
                            </div>
                            <FormSelect
                              onChange={(e) => {
                                setFilters({ ...filters, idLavorazione: e.target.value });
                              }}
                              value={filters.idLavorazione}
                              className="flex-1 mt-2">
                              <option value={""}>Seleziona una promozione</option>
                              {allPromo.data?.map((promo) => (
                                <option value={promo.id}>{promo.nome}</option>
                              ))}
                            </FormSelect>
                          </div>
                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              Tipo di export
                            </div>
                            <FormSelect
                              onChange={(e) => {
                                setFilters({ ...filters, idTipoExport: e.target.value });
                              }}
                              value={filters.idTipoExport}
                              className="flex-1 mt-2">
                              <option value={""}>Seleziona un tipo di export</option>
                              {allTipoExport.data?.filter((tipo_expot) => tipo_expot.codice !== "WEB" && tipo_expot.codice !== EXPORT_DI_SISTEMA.CORREGGO).map((tipo_expot) => (
                                <option value={tipo_expot.id}>{tipo_expot.nome}</option>
                              ))}
                            </FormSelect>
                          </div>
                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              Formati
                            </div>
                            <FormSelect
                              onChange={(e) => {
                                setFilters({ ...filters, idFormato: e.target.value });
                              }}
                              value={filters.idFormato}
                              className="flex-1 mt-2">
                              <option value={""}>Seleziona un formato</option>
                              {allFormato.data?.map((formato) => (
                                <option value={formato.id}>{formato.nome}</option>
                              ))}
                            </FormSelect>
                          </div>

                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              Area
                            </div>
                            <FormSelect
                              onChange={(e) => {
                                setFilters({ ...filters, idArea: e.target.value });
                              }}
                              value={filters.idArea}
                              className="flex-1 mt-2">
                              <option value="">Seleziona un'area</option>
                              {allArea.data?.map((area) => (
                                <option value={area.id}>{area.nome}</option>
                              ))}
                            </FormSelect>
                          </div>

                          <div className="mt-3">
                            <div className="text-left text-slate-500">
                              Canale
                            </div>
                            <FormSelect
                              onChange={(e) => {
                                setFilters({ ...filters, idCanale: e.target.value });
                              }}
                              value={filters.idCanale}
                              className="flex-1 mt-2">
                              <option value={""}>Seleziona un canale</option>
                              {allCanale.data?.map((canale) => (
                                <option value={canale.id}>{canale.nome}</option>
                              ))}
                            </FormSelect>
                          </div>

                          <div className="flex items-center mt-4">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                close();
                              }}
                              className="w-32 ml-auto"
                            >
                              Chiudi
                            </Button>
                            <Button onClick={() => {
                              setFilters({
                                idArea: '',
                                idCanale: '',
                                nome: '',
                                idTipoExport: '',
                                idFormato: '',
                                idPuntoVendita: '',
                                idLavorazione: '',
                                idCombinazione: '',
                                idDeclinazione: ''
                              })
                            }}
                              variant="primary"
                              className="w-32 ml-2">
                              Reset
                              <Lucide icon="RefreshCcw" className="w-4 h-4 stroke-[1.5]" />
                            </Button>
                            <Button onClick={() => {
                              files.refetch()
                            }} variant="primary" className="w-32 ml-2">
                              Filtra
                            </Button>
                          </div>
                        </div>
                      </Popover.Panel>
                    </>
                  )}
                </Popover>

              </div>
            </div>

            {Array.isArray(files?.data?.files) && files?.data?.files.length === 0 && (
              <EmptyState
                icon="FileX"
                title="Nessun contenuto trovato"
                description="Al momento non ci sono contenuti disponibili."
              />
            )}
            {files.isLoading ? (
              renderLoadingState()
            ) : (
              <>
                {files?.data && files.data.files?.length > 0 && (
                  <>
                    {/* Visualizzazione a griglia */}
                    {itemDisposition === ItemDisposition.grid && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-5">
                        {files?.data.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex flex-col p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors border border-slate-200"
                          >
                            <div className="w-full h-[80%] flex items-center justify-center rounded bg-white border border-slate-200 overflow-hidden mb-3">
                              {file.url ? (
                                <img
                                  src={file.url}
                                  alt={file.nome}
                                  className="w-full h-full object-scale-down"
                                  onLoad={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                    if (file.url) {
                                      cacheImage(file.url);
                                    }
                                  }}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '';
                                  }}
                                  style={{
                                    opacity: '0',
                                    transition: 'opacity 0.3s ease-in-out',
                                  }}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="flex items-center justify-center w-full h-full bg-gray-100">
                                  <Lucide
                                    icon={getFileIcon(file.nome)}
                                    className="w-12 h-12 stroke-[1.5]"
                                  />
                                </div>
                              )}
                            </div>
                            <div className="w-full min-w-0">
                              <div className="text-sm font-medium text-slate-700 truncate">
                                {file.nome}
                              </div>
                            </div>
                            <Button
                              onClick={handleDownloadSingleFile(file)}
                              variant="outline-secondary"
                              className="mt-2 text-xs"
                            >
                              Scarica &nbsp;
                              <Lucide icon="Download" className="w-4 h-4 stroke-[1.5]" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Visualizzazione a lista */}
                    {itemDisposition === ItemDisposition.list && (
                      <div className="divide-y divide-slate-200">
                        {files?.data?.files.map((file, index) => (
                          <div
                            key={index}
                            className="flex items-center py-3 hover:bg-slate-50 transition-colors px-2 rounded-md"
                          >
                            <div className="flex items-center justify-center w-10 h-10 mr-3 bg-white rounded border border-slate-200">
                              {file.url ? (
                                <img
                                  src={file.url}
                                  alt={file.nome}
                                  className="w-full h-full object-contain p-1"
                                  onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = '';
                                  }}
                                  style={{
                                    opacity: '0',
                                    transition: 'opacity 0.3s ease-in-out',
                                  }}
                                  loading="lazy"
                                />
                              ) : (
                                <Lucide
                                  icon={getFileIcon(file.nome)}
                                  className="w-5 h-5 stroke-[1.5]"
                                />
                              )}
                            </div>
                            <div className="flex-grow min-w-0">
                              <div className="text-sm font-medium text-slate-700 truncate">
                                {file.nome}
                              </div>
                            </div>
                            <Button
                              onClick={handleDownloadSingleFile(file)}
                              variant="outline-secondary"
                              size="sm"
                              className="ml-2 text-xs whitespace-nowrap"
                            >
                              Scarica &nbsp;
                              <Lucide
                                icon="Download"
                                className="w-4 h-4 stroke-[1.5]"
                              />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {/* Se invece ci sono file, mostriamo la visualizzazione grid/list */}
            <div className="flex flex-col-reverse flex-wrap items-center p-5 flex-reverse gap-y-2 sm:flex-row">
              <Pagination className="flex-1 w-full mr-auto sm:w-auto">
                <Pagination.Link onClick={() => {
                  console.log('Navigating to first page');
                  setPage(1);
                }}>
                  <Lucide icon="ChevronsLeft" className="w-4 h-4" />
                </Pagination.Link>
                <Pagination.Link onClick={() => {
                  console.log('Navigating to previous page');
                  setPage((prev) => Math.max(prev - 1, 1));
                }}>
                  <Lucide icon="ChevronLeft" className="w-4 h-4" />
                </Pagination.Link>
                <Pagination.Link>...</Pagination.Link>
                {files?.data?.totalPages && Array.from({ length: files.data.totalPages }, (_, i) => i + 1).map((pageNumber) => {
                  const isCurrentPage = pageNumber === files.data?.currentPage;
                  const isNearCurrentPage = Math.abs(pageNumber - (files.data?.currentPage ?? 0)) <= 3;

                  if (isCurrentPage || isNearCurrentPage) {
                    return (
                      <Pagination.Link
                        key={pageNumber}
                        active={isCurrentPage}
                        onClick={() => {
                          console.log(`Navigating to page ${pageNumber}`);
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </Pagination.Link>
                    );
                  }

                  return null;
                })}
                <Pagination.Link>...</Pagination.Link>
                <Pagination.Link onClick={() => {
                  console.log('Navigating to next page');
                  setPage((prev) => Math.min(prev + 1, files?.data?.totalPages || 1));
                }}>
                  <Lucide icon="ChevronRight" className="w-4 h-4" />
                </Pagination.Link>
                <Pagination.Link onClick={() => {
                  console.log('Navigating to last page');
                  setPage(files?.data?.totalPages || 1);
                }}>
                  <Lucide icon="ChevronsRight" className="w-4 h-4" />
                </Pagination.Link>
              </Pagination>
              <FormSelect onChange={(e) => {
                const newSize = parseInt(e.target.value);
                console.log(`Changing page size to ${newSize}`);
                setPageSize(newSize);
              }} className="sm:w-20 rounded-[0.5rem]">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={35}>35</option>
                <option value={50}>50</option>
              </FormSelect>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default withSessionCheck(ContenutiDigitali);
