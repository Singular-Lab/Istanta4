import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormLabel, FormSelect } from "@/components/Base/Form";
import { Popover } from "@/components/Base/Headless";
import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Skeleton from "@/components/Base/Skeleton";
import EmptyState from "@/components/EmptyState";
import { useDebounce } from "@/hooks/useDebounce";
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
  const [testoRicerca, setTestoRicerca] = useState("");
  // La ricerca per nome parte 300 ms dopo l'ultima battuta e riparte dalla prima pagina
  const applicaRicerca = useDebounce((testo: string) => {
    setFilters((precedenti) => ({ ...precedenti, nome: testo.trim() }));
    setPage(1);
  }, 300);
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

  // Filtri del pannello Filtra effettivamente impostati (la ricerca per nome ha il suo campo)
  const filtriAttivi = [filters.idLavorazione, filters.idTipoExport, filters.idFormato, filters.idArea, filters.idCanale].filter(Boolean).length;

  const azzeraFiltri = () => {
    setTestoRicerca("");
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
    });
    setPage(1);
  };

  // Ogni filtro del pannello riparte dalla prima pagina
  const impostaFiltro = (campo: keyof typeof filters, valore: string) => {
    setFilters((precedenti) => ({ ...precedenti, [campo]: valore }));
    setPage(1);
  };

  // Render loading state based on current display mode
  const renderLoadingState = () => {
    const ghostFiles = generateGhostFiles(pageSize);

    if (itemDisposition === ItemDisposition.grid) {
      return (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-busy="true">
          {ghostFiles.map((ghost) => (
            <div key={ghost.id} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3">
              <Skeleton className="h-40 rounded-control" />
              <Skeleton className="h-4" />
              <Skeleton className="h-8 w-1/2 rounded-control" />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="divide-y divide-slate-100 px-5" aria-busy="true">
        {ghostFiles.map((ghost) => (
          <div key={ghost.id} className="flex items-center gap-3 py-3">
            <Skeleton className="h-10 w-10 flex-none rounded-control" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="ml-auto h-8 w-24 rounded-control" />
          </div>
        ))}
      </div>
    );
  };

  const filtriSelezionabili: { campo: keyof typeof filters; etichetta: string; vuoto: string; opzioni: { id?: string; nome: string }[] }[] = [
    { campo: "idLavorazione", etichetta: "Promozione", vuoto: "Tutte le promozioni", opzioni: allPromo.data ?? [] },
    {
      campo: "idTipoExport",
      etichetta: "Tipo di export",
      vuoto: "Tutti i tipi di export",
      opzioni: (allTipoExport.data ?? []).filter((tipo) => tipo.codice !== "WEB" && tipo.codice !== EXPORT_DI_SISTEMA.CORREGGO),
    },
    { campo: "idFormato", etichetta: "Formato", vuoto: "Tutti i formati", opzioni: allFormato.data ?? [] },
    { campo: "idArea", etichetta: "Area", vuoto: "Tutte le aree", opzioni: allArea.data ?? [] },
    { campo: "idCanale", etichetta: "Canale", vuoto: "Tutti i canali", opzioni: allCanale.data ?? [] },
  ];

  const elencoFile = files.data?.files ?? [];
  const ricercaAttiva = Boolean(filters.nome) || filtriAttivi > 0;

  return (
    <Pagina titolo="Contenuti digitali" descrizione="Volantini e materiali pubblicati, da cercare e scaricare">
      <Sezione senzaPadding aria-label="Contenuti digitali">
        <BarraFiltri
          destra={
            <Popover className="inline-block">
              {({ close }) => (
                <>
                  <Popover.Button as={Button} size="sm" variant="outline-secondary" className="w-full sm:w-auto">
                    <Lucide icon="ArrowDownWideNarrow" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                    Filtra
                    {/* Spazi come testo, fuori dagli span: dentro si perdono e il nome letto diventa "Filtra1filtri attivi" */}
                    {filtriAttivi > 0 && " "}
                    {filtriAttivi > 0 && (
                      <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-2xs font-medium tabular-nums text-slate-600">
                        {filtriAttivi}
                        {" "}
                        <span className="sr-only">filtri attivi</span>
                      </span>
                    )}
                  </Popover.Button>

                  <Popover.Panel placement="bottom-end" className="mt-2">
                    <div className="flex w-72 flex-col gap-3 p-2">
                      {filtriSelezionabili.map((filtro) => (
                        <div key={filtro.campo}>
                          <FormLabel htmlFor={`filtro-${filtro.campo}`}>{filtro.etichetta}</FormLabel>
                          <FormSelect
                            id={`filtro-${filtro.campo}`}
                            formSelectSize="sm"
                            value={filters[filtro.campo]}
                            onChange={(e) => impostaFiltro(filtro.campo, e.target.value)}
                          >
                            <option value="">{filtro.vuoto}</option>
                            {filtro.opzioni.map((opzione) => (
                              <option key={opzione.id ?? opzione.nome} value={opzione.id}>
                                {opzione.nome}
                              </option>
                            ))}
                          </FormSelect>
                        </div>
                      ))}

                      <div className="mt-1 flex justify-end gap-2">
                        <Button size="sm" variant="outline-secondary" onClick={azzeraFiltri}>
                          <Lucide icon="RefreshCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                          Reset
                        </Button>
                        <Button size="sm" variant="outline-secondary" onClick={() => close()}>
                          Chiudi
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            files.refetch();
                            close();
                          }}
                        >
                          Filtra
                        </Button>
                      </div>
                    </div>
                  </Popover.Panel>
                </>
              )}
            </Popover>
          }
        >
          <CampoRicerca
            etichetta="Cerca contenuti"
            placeholder="Ricerca contenuti…"
            value={testoRicerca}
            onChange={(valore) => {
              setTestoRicerca(valore);
              applicaRicerca(valore);
            }}
          />
        </BarraFiltri>

        {filesQuery.isError ? (
          <PageError
            compatta
            className="m-5"
            titolo="Contenuti non caricati"
            motivo={filesQuery.error?.message || "Si è verificato un errore durante il recupero dei contenuti digitali."}
            onRiprova={() => filesQuery.refetch()}
          />
        ) : files.isLoading ? (
          renderLoadingState()
        ) : elencoFile.length === 0 ? (
          ricercaAttiva ? (
            <EmptyState
              compatta
              icon="SearchX"
              title="Nessun risultato"
              description="Nessun contenuto corrisponde alla ricerca o ai filtri scelti."
              buttonText="Azzera filtri"
              buttonIcon="RotateCcw"
              onButtonClick={azzeraFiltri}
            />
          ) : (
            <EmptyState
              compatta
              icon="FileX"
              title="Nessun contenuto trovato"
              description="Al momento non ci sono contenuti disponibili."
            />
          )
        ) : itemDisposition === ItemDisposition.grid ? (
          <ul className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {elencoFile.map((file, index) => (
              <li key={index} className="flex flex-col gap-3 rounded-card border border-slate-200 bg-white p-3">
                <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-slate-50">
                  {file.url ? (
                    <img
                      src={file.url}
                      alt=""
                      className="h-full w-full object-scale-down"
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
                    <Lucide icon={getFileIcon(file.nome)} aria-hidden="true" className="h-12 w-12 text-slate-400" />
                  )}
                </div>
                <p className="truncate text-sm font-medium text-slate-700" title={file.nome}>
                  {file.nome}
                </p>
                <Button
                  onClick={handleDownloadSingleFile(file)}
                  variant="outline-secondary"
                  size="sm"
                  className="self-start"
                  aria-label={`Scarica ${file.nome}`}
                >
                  <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Scarica
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="divide-y divide-slate-100 px-5">
            {elencoFile.map((file, index) => (
              <li key={index} className="flex items-center gap-3 py-3">
                <div className="flex h-10 w-10 flex-none items-center justify-center rounded-control border border-slate-200 bg-white">
                  {file.url ? (
                    <img
                      src={file.url}
                      alt=""
                      className="h-full w-full object-contain p-1"
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
                    <Lucide icon={getFileIcon(file.nome)} aria-hidden="true" className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <p className="min-w-0 flex-grow truncate text-sm font-medium text-slate-700">{file.nome}</p>
                <Button
                  onClick={handleDownloadSingleFile(file)}
                  variant="outline-secondary"
                  size="sm"
                  className="whitespace-nowrap"
                  aria-label={`Scarica ${file.nome}`}
                >
                  <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  Scarica
                </Button>
              </li>
            ))}
          </ul>
        )}

        <PaginazioneTabella
          totale={files.data?.totalItems ?? 0}
          pagina={page}
          dimensionePagina={pageSize}
          onCambiaPagina={setPage}
          onCambiaDimensione={setPageSize}
          opzioniDimensione={[10, 25, 35, 50]}
        />
      </Sezione>
    </Pagina>
  );
}

export default withSessionCheck(ContenutiDigitali);
