import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TIPO_UTENTI } from "../../../../lib/enums";
import { ServerCall } from "../../../../lib/server_call";
import type { TracciatiResponseDTO } from "../../../../server/core/dto";
import Button from "../../../components/Base/Button";
import { Dialog } from "../../../components/Base/Headless";
import LoadingIcon from "../../../components/Base/LoadingIcon";
import Lucide from "../../../components/Base/Lucide";
import { useUser } from "../../../context/UserContext";

type TracciatoCardProps = {
    tracciato: TracciatiResponseDTO;
    getFileSize: (sizeInBytes?: number) => string;
    handleDownload: (tracciato: TracciatiResponseDTO) => void;
    expandedErrorTracciatoId: string | number | null;
    setExpandedErrorTracciatoId: (id: string | number | null) => void;
    formatDate: (date: string | Date | undefined) => string;
    getShortError: (error: string, maxLength?: number) => string;
    onDeleteTracciato: (tracciato: TracciatiResponseDTO) => void;
    isDeletingTracciato?: boolean;
    promoStorico: boolean;
};

// helper spostati fuori per usarli anche qui
const getStatusStyle = (stato: string) => {
    switch (stato) {
        case "Terminata":
            return {
                bgColor: "bg-success/10",
                textColor: "text-success",
                borderColor: "border-success/20",
                icon: "CircleCheck" as const,
            };
        case "TerminataConErrori":
            return {
                bgColor: "bg-danger/10",
                textColor: "text-danger",
                borderColor: "border-danger/20",
                icon: "CircleAlert" as const,
            };
        case "Cancellata":
        case "Scartata":
            return {
                bgColor: "bg-danger/10",
                textColor: "text-danger",
                borderColor: "border-danger/20",
                icon: "CircleX" as const,
            };
        case "Esaminata":
            return {
                bgColor: "bg-info/10",
                textColor: "text-info",
                borderColor: "border-info/20",
                icon: "Eye" as const,
            };
        case "InAttesaDiConfermaUtente":
            return {
                bgColor: "bg-warning/10",
                textColor: "text-warning",
                borderColor: "border-warning/20",
                icon: "CircleAlert" as const,
            };
        case "InAttesaDiAssegnazione":
        case "InCoda":
        case "ElaborazioneDati":
        case "AttesaIO":
        case "IO":
            return {
                bgColor: "bg-primary/10",
                textColor: "text-primary",
                borderColor: "border-primary/20",
                icon: "Loader" as const,
            };
        default:
            return {
                bgColor: "bg-slate-100",
                textColor: "text-slate-600",
                borderColor: "border-slate-200",
                icon: "Info" as const,
            };
    }
};

const getStatusLabel = (stato: string) => {
    const labels: { [key: string]: string } = {
        InAttesaDiAssegnazione: "In attesa di assegnazione",
        InCoda: "In coda",
        ElaborazioneDati: "Elaborazione dati",
        AttesaIO: "Attesa I/O",
        IO: "I/O",
        Cancellata: "Cancellata",
        Terminata: "Completata",
        TerminataConErrori: "Terminata con errori",
        InAttesaDiConfermaUtente: "In attesa di conferma",
        Esaminata: "Esaminata",
        Scartata: "Scartata",
    };
    return labels[stato] || stato;
};

const TracciatoCard: React.FC<TracciatoCardProps> = ({
    tracciato,
    getFileSize,
    handleDownload,
    expandedErrorTracciatoId,
    setExpandedErrorTracciatoId,
    formatDate,
    getShortError,
    onDeleteTracciato,
    isDeletingTracciato = false,
    promoStorico = false,
}) => {
    const { user } = useUser()
    const navigate = useNavigate();
    const [showDialogEliminazioneDefinitiva, setShowDialogEliminazioneDefinitiva] = useState<boolean>(false);
    const statusImportazioneQuery = useQuery({
        queryKey: ["statusImportazione", tracciato.id],
        queryFn: async () => {
            if (!tracciato.id) return null;
            try {
                const result = await ServerCall.get<{
                    stato: string;
                    error: string;
                    esito: boolean;
                }>(`/getStatusImportazione?idTracciato=${tracciato.id}`);
                return result;
            } catch (error) {
                ServerCall.handleErrorWithPreciseData(error);
                return null;
            }
        },
        refetchInterval: (query) => {
            const data = query.state.data as
                | { stato: string; error: string; esito: boolean }
                | null
                | undefined;

            if (
                data?.stato === "Terminata" ||
                data?.stato === "TerminataConErrori" ||
                data?.stato === "Scartata" ||
                data?.stato === "Esaminata"
            ) {
                return false;
            }
            return 3000;
        },
        enabled: !!tracciato.id,
    });

    const statusData = statusImportazioneQuery.data as
        | { stato: string; error: string; esito: boolean }
        | null
        | undefined;

    const statusStyle = statusData ? getStatusStyle(statusData.stato) : null;

    const cardClassName = `
    border rounded-lg p-3 hover:shadow-md transition-all duration-200 group
    ${statusStyle ? statusStyle.bgColor : "bg-white"}
    ${statusStyle
            ? statusStyle.borderColor
            : "border-slate-200 hover:border-slate-300"
        }
  `;

    const isLoadingState =
        statusData?.stato === "InCoda" ||
        statusData?.stato === "ElaborazioneDati" ||
        statusData?.stato === "AttesaIO" ||
        statusData?.stato === "IO";

    const isExpanded = expandedErrorTracciatoId === tracciato.id;
    const canDeleteTracciato =
        tracciato.stato === "Scartato" || statusData?.stato === "Scartata";

    return (
        <Fragment>
            <div key={tracciato.id} className={cardClassName}>
                <div className="flex items-start gap-3">
                    <div className="mt-1">
                        <Lucide
                            icon="FileText"
                            className="w-5 h-5 text-primary flex-shrink-0"
                        />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h4 className="font-semibold text-slate-800 truncate text-sm">
                                    {tracciato.filename}
                                </h4>

                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                    <div className="flex items-center gap-1">
                                        <Lucide
                                            icon="Calendar"
                                            className="w-3 h-3 text-slate-400"
                                        />
                                        <span>{formatDate(tracciato.createdat)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Lucide
                                            icon="HardDrive"
                                            className="w-3 h-3 text-slate-400"
                                        />
                                        <span>{getFileSize(tracciato.filesize)} MB</span>
                                    </div>
                                </div>
                            </div>

                            {statusData && statusStyle && (
                                <div className="flex flex-col items-end gap-1">
                                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/70">
                                        {isLoadingState ? (
                                            <LoadingIcon
                                                icon="spinning-circles"
                                                className={`w-3 h-3 ${statusStyle.textColor}`}
                                            />
                                        ) : (
                                            <Lucide
                                                icon={statusStyle.icon}
                                                className={`w-3 h-3 ${statusStyle.textColor}`}
                                            />
                                        )}
                                        <span
                                            className={`text-[11px] font-medium ${statusStyle.textColor}`}
                                        >
                                            {getStatusLabel(statusData.stato)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>


                        {tracciato.context?.length > 0 && (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                {tracciato.context
                                    .filter(
                                        (context: {
                                            user_value?: string;
                                        }) => context.user_value != null && context.user_value !== ""
                                    )
                                    .map(
                                        (
                                            context: {
                                                nome_field: string;
                                                valore: { titolo: string; valore: string }[];
                                                user_value?: string;
                                            },
                                            idxContext: number
                                        ) => {
                                            const matchedOption = context.valore.find(
                                                (v: { titolo: string; valore: string }) =>
                                                    v.valore === context.user_value
                                            );
                                            return (
                                                <div
                                                    key={idxContext}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 rounded text-slate-700"
                                                >
                                                    <span className="font-medium">
                                                        {context.nome_field
                                                            .replace(/([A-Z])/g, " $1")
                                                            .replace(/^./, (str: string) => str.toUpperCase())
                                                            .trim()}
                                                        :
                                                    </span>
                                                    <span className={matchedOption ? '' : 'italic'}>
                                                        {matchedOption?.titolo ?? context.user_value}
                                                    </span>
                                                </div>
                                            );
                                        }
                                    )}
                            </div>
                        )}

                        {(statusData?.error && (user?.tipo == TIPO_UTENTI.SUPERADMIN || user?.tipo == TIPO_UTENTI.AGENZIA)) && (
                            <div className="mt-1 text-xs text-danger">
                                {(() => {
                                    const fullError = statusData.error;
                                    const shortError = getShortError(fullError, 220);
                                    const isLong = fullError.length > shortError.length;

                                    return (
                                        <div className="space-y-1">
                                            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] bg-danger/5 border border-danger/20 rounded p-2">
                                                {isExpanded ? fullError : shortError}
                                            </pre>
                                            {isLong && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpandedErrorTracciatoId(
                                                            isExpanded ? null : tracciato.id
                                                        )
                                                    }
                                                    className="text-[11px] font-medium text-danger underline underline-offset-2"
                                                >
                                                    {isExpanded ? "Mostra meno" : "Mostra tutto"}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                        <button
                            onClick={() => {
                                if (promoStorico) {
                                    navigate(
                                        `/promozioni/storico/dettagli/${tracciato.id_promo}/anteprima-tracciato/${tracciato.id}`
                                    );
                                } else {
                                    navigate(
                                        `/promozioni/in-corso/dettagli/${tracciato.id_promo}/anteprima-tracciato/${tracciato.id}`
                                    );
                                }
                            }}
                            className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-all duration-200 flex items-center justify-center group-hover:scale-105"
                            title="Anteprima tracciato"
                        >
                            <Lucide icon="Eye" className="w-4 h-4" />
                        </button>

                        <button
                            onClick={() => handleDownload(tracciato)}
                            className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 hover:bg-primary text-primary hover:text-white transition-all duration-200 flex items-center justify-center group-hover:scale-110"
                            title="Scarica file"
                        >
                            <Lucide icon="Download" className="w-4 h-4" />
                        </button>
                        {(canDeleteTracciato && !promoStorico) && (
                            <button
                                onClick={() => {
                                    setShowDialogEliminazioneDefinitiva(true);
                                }}
                                className="flex-shrink-0 w-9 h-9 rounded-full bg-danger/10 hover:bg-danger text-danger hover:text-white transition-all duration-200 flex items-center justify-center group-hover:scale-110"
                                title="Elimina tracciato"
                            >
                                <Lucide icon="Trash2" className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <Dialog
                open={showDialogEliminazioneDefinitiva}
                onClose={() => {
                    if (isDeletingTracciato) return;
                    setShowDialogEliminazioneDefinitiva(false);
                }}
            >
                <Dialog.Panel>
                    <Dialog.Title>
                        <div className="flex items-center gap-2">
                            <Lucide icon="Trash2" className="w-5 h-5 text-danger" />
                            <h2 className="text-base font-medium">Elimina tracciato</h2>
                        </div>
                    </Dialog.Title>
                    <Dialog.Description>
                        <div className="py-2 text-sm text-slate-600">
                            <p>
                                Stai per eliminare definitivamente il tracciato:
                                {" "}
                                <span className="font-semibold text-slate-800">{tracciato.filename}</span>
                            </p>
                            <p className="mt-2 text-danger font-medium">
                                Questa azione non può essere annullata.
                            </p>
                        </div>
                    </Dialog.Description>
                    <Dialog.Footer className="px-5 py-3 text-right border-t border-slate-200/60">
                        <Button
                            type="button"
                            variant="outline-secondary"
                            className="w-24 mr-2"
                            onClick={() => setShowDialogEliminazioneDefinitiva(false)}
                            disabled={isDeletingTracciato}
                        >
                            Annulla
                        </Button>
                        <Button
                            type="button"
                            variant="danger"
                            className="w-36"
                            onClick={() => {
                                setShowDialogEliminazioneDefinitiva(false);
                                onDeleteTracciato(tracciato);
                            }}
                            disabled={isDeletingTracciato}
                        >
                            {isDeletingTracciato ? (
                                <>
                                    <Lucide icon="Loader" className="w-4 h-4 animate-spin mr-2" />
                                    Eliminazione...
                                </>
                            ) : (
                                <>
                                    <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                                    Elimina
                                </>
                            )}
                        </Button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>
        </Fragment>
    );
};

export default TracciatoCard;
