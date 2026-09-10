import { FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
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
    return (
        <div className="box box--stacked p-6 lg:col-span-3">
            {/* ================= HEADER ================= */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
                        <Lucide icon="Package" className="h-5 w-5 text-success" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-slate-800">
                            Referenze in Volantino
                        </h3>
                        <p className="text-xs text-slate-500">
                            {flyerInsights?.totaleReferenze || 0} referenze totali
                        </p>
                    </div>
                </div>

                {/* HEADER ACTIONS */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <div className="relative">
                        <Lucide
                            icon="Search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                        />
                        <FormInput
                            type="text"
                            placeholder="Cerca referenza..."
                            className="pl-9 rounded-lg h-9"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                        />
                    </div>

                    <FormSelect
                        className="h-9 w-full sm:w-32"
                        value={selectedReparto}
                        onChange={(e) => setSelectedReparto(e.target.value)}
                    >
                        <option value="">Tutti</option>
                        {repartoOptions.map((sigla) => (
                            <option key={sigla} value={sigla}>
                                {sigla}
                            </option>
                        ))}
                    </FormSelect>
                </div>
            </div>

            {/* ================= CONTENUTO ================= */}
            <div className="max-h-[500px] overflow-y-auto pr-2 space-y-4">
                {filteredGruppi.map((gruppo) => {
                    const colorClass = insightsConfig?.reparti?.colorStrategy
                        ? resolveColor(
                            gruppo.descrizione,
                            insightsConfig.reparti.colorStrategy
                        ).tw
                        : "bg-slate-100 text-slate-700";

                    return (
                        <div
                            key={gruppo.sigla}
                            className="border border-slate-200 rounded-xl overflow-hidden"
                        >
                            {/* HEADER GRUPPO */}
                            <div
                                className={clsx(
                                    "px-4 py-3 border-b border-slate-200 flex items-center justify-between",
                                    colorClass.includes("bg-")
                                        ? `${colorClass.split(" ")[0]}/20`
                                        : "bg-slate-50"
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <div
                                        className={clsx(
                                            "inline-flex items-center justify-center rounded px-2 py-1 text-[10px] font-bold",
                                            colorClass
                                        )}
                                    >
                                        <span className="whitespace-nowrap">{gruppo.sigla}</span>
                                    </div>
                                    <span className="text-sm font-semibold text-slate-800">
                                        {gruppo.descrizione}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                        ({gruppo.referenze.length})
                                    </span>
                                </div>
                            </div>

                            {/* GRID REFERENZE */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

                                    const descrizioneParam = [
                                        ref.descrizione,
                                        ref.descrizioneDue,
                                        ref.descrizioneTre,
                                        ref.descrizioneQuattro,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")
                                        .replace(/\$br/gi, " ")
                                        .trim();

                                    const categoriaParam =
                                        ref.categoria ||
                                        ref.categoriaMerceologica ||
                                        ref.categoriaMerce ||
                                        ref.categoriaMarketing;

                                    const competitorParams = new URLSearchParams({
                                        apikey: "sk_demo_12345",
                                    });

                                    if (descrizioneParam) {
                                        competitorParams.set("descrizione", descrizioneParam);
                                    }

                                    if (ref.reparto || gruppo.descrizione) {
                                        competitorParams.set(
                                            "reparto",
                                            ref.reparto || gruppo.descrizione
                                        );
                                    }

                                    if (categoriaParam) {
                                        competitorParams.set("categoria", categoriaParam);
                                    }

                                    return (
                                        <div
                                            key={ref.id || idx}
                                            className="flex flex-col p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all"
                                        >
                                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-slate-100 flex items-center justify-center mb-3">
                                                {foto ? (
                                                    <img
                                                        src={foto}
                                                        alt={ref.descrizione || "Referenza"}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => {
                                                            const el = e.target as HTMLImageElement;
                                                            el.style.display = "none";
                                                            el.nextElementSibling?.classList.remove("hidden");
                                                        }}
                                                    />
                                                ) : null}
                                                <Lucide
                                                    icon="Image"
                                                    className={clsx(
                                                        "h-10 w-10 text-slate-400",
                                                        foto && "hidden"
                                                    )}
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-800 line-clamp-3">
                                                    {descrizioneCompleta.length > 0
                                                        ? descrizioneCompleta
                                                        : "N/D"}
                                                </p>

                                                {ref.codiceReferenza && (
                                                    <p className="text-[10px] text-slate-500 mt-1 font-mono">
                                                        {ref.codiceReferenza}
                                                    </p>
                                                )}

                                                {ref.prezzo && (
                                                    <p className="text-lg font-semibold text-success mt-1">
                                                        € {Number(ref.prezzo).toFixed(2)}
                                                    </p>
                                                )}
                                            </div>

                                            {/* <div className="relative mt-3">
                                                <Button
                                                    as="a"
                                                    href={`https://www.istantabusiness.it/betatools/competitoranalyzer/ref_analyzer.php?${competitorParams.toString()}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    variant="outline-secondary"
                                                    size="sm"
                                                    className="w-full text-xs border-dashed border-warning/60 text-warning/80 hover:bg-warning/10 hover:border-warning"
                                                >
                                                    <Lucide
                                                        icon="ChartNoAxesCombined"
                                                        className="h-3.5 w-3.5 mr-1.5"
                                                    />
                                                    Competitor Analyzer
                                                    <span className="ml-1.5 inline-flex items-center px-1 py-0.5 rounded text-[9px] font-bold tracking-wide bg-warning/20 text-warning border border-warning/40 leading-none">
                                                        BETA
                                                    </span>
                                                </Button>
                                            </div> */}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ReferenzeInVolantinoBox;
