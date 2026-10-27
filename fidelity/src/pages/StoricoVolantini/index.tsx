import BarraFiltri from "@/components/Base/BarraFiltri";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import PageError from "@/components/Base/PageError";
import Pagina from "@/components/Base/Pagina";
import PaginazioneTabella from "@/components/Base/PaginazioneTabella";
import Sezione from "@/components/Base/Sezione";
import Spinner from "@/components/Base/Spinner";
import StatCard, { StatCardGrid } from "@/components/Base/StatCard";
import TomSelect from "@/components/Base/TomSelect";
import EmptyState from "@/components/EmptyState";
import withSessionCheck from "@/components/SessionChecker";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import { AreaResponseDTO, CanaleResponseDTO } from "../../../server/core/dto";
import { PERMISSIONS } from "../../constants/permissions";
import { usePermission } from "../../context/PermissionContext";
import CardVolantino from "../shared/CardVolantino";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface FileAnteprima {
    id: string;
    nome: string;
    nome_originale?: string;
    tipo_export?: string;
    id_olimpo_cloud?: string;
    thumbnailUrl?: string;
    mime?: string;
    pages?: number;
    url?: string;
}

interface KitVolantino {
    id: string;
    titolo: string;
    nome_area?: string;
    nome_canale?: string;
    stato_lavorazione: string;
    nome_promo: string;
    id_promo?: string;
    validita_dal?: string;
    validita_al?: string;
    files: FileAnteprima[];
}

interface StoricoVolantiniResponse {
    totale: number;
    kit: KitVolantino[];
}

interface CardFilter {
    id_area: string;
    id_canale: string;
}

// Componente principale
const StoricoVolantiniPage = () => {
    // Stato per i dati
    const [data, setData] = useState<StoricoVolantiniResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Motivo dell'ultimo caricamento fallito, null se è andato a buon fine
    const [errore, setErrore] = useState<string | null>(null);

    // Stato per aree e canali
    const [aree, setAree] = useState<AreaResponseDTO[]>([]);
    const [canali, setCanali] = useState<CanaleResponseDTO[]>([]);

    // Filtri
    const [filter, setFilter] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [isFiltering, setIsFiltering] = useState(false);

    // Stato paginazione
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Helper per costruire query string
    const buildQueryString = useCallback((filter: CardFilter) => {
        const params = new URLSearchParams();
        if (filter.id_area) params.set("id_area", filter.id_area);
        if (filter.id_canale) params.set("id_canale", filter.id_canale);
        const queryString = params.toString();
        return queryString ? `?${queryString}` : "";
    }, []);

    // Carica i dati iniziali
    const fetchData = useCallback(async (currentFilter: CardFilter) => {
        setIsFiltering(true);
        try {
            const response = await ServerCall.get<StoricoVolantiniResponse>(
                `/dashboard/storico-volantini${buildQueryString(currentFilter)}`
            );
            setData(response);
            setErrore(null);
        } catch (error) {
            console.error("Errore caricamento storico volantini:", error);
            setErrore((error as Error)?.message || "Si è verificato un errore durante il caricamento dello storico.");
        } finally {
            setIsFiltering(false);
            setIsLoading(false);
        }
    }, [buildQueryString]);

    // Carica aree e canali
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [areeData, canaliData] = await Promise.all([
                    ServerCall.get<AreaResponseDTO[]>("/aree"),
                    ServerCall.get<CanaleResponseDTO[]>("/canali")
                ]);
                setAree(areeData || []);
                setCanali(canaliData || []);
            } catch (error) {
                console.error("Errore caricamento aree/canali:", error);
            }
        };

        loadInitialData();
        fetchData(filter);
    }, []);

    // Cambiando le righe per pagina si riparte dalla prima pagina
    const handlePageSizeChange = useCallback((dimensione: number) => {
        setPageSize(dimensione);
        setCurrentPage(1);
    }, []);

    // Handler per cambio filtri
    const handleFilterChange = useCallback((newFilter: CardFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        fetchData(newFilter);
    }, [fetchData]);

    // Refetch
    const refetch = useCallback(() => {
        setIsLoading(true);
        fetchData(filter);
    }, [filter, fetchData]);

    // Paginazione client-side sui dati già ricevuti
    const paginatedKits = useMemo(() => {
        if (!data?.kit) return [];
        const startIndex = (currentPage - 1) * pageSize;
        return data.kit.slice(startIndex, startIndex + pageSize);
    }, [data?.kit, currentPage, pageSize]);

    const totalPages = useMemo(() => {
        if (!data?.kit) return 0;
        return Math.ceil(data.kit.length / pageSize);
    }, [data?.kit, pageSize]);

    const hasActiveFilters = filter.id_area || filter.id_canale;

    const canAccessPromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
    const descrizione = "Panoramica completa di tutti i volantini pubblicati dalle promozioni scadute.";

    if (isLoading) {
        return (
            <Pagina titolo="Storico volantini" descrizione={descrizione}>
                <div className="flex justify-center py-16">
                    <Spinner size="lg" etichetta="Caricamento dello storico volantini" />
                </div>
            </Pagina>
        );
    }

    if (errore) {
        return (
            <Pagina titolo="Storico volantini" descrizione={descrizione}>
                <PageError compatta titolo="Storico non caricato" motivo={errore} onRiprova={refetch} />
            </Pagina>
        );
    }

    return (
        <Pagina titolo="Storico volantini" descrizione={descrizione}>
            <StatCardGrid className="lg:grid-cols-3">
                <StatCard densita="compatta" icona="History" tono="info" etichetta="Volantini totali" valore={data?.totale || 0} />
                <StatCard densita="compatta" icona="FileStack" tono="brand" etichetta="In questa pagina" valore={paginatedKits.length} />
                <StatCard densita="compatta" icona="BookOpen" tono="success" etichetta="Pagine totali" valore={totalPages} />
            </StatCardGrid>

            <Sezione senzaPadding aria-label="Volantini pubblicati" aria-busy={isFiltering || undefined}>
                <BarraFiltri
                    destra={
                        hasActiveFilters ? (
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleFilterChange({ id_area: "", id_canale: "" })}
                                disabled={isFiltering}
                            >
                                <Lucide icon="X" aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                                Azzera filtri
                            </Button>
                        ) : undefined
                    }
                >
                    <div className="w-full sm:w-48">
                        <TomSelect
                            id="filter-area-storico"
                            aria-label="Area"
                            value={filter.id_area}
                            onChange={(e) => handleFilterChange({ ...filter, id_area: e.target.value })}
                            disabled={isFiltering}
                            options={{
                                placeholder: "Area",
                                allowEmptyOption: true
                            }}
                            className={clsx(isFiltering && "opacity-50")}
                        >
                            <option value="">Tutte le aree</option>
                            {aree.map((area) => (
                                <option key={area.id} value={area.id}>
                                    {area.nome}
                                </option>
                            ))}
                        </TomSelect>
                    </div>
                    <div className="w-full sm:w-48">
                        <TomSelect
                            id="filter-canale-storico"
                            aria-label="Canale"
                            value={filter.id_canale}
                            onChange={(e) => handleFilterChange({ ...filter, id_canale: e.target.value })}
                            disabled={isFiltering}
                            options={{
                                placeholder: "Canale",
                                allowEmptyOption: true
                            }}
                            className={clsx(isFiltering && "opacity-50")}
                        >
                            <option value="">Tutti i canali</option>
                            {canali.map((canale) => (
                                <option key={canale.id} value={canale.id}>
                                    {canale.nome}
                                </option>
                            ))}
                        </TomSelect>
                    </div>
                </BarraFiltri>

                {/* Lista volantini */}
                <div className={clsx("transition-opacity duration-150", isFiltering && "pointer-events-none opacity-50")}>
                    {!data?.kit || data.kit.length === 0 ? (
                        <EmptyState
                            compatta
                            icon={hasActiveFilters ? "SearchX" : "Archive"}
                            title={hasActiveFilters ? "Nessun risultato" : "Non ci sono volantini archiviati"}
                            description={hasActiveFilters
                                ? "Nessun volantino trovato con i filtri selezionati. Prova a modificare i filtri."
                                : "Appena pubblicherai un kit troverai qui i file e le anteprime."
                            }
                        />
                    ) : (
                        <ul className="space-y-3 p-5">
                            {paginatedKits.map((kit) => {
                                const file = kit.files?.[0];
                                return (
                                    <li key={kit.id}>
                                        <CardVolantino
                                            titolo={kit.titolo}
                                            stato={kit.stato_lavorazione}
                                            nomeArea={kit.nome_area}
                                            nomeCanale={kit.nome_canale}
                                            file={
                                                file && {
                                                    nome: file.nome,
                                                    anteprima: file.url ?? file.thumbnailUrl,
                                                    idOlimpoCloud: file.id_olimpo_cloud,
                                                    tipoExport: file.tipo_export,
                                                    mime: file.mime,
                                                    pagine: file.pages,
                                                }
                                            }
                                            validitaDal={kit.validita_dal}
                                            validitaAl={kit.validita_al}
                                            collegamento={
                                                canAccessPromo && kit.id_promo
                                                    ? `/promozioni/in-corso/dettagli/${kit.id_promo}/kits/${kit.id}`
                                                    : undefined
                                            }
                                            promo={{
                                                nome: kit.nome_promo,
                                                collegamento: canAccessPromo ? `/promozioni/in-corso/dettagli/${kit.id_promo}` : undefined,
                                            }}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <PaginazioneTabella
                    totale={data?.kit?.length ?? 0}
                    pagina={currentPage}
                    dimensionePagina={pageSize}
                    onCambiaPagina={setCurrentPage}
                    onCambiaDimensione={handlePageSizeChange}
                    opzioniDimensione={PAGE_SIZE_OPTIONS}
                />
            </Sezione>
        </Pagina>
    );
};

export default withSessionCheck(StoricoVolantiniPage);
