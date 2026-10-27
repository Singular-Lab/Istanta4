import BarraFiltri from "@/components/Base/BarraFiltri";
import CampoRicerca from "@/components/Base/CampoRicerca";
import { FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import Sezione from "@/components/Base/Sezione";
import StatusBadge from "@/components/Base/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { formatNumero } from "@/utils/format";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { EXPORT_DI_SISTEMA } from "../../../lib/enums";

interface Referenza {
    id?: string;
    descrizione?: string;
    descrizioneDue?: string;
    descrizioneTre?: string;
    descrizioneQuattro?: string;
    codiceReferenza?: string;
    prezzo?: string | number;
    foto?: string[];
    fotoGruppo?: string;
    reparto?: string;
    categoria?: string;
    categoriaMerceologica?: string;
    categoriaMerce?: string;
    categoriaMarketing?: string;
    origine?: "listino" | "fuori_listino";
}

interface GruppoReferenze {
    sigla: string;
    descrizione: string;
    referenze: Referenza[];
}

interface ReferenzeInVolantinoBoxProps {
    exportTypes: string[];
    referenzePerReparto: GruppoReferenze[];
    flyerInsights?: {
        totaleReferenze?: number;
    };
    insightsConfig?: any;
    resolveColor: (value: string, strategy: any) => { tw: string };
}

const ReferenzeInVolantinoBox: React.FC<ReferenzeInVolantinoBoxProps> = ({
    exportTypes,
    referenzePerReparto,
    flyerInsights,
    insightsConfig,
    resolveColor,
}) => {

    /* ======================================================
       STATE
    ====================================================== */
    const [searchText, setSearchText] = useState("");
    const [selectedReparto, setSelectedReparto] = useState("");

    /* ======================================================
       OPZIONI SELECT (SOLO SIGLE)
    ====================================================== */
    const repartoOptions = useMemo(
        () => referenzePerReparto.map((g) => g.sigla),
        [referenzePerReparto]
    );

    /* ======================================================
       FILTRO GRUPPI + REFERENZE (CORE LOGIC)
    ====================================================== */
    const filteredGruppi = useMemo(() => {
        const text = searchText.trim().toLowerCase();

        return referenzePerReparto
            // filtro per reparto
            .filter((gruppo) => {
                if (!selectedReparto) return true;
                return gruppo.sigla === selectedReparto;
            })
            // filtro per referenze
            .map((gruppo) => {
                if (!text) return gruppo;

                const referenzeFiltrate = gruppo.referenze.filter((ref) => {
                    const fullDescrizione = [
                        ref.descrizione,
                        ref.descrizioneDue,
                        ref.descrizioneTre,
                        ref.descrizioneQuattro,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .replace(/\$br/gi, " ")
                        .toLowerCase();

                    return fullDescrizione.includes(text);
                });

                return {
                    ...gruppo,
                    referenze: referenzeFiltrate,
                };
            })
            // rimuove gruppi vuoti
            .filter((gruppo) => gruppo.referenze.length > 0);
    }, [referenzePerReparto, searchText, selectedReparto]);
    /* ======================================================
       VISIBILITÀ
    ====================================================== */
    if (!exportTypes.includes(EXPORT_DI_SISTEMA.VOL) || referenzePerReparto.length === 0) {
        return null;
    }

    /* ======================================================
       RENDER
    ====================================================== */
    const filtriAttivi = Boolean(searchText.trim() || selectedReparto);

    return (
        <Sezione
            icona="Package"
            titolo="Referenze in volantino"
            descrizione={`${flyerInsights?.totaleReferenze || 0} referenze totali`}
        >
            <BarraFiltri variante="interna">
                <CampoRicerca
                    etichetta="Cerca referenza"
                    placeholder="Cerca referenza…"
                    value={searchText}
                    onChange={setSearchText}
                />
                <FormSelect
                    formSelectSize="sm"
                    aria-label="Reparto"
                    className="sm:w-40"
                    value={selectedReparto}
                    onChange={(e) => setSelectedReparto(e.target.value)}
                >
                    <option value="">Tutti i reparti</option>
                    {repartoOptions.map((sigla) => (
                        <option key={sigla} value={sigla}>
                            {sigla}
                        </option>
                    ))}
                </FormSelect>
            </BarraFiltri>

            {/* ================= CONTENUTO ================= */}
            <div className="max-h-[500px] space-y-4 overflow-y-auto pr-2">
                {filteredGruppi.length === 0 && filtriAttivi && (
                    <EmptyState
                        compatta
                        icon="SearchX"
                        title="Nessun risultato"
                        description="Nessuna referenza corrisponde alla ricerca o al reparto scelto."
                        buttonText="Azzera filtri"
                        buttonIcon="RotateCcw"
                        onButtonClick={() => {
                            setSearchText("");
                            setSelectedReparto("");
                        }}
                    />
                )}
                {filteredGruppi.map((gruppo) => {
                    const colorClass = insightsConfig?.reparti?.colorStrategy
                        ? resolveColor(
                            gruppo.descrizione,
                            insightsConfig.reparti.colorStrategy
                        ).tw
                        : "bg-slate-100 text-slate-700";

                    return (
                        <div key={gruppo.sigla} className="overflow-hidden rounded-card border border-slate-200">
                            {/* HEADER GRUPPO */}
                            <div
                                className={clsx(
                                    "flex items-center justify-between border-b border-slate-200 px-4 py-3",
                                    colorClass.includes("bg-")
                                        ? `${colorClass.split(" ")[0]}/20`
                                        : "bg-slate-50"
                                )}
                            >
                                <h3 className="title-card flex items-center gap-2">
                                    <span
                                        className={clsx(
                                            "inline-flex items-center justify-center whitespace-nowrap rounded-full px-2 py-0.5 text-3xs font-bold",
                                            colorClass
                                        )}
                                    >
                                        {gruppo.sigla}
                                    </span>
                                    {gruppo.descrizione}
                                    <span className="text-xs font-normal text-slate-500">({gruppo.referenze.length})</span>
                                </h3>
                            </div>

                            {/* GRID REFERENZE */}
                            <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                {gruppo.referenze.map((ref, idx) => {
                                    const foto = ref.foto?.[0] || ref.fotoGruppo;

                                    const descrizioneCompleta = [
                                        ref.descrizione,
                                        ref.descrizioneDue,
                                        ref.descrizioneTre,
                                        ref.descrizioneQuattro,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")
                                        .split("$br")
                                        .map((part, i, arr) => (
                                            <span key={i}>
                                                {part}
                                                {i < arr.length - 1 && <br />}
                                            </span>
                                        ));

                                    const fuoriListino = ref.origine === "fuori_listino";

                                    return (
                                        <div
                                            key={ref.id || idx}
                                            className={clsx(
                                                "flex flex-col rounded-control border bg-white p-3 transition-colors",
                                                fuoriListino
                                                    ? "border-warning/40 ring-1 ring-warning/20 hover:border-warning/60"
                                                    : "border-slate-200 hover:border-slate-300"
                                            )}
                                        >
                                            {/* Nel volantino c'era, a listino no: l'ha compilata una persona. */}
                                            {fuoriListino && (
                                                <StatusBadge tono="warning" icon="TriangleAlert" etichetta="Fuori listino" className="mb-2 self-start" />
                                            )}
                                            <div className="mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-slate-100">
                                                {foto ? (
                                                    <img
                                                        src={foto}
                                                        alt={ref.descrizione || "Referenza"}
                                                        className="h-full w-full object-contain"
                                                        onError={(e) => {
                                                            const el = e.target as HTMLImageElement;
                                                            el.style.display = "none";
                                                            el.nextElementSibling?.classList.remove("hidden");
                                                        }}
                                                    />
                                                ) : null}
                                                <Lucide
                                                    icon="Image"
                                                    aria-hidden="true"
                                                    className={clsx(
                                                        "h-10 w-10 text-slate-400",
                                                        foto && "hidden"
                                                    )}
                                                />
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-3 text-sm font-medium text-slate-800">
                                                    {descrizioneCompleta.length > 0
                                                        ? descrizioneCompleta
                                                        : "N/D"}
                                                </p>

                                                {ref.codiceReferenza && (
                                                    <p className="mt-1 font-mono text-3xs text-slate-500">
                                                        {ref.codiceReferenza}
                                                    </p>
                                                )}

                                                {ref.prezzo && (
                                                    <p className="mt-1 text-lg font-semibold tabular-nums text-success">
                                                        € {formatNumero(ref.prezzo, 2)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Sezione>
    );
};

export default ReferenzeInVolantinoBox;
