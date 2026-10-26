import { FormLabel, FormSelect } from "@/components/Base/Form";
import Dialog from "@/components/Base/Headless/Dialog";
import Lucide from "@/components/Base/Lucide";
import withSessionCheck from "@/components/SessionChecker";
import { useNotification } from "@/context/NotificationContext";
import { useUser } from "@/context/UserContext";
import { SocketProvider } from "@/hooks/useSocket";
import { useFetchDatoPerMenabo, useFetchMenaboLayout, useFetchRegoleMenabo, useSaveMenaboLayout } from "@/query/query";
import { useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { TIPO_UTENTI } from "../../../lib/enums";
import type { MenaboLayoutDivisioneSalvata, MenaboRisultatoCanale, MenaboSottogruppoChiave } from "../../../lib/types";
import MenaboCanvas, { DRAG_TYPE_LABEL, DRAG_TYPE_NOTE, DRAG_TYPE_SIDEBAR, type CanvasRecordsPayload, type LabelDragPayload, type SidebarDragPayload } from "./MenaboCanvas";
import { useMenaboPresence } from "./useMenaboPresence";

const PALETTE = [
    "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
    "#8b5cf6", "#06b6d4", "#ec4899", "#f97316",
    "#84cc16", "#6366f1",
];

// Colore stabile per utente (stesso userId → stesso colore avatar in tutta la pagina).
function colorForUser(userId: string): string {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
    return PALETTE[hash % PALETTE.length];
}

// Iniziali (max 2) dal nome completo, per gli avatar di presenza.
function getInitials(nome: string): string {
    return nome
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(p => p[0]?.toUpperCase() ?? "")
        .join("");
}

function getGroupSourceKey(
    guidCanale: string,
    item: MenaboRisultatoCanale["raggruppamento"][number],
    index: number,
) {
    return JSON.stringify([guidCanale, item.nome_campo, item.valore_campo, index]);
}

function getSubgroupSourceKey(groupSourceKey: string, nomeCampo: string, valoreCampo: string) {
    return JSON.stringify([groupSourceKey, "sub", nomeCampo, valoreCampo]);
}

function getRecordKey(sourceKey: string, index: number) {
    return JSON.stringify([sourceKey, index]);
}

function getRecordCodice(record: Record<string, string>): string {
    return (record["Codice"] ?? record["codice"] ?? record["codice_referenza"] ?? "").trim().toLowerCase();
}

function parseScattoSubCodici(record: Record<string, string>): string[] {
    const scatto = (record["Scatto.CodiceGruppo"] ?? "").trim();
    if (!scatto) return [];
    const codice = getRecordCodice(record);
    if (scatto.toLowerCase() === codice) return [];
    return scatto.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

interface SubgroupEntry {
    nomeCampo: string;
    valoreCampo: string;
    label: string;
    sourceKey: string;
    availableRecords: { record: Record<string, string>; recordKey: string }[];
}

function computeSubgroups(
    chiave: MenaboSottogruppoChiave,
    groupSourceKey: string,
    availableRecords: { record: Record<string, string>; recordKey: string }[],
): SubgroupEntry[] {
    const subMap = new Map<string, { record: Record<string, string>; recordKey: string }[]>();

    for (const entry of availableRecords) {
        const val = String(entry.record[chiave.nome_campo] ?? "").trim() || "—";
        const arr = subMap.get(val) ?? [];
        arr.push(entry);
        subMap.set(val, arr);
    }
    return Array.from(subMap.entries()).map(([val, recs]) => ({
        nomeCampo: chiave.nome_campo,
        valoreCampo: val,
        label: chiave.label,
        sourceKey: getSubgroupSourceKey(groupSourceKey, chiave.nome_campo, val),
        availableRecords: recs,
    }));
}

function MenaboPromoPage() {
    const { idPromo } = useParams<{ idPromo: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { showNotification } = useNotification();
    const { user } = useUser();
    const { data, isLoading, isError } = useFetchDatoPerMenabo(idPromo);
    const { data: regoleMenabo } = useFetchRegoleMenabo();
    const { data: menaboLayout } = useFetchMenaboLayout(idPromo);
    const { mutateAsync: saveMenaboLayout, isPending: isSavingMenaboLayout } = useSaveMenaboLayout(idPromo);

    const risultati = useMemo(() => data?.risultati ?? [], [data]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [selectedItem, setSelectedItem] = useState<string>("");
    const [labelText, setLabelText] = useState("Ricetta");
    const [placedRecordKeys, setPlacedRecordKeys] = useState<Set<string>>(() => new Set());
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Sotto il breakpoint lg la sidebar è un drawer in overlay: al primo caricamento
    // parte chiusa per non coprire il canvas (effetto post-mount per non rompere l'idratazione SSR)
    useEffect(() => {
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
    }, []);

    // Dirty state e dialogs
    const [isCanvasDirty, setIsCanvasDirty] = useState(false);
    const [pendingCanaleId, setPendingCanaleId] = useState<string | null>(null);
    const [isDirtyDialogOpen, setIsDirtyDialogOpen] = useState(false);
    const [isPresenceDialogOpen, setIsPresenceDialogOpen] = useState(false);
    const [pendingPresenceCanaleId, setPendingPresenceCanaleId] = useState<string | null>(null);

    // Presenza WebSocket
    const { allPresences, isKicked, kickedInfo, joinDivision, leaveDivision, kickEditor, clearKicked } = useMenaboPresence({ idPromo, user });
    const isSuperadmin = user?.tipo === TIPO_UTENTI.SUPERADMIN;

    // Etichetta della divisione coerente col tipo configurato (Canale / Area / Canale/Area):
    // usata in tutte le scritte visibili al posto del termine generico "divisione".
    const etichettaDivisione =
        data?.tipoDivisione === "canale" ? "Canale" : data?.tipoDivisione === "area" ? "Area" : "Canale/Area";
    const etichettaDivisioneLow = etichettaDivisione.toLowerCase();

    const canaleSelezionato: MenaboRisultatoCanale | undefined = useMemo(
        () => risultati.find(r => r.id === selectedId),
        [risultati, selectedId],
    );



    // Canali/aree occupati da ALTRI utenti, esclusa la selezione corrente (gestita dal banner).
    // Serve a mostrare a colpo d'occhio cosa è in uso e da chi, prima ancora di selezionare.
    const divisioniOccupate = useMemo(
        () =>
            risultati
                .filter(r => r.id !== selectedId)
                .map(r => ({ r, editors: (allPresences[r.id] ?? []).filter(e => e.userId !== user?.id) }))
                .filter(x => x.editors.length > 0),
        [risultati, allPresences, selectedId, user?.id],
    );

    const gruppiDisponibili = useMemo(() => {
        const raggruppamento = canaleSelezionato?.raggruppamento ?? [];

        // Primo passaggio: raccoglie tutti i codici "coperti" dai gruppi già piazzati sul canvas.
        // Se un record di gruppo (Scatto.CodiceGruppo con sub-codici) è stato piazzato,
        // i singoli che ne fanno parte non devono più comparire nella sidebar.
        const groupedCodes = new Set<string>();
        raggruppamento.forEach((item, idx) => {
            const sourceKey = getGroupSourceKey(selectedId, item, idx);
            item.records.forEach((record, recordIdx) => {
                if (!placedRecordKeys.has(getRecordKey(sourceKey, recordIdx))) return;
                parseScattoSubCodici(record).forEach(c => groupedCodes.add(c));
            });
        });

        const isHidden = (record: Record<string, string>, recordKey: string): boolean => {
            if (placedRecordKeys.has(recordKey)) return true;
            if (groupedCodes.size > 0 && parseScattoSubCodici(record).length === 0) {
                const codice = getRecordCodice(record);
                if (codice && groupedCodes.has(codice)) return true;
            }
            return false;
        };

        return raggruppamento.map((item, idx) => {
            const sourceKey = getGroupSourceKey(selectedId, item, idx);
            const records = item.records.map((record, recordIdx) => ({
                record,
                recordKey: getRecordKey(sourceKey, recordIdx),
            }));
            const availableRecords = records.filter(({ record, recordKey }) => !isHidden(record, recordKey));

            const chiave = item.chiavi_sottogruppi?.[0];
            const subgroups = chiave
                ? computeSubgroups(chiave, sourceKey, records).map(sub => ({
                    ...sub,
                    availableRecords: sub.availableRecords.filter(({ record, recordKey }) => !isHidden(record, recordKey)),
                }))
                : [];

            return { item, idx, sourceKey, availableRecords, subgroups };
        });
    }, [canaleSelezionato, placedRecordKeys, selectedId]);

    // La label è già pronta per la visualizzazione, non serve nomeCanale

    const commitCanaleChange = useCallback((id: string) => {
        leaveDivision();
        setSelectedId(id);
        setSelectedItem("");
        setIsCanvasDirty(false);
        if (id) joinDivision(id);
    }, [joinDivision, leaveDivision]);

    const handleCanaleChange = (id: string) => {
        if (isCanvasDirty) {
            setPendingCanaleId(id);
            setIsDirtyDialogOpen(true);
            return;
        }
        const otherEditors = id ? (allPresences[id] ?? []).filter(e => e.userId !== user?.id) : [];
        if (otherEditors.length > 0) {
            setPendingPresenceCanaleId(id);
            setIsPresenceDialogOpen(true);
            return;
        }
        commitCanaleChange(id);
    };

    const handleSidebarItemPlaced = useCallback((placement: CanvasRecordsPayload) => {
        setPlacedRecordKeys(prev => {
            const next = new Set(prev);
            placement.recordKeys.forEach(recordKey => next.add(recordKey));
            return next;
        });
        setSelectedItem(prev => (prev === placement.sourceKey ? "" : prev));
    }, []);

    const handleCanvasItemsRemoved = useCallback((removedRecords: CanvasRecordsPayload[]) => {
        setPlacedRecordKeys(prev => {
            const next = new Set(prev);
            removedRecords.forEach(({ recordKeys }) => {
                recordKeys.forEach(recordKey => next.delete(recordKey));
            });
            return next;
        });
    }, []);

    const handleHydratedRecordsChange = useCallback((divisionId: string, placements: CanvasRecordsPayload[]) => {
        setPlacedRecordKeys(prev => {
            const next = new Set<string>();
            prev.forEach(recordKey => {
                if (!recordKey.includes(divisionId)) next.add(recordKey);
            });
            placements.forEach(({ recordKeys }) => {
                recordKeys.forEach(recordKey => next.add(recordKey));
            });
            return next;
        });
    }, []);

    const handleSaveMenaboLayout = useCallback(async (divisione: MenaboLayoutDivisioneSalvata) => {
        if (!idPromo) return;
        try {
            await saveMenaboLayout({
                tipoDivisione: data?.tipoDivisione ?? regoleMenabo?.tipoDivisione ?? "canale",
                divisione,
            });
            await queryClient.invalidateQueries({ queryKey: ["menabo-layout", idPromo] });
            showNotification("Menabò salvato", { variant: "success" });
        } catch (error) {
            showNotification("Errore durante il salvataggio del Menabò", { variant: "error" });
            throw error;
        }
    }, [data?.tipoDivisione, idPromo, queryClient, regoleMenabo?.tipoDivisione, saveMenaboLayout, showNotification]);

    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());

    const promoDetailPath = useMemo(() => {
        if (!idPromo) return "";

        const promoSection = location.pathname.includes("/promozioni/storico/")
            ? "storico"
            : "in-corso";

        return `/promozioni/${promoSection}/dettagli/${idPromo}`;
    }, [idPromo, location.pathname]);

    // Effetto: se l'utente viene espulso dal menabò, i non-superadmin tornano alla promo.
    useEffect(() => {
        if (!isKicked || !kickedInfo) return;

        leaveDivision();
        setSelectedId("");
        setIsCanvasDirty(false);

        if (!isSuperadmin) {
            showNotification(
                `${kickedInfo.kickedBy} ha chiuso la tua sessione nel menabò. Ti riportiamo alla promozione.`,
                { variant: "warning" },
            );
            clearKicked();
            navigate(promoDetailPath || "/promozioni/in-corso", { replace: true });
            return;
        }

        showNotification(`${kickedInfo.kickedBy} ti ha rimosso da ${etichettaDivisioneLow}`, { variant: "warning" });
        clearKicked();
    }, [
        clearKicked,
        etichettaDivisioneLow,
        isKicked,
        isSuperadmin,
        kickedInfo,
        leaveDivision,
        navigate,
        promoDetailPath,
        showNotification,
    ]);

    const handleBackToPromo = useCallback(() => {
        if (promoDetailPath) {
            navigate(promoDetailPath);
            return;
        }

        navigate(-1);
    }, [navigate, promoDetailPath]);

    const toggleGroup = useCallback((sourceKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(sourceKey)) next.delete(sourceKey);
            else next.add(sourceKey);
            return next;
        });
    }, []);

    const onSubgroupDragStart = (
        e: React.DragEvent,
        parentItem: MenaboRisultatoCanale["raggruppamento"][number],
        sub: SubgroupEntry,
        colorIdx: number,
    ) => {
        const records = sub.availableRecords.map(({ record }) => record);
        const recordKeys = sub.availableRecords.map(({ recordKey }) => recordKey);
        const label = `${parentItem.valore_campo} · ${sub.valoreCampo}`;
        const payload: SidebarDragPayload = {
            valore_campo: label,
            nome_campo: sub.nomeCampo,
            records,
            recordKeys,
            colorIdx,
            sourceKey: sub.sourceKey,
        };
        e.dataTransfer.setData(DRAG_TYPE_SIDEBAR, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";

        const color = PALETTE[colorIdx % PALETTE.length];
        const ghost = document.createElement("div");
        ghost.style.cssText = [
            "position:fixed;top:-9999px;left:0",
            `background:${color};color:white`,
            "padding:5px 11px;border-radius:6px",
            "font-size:12px;font-weight:600",
            "white-space:nowrap;pointer-events:none",
            "box-shadow:0 4px 14px rgba(0,0,0,0.3)",
        ].join(";");
        ghost.textContent = label;
        document.body.appendChild(ghost);
        const _w = ghost.offsetWidth;
        e.dataTransfer.setDragImage(ghost, _w / 2, 15);
        setTimeout(() => ghost.remove(), 0);
    };

    const onItemDragStart = (
        e: React.DragEvent,
        item: MenaboRisultatoCanale["raggruppamento"][number],
        records: Array<Record<string, string>>,
        recordKeys: string[],
        colorIdx: number,
        sourceKey: string,
    ) => {
        const payload: SidebarDragPayload = {
            valore_campo: item.valore_campo,
            nome_campo: item.nome_campo,
            records,
            recordKeys,
            colorIdx,
            sourceKey,
        };
        e.dataTransfer.setData(DRAG_TYPE_SIDEBAR, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";

        const color = PALETTE[colorIdx % PALETTE.length];
        const ghost = document.createElement("div");
        ghost.style.cssText = [
            "position:fixed;top:-9999px;left:0",
            `background:${color};color:white`,
            "padding:5px 11px;border-radius:6px",
            "font-size:12px;font-weight:600",
            "white-space:nowrap;pointer-events:none",
            "box-shadow:0 4px 14px rgba(0,0,0,0.3)",
        ].join(";");
        ghost.textContent = item.valore_campo || item.nome_campo || "—";
        document.body.appendChild(ghost);
        const _w = ghost.offsetWidth;
        e.dataTransfer.setDragImage(ghost, _w / 2, 15);
        setTimeout(() => ghost.remove(), 0);
    };

    const onLabelDragStart = (e: React.DragEvent, text: string) => {
        const cleanText = text.trim() || "Etichetta";
        const payload: LabelDragPayload = {
            text: cleanText,
            colorIdx: 0,
        };
        e.dataTransfer.setData(DRAG_TYPE_LABEL, JSON.stringify(payload));
        e.dataTransfer.effectAllowed = "copy";

        const color = PALETTE[0];
        const ghost = document.createElement("div");
        ghost.style.cssText = [
            "position:fixed;top:-9999px;left:0",
            `border:1px solid ${color};color:#1f2937;background:white`,
            "padding:7px 14px;border-radius:6px",
            "font-size:13px;font-weight:800;text-transform:uppercase",
            "white-space:nowrap;pointer-events:none",
            "box-shadow:0 6px 18px rgba(15,23,42,0.18)",
        ].join(";");
        ghost.textContent = cleanText;
        document.body.appendChild(ghost);
        const _w = ghost.offsetWidth;
        e.dataTransfer.setDragImage(ghost, _w / 2, 18);
        setTimeout(() => ghost.remove(), 0);
    };

    // Nota di pagina: nessun payload (il testo si scrive dopo il drop, sul post-it).
    const onNoteDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData(DRAG_TYPE_NOTE, "1");
        e.dataTransfer.effectAllowed = "copy";

        const ghost = document.createElement("div");
        ghost.style.cssText = [
            "position:fixed;top:-9999px;left:0",
            "background:#fef3c7;color:#92400e;border:1px solid #fcd34d",
            "padding:6px 12px;border-radius:6px",
            "font-size:12px;font-weight:600",
            "white-space:nowrap;pointer-events:none",
            "box-shadow:0 6px 18px rgba(15,23,42,0.18)",
        ].join(";");
        ghost.textContent = "Nota";
        document.body.appendChild(ghost);
        const _w = ghost.offsetWidth;
        e.dataTransfer.setDragImage(ghost, _w / 2, 16);
        setTimeout(() => ghost.remove(), 0);
    };

    // ── Contenuto gruppi (riusato in entrambe le modalità) ─────────────────
    const groupsListContent = (
        <>
            <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Gruppi
                </span>
                {canaleSelezionato && (
                    <span className="text-xs text-slate-400 italic">
                        trascina →
                    </span>
                )}
            </div>

            {isLoading && (
                <p className="text-sm text-slate-400 py-2">Caricamento…</p>
            )}


            {canaleSelezionato?.raggruppamento.length === 0 && (
                <p className="text-sm text-slate-400 py-2">
                    Nessun gruppo disponibile.
                </p>
            )}

            {canaleSelezionato && canaleSelezionato.raggruppamento.length > 0 && gruppiDisponibili.every(group => group.availableRecords.length === 0) && (
                <p className="text-sm text-slate-400 py-2">
                    Tutte le referenze sono già state inserite nelle pagine.
                </p>
            )}

            {gruppiDisponibili.map(({ item, idx, sourceKey, availableRecords, subgroups }) => {
                const color = PALETTE[idx % PALETTE.length];
                const records = availableRecords.map(({ record }) => record);
                const recordKeys = availableRecords.map(({ recordKey }) => recordKey);
                const hasSubgroups = subgroups.length > 0;
                const isExpanded = expandedGroups.has(sourceKey);
                const hasAvailableRecords = availableRecords.length > 0;

                return (
                    <div key={sourceKey} className="flex flex-col">
                        {/* Gruppo — sempre draggable (trascina tutti i record del gruppo) */}
                        <button
                            type="button"
                            draggable={hasAvailableRecords}
                            onDragStart={e => {
                                if (!hasAvailableRecords) {
                                    e.preventDefault();
                                    return;
                                }
                                onItemDragStart(e, item, records, recordKeys, idx, sourceKey);
                            }}
                            onClick={() => {
                                if (!hasAvailableRecords) return;
                                hasSubgroups ? toggleGroup(sourceKey) : setSelectedItem(sourceKey);
                            }}
                            disabled={!hasAvailableRecords}
                            className={clsx([
                                "group flex items-center py-2.5",
                                "text-left w-full rounded px-1.5 transition-colors",
                                hasAvailableRecords
                                    ? "cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-darkmode-400"
                                    : "cursor-not-allowed opacity-40",
                                !hasSubgroups && selectedItem === sourceKey &&
                                "bg-slate-50 dark:bg-darkmode-400",
                            ])}
                        >
                            {hasSubgroups ? (
                                <Lucide
                                    icon={isExpanded ? "ChevronDown" : "ChevronRight"}
                                    className="w-3 h-3 mr-1 flex-shrink-0 text-slate-400"
                                />
                            ) : (
                                <span className="w-4 flex-shrink-0" />
                            )}
                            <div
                                className="w-2 h-2 rounded-sm flex-shrink-0 mr-2"
                                style={{ background: color }}
                            />
                            <span
                                className={clsx(
                                    "truncate flex-1 text-sm",
                                    !hasSubgroups && selectedItem === sourceKey
                                        ? "text-primary font-medium"
                                        : "text-slate-600 dark:text-slate-300",
                                )}
                            >
                                {item.valore_campo || "—"}
                            </span>
                            <span className="ml-2 text-xs text-slate-400 flex-shrink-0 tabular-nums">
                                {availableRecords.length}
                            </span>
                            <Lucide
                                icon="GripVertical"
                                className="w-3.5 h-3.5 ml-1.5 flex-shrink-0 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </button>

                        {/* Sottogruppi — visibili solo se espanso */}
                        {hasSubgroups && isExpanded && (
                            <div className="ml-6 flex flex-col border-l border-slate-200 dark:border-darkmode-400 pl-2 mb-1">
                                {subgroups.map(sub => {
                                    const hasSubgroupRecords = sub.availableRecords.length > 0;

                                    return (
                                        <button
                                            key={sub.sourceKey}
                                            type="button"
                                            draggable={hasSubgroupRecords}
                                            onDragStart={e => {
                                                if (!hasSubgroupRecords) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                onSubgroupDragStart(e, item, sub, idx);
                                            }}
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (!hasSubgroupRecords) return;
                                                setSelectedItem(sub.sourceKey);
                                            }}
                                            disabled={!hasSubgroupRecords}
                                            className={clsx([
                                                "group flex items-center py-1.5",
                                                "text-left w-full rounded px-1 transition-colors",
                                                hasSubgroupRecords
                                                    ? "cursor-grab active:cursor-grabbing hover:bg-slate-50 dark:hover:bg-darkmode-400"
                                                    : "cursor-not-allowed opacity-40",
                                                selectedItem === sub.sourceKey &&
                                                "bg-slate-50 dark:bg-darkmode-400",
                                            ])}
                                        >
                                            <div
                                                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mr-2"
                                                style={{ background: color, opacity: 0.75 }}
                                            />
                                            <span
                                                className={clsx(
                                                    "truncate flex-1 text-xs",
                                                    selectedItem === sub.sourceKey
                                                        ? "text-primary font-medium"
                                                        : "text-slate-500 dark:text-slate-400",
                                                )}
                                            >
                                                {sub.valoreCampo}
                                            </span>
                                            <span className="ml-1.5 text-xs text-slate-400 flex-shrink-0 tabular-nums">
                                                {sub.availableRecords.length}
                                            </span>
                                            <Lucide
                                                icon="GripVertical"
                                                className={clsx(
                                                    "w-3 h-3 ml-1 flex-shrink-0 text-slate-300 transition-opacity",
                                                    hasSubgroupRecords ? "opacity-0 group-hover:opacity-100" : "opacity-0",
                                                )}
                                            />
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </>
    );

    // ── Modalità normale ──────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 z-[9999] flex bg-white dark:bg-darkmode-600">

            {/* Striscia laterale quando il pannello è chiuso */}
            {!isSidebarOpen && (
                <div className="w-8 flex-shrink-0 border-r border-slate-200/80 bg-slate-50/60 dark:border-darkmode-400 dark:bg-darkmode-700/40 flex flex-col items-center pt-3 gap-1">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-darkmode-600"
                        title="Mostra pannello"
                    >
                        <Lucide icon="PanelLeftOpen" className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={handleBackToPromo}
                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-600 dark:hover:bg-darkmode-600"
                        title="Torna alla promozione"
                    >
                        <Lucide icon="ChevronLeft" className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* Pannello laterale */}
            {isSidebarOpen && (
                <div className="absolute inset-y-0 left-0 z-40 w-96 max-w-[85vw] flex-shrink-0 flex flex-col border-r border-slate-200/80 bg-white shadow-2xl dark:border-darkmode-400 dark:bg-darkmode-600 overflow-hidden lg:static lg:z-auto lg:shadow-none">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-slate-50/60 flex-shrink-0 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                        <div>
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">Contenuti</div>
                            <div className="text-xs text-slate-400">Trascina nel menabò</div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleBackToPromo}
                                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-darkmode-500"
                                title="Torna alla promozione"
                            >
                                <Lucide icon="ChevronLeft" className="h-3.5 w-3.5" />
                            </button>
                            <button
                                onClick={() => setIsSidebarOpen(false)}
                                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-500 dark:hover:bg-darkmode-500"
                                title="Comprimi pannello"
                            >
                                <Lucide icon="PanelLeftClose" className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto flex flex-col gap-y-4 p-4">
                        {/* Selettore canale */}
                        <div className="flex flex-col gap-y-2">
                            <FormLabel className="font-medium">{etichettaDivisione}</FormLabel>
                            <FormSelect
                                value={selectedId}
                                onChange={e => handleCanaleChange(e.target.value)}
                                disabled={isLoading || risultati.length === 0}
                            >
                                <option value="">— Seleziona —</option>
                                {risultati.map(r => {
                                    const altri = (allPresences[r.id] ?? []).filter(e => e.userId !== user?.id);
                                    const suffix = altri.length > 0 ? ` 🔒 ${altri.map(e => e.userName).join(", ")}` : "";
                                    return (
                                        <option key={r.id} value={r.id}>
                                            {r.label}{suffix}
                                        </option>
                                    );
                                })}
                            </FormSelect>

                            {/* Riepilogo visivo: canali/aree occupati da altri (cliccabili per entrarci) */}
                            {divisioniOccupate.length > 0 && (
                                <div className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50/60 p-2 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                                    <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                        {etichettaDivisione} in uso
                                    </div>
                                    {divisioniOccupate.map(({ r, editors }) => (
                                        <div
                                            key={r.id}
                                            className="flex items-center justify-between gap-2 rounded px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-darkmode-500"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handleCanaleChange(r.id)}
                                                title={`Occupata da ${editors.map(e => e.userName).join(", ")}`}
                                                className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                            >
                                                <span className="flex min-w-0 items-center gap-1.5">
                                                    <Lucide icon="Lock" className="h-3 w-3 flex-shrink-0 text-amber-500" />
                                                    <span className="truncate text-xs font-medium text-slate-600 dark:text-slate-200">{r.label}</span>
                                                </span>
                                                <span className="flex flex-shrink-0 items-center -space-x-1.5">
                                                    {editors.map(e => (
                                                        <span
                                                            key={e.socketId}
                                                            title={e.userName}
                                                            className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white dark:ring-darkmode-600"
                                                            style={{ backgroundColor: colorForUser(e.userId) }}
                                                        >
                                                            {getInitials(e.userName)}
                                                        </span>
                                                    ))}
                                                </span>
                                            </button>
                                            {isSuperadmin && editors.some(e => e.userTipo !== TIPO_UTENTI.SUPERADMIN) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPendingPresenceCanaleId(r.id);
                                                        setIsPresenceDialogOpen(true);
                                                    }}
                                                    className="flex-shrink-0 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                                                    title={`Rimuovi gli utenti da ${r.label}`}
                                                >
                                                    Rimuovi
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Banner presenza: altri utenti stanno modificando questa divisione */}
                            {selectedId && (allPresences[selectedId] ?? []).filter(e => e.userId !== user?.id).map(editor => (
                                <div
                                    key={editor.socketId}
                                    className="flex items-center justify-between gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300"
                                >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span
                                            title={editor.userName}
                                            className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                            style={{ backgroundColor: colorForUser(editor.userId) }}
                                        >
                                            {getInitials(editor.userName)}
                                        </span>
                                        <span className="truncate font-medium">{editor.userName}</span>
                                        <span className="flex-shrink-0 text-amber-600 dark:text-amber-400">sta modificando</span>
                                    </div>
                                    {isSuperadmin && editor.userTipo !== TIPO_UTENTI.SUPERADMIN && (
                                        <button
                                            type="button"
                                            onClick={() => kickEditor(editor.socketId)}
                                            className="flex-shrink-0 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                                            title={`Rimuovi ${editor.userName} da ${etichettaDivisioneLow}`}
                                        >
                                            Rimuovi
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Etichette libere */}
                        <div className="flex flex-col gap-y-2 border-t border-slate-200/80 pt-4 dark:border-darkmode-400">
                            <div className="flex items-center justify-between">
                                <FormLabel className="mb-0 font-medium">Etichetta</FormLabel>
                                {labelText.trim() && (
                                    <span className="text-xs text-slate-400 italic">trascina →</span>
                                )}
                            </div>
                            <input
                                type="text"
                                value={labelText}
                                onChange={e => setLabelText(e.target.value)}
                                placeholder="Ricetta, Copertina..."
                                className="h-9 rounded border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary/40 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-100"
                            />
                            <div
                                draggable={!!labelText.trim()}
                                onDragStart={e => {
                                    if (!labelText.trim()) { e.preventDefault(); return; }
                                    onLabelDragStart(e, labelText);
                                }}
                                className={clsx(
                                    "group flex items-center justify-between rounded border px-3 py-2 text-left transition-opacity",
                                    labelText.trim()
                                        ? "cursor-grab active:cursor-grabbing border-primary/20 bg-primary/[0.06]"
                                        : "cursor-not-allowed opacity-40 border-slate-200 bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-700/40",
                                )}
                                title={labelText.trim() ? "Trascina l'etichetta nella pagina" : "Scrivi un testo per abilitare il trascinamento"}
                            >
                                <span className="truncate text-xs font-bold uppercase tracking-normal text-slate-700 dark:text-slate-200">
                                    {labelText.trim() || "—"}
                                </span>
                                <Lucide
                                    icon="GripVertical"
                                    className={clsx(
                                        "ml-2 h-3.5 w-3.5 flex-shrink-0 text-slate-400 transition-opacity",
                                        labelText.trim() ? "opacity-70 group-hover:opacity-100" : "opacity-30",
                                    )}
                                />
                            </div>
                        </div>

                        {/* Nota di pagina */}
                        <div className="flex flex-col gap-y-2 border-t border-slate-200/80 pt-4 dark:border-darkmode-400">
                            <div className="flex items-center justify-between">
                                <FormLabel className="mb-0 font-medium">Nota di pagina</FormLabel>
                                <span className="text-xs text-slate-400 italic">trascina →</span>
                            </div>
                            <div
                                draggable
                                onDragStart={onNoteDragStart}
                                className="group relative flex cursor-grab items-center justify-between overflow-hidden rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-3 py-2.5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md active:translate-y-0 active:cursor-grabbing dark:border-amber-500/30 dark:from-amber-950/35 dark:via-darkmode-700 dark:to-darkmode-700"
                                title="Trascina su una pagina per aggiungere un promemoria (non viene stampato)"
                            >
                                <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-400/80 dark:bg-amber-300/70" />
                                <span className="flex min-w-0 items-center gap-2 truncate pl-1 text-xs font-semibold text-slate-700 dark:text-slate-100">
                                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25">
                                        <Lucide icon="StickyNote" className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate">Promemoria pagina</span>
                                        <span className="truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">visibile solo nel menabò</span>
                                    </span>
                                </span>
                                <Lucide
                                    icon="GripVertical"
                                    className="ml-2 h-3.5 w-3.5 flex-shrink-0 text-amber-500/70 opacity-60 transition-opacity group-hover:opacity-100"
                                />
                            </div>
                            <p className="text-[11px] leading-snug text-slate-400">
                                Annotazione visibile nel menabò: non finisce negli export.
                            </p>
                        </div>

                        {/* Lista gruppi */}
                        <div className="flex flex-col">
                            {groupsListContent}
                        </div>
                    </div>
                </div>
            )}

            {/* Area canvas */}
            <div className="flex-1 min-w-0 flex flex-col">
                {!isLoading && isError ? (
                    <div className="flex-1 flex items-center justify-center bg-slate-100/80 dark:bg-darkmode-700/40">
                        <div className="flex flex-col items-center gap-5 max-w-sm text-center px-8">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm dark:bg-darkmode-600">
                                <Lucide icon="FileX" className="h-7 w-7 text-slate-400 dark:text-slate-300" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <h3 className="text-base font-semibold text-slate-700 dark:text-slate-100">
                                    Analisi del momento non disponibile
                                </h3>
                                <p className="text-sm text-slate-400 leading-relaxed">
                                    Per utilizzare il Menabò è necessario che la promozione abbia almeno un'analisi del momento configurata.
                                    Configura il primo momento dalla pagina della promozione e riprova.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                                <Lucide icon="AlertTriangle" className="h-3.5 w-3.5 flex-shrink-0" />
                                Operazione non disponibile senza l'analisi del primo momento.
                            </div>
                            <button
                                type="button"
                                onClick={handleBackToPromo}
                                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-200 dark:hover:bg-darkmode-500"
                            >
                                <Lucide icon="ChevronLeft" className="mr-2 h-4 w-4" />
                                Torna alla promozione
                            </button>
                        </div>
                    </div>
                ) : (
                    <MenaboCanvas
                        onSidebarItemPlaced={handleSidebarItemPlaced}
                        onCanvasItemsRemoved={handleCanvasItemsRemoved}
                        onHydratedRecordsChange={handleHydratedRecordsChange}
                        onSaveLayout={handleSaveMenaboLayout}
                        onDirtyChange={setIsCanvasDirty}
                        savedLayout={menaboLayout}
                        isSavingLayout={isSavingMenaboLayout}
                        regoleMenabo={regoleMenabo!}
                        canaleSelezionato={canaleSelezionato}
                        idPromo={idPromo!}
                        nomePromo={data?.nomePromo}
                    />
                )}
            </div>

            {/* Dialog: modifiche non salvate */}
            <Dialog
                open={isDirtyDialogOpen}
                onClose={() => setIsDirtyDialogOpen(false)}
                centered
            >
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium text-slate-700 dark:text-slate-100">
                            Modifiche non salvate
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            Hai modifiche non salvate. Cambiando {etichettaDivisioneLow} le perderai.
                        </p>
                    </Dialog.Description>
                    <Dialog.Footer>
                        <button
                            type="button"
                            onClick={() => setIsDirtyDialogOpen(false)}
                            className="mr-1 w-24 rounded border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-800 dark:text-slate-300"
                        >
                            Rimani
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setIsDirtyDialogOpen(false);
                                if (pendingCanaleId === null) return;
                                const id = pendingCanaleId;
                                setPendingCanaleId(null);
                                const otherEditors = id ? (allPresences[id] ?? []).filter(e => e.userId !== user?.id) : [];
                                if (otherEditors.length > 0) {
                                    setPendingPresenceCanaleId(id);
                                    setIsPresenceDialogOpen(true);
                                } else {
                                    commitCanaleChange(id);
                                }
                            }}
                            className="w-40 rounded border border-danger/30 bg-danger/10 py-2 text-sm font-medium text-danger hover:bg-danger/20 dark:bg-danger/20"
                        >
                            Cambia senza salvare
                        </button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>

            {/* Dialog: divisione occupata da un altro utente */}
            {(() => {
                const occupiedEditors = pendingPresenceCanaleId
                    ? (allPresences[pendingPresenceCanaleId] ?? []).filter(e => e.userId !== user?.id)
                    : [];
                const removableEditors = occupiedEditors.filter(e => e.userTipo !== TIPO_UTENTI.SUPERADMIN);
                return (
                    <Dialog
                        open={isPresenceDialogOpen}
                        onClose={() => setIsPresenceDialogOpen(false)}
                        centered
                    >
                        <Dialog.Panel>
                            <Dialog.Title>
                                <h2 className="mr-auto text-base font-medium text-slate-700 dark:text-slate-100">
                                    {etichettaDivisione} in uso
                                </h2>
                            </Dialog.Title>
                            <Dialog.Description>
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                                    {occupiedEditors.map(e => e.userName).join(", ")}
                                    {occupiedEditors.length === 1 ? " sta " : " stanno "}
                                    già lavorando qui. Vuoi entrare comunque?
                                </p>
                            </Dialog.Description>
                            <Dialog.Footer>
                                <button
                                    type="button"
                                    onClick={() => { setIsPresenceDialogOpen(false); setPendingPresenceCanaleId(null); }}
                                    className="mr-1 w-24 rounded border border-slate-200 bg-white py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-800 dark:text-slate-300"
                                >
                                    Annulla
                                </button>
                                {isSuperadmin && removableEditors.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            removableEditors.forEach(e => kickEditor(e.socketId));
                                            setIsPresenceDialogOpen(false);
                                            if (pendingPresenceCanaleId) commitCanaleChange(pendingPresenceCanaleId);
                                            setPendingPresenceCanaleId(null);
                                        }}
                                        className="mr-1 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-800/50 dark:bg-red-900/20 dark:text-red-400"
                                    >
                                        Rimuovi e entra
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPresenceDialogOpen(false);
                                        if (pendingPresenceCanaleId) commitCanaleChange(pendingPresenceCanaleId);
                                        setPendingPresenceCanaleId(null);
                                    }}
                                    className="rounded border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20"
                                >
                                    Entra comunque
                                </button>
                            </Dialog.Footer>
                        </Dialog.Panel>
                    </Dialog>
                );
            })()}
        </div>
    );
}

function MenaboPromoPageWithSocket() {
    return (
        <SocketProvider>
            <MenaboPromoPage />
        </SocketProvider>
    );
}

export default withSessionCheck(MenaboPromoPageWithSocket);
