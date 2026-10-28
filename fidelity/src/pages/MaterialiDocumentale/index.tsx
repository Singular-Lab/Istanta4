/* eslint-disable no-console */
import Button from "@/components/Base/Button";
import { FormField, FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
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
import { usePromoName } from "@/hooks/usePromoName";
import { descriviStato } from "@/constants/stati";
import { formatData, formatNumero } from "@/utils/format";

export interface MaterialiDocumentaleLoaderData {
  title: string;
  description: string;
  filterType: 'attivi' | 'in-corso' | 'storico';
  preselectedPromoId?: string;
}

// Soglia per determinare se mostrare select o text input
const MAX_VALUES_FOR_SELECT = 5;

// Attributi che FormField passa al campo per collegarlo a etichetta, aiuto ed errore
type AttributiCampo = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

// Componente per l'input del valore metadata (Select o TextInput in base al numero di valori)
interface MetadataValueInputProps extends AttributiCampo {
  field: string;
  value: string;
  onChange: (value: string) => void;
}

const MetadataValueInput: React.FC<MetadataValueInputProps> = ({ field, value, onChange, ...attributi }) => {
  const { data: fieldValues = [], isLoading } = useFetchFilesFieldValues(field, !!field);

  // Se non c'è un campo selezionato, mostra input disabilitato
  if (!field) {
    return (
      <FormInput
        {...attributi}
        type="text"
        placeholder="Seleziona prima un campo…"
        value=""
        disabled
      />
    );
  }

  // Se sta caricando o ci sono troppi valori o nessun valore, mostra TextInput
  if (isLoading || fieldValues.length === 0 || fieldValues.length > MAX_VALUES_FOR_SELECT) {
    return (
      <FormInput
        {...attributi}
        type="text"
        placeholder={isLoading ? "Caricamento valori…" : "Inserisci valore…"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
      />
    );
  }

  // Altrimenti mostra select con i valori disponibili
  return (
    <FormSelect
      {...attributi}
      value={value}
      onChange={(e) => onChange(e.target.value)}
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
    // Promo aperta dal suo dettaglio: i materiali si vedono in qualunque stato sia
    if (isPromoPreselected) return {};
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
  }, [loaderData.filterType, isPromoPreselected]);

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
    if (isPromoPreselected) return [preselectedPromoId];
    if (!promoOptions.length) return [];
    let promos = promoOptions;

    if (filters.idPromo) {
      promos = promos.filter(p => p.id === filters.idPromo);
    }

    return promos.map(p => p.id);
  }, [promoOptions, filters.idPromo, isPromoPreselected, preselectedPromoId]);

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
      headers.append('x-csrf-token', (await ServerCall.ensureCSRFToken()) ?? '');

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
  const { data: preselectedPromoName } = usePromoName({ promoId: preselectedPromoId, enabled: isPromoPreselected });
  const selectedPromoName = useMemo(() => {
    if (!filters.idPromo) return null;
    const promo = promoOptions.find(p => p.id === filters.idPromo);
    return promo?.nome ?? preselectedPromoName ?? null;
  }, [filters.idPromo, promoOptions, preselectedPromoName]);

  const azzeraFiltri = () => {
    setFilters({
      ...defaultFilters,
      idPromo: preselectedPromoId,
    });
    setSelectedMetadataKey('');
    setSelectedMetadataValue('');
  };

  const nomeFile = (file: FileItemKit) => file.nome.split(' (Lavorazione:')[0];

  const apriAnteprima = (file: FileItemKit) => {
    if (file.url) {
      setLightboxImage(file.url);
      setPagesLightBoxImage(file.pages ?? null);
    }
  };

  const conteggioFile = `${formatNumero(filesQuery.data?.totalItems || 0)} file trovati${
    activeFiltersCount > 0 ? ` · ${activeFiltersCount} ${activeFiltersCount === 1 ? "filtro attivo" : "filtri attivi"}` : ""
  }`;

  return (
    <>
      {/* Con la promo preselezionata il titolo la nomina e l'indietro riporta alla promo */}
      <Pagina
        titolo={isPromoPreselected && selectedPromoName ? `Materiali: ${selectedPromoName}` : loaderData.title}
        descrizione={loaderData.description}
        indietro={isPromoPreselected ? { onClick: handleBackToPromo, etichetta: "Torna alla promo" } : undefined}
      >
        <Sezione
          titolo="File disponibili"
          descrizione={conteggioFile}
          azioni={
            <>
              <Button type="button" variant="outline-secondary" size="sm" onClick={azzeraFiltri}>
                <Lucide icon="RotateCcw" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                Azzera filtri
              </Button>
              <Button
                type="button"
                size="sm"
                variant={itemDisposition === ItemDisposition.grid ? "primary" : "outline-secondary"}
                onClick={() => setItemDisposition(ItemDisposition.grid)}
                aria-label="Vista griglia"
                aria-pressed={itemDisposition === ItemDisposition.grid}
                title="Vista griglia"
              >
                <Lucide icon="LayoutGrid" aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant={itemDisposition === ItemDisposition.list ? "primary" : "outline-secondary"}
                onClick={() => setItemDisposition(ItemDisposition.list)}
                aria-label="Vista elenco"
                aria-pressed={itemDisposition === ItemDisposition.list}
                title="Vista elenco"
              >
                <Lucide icon="List" aria-hidden="true" className="h-3.5 w-3.5" />
              </Button>
            </>
          }
        >
          {/* Filtri: dentro la sezione che filtrano */}
          <div className="mb-5 space-y-5 border-b border-dashed border-slate-200 pb-5">
            {/* Filtri della promozione: nascosti se la promo è preselezionata */}
            {!isPromoPreselected && (
              <fieldset>
                <legend className="title-card mb-3">Promozione</legend>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <FormField etichetta="Promozione">
                    <FormSelect
                      value={filters.idPromo}
                      onChange={(e) => setFilters({ ...filters, idPromo: e.target.value })}
                    >
                      <option value="">Tutte le promozioni</option>
                      {promoOptions.map((promo) => (
                        <option key={promo.id} value={promo.id}>
                          {promo.nome} ({descriviStato("promo", promo.stato).etichetta})
                        </option>
                      ))}
                    </FormSelect>
                  </FormField>

                  <FormField etichetta="Nome della promozione">
                    <FormInput
                      type="text"
                      placeholder="Cerca per nome…"
                      value={filters.nomePromo}
                      onChange={(e) => setFilters({ ...filters, nomePromo: e.target.value })}
                    />
                  </FormField>

                  {!basePromoFilter.lockStatusSelect && (
                    <FormField etichetta="Stato">
                      <FormSelect
                        value={filters.statoPromo}
                        onChange={(e) => setFilters({ ...filters, statoPromo: e.target.value })}
                      >
                        {availableStati.map((stato) => (
                          <option key={stato} value={stato}>
                            {descriviStato("promo", stato).etichetta}
                          </option>
                        ))}
                      </FormSelect>
                    </FormField>
                  )}

                  <FormField etichetta="Validità dal">
                    <FormInput
                      type="date"
                      value={filters.validitaDal}
                      onChange={(e) => setFilters({ ...filters, validitaDal: e.target.value })}
                    />
                  </FormField>

                  <FormField etichetta="Validità al">
                    <FormInput
                      type="date"
                      value={filters.validitaAl}
                      onChange={(e) => setFilters({ ...filters, validitaAl: e.target.value })}
                    />
                  </FormField>
                </div>
              </fieldset>
            )}

            {/* Filtri dei file */}
            <fieldset>
              <legend className="title-card mb-3">File</legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {/* Campo metadata: sostituisce Nome file / Metadata */}
                <FormField etichetta="Campo metadata">
                  <FormSelect
                    value={selectedMetadataKey}
                    onChange={(e) => {
                      setSelectedMetadataKey(e.target.value);
                      setSelectedMetadataValue('');
                    }}
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
                </FormField>

                <FormField etichetta="Valore metadata">
                  <MetadataValueInput
                    field={selectedMetadataKey}
                    value={selectedMetadataValue}
                    onChange={setSelectedMetadataValue}
                  />
                </FormField>

                <FormField etichetta="Area">
                  <FormSelect
                    value={filters.idArea}
                    onChange={(e) => setFilters({ ...filters, idArea: e.target.value })}
                  >
                    <option value="">Tutte</option>
                    {allArea.data?.map((area) => (
                      <option key={area.id} value={area.id}>{area.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField etichetta="Canale">
                  <FormSelect
                    value={filters.idCanale}
                    onChange={(e) => setFilters({ ...filters, idCanale: e.target.value })}
                  >
                    <option value="">Tutti</option>
                    {allCanale.data?.map((canale) => (
                      <option key={canale.id} value={canale.id}>{canale.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField etichetta="Tipo export">
                  <FormSelect
                    value={filters.idTipoExport}
                    onChange={(e) => setFilters({ ...filters, idTipoExport: e.target.value })}
                  >
                    <option value="">Tutti</option>
                    {allTipoExport.data?.filter((tipo_expot) => tipo_expot.codice !== "WEB" && tipo_expot.codice !== EXPORT_DI_SISTEMA.CORREGGO).map((tipo_expot) => (
                      <option key={tipo_expot.id} value={tipo_expot.id}>{tipo_expot.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>

                <FormField etichetta="Formato">
                  <FormSelect
                    value={filters.idFormato}
                    onChange={(e) => setFilters({ ...filters, idFormato: e.target.value })}
                  >
                    <option value="">Tutti</option>
                    {allFormato.data?.map((formato) => (
                      <option key={formato.id} value={formato.id}>{formato.nome}</option>
                    ))}
                  </FormSelect>
                </FormField>
              </div>
            </fieldset>
          </div>

          {/* Elenco dei file */}
          {filesQuery.isLoading ? (
            <div className="space-y-4" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-3">
                  <Skeleton height="32px" width="35%" className="mb-1 rounded-control" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                    {[1, 2, 3, 4].map((j) => (
                      <Skeleton key={j} height="160px" className="rounded-control" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : filesQuery.isError && !filesQuery.data ? (
            <PageError
              compatta
              titolo="Impossibile caricare i file"
              motivo={filesQuery.error?.message || "Il servizio non ha restituito i file."}
              onRiprova={() => filesQuery.refetch()}
            />
          ) : !filesQuery.data || !filesQuery.data.promos || filesQuery.data.promos.length === 0 ? (
            <EmptyState
              compatta
              icon="FileX"
              title="Nessun file trovato"
              description="Non ci sono file disponibili con i filtri selezionati"
            />
          ) : (
            (() => {
              const promos = filesQuery.data?.promos ?? [];
              const promosToRender = filters.idPromo
                ? promos.filter((promo) => promo.id === filters.idPromo)
                : promos;
              const areFiltersEmpty = Object.values(filters).every((value) => value === "");
              if (promosToRender.length === 0) {
                return (
                  <EmptyState
                    compatta
                    icon="FolderX"
                    title="Nessuna promozione trovata"
                    description={
                      areFiltersEmpty
                        ? "Non ci sono promozioni attive in questo momento."
                        : "Prova a modificare i filtri per visualizzare i file disponibili."
                    }
                  />
                );
              }

              return (
                <div className="space-y-8">
                  {promosToRender.map((promo) => {
                    const hasFiles = promo.kits && promo.kits.length > 0;

                    return (
                      <div key={promo.id}>
                        <div className="mb-4 flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="title-card">{promo.nome}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                              <span className="flex items-center tabular-nums">
                                <Lucide icon="Calendar" aria-hidden="true" className="mr-1.5 h-4 w-4" />
                                {formatData(promo.validita_dal)}
                                {' – '}
                                {formatData(promo.validita_al)}
                              </span>
                              <StatusBadge dominio="promo" stato={promo.stato} />
                            </div>
                          </div>
                          {hasFiles && (
                            <Button
                              type="button"
                              variant="primary"
                              size="sm"
                              onClick={handleDownloadPromoZip(promo.id, promo.nome)}
                              disabled={downloadingPromoId === promo.id}
                              loading={downloadingPromoId === promo.id}
                            >
                              {downloadingPromoId !== promo.id && (
                                <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Scarica tutti i file come ZIP
                            </Button>
                          )}
                        </div>

                        {!hasFiles ? (
                          <EmptyState
                            compatta
                            icon="FileX"
                            title="Nessun file disponibile per questa promozione"
                            description=""
                            className="border border-slate-200"
                          />
                        ) : (
                          <div className="space-y-4">
                            {promo.kits.map((kit) => {
                              const files = kit.files as FileItemKit[];

                              return (
                                <div key={kit.id} className="overflow-hidden rounded-card border border-slate-200 bg-white">
                                  <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                                    <Lucide icon="Package" aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />
                                    <h4 className="title-card truncate">{kit.nome}</h4>
                                    <span className="ml-auto shrink-0 text-xs tabular-nums text-slate-500">
                                      {formatNumero(files.length)} file
                                    </span>
                                  </div>

                                  {itemDisposition === ItemDisposition.grid ? (
                                    <div className="max-h-64 overflow-y-auto p-4 sm:max-h-72 md:max-h-80 lg:max-h-96">
                                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                                        {files.map((file, idx) => (
                                          <div
                                            key={idx}
                                            className="flex flex-col rounded-control border border-slate-200 bg-slate-50 p-3 transition-colors hover:bg-slate-100"
                                          >
                                            <button
                                              type="button"
                                              aria-label={`Anteprima ${file.nome}`}
                                              disabled={!file.url}
                                              className="mb-2 flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-control border border-slate-200 bg-white disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                                              onClick={() => apriAnteprima(file)}
                                            >
                                              {file.url ? (
                                                <img
                                                  src={file.url}
                                                  alt={file.nome}
                                                  className="h-full w-full object-scale-down"
                                                  loading="lazy"
                                                />
                                              ) : (
                                                <Lucide
                                                  icon={getFileIcon(file.nome)}
                                                  aria-hidden="true"
                                                  className="h-10 w-10 stroke-[1.5] text-slate-400"
                                                />
                                              )}
                                            </button>
                                            <div className="mb-1 truncate text-xs font-medium text-slate-700" title={nomeFile(file)}>
                                              {nomeFile(file)}
                                            </div>
                                            {file.tipo_export_codice && (
                                              <div className="mb-2 truncate text-xs text-slate-500">
                                                {file.tipo_export_codice}
                                              </div>
                                            )}
                                            <div className="mt-2 flex flex-col gap-2">
                                              <Button type="button" onClick={handleDownloadSingleFile(file)} variant="outline-secondary" size="sm">
                                                <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                                Scarica
                                              </Button>
                                              <Button type="button" onClick={handlePrintSingleFile(file)} variant="outline-secondary" size="sm">
                                                <Lucide icon="Printer" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                                Stampa
                                              </Button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto sm:max-h-72 md:max-h-80 lg:max-h-96">
                                      {files.map((file, idx) => (
                                        <div
                                          key={idx}
                                          className="flex items-center gap-2 px-4 py-3 transition-colors hover:bg-slate-50"
                                        >
                                          <button
                                            type="button"
                                            aria-label={`Anteprima ${file.nome}`}
                                            disabled={!file.url}
                                            className="mr-1 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-control border border-slate-200 bg-white disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-1/40"
                                            onClick={() => apriAnteprima(file)}
                                          >
                                            {file.url ? (
                                              <img
                                                src={file.url}
                                                alt={file.nome}
                                                className="h-full w-full object-contain p-1"
                                                loading="lazy"
                                              />
                                            ) : (
                                              <Lucide
                                                icon={getFileIcon(file.nome)}
                                                aria-hidden="true"
                                                className="h-5 w-5 stroke-[1.5] text-slate-400"
                                              />
                                            )}
                                          </button>
                                          <div className="min-w-0 flex-grow">
                                            <div className="truncate text-sm font-medium text-slate-700" title={nomeFile(file)}>
                                              {nomeFile(file)}
                                            </div>
                                            {file.tipo_export_codice && (
                                              <div className="text-xs text-slate-500">{file.tipo_export_codice}</div>
                                            )}
                                          </div>
                                          <Button
                                            type="button"
                                            onClick={handleDownloadSingleFile(file)}
                                            variant="outline-secondary"
                                            size="sm"
                                            className="whitespace-nowrap"
                                          >
                                            <Lucide icon="Download" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                            Scarica
                                          </Button>
                                          <Button
                                            type="button"
                                            onClick={handlePrintSingleFile(file)}
                                            variant="outline-secondary"
                                            size="sm"
                                            className="whitespace-nowrap"
                                          >
                                            <Lucide icon="Printer" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                            Stampa
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          )}
        </Sezione>
      </Pagina>

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
    </>
  );
};

export default withSessionCheck(MaterialiDocumentale);
