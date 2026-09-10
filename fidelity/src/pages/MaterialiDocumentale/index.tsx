/* eslint-disable no-console */
import Button from "@/components/Base/Button";
import { FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageHeader from "@/components/Base/PageHeader";
import EmptyState from "@/components/EmptyState";
import { PreviewImmaginePdf } from "@/components/PreviewImmaginePdf";
import {
  useFetchAllFilesDocumentale,
  useFetchAree,
  useFetchCanali,
  useFetchFilesFieldValues,
  useFetchFilesMetadataFields,
  useFetchFormati,
  useFetchLavorazioni,
  useFetchPromoFiltered,
  useFetchTipiExport
} from "@/query/query";
import React, { useMemo, useRef, useState } from "react";
import { useLoaderData, useNavigate, useParams } from "react-router-dom";
import { EXPORT_DI_SISTEMA, ItemDisposition, STATO_PROMO } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { FileItemKit } from "../../../lib/types";
import Skeleton from "../../components/Base/Skeleton";
import withSessionCheck from "../../components/SessionChecker";

export interface MaterialiDocumentaleLoaderData {
  title: string;
  description: string;
  filterType: 'attivi' | 'in-corso' | 'storico';
  preselectedPromoId?: string;
}

// Soglia per determinare se mostrare select o text input
const MAX_VALUES_FOR_SELECT = 5;

// Componente per l'input del valore metadata (Select o TextInput in base al numero di valori)
interface MetadataValueInputProps {
  field: string;
  value: string;
  onChange: (value: string) => void;
}

const MetadataValueInput: React.FC<MetadataValueInputProps> = ({ field, value, onChange }) => {
  const { data: fieldValues = [], isLoading } = useFetchFilesFieldValues(field, !!field);

  // Se non c'è un campo selezionato, mostra input disabilitato
  if (!field) {
    return (
      <FormInput
        type="text"
        placeholder="Seleziona prima una chiave..."
        value=""
        disabled
        className="w-full"
      />
    );
  }

  // Se sta caricando o ci sono troppi valori o nessun valore, mostra TextInput
  if (isLoading || fieldValues.length === 0 || fieldValues.length > MAX_VALUES_FOR_SELECT) {
    return (
      <div>
        <FormInput
          type="text"
          placeholder={isLoading ? "Caricamento valori..." : "Inserisci valore..."}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full"
          disabled={isLoading}
        />
      </div>
    );
  }

  // Altrimenti mostra select con i valori disponibili
  return (
    <FormSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full"
    >
      <option value="">Seleziona valore</option>
      {fieldValues.map((val, i) => (
        <option key={i} value={val}>
          {val}
        </option>
      ))}
    </FormSelect>
  );
};

// Valori di default per i filtri - estratti per riutilizzo nel reset sincrono
const defaultFilters = {
  nomePromo: '',
  idPromo: '',
  statoPromo: '',
  validitaDal: '',
  validitaAl: '',
  nomeKit: '',
  idKit: '',
  idArea: '',
  idCanale: '',
  idTipoExport: '',
  idFormato: '',
  idPuntoVendita: '',
};

type RoutePromoFilterConfig = {
  stati?: STATO_PROMO[];
  excludeStati?: STATO_PROMO[];
  validitaAlFrom?: string;
  validitaAlTo?: string;
  lockStatusSelect?: boolean;
};

const MaterialiDocumentale: React.FC = () => {
  const loaderData = useLoaderData() as MaterialiDocumentaleLoaderData;
  const { idPromo: idPromoFromParams } = useParams();
  const navigate = useNavigate();

  // Determina se la promo è preselezionata (da loader o da params)
  const preselectedPromoId = loaderData.preselectedPromoId || idPromoFromParams || '';
  const isPromoPreselected = !!preselectedPromoId;

  // Track previous filterType to detect route changes
  const prevFilterTypeRef = useRef(loaderData.filterType);

  // View mode
  const [itemDisposition, setItemDisposition] = useState(ItemDisposition.grid);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [pagesLightBoxImage, setPagesLightBoxImage] = useState<number | null>(null);
  const [downloadingPromoId, setDownloadingPromoId] = useState<string | null>(null);

  // Advanced filters - inizializza con idPromo se preselezionato
  const [filters, setFilters] = useState<typeof defaultFilters>({
    ...defaultFilters,
    idPromo: preselectedPromoId,
  });

  // Metadata filter state - singola coppia chiave/valore come in GestioneApi
  const [selectedMetadataKey, setSelectedMetadataKey] = useState<string>('');
  const [selectedMetadataValue, setSelectedMetadataValue] = useState<string>('');

  // SYNC RESET: Reset filtri quando filterType cambia (prima del render)
  // Questo pattern è raccomandato da React docs per "Adjusting state when a prop changes"
  // Evita la race condition dell'useEffect che verrebbe eseguito DOPO il render
  if (prevFilterTypeRef.current !== loaderData.filterType) {
    setFilters({
      ...defaultFilters,
      idPromo: preselectedPromoId,
    });
    setSelectedMetadataKey('');
    setSelectedMetadataValue('');
    prevFilterTypeRef.current = loaderData.filterType;
  }

  // Funzione per tornare alla pagina dettagli promo
  const handleBackToPromo = () => {
    if (preselectedPromoId) {
      navigate(`/promozioni/in-corso/dettagli/${preselectedPromoId}`);
    }
  };

  // Data fetching
  const allPromo = useFetchLavorazioni();
  const allArea = useFetchAree();
  const allCanale = useFetchCanali();
  const allTipoExport = useFetchTipiExport();
  const allFormato = useFetchFormati();

  // Fetch metadata fields per filtri dinamici
  const { data: metadataFields = [] } = useFetchFilesMetadataFields();

  // Build base filters based on route
  const basePromoFilter = useMemo<RoutePromoFilterConfig>(() => {
    const today = new Date().toISOString().split('T')[0];

    switch (loaderData.filterType) {
      case 'attivi':
        return {
          stati: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI],
          validitaAlFrom: today,
          lockStatusSelect: true,
        };
      case 'storico':
        return {
          stati: [STATO_PROMO.ARCHIVIATA],
          validitaAlTo: today,
          lockStatusSelect: true,
        };
      case 'in-corso':
        return {
          stati: [
            STATO_PROMO.PIANIFICATA,
            STATO_PROMO.IN_LAVORAZIONE,
            STATO_PROMO.IN_SCADENZA,
            STATO_PROMO.IN_ATTESA_DI_VALIDITA,
            STATO_PROMO.IN_RITARDO,
          ],
          excludeStati: [STATO_PROMO.ELIMINATA],
        };
      default:
        return {};
    }
  }, [loaderData.filterType]);

  const singleRouteState = basePromoFilter.stati?.length === 1 ? basePromoFilter.stati[0] : undefined;
  const singleExcludedState = basePromoFilter.excludeStati?.length === 1 ? basePromoFilter.excludeStati[0] : undefined;

  const serverStatoFilter = filters.statoPromo || singleRouteState;
  const serverExcludeFilter = filters.statoPromo ? undefined : singleExcludedState;

  // Fetch filtered promos (tutte le promo per la select)
  const filteredPromos = useFetchPromoFiltered({
    page: 1,
    pageSize: 1000,
    search: filters.nomePromo,
    stato: serverStatoFilter,
    validitaDal: filters.validitaDal,
    validitaAl: filters.validitaAl,
    validitaAlFrom: basePromoFilter.validitaAlFrom,
    validitaAlTo: basePromoFilter.validitaAlTo,
    excludeStato: serverExcludeFilter,
  });

  const promoOptions = useMemo(() => {
    const promos = filteredPromos.data?.promos ?? [];

    if (filters.statoPromo) {
      return promos;
    }

    return promos.filter((promo) => {
      const currentState = promo.stato as STATO_PROMO;
      const matchesInclude =
        !basePromoFilter.stati?.length || basePromoFilter.stati.includes(currentState);
      const matchesExclude =
        !basePromoFilter.excludeStati?.length || !basePromoFilter.excludeStati.includes(currentState);
      return matchesInclude && matchesExclude;
    });
  }, [filteredPromos.data, filters.statoPromo, basePromoFilter]);

  // Get promo IDs for file filtering
  const promoIds = useMemo(() => {
    if (!promoOptions.length) return [];
    let promos = promoOptions;

    if (filters.idPromo) {
      promos = promos.filter(p => p.id === filters.idPromo);
    }

    return promos.map(p => p.id);
  }, [promoOptions, filters.idPromo]);

  // Costruisce il filtro metadata: semplice coppia campo/valore
  const metadataFilter = useMemo(() => {
    if (selectedMetadataKey && selectedMetadataValue) {
      return { field: selectedMetadataKey, value: selectedMetadataValue };
    }
    return undefined;
  }, [selectedMetadataKey, selectedMetadataValue]);

  // Fetch files with all filters - il server restituisce struttura gerarchica Promo → Kit → File
  const filesQuery = useFetchAllFilesDocumentale(
    1,
    10000,
    {
      idArea: filters.idArea,
      idCanale: filters.idCanale,
      nome: '',
      idTipoExport: filters.idTipoExport,
      idFormato: filters.idFormato,
      idPuntoVendita: filters.idPuntoVendita,
      idLavorazione: promoIds.join(','),
      idCombinazione: filters.idKit,
      idDeclinazione: '',
    },
    metadataFilter
  );


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

  const handleDownloadSingleFile = (file: FileItemKit) => () => {
    if (!file.id_olimpo_cloud) {
      console.error('ID Olimpo del file non disponibile');
      return;
    }
    const url = ServerCall.getUrl();
    const downloadUrl = `${url}/downloadPDFVolantino/${file.id_olimpo_cloud}?fileName=${encodeURIComponent(file.nome)}`;

    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = file.nome;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintSingleFile = (file: FileItemKit) => async () => {
    if (!file.id_olimpo_cloud) {
      console.error('ID Olimpo del file non disponibile');
      return;
    }

    try {
      // downloadPDFVolantino è un endpoint pubblico (no auth) che imposta Access-Control-Allow-Origin: *
      // quindi NON usare credentials: 'include' (incompatibile con wildcard origin)
      const response = await fetch(
        `${ServerCall.getUrl()}/downloadPDFVolantino/${file.id_olimpo_cloud}?fileName=${encodeURIComponent(file.nome)}`
      );

      if (!response.ok) {
        console.error('Errore durante il recupero del file');
        return;
      }

      const blob = await response.blob();
      const namedFile = new File([blob], file.nome, { type: 'application/pdf' });
      const blobUrl = window.URL.createObjectURL(namedFile);

      const printWindow = window.open(blobUrl);
      if (!printWindow) {
        console.error('Impossibile aprire la finestra di stampa');
        window.URL.revokeObjectURL(blobUrl);
        return;
      }

      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
      };
    } catch (error) {
      console.error('Errore durante la stampa del file:', error);
    }
  };

  const handleDownloadPromoZip = (promoId: string, promoName: string) => async () => {
    try {
      setDownloadingPromoId(promoId);

      const promo = filesQuery.data?.promos?.find(p => p.id === promoId);
      if (!promo || promo.kits.length === 0) {
        console.error('Nessun file disponibile per questa promozione');
        return;
      }

      // Raccogli tutti i file della promo
      const allFiles: FileItemKit[] = promo.kits.flatMap(k => k.files as FileItemKit[]);

      // Stessi header di ServerCall.post per garantire che i cookie di sessione vengano inviati
      const headers = new Headers();
      headers.append('Content-Type', 'application/json');
      headers.append('Accept', 'application/json');
      headers.append('X-Requested-With', 'XMLHttpRequest');

      const response = await fetch(`${ServerCall.getUrl()}/downloadPromoZip`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ promoId, promoName, files: allFiles }),
        cache: 'default',
      });

      if (!response.ok) {
        console.error('Errore durante il download dello ZIP', response.status);
        return;
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${promoName}.zip`;

      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (error) {
      console.error('Errore durante il download dello ZIP della promo:', error);
    } finally {
      setDownloadingPromoId(null);
    }
  };

  // Get unique stati from all promos
  const availableStati = useMemo(() => {
    if (!allPromo.data) return [];
    if (loaderData.filterType === "in-corso") {
      return [
        STATO_PROMO.PIANIFICATA,
        STATO_PROMO.IN_LAVORAZIONE,
        STATO_PROMO.IN_SCADENZA,
        STATO_PROMO.IN_ATTESA_DI_VALIDITA,
        STATO_PROMO.IN_RITARDO,
      ];
    } else if (loaderData.filterType === "attivi") {
      return [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI];
    } else if (loaderData.filterType === "storico") {
      return [STATO_PROMO.ARCHIVIATA];
    }
    return Array.from(
      new Set(allPromo.data.map((promo) => promo.stato).filter(Boolean))
    ) as STATO_PROMO[];
  }, [allPromo.data, loaderData.filterType]);

  // Count active filters - esclude idPromo se preselezionato
  const activeFiltersCount = useMemo(() => {
    const standardFiltersCount = Object.entries(filters).filter(([key, value]) => {
      if (key === 'statoPromo' && basePromoFilter.lockStatusSelect) return false;
      if (key === 'idPromo' && isPromoPreselected) return false;
      return value !== '';
    }).length;
    const metadataFilterActive = selectedMetadataKey && selectedMetadataValue ? 1 : 0;
    return standardFiltersCount + metadataFilterActive;
  }, [filters, basePromoFilter, selectedMetadataKey, selectedMetadataValue, isPromoPreselected]);

  // Trova il nome della promo selezionata (per header quando preselezionata)
  const selectedPromoName = useMemo(() => {
    if (!filters.idPromo) return null;
    const promo = promoOptions.find(p => p.id === filters.idPromo);
    return promo?.nome ?? null;
  }, [filters.idPromo, promoOptions]);

  return (
    <div className="grid grid-cols-12 gap-y-10 gap-x-6">
      <div className="col-span-12">
        {/* Header: mostra PageHeader con back button se promo preselezionata */}
        {isPromoPreselected ? (
          <div className="flex items-center gap-4 mb-4">
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleBackToPromo}
              className="shrink-0"
            >
              <Lucide icon="ArrowLeft" className="w-4 h-4" />
            </Button>
            <PageHeader
              title={selectedPromoName ? `Materiali: ${selectedPromoName}` : loaderData.title}
              description={loaderData.description}
            />
          </div>
        ) : (
          <PageHeader
            title={loaderData.title}
            description={loaderData.description}
          />
        )}

        <div className="mt-3.5">
          <div className="flex flex-col box box--stacked">
            {/* Header with stats and view controls */}
            <div className="p-5 border-b border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm text-slate-600">
                    {filesQuery.data?.totalItems || 0} file trovati
                    {activeFiltersCount > 0 && ` (${activeFiltersCount} filtri attivi)`}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline-secondary"
                    onClick={() => {
                      setFilters({
                        ...defaultFilters,
                        idPromo: preselectedPromoId,
                      });
                      setSelectedMetadataKey('');
                      setSelectedMetadataValue('');
                    }}
                  >
                    <Lucide icon="RotateCcw" className="w-4 h-4 mr-2" />
                    Reset Filtri
                  </Button>

                  <Button
                    variant={itemDisposition === ItemDisposition.grid ? "primary" : "outline-secondary"}
                    onClick={() => setItemDisposition(ItemDisposition.grid)}
                  >
                    <Lucide icon="LayoutGrid" className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={itemDisposition === ItemDisposition.list ? "primary" : "outline-secondary"}
                    onClick={() => setItemDisposition(ItemDisposition.list)}
                  >
                    <Lucide icon="List" className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Expanded Filters Section */}
            <div className="p-5 border-b border-slate-200 bg-slate-50">
              <div className="space-y-4">
                {/* Promozione Filters - nascondi se promo preselezionata */}
                {!isPromoPreselected && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1 h-5 bg-primary rounded-full"></div>
                      <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Promozione
                      </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                          Seleziona Promozione
                        </label>
                        <FormSelect
                          value={filters.idPromo}
                          onChange={(e) => setFilters({ ...filters, idPromo: e.target.value })}
                          className="w-full"
                        >
                          <option value="">Tutte le promozioni</option>
                          {promoOptions.map((promo) => (
                            <option key={promo.id} value={promo.id}>
                              {promo.nome} ({promo.stato})
                            </option>
                          ))}
                        </FormSelect>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                          Nome Promozione
                        </label>
                        <FormInput
                          type="text"
                          placeholder="Cerca per nome..."
                          value={filters.nomePromo}
                          onChange={(e) => setFilters({ ...filters, nomePromo: e.target.value })}
                          className="w-full"
                        />
                      </div>

                      {!basePromoFilter.lockStatusSelect && (
                        <div>
                          <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                            Stato
                          </label>
                          <FormSelect
                            value={filters.statoPromo}
                            onChange={(e) => setFilters({ ...filters, statoPromo: e.target.value })}
                            className="w-full"
                          >
                            {availableStati.map((stato) => (
                              <option key={stato} value={stato}>
                                {stato.replace(/_/g, " ").toLowerCase().split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                              </option>
                            ))}
                          </FormSelect>
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                          Validità Da
                        </label>
                        <FormInput
                          type="date"
                          value={filters.validitaDal}
                          onChange={(e) => setFilters({ ...filters, validitaDal: e.target.value })}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                          Validità A
                        </label>
                        <FormInput
                          type="date"
                          value={filters.validitaAl}
                          onChange={(e) => setFilters({ ...filters, validitaAl: e.target.value })}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* File Filters */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1 h-5 bg-primary rounded-full"></div>
                    <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                      File
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                    {/* Campo Metadata - sostituisce Nome File / Metadata */}
                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Campo Metadata
                      </label>
                      <FormSelect
                        value={selectedMetadataKey}
                        onChange={(e) => {
                          setSelectedMetadataKey(e.target.value);
                          setSelectedMetadataValue('');
                        }}
                        className="w-full"
                      >
                        <option value="">Seleziona campo</option>
                        {metadataFields.map((field) => {
                          // Mostra solo l'ultimo segmento del path
                          const parts = field.split('.');
                          const label = parts[parts.length - 1];
                          return (
                            <option key={field} value={field}>
                              {label.charAt(0).toUpperCase() + label.slice(1)}
                            </option>
                          );
                        })}
                      </FormSelect>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Valore Metadata
                      </label>
                      <MetadataValueInput
                        field={selectedMetadataKey}
                        value={selectedMetadataValue}
                        onChange={setSelectedMetadataValue}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Area
                      </label>
                      <FormSelect
                        value={filters.idArea}
                        onChange={(e) => setFilters({ ...filters, idArea: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Tutte</option>
                        {allArea.data?.map((area) => (
                          <option key={area.id} value={area.id}>{area.nome}</option>
                        ))}
                      </FormSelect>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Canale
                      </label>
                      <FormSelect
                        value={filters.idCanale}
                        onChange={(e) => setFilters({ ...filters, idCanale: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Tutti</option>
                        {allCanale.data?.map((canale) => (
                          <option key={canale.id} value={canale.id}>{canale.nome}</option>
                        ))}
                      </FormSelect>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Tipo Export
                      </label>
                      <FormSelect
                        value={filters.idTipoExport}
                        onChange={(e) => setFilters({ ...filters, idTipoExport: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Tutti</option>
                        {allTipoExport.data?.filter((tipo_expot) => tipo_expot.codice !== "WEB" && tipo_expot.codice !== EXPORT_DI_SISTEMA.CORREGGO).map((tipo_expot) => (
                          <option key={tipo_expot.id} value={tipo_expot.id}>{tipo_expot.nome}</option>
                        ))}
                      </FormSelect>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-700 mb-1.5 block">
                        Formato
                      </label>
                      <FormSelect
                        value={filters.idFormato}
                        onChange={(e) => setFilters({ ...filters, idFormato: e.target.value })}
                        className="w-full"
                      >
                        <option value="">Tutti</option>
                        {allFormato.data?.map((formato) => (
                          <option key={formato.id} value={formato.id}>{formato.nome}</option>
                        ))}
                      </FormSelect>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Files List */}
            {filesQuery.isLoading ? (
              <div className="p-5">
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton height="32px" width="35%" className="rounded mb-1" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {[1, 2, 3, 4].map((j) => (
                          <Skeleton key={j} height="160px" className="rounded" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : !filesQuery.data || !filesQuery.data.promos || filesQuery.data.promos.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon="FileX"
                  title="Nessun file trovato"
                  description="Non ci sono file disponibili con i filtri selezionati"
                />
              </div>
            ) : (
              <div className="p-5">
                {(() => {
                  const promos = filesQuery.data?.promos ?? [];
                  const promosToRender = filters.idPromo
                    ? promos.filter((promo) => promo.id === filters.idPromo)
                    : promos;
                  const areFiltersEmpty = Object.values(filters).every((value) => value === "");
                  if (promosToRender.length === 0 && areFiltersEmpty) {
                    return (
                      <EmptyState
                        icon="FolderX"
                        title="Nessuna promozione trovata"
                        description="Non ci sono promozioni attive in questo momento."
                      />
                    );
                  }
                  if (promosToRender.length === 0 && !areFiltersEmpty) {
                    return (
                      <EmptyState
                        icon="FolderX"
                        title="Nessuna promozione trovata"
                        description="Prova a modificare i filtri per visualizzare i file disponibili."
                      />
                    );
                  }

                  return promosToRender.map((promo) => {
                    const hasFiles = promo.kits && promo.kits.length > 0;

                    return (
                      <div key={promo.id} className="mb-8 last:mb-0">
                        <div className="mb-4 pb-3 border-b border-slate-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-lg font-semibold text-slate-800">
                                {promo.nome}
                              </h3>
                              <div className="flex items-center gap-3 mt-1 text-sm text-slate-600">
                                <span className="flex items-center">
                                  <Lucide icon="Calendar" className="w-4 h-4 mr-1" />
                                  {new Date(promo.validita_dal).toLocaleDateString('it-IT')}
                                  {' - '}
                                  {new Date(promo.validita_al).toLocaleDateString('it-IT')}
                                </span>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                  {promo.stato
                                    ? promo.stato
                                      .toLowerCase()
                                      .replace(/_/g, " ")
                                      .replace(/^\w/, (char) => char.toUpperCase())
                                    : ""}
                                </span>
                              </div>
                            </div>
                            {hasFiles && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={handleDownloadPromoZip(promo.id, promo.nome)}
                                disabled={downloadingPromoId === promo.id}
                              >
                                {downloadingPromoId === promo.id ? (
                                  <>
                                    <Lucide icon="Loader" className="w-4 h-4 mr-2 animate-spin" />
                                    Download in corso...
                                  </>
                                ) : (
                                  <>
                                    <Lucide icon="Download" className="w-4 h-4 mr-2" />
                                    Scarica tutti i file come ZIP
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>

                        {!hasFiles ? (
                          <div className="p-4 bg-slate-50 rounded-md border border-slate-200">
                            <p className="text-sm text-slate-600 text-center">
                              <Lucide icon="FileX" className="w-5 h-5 inline-block mr-2" />
                              Nessun file disponibile per questa promozione
                            </p>
                          </div>
                        ) : (
                          promo.kits.map((kit) => {
                            const files = kit.files as FileItemKit[];

                            return (
                              <div key={kit.id} className="mb-4 last:mb-0 rounded-lg border border-slate-200 overflow-hidden">
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                                  <Lucide icon="Package" className="w-4 h-4 text-primary shrink-0" />
                                  <h4 className="text-sm font-semibold text-slate-700 truncate">
                                    {kit.nome}
                                  </h4>
                                  <span className="ml-auto text-xs text-slate-400 shrink-0">
                                    {files.length} {files.length === 1 ? 'file' : 'file'}
                                  </span>
                                </div>

                                {itemDisposition === ItemDisposition.grid ? (
                                  <div className="p-3 max-h-64 sm:max-h-72 md:max-h-80 lg:max-h-96 overflow-y-auto">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {files.map((file, idx) => (
                                        <div
                                          key={idx}
                                          className="flex flex-col p-3 bg-slate-50 rounded-md hover:bg-slate-100 transition-colors border border-slate-200"
                                        >
                                          <div
                                            className="w-full h-32 flex items-center justify-center rounded bg-white border border-slate-200 overflow-hidden mb-2 cursor-pointer"
                                            onClick={() => {
                                              if (file.url) {
                                                setLightboxImage(file.url);
                                                setPagesLightBoxImage(file.pages ?? null)
                                              }
                                            }}
                                          >
                                            {file.url ? (
                                              <img
                                                src={file.url}
                                                alt={file.nome}
                                                className="w-full h-full object-scale-down"
                                                loading="lazy"
                                              />
                                            ) : (
                                              <Lucide
                                                icon={getFileIcon(file.nome)}
                                                className="w-10 h-10 stroke-[1.5] text-slate-400"
                                              />
                                            )}
                                          </div>
                                          <div className="text-xs font-medium text-slate-700 truncate mb-1">
                                            {file.nome.split(' (Lavorazione:')[0]}
                                          </div>
                                          {file.tipo_export_codice && (
                                            <div className="text-xs text-slate-500 truncate mb-2">
                                              {file.tipo_export_codice}
                                            </div>
                                          )}
                                          <div className="flex flex-col gap-2 mt-2">
                                            <Button
                                              onClick={handleDownloadSingleFile(file)}
                                              variant="outline-secondary"
                                              className="text-xs"
                                              size="sm"
                                            >
                                              <Lucide icon="Download" className="w-3 h-3 mr-1" />
                                              Scarica
                                            </Button>
                                            <Button
                                              onClick={handlePrintSingleFile(file)}
                                              variant="outline-secondary"
                                              size="sm"
                                              className="text-xs"
                                            >
                                              <Lucide icon="Printer" className="w-4 h-4 mr-1" />
                                              Stampa
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="max-h-64 sm:max-h-72 md:max-h-80 lg:max-h-96 overflow-y-auto">
                                    <div className="divide-y divide-slate-200">
                                      {files.map((file, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center py-3 hover:bg-slate-50 transition-colors px-2 rounded-md"
                                        >
                                          <div
                                            className="flex items-center justify-center w-10 h-10 mr-3 bg-white rounded border border-slate-200 cursor-pointer flex-shrink-0"
                                            onClick={() => {
                                              if (file.url) {
                                                setLightboxImage(file.url);
                                                setPagesLightBoxImage(file.pages ?? null)
                                              }
                                            }}
                                          >
                                            {file.url ? (
                                              <img
                                                src={file.url}
                                                alt={file.nome}
                                                className="w-full h-full object-contain p-1"
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
                                              {file.nome.split(' (Lavorazione:')[0]}
                                            </div>
                                            {file.tipo_export_codice && (
                                              <div className="text-xs text-slate-500">
                                                {file.tipo_export_codice}
                                              </div>
                                            )}
                                          </div>
                                          <Button
                                            onClick={handleDownloadSingleFile(file)}
                                            variant="outline-secondary"
                                            size="sm"
                                            className="ml-2 text-xs whitespace-nowrap"
                                          >
                                            <Lucide icon="Download" className="w-4 h-4 mr-1" />
                                            Scarica
                                          </Button>
                                          <Button
                                            onClick={handlePrintSingleFile(file)}
                                            variant="outline-secondary"
                                            size="sm"
                                            className="ml-2 text-xs whitespace-nowrap"
                                          >
                                            <Lucide icon="Printer" className="w-4 h-4 mr-1" />
                                            Stampa
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Lightbox */}
        {lightboxImage && (
          <PreviewImmaginePdf
            imageUrl={lightboxImage}
            onClose={() => {
              setLightboxImage(null);
              setPagesLightBoxImage(null);
            }}
            totalPages={pagesLightBoxImage || 1}
          />
        )}
      </div>
    </div>
  );
};

export default withSessionCheck(MaterialiDocumentale);
