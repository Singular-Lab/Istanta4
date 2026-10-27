import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ServerCall } from "../../../../lib/server_call";
import type { TracciatiResponseDTO } from "../../../../server/core/dto";
import Button from "../../../components/Base/Button";
import { FormInput } from "../../../components/Base/Form";
import { Dialog } from "../../../components/Base/Headless";
import Lucide from "../../../components/Base/Lucide";
import Spinner from "../../../components/Base/Spinner";
import StatusBadge from "../../../components/Base/StatusBadge";
import ConfirmDialog from "../../../components/ConfirmDialog";
import type { TonoStato } from "../../../constants/stati";
import { usePermissionContext } from "../../../context/PermissionContext";
import { PERMISSIONS } from "../../../constants/permissions";

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

// Tono e icona dello stato dell'importazione, con i colori comuni di StatusBadge
const getStatusStyle = (stato: string): { tono: TonoStato; icon: string } => {
    switch (stato) {
        case "Terminata":
            return { tono: "success", icon: "CircleCheck" };
        case "TerminataConErrori":
            return { tono: "danger", icon: "CircleAlert" };
        case "Cancellata":
        case "Scartata":
            return { tono: "danger", icon: "CircleX" };
        case "Esaminata":
            return { tono: "info", icon: "Eye" };
        case "InAttesaDiConfermaUtente":
            return { tono: "warning", icon: "CircleAlert" };
        case "InAttesaDiAssegnazione":
        case "InCoda":
        case "ElaborazioneDati":
        case "AttesaIO":
        case "IO":
            return { tono: "brand", icon: "Loader" };
        default:
            return { tono: "neutral", icon: "Info" };
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
    const { hasPermission } = usePermissionContext();
    const navigate = useNavigate();
    const [showDialogEliminazioneDefinitiva, setShowDialogEliminazioneDefinitiva] = useState<boolean>(false);
    const queryClient = useQueryClient();
    const [showDialogRinomina, setShowDialogRinomina] = useState<boolean>(false);
    const [nuovoNome, setNuovoNome] = useState<string>("");
    // Cambia solo il nome mostrato in FP: il file del marketing e il suo nome restano quelli originali
    const rinominaMutation = useMutation({
        mutationFn: (nome: string) =>
            ServerCall.put<TracciatiResponseDTO>(`/tracciati/${tracciato.id}/nome`, { nome }),
        onSuccess: async () => {
            setShowDialogRinomina(false);
            await queryClient.invalidateQueries({ queryKey: ["tracciatiPromo", tracciato.id_promo] });
        },
    });
    const statusImportazioneQuery = useQuery({
        queryKey: ["statusImportazione", tracciato.id],
        queryFn: async () => {
            if (!tracciato.id) return null;
            return ServerCall.get<{
                stato: string;
                error: string;
                esito: boolean;
            }>(`/getStatusImportazione?idTracciato=${tracciato.id}`);
        },
        refetchInterval: (query) => {
            // In errore non si ripete il polling: il messaggio resta visibile nella card
            if (query.state.status === "error") return false;
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

    const isLoadingState =
        statusData?.stato === "InCoda" ||
        statusData?.stato === "ElaborazioneDati" ||
        statusData?.stato === "AttesaIO" ||
        statusData?.stato === "IO";

    const isExpanded = expandedErrorTracciatoId === tracciato.id;
    const canDeleteTracciato =
        tracciato.stato === "Scartato" || statusData?.stato === "Scartata";

    // Comandi del tracciato: icone con nome accessibile, come le azioni di riga
    const comando = "h-8 w-8 p-0";

    return (
        <Fragment>
            <div className="group rounded-card border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300">
                <div className="flex items-start gap-3">
                    <Lucide icon="FileText" aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0 text-slate-500" />

                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h3 className="title-card truncate" title={tracciato.nome}>
                                    {tracciato.nome}
                                </h3>
                                {tracciato.nome !== tracciato.filename && (
                                    <div className="truncate text-xs text-slate-500" title={tracciato.filename}>
                                        File originale: {tracciato.filename}
                                    </div>
                                )}

                                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                                    <span className="flex items-center gap-1">
                                        <Lucide icon="Calendar" aria-hidden="true" className="h-3 w-3 text-slate-400" />
                                        {formatDate(tracciato.createdat)}
                                    </span>
                                    <span className="flex items-center gap-1 tabular-nums">
                                        <Lucide icon="HardDrive" aria-hidden="true" className="h-3 w-3 text-slate-400" />
                                        {getFileSize(tracciato.filesize)} MB
                                    </span>
                                </div>
                            </div>

                            {statusData && statusStyle && (
                                <span className="inline-flex flex-none items-center gap-1.5">
                                    {isLoadingState && <Spinner decorativo size="sm" className="h-3.5 w-3.5" />}
                                    <StatusBadge
                                        tono={statusStyle.tono}
                                        etichetta={getStatusLabel(statusData.stato)}
                                        icon={isLoadingState ? undefined : statusStyle.icon}
                                    />
                                </span>
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
                                                    className="inline-flex items-center gap-1 rounded-control bg-slate-50 px-2 py-0.5 text-slate-700"
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

                        {statusImportazioneQuery.isError && (
                            <div className="mt-1 text-xs text-danger">
                                Stato importazione non disponibile: {statusImportazioneQuery.error?.message}
                            </div>
                        )}

                        {(statusData?.error && hasPermission(PERMISSIONS.FILE.UPLOAD_TRACCIATO)) && (
                            <div className="mt-1 text-xs text-danger">
                                {(() => {
                                    const fullError = statusData.error;
                                    const shortError = getShortError(fullError, 220);
                                    const isLong = fullError.length > shortError.length;

                                    return (
                                        <div className="space-y-1">
                                            <pre className="whitespace-pre-wrap break-words rounded-control border border-danger/20 bg-danger/5 p-2 font-mono text-2xs">
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
                                                    aria-expanded={isExpanded}
                                                    className="text-2xs font-medium text-danger underline underline-offset-2"
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

                    <div className="flex flex-none flex-col items-end gap-2 sm:flex-row sm:items-start">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline-secondary"
                            className={comando}
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
                            title="Anteprima tracciato"
                            aria-label="Anteprima tracciato"
                        >
                            <Lucide icon="Eye" aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline-secondary"
                            className={comando}
                            onClick={() => handleDownload(tracciato)}
                            title="Scarica file"
                            aria-label="Scarica file"
                        >
                            <Lucide icon="Download" aria-hidden="true" className="h-4 w-4" />
                        </Button>
                        {!promoStorico && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                className={comando}
                                onClick={() => {
                                    setNuovoNome(tracciato.nome);
                                    rinominaMutation.reset();
                                    setShowDialogRinomina(true);
                                }}
                                title="Rinomina tracciato"
                                aria-label="Rinomina tracciato"
                            >
                                <Lucide icon="Pencil" aria-hidden="true" className="h-4 w-4" />
                            </Button>
                        )}
                        {(canDeleteTracciato && !promoStorico) && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-danger"
                                className={comando}
                                onClick={() => setShowDialogEliminazioneDefinitiva(true)}
                                title="Elimina tracciato"
                                aria-label="Elimina tracciato"
                            >
                                <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmDialog
                open={showDialogEliminazioneDefinitiva}
                onClose={() => {
                    if (isDeletingTracciato) return;
                    setShowDialogEliminazioneDefinitiva(false);
                }}
                onConfirm={() => {
                    setShowDialogEliminazioneDefinitiva(false);
                    onDeleteTracciato(tracciato);
                }}
                loading={isDeletingTracciato}
                title="Elimina tracciato"
                confirmLabel="Elimina"
                description={
                    <p>
                        Stai per eliminare definitivamente il tracciato{" "}
                        <span className="font-semibold text-slate-800">{tracciato.nome}</span>. Questa azione non può essere annullata.
                    </p>
                }
            />

            <Dialog
                open={showDialogRinomina}
                onClose={() => {
                    if (rinominaMutation.isPending) return;
                    setShowDialogRinomina(false);
                }}
            >
                <Dialog.Panel>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            if (nuovoNome.trim()) rinominaMutation.mutate(nuovoNome.trim());
                        }}
                    >
                        <Dialog.Title>
                            <Lucide icon="Pencil" aria-hidden="true" className="h-5 w-5 text-slate-500" />
                            Rinomina tracciato
                        </Dialog.Title>
                        <Dialog.Description>
                            <div className="space-y-2 text-sm text-slate-600">
                                <FormInput
                                    type="text"
                                    aria-label="Nuovo nome del tracciato"
                                    value={nuovoNome}
                                    maxLength={255}
                                    autoFocus
                                    onChange={(e) => setNuovoNome(e.target.value)}
                                />
                                <p className="text-xs text-slate-500">
                                    Cambia solo il nome mostrato in FP. Il file resta {tracciato.filename}.
                                </p>
                                {rinominaMutation.isError && (
                                    <p className="text-xs text-danger">Rinomina non riuscita, riprova.</p>
                                )}
                            </div>
                        </Dialog.Description>
                        <Dialog.Footer>
                            <Button
                                type="button"
                                variant="outline-secondary"
                                onClick={() => setShowDialogRinomina(false)}
                                disabled={rinominaMutation.isPending}
                            >
                                Annulla
                            </Button>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={rinominaMutation.isPending || !nuovoNome.trim()}
                                loading={rinominaMutation.isPending}
                            >
                                Salva
                            </Button>
                        </Dialog.Footer>
                    </form>
                </Dialog.Panel>
            </Dialog>
        </Fragment>
    );
};

export default TracciatoCard;
