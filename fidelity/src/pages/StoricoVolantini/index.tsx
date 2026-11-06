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
import { useCallback, useEffect, useRef, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type { PaginaVolantiniConsultazione } from "../../../lib/consultazione/tipi";
import { percorsoDettaglioVolantino } from "../../../lib/materiali/periodi";
import { urlVolantiniConsultazione } from "../../query/consultazione";
import { PERMISSIONS } from "../../constants/permissions";
import { usePermission } from "../../context/PermissionContext";
import CardVolantino from "../shared/CardVolantino";
import { areeECanaliDaCombinazioni, type CombinazioneConNomi, type OpzioneFiltro } from "./filtriAreeCanali";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface CardFilter {
    id_area: string;
    id_canale: string;
}

// Componente principale
const StoricoVolantiniPage = () => {
    // Una pagina dei volantini pubblicati dello storico (promo archiviate della GDO)
    const [data, setData] = useState<PaginaVolantiniConsultazione | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    // Motivo dell'ultimo caricamento fallito, null se è andato a buon fine
    const [errore, setErrore] = useState<string | null>(null);

    // Stato per aree e canali
    const [aree, setAree] = useState<OpzioneFiltro[]>([]);
    const [canali, setCanali] = useState<OpzioneFiltro[]>([]);

    // Filtri
    const [filter, setFilter] = useState<CardFilter>({ id_area: "", id_canale: "" });
    const [isFiltering, setIsFiltering] = useState(false);

    // Stato paginazione: le pagine le taglia il server
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    // Solo l'ultima richiesta aggiorna la pagina: una risposta lenta non sovrascrive quelle dopo
    const ultimaRichiesta = useRef(0);

    const fetchData = useCallback(async (currentFilter: CardFilter, pagina: number, dimensione: number) => {
        const richiesta = ++ultimaRichiesta.current;
        setIsFiltering(true);
        try {
            const response = await ServerCall.get<PaginaVolantiniConsultazione>(urlVolantiniConsultazione(
                "storico",
                { idArea: currentFilter.id_area, idCanale: currentFilter.id_canale },
                { pagina, dimensione }
            ));
            if (richiesta !== ultimaRichiesta.current) return;
            setData(response);
            setErrore(null);
        } catch (error) {
            if (richiesta !== ultimaRichiesta.current) return;
            console.error("Errore caricamento storico volantini:", error);
            setErrore((error as Error)?.message || "Si è verificato un errore durante il caricamento dello storico.");
        } finally {
            if (richiesta === ultimaRichiesta.current) {
                setIsFiltering(false);
                setIsLoading(false);
            }
        }
    }, []);

    // Carica aree e canali dalle combinazioni area/canale: la rotta richiede solo il login,
    // come la pagina, e ogni combinazione porta nome e codice di area e canale
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const combinazioni = await ServerCall.get<CombinazioneConNomi[]>("/get_all_combinazioni_canale_area");
                const opzioni = areeECanaliDaCombinazioni(Array.isArray(combinazioni) ? combinazioni : []);
                setAree(opzioni.aree);
                setCanali(opzioni.canali);
            } catch (error) {
                console.error("Errore caricamento aree/canali:", error);
            }
        };

        loadInitialData();
        fetchData(filter, 1, pageSize);
    }, []);

    const handlePageChange = useCallback((pagina: number) => {
        setCurrentPage(pagina);
        fetchData(filter, pagina, pageSize);
    }, [fetchData, filter, pageSize]);

    // Cambiando le righe per pagina si riparte dalla prima pagina
    const handlePageSizeChange = useCallback((dimensione: number) => {
        setPageSize(dimensione);
        setCurrentPage(1);
        fetchData(filter, 1, dimensione);
    }, [fetchData, filter]);

    // Cambiando i filtri si riparte dalla prima pagina
    const handleFilterChange = useCallback((newFilter: CardFilter) => {
        setFilter(newFilter);
        setCurrentPage(1);
        fetchData(newFilter, 1, pageSize);
    }, [fetchData, pageSize]);

    const refetch = useCallback(() => {
        setIsLoading(true);
        fetchData(filter, currentPage, pageSize);
    }, [filter, currentPage, pageSize, fetchData]);

    const paginatedKits = data?.kit ?? [];
    const totale = data?.totale ?? 0;
    const totalPages = Math.ceil(totale / pageSize);

    const hasActiveFilters = filter.id_area || filter.id_canale;

    const canAccessPromo = usePermission(PERMISSIONS.PROMO.VISUALIZZA);
    const puoConsultareVolantini = usePermission(PERMISSIONS.MATERIALI.VISUALIZZA);
    const puoScaricare = usePermission(PERMISSIONS.MATERIALI.SCARICA);
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
                <StatCard densita="compatta" icona="History" tono="info" etichetta="Volantini totali" valore={totale} />
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
                    {paginatedKits.length === 0 ? (
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
                                const file = kit.copertina;
                                return (
                                    <li key={kit.id}>
                                        <CardVolantino
                                            titolo={kit.titolo}
                                            nomeArea={kit.area.nome}
                                            nomeCanale={kit.canale.nome}
                                            file={
                                                file ? {
                                                    nome: file.nome,
                                                    anteprima: file.anteprima ?? undefined,
                                                    idFile: file.id,
                                                    tipoExport: file.tipoExport ?? undefined,
                                                    mime: file.mime ?? undefined,
                                                    pagine: file.pagine ?? undefined,
                                                } : undefined
                                            }
                                            validitaDal={kit.promo.validitaDal ?? undefined}
                                            validitaAl={kit.promo.validitaAl ?? undefined}
                                            collegamento={puoConsultareVolantini ? percorsoDettaglioVolantino(kit.id) : undefined}
                                            promo={{
                                                nome: kit.promo.nome,
                                                collegamento: canAccessPromo ? `/promozioni/in-corso/dettagli/${kit.promo.id}` : undefined,
                                            }}
                                            puoScaricare={puoScaricare}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <PaginazioneTabella
                    totale={totale}
                    pagina={currentPage}
                    dimensionePagina={pageSize}
                    onCambiaPagina={handlePageChange}
                    onCambiaDimensione={handlePageSizeChange}
                    opzioniDimensione={PAGE_SIZE_OPTIONS}
                />
            </Sezione>
        </Pagina>
    );
};

export default withSessionCheck(StoricoVolantiniPage);
