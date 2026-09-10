import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/Base/ContextMenu";
import Dialog from "@/components/Base/Headless/Dialog";
import { FormTextarea } from "@/components/Base/Form";
import Menu from "@/components/Base/Headless/Menu";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ServerCall } from "../../../lib/server_call";
import type { MenaboLayoutDivisioneSalvata, MenaboLayoutSalvato, RegoleMenabo } from "../../../lib/types";
import { useUser } from "../../context/UserContext";
// ── Document dimensions (A4 in points at 72 dpi) ──────────────────────────
const DOC_W = 595;
const DOC_H = 842;
const MARGIN = 28;
const PAGE_GAP = 32;
const MAX_HISTORY = 50;

// ── Cell / group layout constants (document units, pt) ────────────────────
const MIN_CELL_W = 120;       // larghezza minima cella per calcolare il numero di colonne
const CELL_GAP = 16;          // gap tra celle nel grid
const CONTENT_PAD = 20;       // padding del contenitore pagina
const GROUP_PAD = 7;
const GROUP_HEADER_H = 14;
const GROUP_HEADER_GAP = 7;
const RECORD_GRID_GAP = 10;
const DEFAULT_MAX_REFS_PER_PAGE = 12;



const PALETTE = [
    "#3b82f6", "#ef4444", "#22c55e", "#f59e0b",
    "#8b5cf6", "#06b6d4", "#ec4899", "#f97316",
    "#84cc16", "#6366f1",
];

// ── Public drag protocol (consumed by sidebar in index.tsx) ───────────────
export const DRAG_TYPE_SIDEBAR = "application/x-menabo-sidebar";
export const DRAG_TYPE_LABEL = "application/x-menabo-label";
export const DRAG_TYPE_NOTE = "application/x-menabo-note";

export interface SidebarDragPayload {
    valore_campo: string;
    nome_campo: string;
    records: Array<Record<string, string>>;
    recordKeys: string[];
    colorIdx: number;
    sourceKey: string;
}

export interface CanvasRecordsPayload {
    sourceKey: string;
    recordKeys: string[];
}

export interface LabelDragPayload {
    text: string;
    colorIdx: number;
}

// ── Internal types ────────────────────────────────────────────────────────
interface PlacedItem {
    id: string;        // unico per slice (gruppo × pagina)
    groupId: string;   // condiviso tra tutti gli slice dello stesso gruppo
    pageIndex: number;
    label: string;
    records: Array<Record<string, string>>;
    recordKeys: string[];
    colorIdx: number;
    sourceKey: string;
}

interface RecordPreviewItem {
    descrizione: string;
    codice: string;
    reparto: string;
    foto_url?: string;
}

interface PlacedDragPayload {
    id: string;
    offsetX: number;
    offsetY: number;
}

interface VisualPlacedItem extends PlacedItem {
    visualId: string;
}

interface PageLabel {
    text: string;
    colorIdx: number;
}

interface PageNote {
    id: string;
    text: string;
}

function makeNoteId() {
    return `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface CanvasSnapshot {
    items: PlacedItem[];
    pageLabels: Record<number, PageLabel>;
    pageMaxOverrides: Record<number, number>;
    hiddenRegoleLabelPages: Record<number, true>;
    pageNotes: Record<number, PageNote[]>;
    pageCount: number;
}


type CanvasTool = "select" | "pan";

const DRAG_TYPE_PLACED = "application/x-menabo-placed";

// ── Helpers ───────────────────────────────────────────────────────────────
function hexToRgba(hex: string, a: number) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
}

function calcItemHeight(records: Array<Record<string, string>>) {
    const fieldCount = Object.keys(records[0] ?? {}).length;
    return 28 + Math.min(fieldCount, 5) * 18 + 10;
}

function cleanRecordText(value: unknown) {
    return String(value ?? "").trim();
}

function downloadJson(payload: unknown, filename: string) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function getRecordText(record: Record<string, string>) {
    const primary = cleanRecordText(record["Descrizioni.Descrizione1"]);
    const secondary = cleanRecordText(record["Descrizioni.Descrizione2"]);
    const fallback = cleanRecordText(record["Codice"] ?? record["codice"] ?? record["Referenza"] ?? record["referenza"]);

    return {
        primary: primary || fallback || "Referenza",
        secondary,
    };
}

function getRecordPreview(record: Record<string, string>): RecordPreviewItem {
    const descrizione = [
        cleanRecordText(record["Descrizioni.Descrizione1"]),
        cleanRecordText(record["Descrizioni.Descrizione2"]),
        cleanRecordText(record["Descrizioni.Descrizione3"]),
    ].filter(Boolean).join(" ") || "—";
    const codice = cleanRecordText(record["Scatto.CodiceGruppo"]) || cleanRecordText(record["Referenza.Codice"]) || "—";
    const reparto = cleanRecordText(record["reparto"]) || "—";
    const fotoUrl = cleanRecordText(record["Foto.OriginUri"]);

    return {
        descrizione,
        codice,
        reparto,
        foto_url: fotoUrl || undefined,
    };
}








function buildPageRows(pageCount: number) {
    const rows: number[][] = [];
    // -1 = placeholder vuoto; la prima pagina (dispari) dagli sempre a destra (recto)
    if (pageCount > 0) rows.push([-1, 0]);
    for (let pageIdx = 1; pageIdx < pageCount; pageIdx += 2) {
        rows.push(
            pageIdx + 1 < pageCount
                ? [pageIdx, pageIdx + 1]
                : [pageIdx, -1], // ultima pagina pari: si ferma a sinistra, placeholder a destra
        );
    }
    return rows;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function paginatePlacedItems(
    sourceItems: PlacedItem[],
    requestedPageCount: number,
    pageLabels: Record<number, PageLabel>,
    getMaxCellsForPage: (pageIdx: number) => number,
) {
    const pages: PlacedItem[][] = Array.from({ length: Math.max(1, requestedPageCount) }, () => []);
    const ensurePage = (pageIdx: number) => {
        while (pages.length <= pageIdx) pages.push([]);
    };
    const getUsedCellsForPage = (pageIdx: number) =>
        (pages[pageIdx] ?? []).reduce((sum, item) => sum + item.records.length, 0);
    const sorted = [...sourceItems].sort((a, b) => a.pageIndex - b.pageIndex);
    let lastTouchedPage = 0;

    for (const group of sorted) {
        let curPage = Math.max(0, group.pageIndex);

        if (group.records.length === 0) {
            while (pageLabels[curPage]) {
                curPage++;
            }
            ensurePage(curPage);
            pages[curPage].push({
                ...group,
                pageIndex: curPage,
            });
            lastTouchedPage = Math.max(lastTouchedPage, curPage);
            continue;
        }

        let recordIdx = 0;
        while (recordIdx < group.records.length) {
            while (pageLabels[curPage]) {
                curPage++;
            }

            ensurePage(curPage);
            const maxCells = Math.max(1, Math.floor(getMaxCellsForPage(curPage)));
            const usedCells = getUsedCellsForPage(curPage);

            if (usedCells >= maxCells) {
                curPage++;
                continue;
            }

            const take = Math.min(maxCells - usedCells, group.records.length - recordIdx);
            if (take <= 0) {
                curPage++;
                continue;
            }

            pages[curPage].push({
                ...group,
                pageIndex: curPage,
                records: group.records.slice(recordIdx, recordIdx + take),
                recordKeys: group.recordKeys.slice(recordIdx, recordIdx + take),
            });
            recordIdx += take;
            lastTouchedPage = Math.max(lastTouchedPage, curPage);
        }
    }

    Object.keys(pageLabels).forEach(key => {
        lastTouchedPage = Math.max(lastTouchedPage, Number(key));
    });

    return {
        pages,
        requiredPageCount: Math.max(requestedPageCount, lastTouchedPage + 1, 1),
    };
}

// ── Canvas component ──────────────────────────────────────────────────────
interface MenaboCanvasProps {
    onSidebarItemPlaced?: (placement: CanvasRecordsPayload) => void;
    onCanvasItemsRemoved?: (removedRecords: CanvasRecordsPayload[]) => void;
    onHydratedRecordsChange?: (divisionId: string, placements: CanvasRecordsPayload[]) => void;
    onSaveLayout?: (divisione: MenaboLayoutDivisioneSalvata) => Promise<void> | void;
    onDirtyChange?: (dirty: boolean) => void;
    savedLayout?: MenaboLayoutSalvato | null;
    isSavingLayout?: boolean;
    regoleMenabo?: RegoleMenabo;
    idPromo: string;
    nomePromo?: string;
}

export default function MenaboCanvas({
    onSidebarItemPlaced,
    onCanvasItemsRemoved,
    onHydratedRecordsChange,
    onSaveLayout,
    onDirtyChange,
    savedLayout,
    isSavingLayout = false,
    regoleMenabo,
    canaleSelezionato,
    idPromo,
    nomePromo,
}: MenaboCanvasProps & { canaleSelezionato: import("../../../lib/types").MenaboRisultatoCanale | undefined }) {
    const divisioneSelezionata = useMemo(() => {
        return regoleMenabo?.divisioni.find(
            d => d.id === canaleSelezionato?.id
        );
    }, [regoleMenabo, canaleSelezionato]);

    const pagesFromRegole = useMemo(() => divisioneSelezionata?.pagine ?? [], [divisioneSelezionata]);
    const { user } = useUser();
    const [pageCount, setPageCount] = useState(0);
    const [items, setItems] = useState<PlacedItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(0.82);
    // true dopo il primo zoom manuale: da lì lo zoom non segue più il fit automatico
    const [isZoomManual, setIsZoomManual] = useState(false);
    // Larghezza reale dell'area di lavoro (aggiornata via ResizeObserver): guida il fit-to-width
    const [workspaceWidth, setWorkspaceWidth] = useState(0);
    const [toolMode, setToolMode] = useState<CanvasTool>("select");
    const [isPreviewPanelOpen, setIsPreviewPanelOpen] = useState(true);
    const [codiciCopiati, setCodiciCopiati] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [pageLabels, setPageLabels] = useState<Record<number, PageLabel>>({});
    const [pageMaxOverrides, setPageMaxOverrides] = useState<Record<number, number>>({});
    const [hiddenRegoleLabelPages, setHiddenRegoleLabelPages] = useState<Record<number, true>>({});
    // Note promemoria per pagina (indice pagina → elenco note). Non sono contenuto stampabile.
    const [pageNotes, setPageNotes] = useState<Record<number, PageNote[]>>({});
    // Pagina con il pannello note attualmente aperto (null = nessuno).
    const [openNotesPage, setOpenNotesPage] = useState<number | null>(null);
    const [pendingPageRemoval, setPendingPageRemoval] = useState<{
        pageIndex: number;
        referenceCount: number;
        hasLabel: boolean;
    } | null>(null);
    const [isClearAllDialogOpen, setIsClearAllDialogOpen] = useState(false);
    const workspaceRef = useRef<HTMLDivElement | null>(null);
    const hydratedDivisionRef = useRef<string>("");
    const panStateRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0,
    });

    // Always-fresh ref so stable callbacks can read current zoom
    const zoomRef = useRef(zoom);
    zoomRef.current = zoom;

    // Mirror refs — always-fresh reads for history callbacks (avoids stale closures)
    const itemsRef = useRef(items);
    itemsRef.current = items;
    const pageLabelsRef = useRef(pageLabels);
    pageLabelsRef.current = pageLabels;
    const pageMaxOverridesRef = useRef(pageMaxOverrides);
    pageMaxOverridesRef.current = pageMaxOverrides;
    const hiddenRegoleLabelPagesRef = useRef(hiddenRegoleLabelPages);
    hiddenRegoleLabelPagesRef.current = hiddenRegoleLabelPages;
    const pageNotesRef = useRef(pageNotes);
    pageNotesRef.current = pageNotes;
    const pageCountRef = useRef(pageCount);
    pageCountRef.current = pageCount;

    // Undo/redo history
    const historyRef = useRef<CanvasSnapshot[]>([]);
    const futureRef = useRef<CanvasSnapshot[]>([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const captureSnapshot = useCallback((): CanvasSnapshot => ({
        items: itemsRef.current,
        pageLabels: pageLabelsRef.current,
        pageMaxOverrides: pageMaxOverridesRef.current,
        hiddenRegoleLabelPages: hiddenRegoleLabelPagesRef.current,
        pageNotes: pageNotesRef.current,
        pageCount: pageCountRef.current,
    }), []);

    const pushHistory = useCallback(() => {
        const snap = captureSnapshot();
        historyRef.current = [...historyRef.current.slice(-(MAX_HISTORY - 1)), snap];
        futureRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
    }, [captureSnapshot]);

    const applySnapshot = useCallback((snap: CanvasSnapshot) => {
        setItems(snap.items);
        setPageLabels(snap.pageLabels);
        setPageMaxOverrides(snap.pageMaxOverrides);
        setHiddenRegoleLabelPages(snap.hiddenRegoleLabelPages);
        setPageNotes(snap.pageNotes);
        setPageCount(snap.pageCount);
        setSelectedId(null);
        setIsDirty(true);
    }, []);

    const undo = useCallback(() => {
        if (historyRef.current.length === 0) return;
        const prev = historyRef.current[historyRef.current.length - 1];
        futureRef.current = [captureSnapshot(), ...futureRef.current];
        historyRef.current = historyRef.current.slice(0, -1);
        applySnapshot(prev);
        setCanUndo(historyRef.current.length > 0);
        setCanRedo(true);
        if (canaleSelezionato) {
            onHydratedRecordsChange?.(canaleSelezionato.id, prev.items.map(item => ({
                sourceKey: item.sourceKey,
                recordKeys: item.recordKeys,
            })));
        }
    }, [applySnapshot, canaleSelezionato, captureSnapshot, onHydratedRecordsChange]);

    const redo = useCallback(() => {
        if (futureRef.current.length === 0) return;
        const next = futureRef.current[0];
        historyRef.current = [...historyRef.current, captureSnapshot()];
        futureRef.current = futureRef.current.slice(1);
        applySnapshot(next);
        setCanUndo(true);
        setCanRedo(futureRef.current.length > 0);
        if (canaleSelezionato) {
            onHydratedRecordsChange?.(canaleSelezionato.id, next.items.map(item => ({
                sourceKey: item.sourceKey,
                recordKeys: item.recordKeys,
            })));
        }
    }, [applySnapshot, canaleSelezionato, captureSnapshot, onHydratedRecordsChange]);

    const markDirty = useCallback(() => {
        setIsDirty(true);
    }, []);

    const getDefaultMaxCellsForPage = useCallback((pageIdx: number) => {
        const directRule = pagesFromRegole[pageIdx]?.referenzePerPagina;
        if (Number.isFinite(directRule) && directRule > 0) {
            return Math.floor(directRule);
        }

        for (let idx = pageIdx - 1; idx >= 0; idx--) {
            const rule = pagesFromRegole[idx]?.referenzePerPagina;
            if (Number.isFinite(rule) && rule > 0) return Math.floor(rule);
        }

        return DEFAULT_MAX_REFS_PER_PAGE;
    }, [pagesFromRegole]);

    const getMaxCellsForPage = useCallback((pageIdx: number) => {
        const override = pageMaxOverrides[pageIdx];
        if (Number.isFinite(override) && override > 0) {
            return Math.floor(override);
        }

        return getDefaultMaxCellsForPage(pageIdx);
    }, [getDefaultMaxCellsForPage, pageMaxOverrides]);

    const effectivePageCount = useMemo(() => {
        if (!canaleSelezionato) return 0;
        return Math.max(pageCount, 1);
    }, [canaleSelezionato, pageCount]);

    const pageLabelsFromRegole: Record<number, PageLabel> = useMemo(() => Object.fromEntries(
        pagesFromRegole.flatMap((p, idx) =>
            p.etichetta && !hiddenRegoleLabelPages[idx]
                ? [[idx, { text: p.etichetta, colorIdx: 0 }] as const]
                : []
        )
    ), [hiddenRegoleLabelPages, pagesFromRegole]);

    const mergedPageLabels = useMemo<Record<number, PageLabel>>(
        () => ({
            ...pageLabelsFromRegole,
            ...pageLabels,
        }),
        [pageLabels, pageLabelsFromRegole],
    );

    // Ref always-fresh per useCallback (evita chiusure stale in onPageDrop)
    const mergedPageLabelsRef = useRef(mergedPageLabels);
    mergedPageLabelsRef.current = mergedPageLabels;

    useEffect(() => {
        if (!canaleSelezionato || savedLayout === undefined) return;

        const savedDivision = savedLayout?.divisioni?.[canaleSelezionato.id];
        const hydrationKey = `${canaleSelezionato.id}:${savedDivision?.updatedAt ?? "empty"}:${JSON.stringify(pagesFromRegole)}`;
        if (hydratedDivisionRef.current === hydrationKey) return;
        hydratedDivisionRef.current = hydrationKey;

        if (!savedDivision) {
            setItems([]);
            setPageLabels({});
            setPageMaxOverrides({});
            setHiddenRegoleLabelPages({});
            setPageNotes({});
            setPageCount(Math.max(pagesFromRegole.length, 1));
            setSelectedId(null);
            setIsDirty(false);
            historyRef.current = [];
            futureRef.current = [];
            setCanUndo(false);
            setCanRedo(false);
            onHydratedRecordsChange?.(canaleSelezionato.id, []);
            return;
        }

        // Deserializza e merga gli slice dello stesso gruppo in un singolo PlacedItem.
        // I salvataggi esistenti serializzano i gruppi per pagina (uno slice per pagina),
        // ma items deve contenere UN item per gruppo: paginatePlacedItems gestisce lo split.
        const rawRestoredItems: PlacedItem[] = savedDivision.pages.flatMap(page =>
            page.groups.map(group => ({
                id: group.id,
                groupId: group.groupId,
                pageIndex: page.pageIndex,
                label: group.label,
                records: group.records,
                recordKeys: group.recordKeys,
                colorIdx: group.colorIdx,
                sourceKey: group.sourceKey,
            }))
        );
        const groupMergeMap = new Map<string, PlacedItem>();
        for (const item of rawRestoredItems) {
            const existing = groupMergeMap.get(item.groupId);
            if (!existing) {
                groupMergeMap.set(item.groupId, item);
            } else {
                groupMergeMap.set(item.groupId, {
                    ...existing,
                    records: [...existing.records, ...item.records],
                    recordKeys: [...existing.recordKeys, ...item.recordKeys],
                });
            }
        }
        const restoredItems = Array.from(groupMergeMap.values());
        const restoredLabels = Object.fromEntries(
            savedDivision.pages
                .filter(page => page.label && page.label.source !== "regole")
                .map(page => [page.pageIndex, {
                    text: page.label!.text,
                    colorIdx: page.label!.colorIdx,
                }] as const)
        );
        const restoredMaxOverrides = Object.fromEntries(
            savedDivision.pages
                .filter(page => typeof page.referenzePerPagina === "number" && page.referenzePerPagina > 0)
                .map(page => [page.pageIndex, Math.floor(page.referenzePerPagina!)] as const)
        );
        const restoredHiddenRegoleLabels = Object.fromEntries(
            savedDivision.pages
                .filter(page => page.regoleLabelHidden)
                .map(page => [page.pageIndex, true] as const)
        );
        const restoredNotes: Record<number, PageNote[]> = {};
        savedDivision.pages.forEach(page => {
            const arr: PageNote[] = [];
            if (Array.isArray(page.notes)) {
                page.notes.forEach(n => {
                    if (n?.text?.trim()) arr.push({ id: n.id || makeNoteId(), text: n.text });
                });
            } else if (typeof page.note === "string" && page.note.trim()) {
                // Migrazione dalla vecchia singola nota.
                arr.push({ id: makeNoteId(), text: page.note });
            }
            if (arr.length > 0) restoredNotes[page.pageIndex] = arr;
        });

        setItems(restoredItems);
        setPageLabels(restoredLabels);
        setPageMaxOverrides(restoredMaxOverrides);
        setHiddenRegoleLabelPages(restoredHiddenRegoleLabels);
        setPageNotes(restoredNotes);
        setPageCount(Math.max(savedDivision.pageCount || pagesFromRegole.length || 1, 1));
        setSelectedId(null);
        setIsDirty(false);
        historyRef.current = [];
        futureRef.current = [];
        setCanUndo(false);
        setCanRedo(false);
        onHydratedRecordsChange?.(
            canaleSelezionato.id,
            restoredItems.map(item => ({
                sourceKey: item.sourceKey,
                recordKeys: item.recordKeys,
            }))
        );
    }, [canaleSelezionato, onHydratedRecordsChange, pagesFromRegole, savedLayout]);

    // Zoom adattivo: finché l'utente non zooma manualmente, lo zoom segue il fit-to-width
    // (mai oltre lo 0.82 di default). Lo zoom manuale resta libero: oltre il fit il
    // workspace scorre in orizzontale, così i contenuti piccoli si possono ingrandire.
    const fitZoom = workspaceWidth > 0
        ? Math.max(0.2, (workspaceWidth - 2 * PAGE_GAP) / DOC_W)
        : 0.82;
    const autoZoom = Math.min(0.82, fitZoom);
    const scale = zoom;
    const scaledW = DOC_W * scale;
    const scaledH = DOC_H * scale;
    // Doppia pagina affiancata solo se lo spread ci sta al fit; la scelta non dipende
    // dallo zoom manuale, così su desktop zoomare non cambia la disposizione (come prima)
    const isSingleColumn = workspaceWidth > 0 && workspaceWidth < 2 * DOC_W * autoZoom + 3 * PAGE_GAP;

    useEffect(() => {
        if (!isZoomManual) setZoom(+autoZoom.toFixed(2));
    }, [autoZoom, isZoomManual]);
    const pageRows = useMemo(
        () => isSingleColumn
            ? Array.from({ length: effectivePageCount }, (_, pageIdx) => [pageIdx])
            : buildPageRows(effectivePageCount),
        [effectivePageCount, isSingleColumn],
    );

    const changeZoom = useCallback((delta: number) => {
        setIsZoomManual(true);
        setZoom(z => +Math.min(2, Math.max(0.3, z + delta)).toFixed(2));
    }, []);

    // Reset = torna allo zoom adattivo (il fit-to-width riprende il controllo)
    const resetZoom = useCallback(() => {
        setIsZoomManual(false);
    }, []);

    // Osserva la larghezza del workspace: quando lo spazio non basta (pannelli aperti,
    // finestra stretta, mobile) le pagine si adattano automaticamente senza overflow.
    useEffect(() => {
        const el = workspaceRef.current;
        if (!el) return;
        const observer = new ResizeObserver(entries => {
            setWorkspaceWidth(entries[0]?.contentRect.width ?? 0);
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const isMod = e.metaKey || e.ctrlKey;

            if (!isMod) return;

            const zoomIn =
                e.key === "+" ||
                e.key === "=" ||
                e.code === "NumpadAdd";

            const zoomOut =
                e.key === "-" ||
                e.code === "NumpadSubtract";

            const zoomReset =
                e.key === "0" ||
                e.code === "Digit0" ||
                e.code === "Numpad0";

            if (!zoomIn && !zoomOut && !zoomReset) return;

            e.preventDefault();
            e.stopPropagation();

            if (zoomIn) changeZoom(0.1);
            if (zoomOut) changeZoom(-0.1);
            if (zoomReset) resetZoom();
        };

        window.addEventListener("keydown", onKeyDown, true);

        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
        };
    }, [changeZoom, resetZoom]);

    const pagination = useMemo(
        () => paginatePlacedItems(items, effectivePageCount || 1, mergedPageLabels, getMaxCellsForPage),
        [effectivePageCount, getMaxCellsForPage, items, mergedPageLabels],
    );
    const paginated = pagination.pages;
    const selectedItem = useMemo(
        () => items.find(item => item.id === selectedId) ?? null,
        [items, selectedId],
    );
    const selectedGroupItems = useMemo(() => {
        if (!selectedItem) return [];
        return items
            .filter(item => item.groupId === selectedItem.groupId)
            .sort((a, b) => a.pageIndex - b.pageIndex);
    }, [items, selectedItem]);
    const selectedPreviewItems = useMemo(
        () => selectedGroupItems.flatMap(item => item.records.map(getRecordPreview)),
        [selectedGroupItems],
    );
    const copyCodiciTimeoutRef = useRef<number | null>(null);

    const handleCopiaCodici = useCallback(() => {
        const codici = selectedPreviewItems
            .map(item => item.codice)
            .filter(codice => codice && codice !== "—");
        if (codici.length === 0) return;

        if (!navigator.clipboard?.writeText) {
            setCodiciCopiati(false);
            return;
        }

        const testo = codici.join("\n");
        navigator.clipboard
            .writeText(testo)
            .then(() => {
                setCodiciCopiati(true);
                if (copyCodiciTimeoutRef.current) window.clearTimeout(copyCodiciTimeoutRef.current);
                copyCodiciTimeoutRef.current = window.setTimeout(() => setCodiciCopiati(false), 1500);
            })
            .catch(() => {
                setCodiciCopiati(false);
            });
    }, [selectedPreviewItems]);
    const selectedGroupPagesLabel = useMemo(() => {
        if (!selectedItem) return "—";
        const pages = Array.from(
            new Set(
                paginated
                    .flatMap(pageItems => pageItems)
                    .filter(item => item.groupId === selectedItem.groupId)
                    .map(item => item.pageIndex + 1),
            ),
        ).sort((a, b) => a - b);

        if (pages.length === 0) return String(selectedItem.pageIndex + 1);
        if (pages.length === 1) return String(pages[0]);

        const isContinuous = pages.every((page, index) => index === 0 || page === pages[index - 1] + 1);
        return isContinuous ? `${pages[0]}-${pages[pages.length - 1]}` : pages.join(", ");
    }, [paginated, selectedItem]);
    const selectedColor = selectedItem
        ? PALETTE[selectedItem.colorIdx % PALETTE.length]
        : PALETTE[0];

    useEffect(() => {
        if (selectedId) setIsPreviewPanelOpen(true);
    }, [selectedId]);

    const notifyRemoved = useCallback(
        (removedRecords: CanvasRecordsPayload[]) => {
            const grouped = new Map<string, Set<string>>();
            removedRecords.forEach(({ sourceKey, recordKeys }) => {
                if (!sourceKey) return;
                const keys = grouped.get(sourceKey) ?? new Set<string>();
                recordKeys.forEach(key => {
                    if (key) keys.add(key);
                });
                if (keys.size > 0) grouped.set(sourceKey, keys);
            });

            const payload = Array.from(grouped.entries()).map(([sourceKey, keys]) => ({
                sourceKey,
                recordKeys: Array.from(keys),
            }));
            if (payload.length > 0) onCanvasItemsRemoved?.(payload);
        },
        [onCanvasItemsRemoved],
    );

    const removeRecordKeysFromItems = useCallback((recordKeys: Set<string>) => {
        if (recordKeys.size === 0) return;
        setItems(prev => prev.flatMap(item => {
            const nextRecords = item.records.filter((_, idx) => !recordKeys.has(item.recordKeys[idx]));
            const nextRecordKeys = item.recordKeys.filter(key => !recordKeys.has(key));
            if (nextRecordKeys.length === 0) return [];
            return [{
                ...item,
                records: nextRecords,
                recordKeys: nextRecordKeys,
            }];
        }));
    }, []);

    const removePageAtIndex = useCallback((pageIndex: number) => {
        pushHistory();
        const removedSlices = paginated[pageIndex] ?? [];
        const removedKeys = new Set(removedSlices.flatMap(item => item.recordKeys));

        notifyRemoved(removedSlices.map(item => ({
            sourceKey: item.sourceKey,
            recordKeys: item.recordKeys,
        })));
        removeRecordKeysFromItems(removedKeys);
        // Rinumera le pagine successive (speculare a insertPageAt): gli item che iniziano DOPO la
        // pagina rimossa scalano di 1. Senza questo, eliminando una pagina in mezzo a pagine piene,
        // gli item restano a pageIndex > rimosso → lastTouchedPage non scende → requiredPageCount
        // fa rimbalzare su il conteggio e la pagina non viene di fatto eliminata.
        setItems(prev => prev.map(item =>
            item.pageIndex > pageIndex ? { ...item, pageIndex: item.pageIndex - 1 } : item
        ));
        setPageLabels(prev => {
            const next: Record<number, PageLabel> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); if (i === pageIndex) return; next[i > pageIndex ? i - 1 : i] = v; });
            return next;
        });
        setHiddenRegoleLabelPages(prev => {
            const next: Record<number, true> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); if (i === pageIndex) return; next[i > pageIndex ? i - 1 : i] = v; });
            return next;
        });
        setPageMaxOverrides(prev => {
            const next: Record<number, number> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); if (i === pageIndex) return; next[i > pageIndex ? i - 1 : i] = v; });
            return next;
        });
        setPageNotes(prev => {
            const next: Record<number, PageNote[]> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); if (i === pageIndex) return; next[i > pageIndex ? i - 1 : i] = v; });
            return next;
        });
        setOpenNotesPage(null);
        setSelectedId(prev => {
            if (removedSlices.some(item => item.id === prev)) return null;
            return prev;
        });
        setPageCount(prev => Math.max(1, prev - 1));
        setPendingPageRemoval(null);
        markDirty();
    }, [markDirty, notifyRemoved, paginated, pushHistory, removeRecordKeysFromItems]);

    const decreasePageCount = useCallback(() => {
        if (effectivePageCount <= 1) return;

        const removedPageIndex = effectivePageCount - 1;
        const removedSlices = paginated[removedPageIndex] ?? [];
        const referenceCount = removedSlices.reduce((sum, item) => sum + item.records.length, 0);
        const hasLabel = !!mergedPageLabels[removedPageIndex];

        if (referenceCount > 0 || hasLabel) {
            setPendingPageRemoval({
                pageIndex: removedPageIndex,
                referenceCount,
                hasLabel,
            });
            return;
        }

        removePageAtIndex(removedPageIndex);
    }, [effectivePageCount, mergedPageLabels, paginated, removePageAtIndex]);

    const insertPageAt = useCallback((insertIdx: number) => {
        pushHistory();
        setItems(prev => prev.map(item =>
            item.pageIndex >= insertIdx ? { ...item, pageIndex: item.pageIndex + 1 } : item
        ));
        setPageLabels(prev => {
            const next: Record<number, PageLabel> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); next[i >= insertIdx ? i + 1 : i] = v; });
            return next;
        });
        setPageMaxOverrides(prev => {
            const next: Record<number, number> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); next[i >= insertIdx ? i + 1 : i] = v; });
            return next;
        });
        setHiddenRegoleLabelPages(prev => {
            const next: Record<number, true> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); next[i >= insertIdx ? i + 1 : i] = v; });
            return next;
        });
        setPageNotes(prev => {
            const next: Record<number, PageNote[]> = {};
            Object.entries(prev).forEach(([k, v]) => { const i = Number(k); next[i >= insertIdx ? i + 1 : i] = v; });
            return next;
        });
        setOpenNotesPage(null);
        setPageCount(prev => prev + 1);
        markDirty();
    }, [markDirty, pushHistory]);

    // ── Drop ─────────────────────────────────────────────────────────────
    const onPageDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>, pageIndex: number) => {
            e.preventDefault();

            const labelRaw = e.dataTransfer.getData(DRAG_TYPE_LABEL);
            if (labelRaw) {
                try {
                    pushHistory();
                    const p: LabelDragPayload = JSON.parse(labelRaw);
                    setPageLabels(prev => ({
                        ...prev,
                        [pageIndex]: { text: p.text.trim() || "Etichetta", colorIdx: p.colorIdx },
                    }));
                    markDirty();
                } catch { }
                return;
            }

            // Nota di pagina: promemoria, non contenuto stampabile. Ammessa anche su pagine
            // bloccate da etichetta (è solo un'annotazione). Ogni drop aggiunge una nuova nota
            // vuota e apre il pannello; il testo si scrive lì.
            if (e.dataTransfer.types.includes(DRAG_TYPE_NOTE)) {
                pushHistory();
                setPageNotes(prev => ({
                    ...prev,
                    [pageIndex]: [...(prev[pageIndex] ?? []), { id: makeNoteId(), text: "" }],
                }));
                setOpenNotesPage(pageIndex);
                markDirty();
                return;
            }

            // Le pagine con etichetta sono bloccate: non accettano nuovi gruppi
            if (mergedPageLabelsRef.current[pageIndex]) return;

            const sidebarRaw = e.dataTransfer.getData(DRAG_TYPE_SIDEBAR);
            if (sidebarRaw) {
                try {
                    pushHistory();
                    const p: SidebarDragPayload = JSON.parse(sidebarRaw);
                    const groupId = `group-${Date.now()}`;
                    const label = p.valore_campo || p.nome_campo || "—";
                    const payloadRecordKeys = p.recordKeys?.length === p.records.length
                        ? p.recordKeys
                        : p.records.map((_, idx) => JSON.stringify([p.sourceKey, idx]));

                    // Pre-calcola maxPageUsed usando itemsRef (non il prev dello setState)
                    // per espandere pageCount subito, evitando un flash visivo tra il render
                    // del nuovo item e l'effetto di auto-espansione a riga ~977.
                    // L'item viene salvato come singolo PlacedItem (non pre-splittato):
                    // paginatePlacedItems gestisce la distribuzione visiva su più pagine.
                    // Questo evita la desincronizzazione quando il max-per-pagina cambia.
                    const basePagination = paginatePlacedItems(
                        itemsRef.current,
                        effectivePageCount || 1,
                        mergedPageLabelsRef.current,
                        getMaxCellsForPage,
                    );
                    const usageMap = new Map<number, number>(
                        basePagination.pages.map((pageItems, idx) => [
                            idx,
                            pageItems.reduce((sum, item) => sum + item.records.length, 0),
                        ]),
                    );
                    let maxPageUsed = pageIndex;
                    let curPage = pageIndex;
                    let recordIdx = 0;
                    while (recordIdx < p.records.length) {
                        while (mergedPageLabelsRef.current[curPage]) curPage++;
                        const maxCells = getMaxCellsForPage(curPage);
                        const usedCells = usageMap.get(curPage) ?? 0;
                        if (usedCells >= maxCells) { curPage++; continue; }
                        const take = Math.min(maxCells - usedCells, p.records.length - recordIdx);
                        if (take <= 0) { curPage++; continue; }
                        usageMap.set(curPage, usedCells + take);
                        maxPageUsed = Math.max(maxPageUsed, curPage);
                        recordIdx += take;
                    }

                    setItems(prev => [...prev, {
                        id: `${groupId}-p${pageIndex}`,
                        groupId,
                        pageIndex,
                        label,
                        records: p.records,
                        recordKeys: payloadRecordKeys,
                        colorIdx: p.colorIdx,
                        sourceKey: p.sourceKey,
                    }]);
                    setPageCount(prev => Math.max(prev, maxPageUsed + 1));
                    markDirty();

                    onSidebarItemPlaced?.({
                        sourceKey: p.sourceKey,
                        recordKeys: payloadRecordKeys,
                    });
                    setSelectedId(null);
                } catch { }
                return;
            }
        },
        [effectivePageCount, getMaxCellsForPage, markDirty, onSidebarItemPlaced, pushHistory],
    );

    const onWorkspaceWheel = useCallback((e: React.WheelEvent) => {
        if (!e.ctrlKey && !e.metaKey) return;

        changeZoom(e.deltaY < 0 ? 0.08 : -0.08);
    }, [changeZoom]);

    const onWorkspacePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (toolMode !== "pan" || e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest("button, input, textarea, select")) return;

        e.preventDefault();
        panStateRef.current = {
            active: true,
            startX: e.clientX,
            startY: e.clientY,
            scrollLeft: e.currentTarget.scrollLeft,
            scrollTop: e.currentTarget.scrollTop,
        };
        e.currentTarget.setPointerCapture(e.pointerId);
        setIsPanning(true);
        setSelectedId(null);
    }, [toolMode]);

    const onWorkspacePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!panStateRef.current.active) return;
        const dx = e.clientX - panStateRef.current.startX;
        const dy = e.clientY - panStateRef.current.startY;
        e.currentTarget.scrollLeft = panStateRef.current.scrollLeft - dx;
        e.currentTarget.scrollTop = panStateRef.current.scrollTop - dy;
    }, []);

    const stopWorkspacePan = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!panStateRef.current.active) return;
        panStateRef.current.active = false;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
        setIsPanning(false);
    }, []);

    // ── Keyboard shortcuts ────────────────────────────────────────────────
    const deleteSelected = useCallback(() => {
        if (!selectedId) return;
        pushHistory();
        markDirty();
        const removedItem = items.find(i => i.id === selectedId);
        notifyRemoved(removedItem ? [{
            sourceKey: removedItem.sourceKey,
            recordKeys: removedItem.recordKeys,
        }] : []);
        setItems(prev => prev.filter(i => i.id !== selectedId));
        setSelectedId(null);
    }, [items, markDirty, notifyRemoved, pushHistory, selectedId]);

    const removePageLabel = useCallback((pageIndex: number) => {
        pushHistory();
        markDirty();
        setPageLabels(prev => {
            const next = { ...prev };
            delete next[pageIndex];
            return next;
        });
        if (pagesFromRegole[pageIndex]?.etichetta) {
            setHiddenRegoleLabelPages(prev => ({
                ...prev,
                [pageIndex]: true,
            }));
        }
    }, [markDirty, pagesFromRegole, pushHistory]);



    // Aggiunge una nuova nota vuota alla pagina e apre il pannello (usato dal pulsante "+").
    const addPageNote = useCallback((pageIndex: number) => {
        pushHistory();
        setPageNotes(prev => ({
            ...prev,
            [pageIndex]: [...(prev[pageIndex] ?? []), { id: makeNoteId(), text: "" }],
        }));
        setOpenNotesPage(pageIndex);
        markDirty();
    }, [markDirty, pushHistory]);

    // Aggiorna il testo di una singola nota mentre l'utente scrive (undo già spinto alla creazione).
    const updatePageNote = useCallback((pageIndex: number, noteId: string, text: string) => {
        setPageNotes(prev => ({
            ...prev,
            [pageIndex]: (prev[pageIndex] ?? []).map(n => (n.id === noteId ? { ...n, text } : n)),
        }));
        markDirty();
    }, [markDirty]);

    const removePageNote = useCallback((pageIndex: number, noteId: string) => {
        pushHistory();
        setPageNotes(prev => {
            const arr = (prev[pageIndex] ?? []).filter(n => n.id !== noteId);
            const next = { ...prev };
            if (arr.length > 0) next[pageIndex] = arr;
            else delete next[pageIndex];
            return next;
        });
        markDirty();
    }, [markDirty, pushHistory]);

    // Chiude il pannello; scarta le note rimaste vuote (niente post-it senza testo).
    const closeNotesPanel = useCallback((pageIndex: number) => {
        setOpenNotesPage(prev => (prev === pageIndex ? null : prev));
        setPageNotes(prev => {
            const arr = (prev[pageIndex] ?? []).filter(n => n.text.trim().length > 0);
            const next = { ...prev };
            if (arr.length > 0) next[pageIndex] = arr;
            else delete next[pageIndex];
            return next;
        });
    }, []);

    const removePlacedLabel = useCallback((itemId: string) => {
        pushHistory();
        markDirty();
        const removedItem = items.find(item => item.id === itemId);
        notifyRemoved(removedItem ? [{
            sourceKey: removedItem.sourceKey,
            recordKeys: removedItem.recordKeys,
        }] : []);
        setItems(prev => prev.filter(item => item.id !== itemId));
        setSelectedId(prev => (prev === itemId ? null : prev));
    }, [items, markDirty, notifyRemoved, pushHistory]);

    const handlePageMaxChange = useCallback((pageIndex: number, value: string) => {
        pushHistory();
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return;
        const nextValue = Math.max(1, Math.floor(parsed));
        setPageMaxOverrides(prev => ({
            ...prev,
            [pageIndex]: nextValue,
        }));
        markDirty();
    }, [markDirty, pushHistory]);

    const clearAllContent = useCallback(() => {
        pushHistory();
        const removedFromItems = items.map(item => ({
            sourceKey: item.sourceKey,
            recordKeys: item.recordKeys,
        }));

        notifyRemoved(removedFromItems);
        setItems([]);
        setPageLabels({});
        setHiddenRegoleLabelPages(() => {
            const next: Record<number, true> = {};
            for (let idx = 0; idx < effectivePageCount; idx++) {
                if (pagesFromRegole[idx]?.etichetta) next[idx] = true;
            }
            return next;
        });
        setPageNotes({});
        setOpenNotesPage(null);
        setSelectedId(null);
        setPendingPageRemoval(null);
        setIsClearAllDialogOpen(false);
        markDirty();
    }, [effectivePageCount, items, markDirty, notifyRemoved, pagesFromRegole, pushHistory]);

    useEffect(() => {
        const fn = (e: KeyboardEvent) => {
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

            const isMod = e.metaKey || e.ctrlKey;
            const key = e.key.toLowerCase();

            if (isMod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
            if (isMod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }

            if (!isMod && key === "v") { e.preventDefault(); setToolMode("select"); return; }
            if (!isMod && key === "h") { e.preventDefault(); setToolMode("pan"); return; }

            if (e.key === "Escape") { setSelectedId(null); return; }
            if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
        };
        window.addEventListener("keydown", fn);
        return () => window.removeEventListener("keydown", fn);
    }, [deleteSelected, redo, undo]);


    useEffect(() => {
        if (!canaleSelezionato) return;
        if (pagination.requiredPageCount <= effectivePageCount) return;
        setPageCount(prev => Math.max(prev, pagination.requiredPageCount));
    }, [canaleSelezionato, effectivePageCount, pagination.requiredPageCount]);

    const currentDivisionLayout = useMemo<MenaboLayoutDivisioneSalvata | null>(() => {
        if (!canaleSelezionato) return null;
        const now = new Date().toISOString();

        return {
            divisionId: canaleSelezionato.id,
            divisionLabel: canaleSelezionato.label,
            pageCount: effectivePageCount,
            updatedAt: now,
            pages: Array.from({ length: effectivePageCount }, (_, pageIndex) => {
                const pageItems = paginated[pageIndex] ?? [];
                const pageLabel = mergedPageLabels[pageIndex];
                const labelSource = pageLabels[pageIndex]
                    ? "manuale"
                    : pageLabelsFromRegole[pageIndex]
                        ? "regole"
                        : undefined;

                return {
                    pageIndex,
                    pageNumber: pageIndex + 1,
                    referenzePerPagina: getMaxCellsForPage(pageIndex),
                    regoleLabelHidden: !!hiddenRegoleLabelPages[pageIndex],
                    notes: (() => {
                        const valid = (pageNotes[pageIndex] ?? []).filter(n => n.text.trim().length > 0);
                        return valid.length > 0 ? valid : undefined;
                    })(),
                    label: pageLabel && labelSource
                        ? {
                            text: pageLabel.text,
                            colorIdx: pageLabel.colorIdx,
                            source: labelSource,
                        }
                        : undefined,
                    groups: pageItems.map(item => ({
                        id: item.id,
                        groupId: item.groupId,
                        sourceKey: item.sourceKey,
                        label: item.label,
                        colorIdx: item.colorIdx,
                        recordKeys: item.recordKeys,
                        records: item.records,
                        recordCount: item.records.length,
                    })),
                };
            }),
        };
    }, [canaleSelezionato, effectivePageCount, getMaxCellsForPage, hiddenRegoleLabelPages, mergedPageLabels, pageLabels, pageLabelsFromRegole, pageNotes, paginated]);

    const [isExportingExcel, setIsExportingExcel] = useState(false);
    const [isExportingIndesignJson, setIsExportingIndesignJson] = useState(false);

    const exportMenaboExcel = useCallback(async () => {
        if (!idPromo || !currentDivisionLayout) return;
        setIsExportingExcel(true);
        try {
            const response = await ServerCall.postRaw(`/promo/${idPromo}/export/xlsx`, {
                layout: currentDivisionLayout,
            });
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `menabo_${currentDivisionLayout.divisionLabel.replace(/\s+/g, "_").toLowerCase()}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } finally {
            setIsExportingExcel(false);
        }
    }, [idPromo, currentDivisionLayout]);

    const exportIndesignPluginJson = useCallback(async () => {
        if (!idPromo || !currentDivisionLayout) return;
        setIsExportingIndesignJson(true);
        try {
            const payload = await ServerCall.post<import("../../../lib/types").IndesignPluginExport>(
                `/promo/${idPromo}/export/indesign-json`,
                { layout: currentDivisionLayout },
            );
            downloadJson(payload, "Filtri.json");
        } finally {
            setIsExportingIndesignJson(false);
        }
    }, [currentDivisionLayout, idPromo]);

    const handleSaveLayout = useCallback(async () => {
        if (!currentDivisionLayout || !onSaveLayout) return;
        try {
            await onSaveLayout(currentDivisionLayout);
            setIsDirty(false);
        } catch {
            // La notifica di errore viene gestita dal parent.
        }
    }, [currentDivisionLayout, onSaveLayout]);

    useEffect(() => {
        const el = workspaceRef.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
            }
        };

        el.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            el.removeEventListener("wheel", handleWheel);
        };
    }, []);

    useEffect(() => { onDirtyChange?.(isDirty); }, [isDirty, onDirtyChange]);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (!isDirty) return;
            e.preventDefault();
        };
        window.addEventListener("beforeunload", handler);
        return () => window.removeEventListener("beforeunload", handler);
    }, [isDirty]);

    const lockedPageCount = Object.keys(mergedPageLabels).length;
    const hasClearableContent = items.length > 0 || lockedPageCount > 0;

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div
            className="box box--stacked flex flex-col overflow-hidden border border-slate-200/80 bg-white dark:border-darkmode-400 dark:bg-darkmode-600"
            style={{ height: "100%" }}
        >
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 select-none dark:border-darkmode-400 dark:bg-darkmode-700/40">
                <div className="mr-auto flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-300">
                        <Lucide icon="FileText" className="h-4 w-4" />
                    </span>
                    <div className="leading-tight">
                        <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">Gestione Menabò</span>
                            {nomePromo && (
                                <>
                                    <span className="text-slate-300 dark:text-darkmode-400">·</span>
                                    <span className="text-sm font-medium text-primary truncate max-w-[260px]" title={nomePromo}>{nomePromo}</span>
                                </>
                            )}
                        </div>
                        <div className="text-xs text-slate-400">
                            A4 · {effectivePageCount} {effectivePageCount === 1 ? "pagina" : "pagine"} · {items.length} elementi
                            {lockedPageCount > 0 && (
                                <span className="ml-1">
                                    · <Lucide icon="Lock" className="inline h-2.5 w-2.5 mb-px" /> {lockedPageCount} {lockedPageCount === 1 ? "bloccata" : "bloccate"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tool mode */}
                <div className="flex h-8 items-center overflow-hidden rounded border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
                    <button
                        onClick={() => setToolMode("select")}
                        className={clsx(
                            "flex h-8 items-center gap-1.5 px-2.5 text-xs font-medium transition-colors active:scale-[0.98]",
                            toolMode === "select"
                                ? "bg-primary text-white"
                                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-darkmode-500",
                        )}
                        title="Modalità cursore (V)"
                    >
                        <Lucide icon="MousePointer2" className="h-3.5 w-3.5" />
                        Cursore
                    </button>
                    <button
                        onClick={() => setToolMode("pan")}
                        className={clsx(
                            "flex h-8 items-center gap-1.5 border-l border-slate-200 px-2.5 text-xs font-medium transition-colors active:scale-[0.98] dark:border-darkmode-400",
                            toolMode === "pan"
                                ? "bg-primary text-white"
                                : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-darkmode-500",
                        )}
                        title="Modalità spostamento (H)"
                    >
                        <Lucide icon="Hand" className="h-3.5 w-3.5" />
                        Mano
                    </button>
                </div>

                {/* Undo / Redo */}
                <div className="flex h-8 items-center overflow-hidden rounded border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Annulla (Ctrl+Z)"
                    >
                        <Lucide icon="Undo2" className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        className="flex h-8 w-8 items-center justify-center border-l border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 active:scale-[0.98] dark:border-darkmode-400 dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Ripristina (Ctrl+Y)"
                    >
                        <Lucide icon="Redo2" className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Export */}
                <Menu>
                    <Menu.Button
                        as="button"
                        type="button"
                        className="flex h-8 items-center gap-1.5 rounded border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-300 dark:hover:bg-darkmode-500"
                    >
                        <Lucide icon="Download" className="h-3.5 w-3.5" />
                        Esporta
                        <Lucide icon="ChevronDown" className="h-3 w-3 text-slate-400" />
                    </Menu.Button>
                    <Menu.Items className="w-44">
                        <Menu.Item
                            as="button"
                            onClick={exportMenaboExcel}
                            disabled={isExportingExcel || !idPromo || !currentDivisionLayout}
                            className="w-full gap-2 text-left text-xs text-slate-600 dark:text-slate-200 disabled:opacity-50"
                        >
                            <Lucide icon="FileSpreadsheet" className="h-4 w-4 text-emerald-600" />
                            {isExportingExcel ? "Esportazione..." : "Excel"}
                        </Menu.Item>
                        {
                            user?.is_admin && (
                                <Menu.Item
                                    as="button"
                                    onClick={exportIndesignPluginJson}
                                    disabled={isExportingIndesignJson || !idPromo || !currentDivisionLayout}
                                    className="w-full gap-2 text-left text-xs text-slate-600 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <Lucide icon="Braces" className="h-4 w-4 text-sky-600" />
                                    {isExportingIndesignJson ? "Esportazione..." : "InDesign JSON"}
                                </Menu.Item>
                            )
                        }
                    </Menu.Items>
                </Menu>

                {/* Save */}
                <button
                    type="button"
                    onClick={handleSaveLayout}
                    disabled={!onSaveLayout || !currentDivisionLayout || isSavingLayout}
                    className={clsx(
                        "flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45",
                        isDirty
                            ? "border-primary bg-primary text-white hover:bg-primary/90"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-300 dark:hover:bg-darkmode-500",
                    )}
                    title={isDirty ? "Salva il menabò costruito" : "Menabò allineato all'ultimo salvataggio"}
                >
                    <Lucide icon="Save" className="h-3.5 w-3.5" />
                    {isSavingLayout ? "Salvataggio..." : isDirty ? "Salva*" : "Salva"}
                </button>

                {/* Zoom */}
                <div className="flex h-8 items-center overflow-hidden rounded border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
                    <button
                        onClick={() => changeZoom(-0.1)}
                        className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Riduci zoom (Ctrl+-)"
                    >
                        <Lucide icon="Minus" className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={resetZoom}
                        className="h-8 min-w-[48px] border-x border-slate-200 px-2 text-center text-xs font-medium leading-8 text-slate-600 transition-colors hover:bg-slate-50 dark:border-darkmode-400 dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Adatta allo spazio disponibile (Ctrl+0)"
                    >
                        {Math.round(scale * 100)}%
                    </button>
                    <button
                        onClick={() => changeZoom(0.1)}
                        className="flex h-8 w-8 items-center justify-center text-slate-500 transition-colors hover:bg-slate-50 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Aumenta zoom (Ctrl++)"
                    >
                        <Lucide icon="Plus" className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Page controls */}
                <div className="flex h-8 items-center gap-1 rounded border border-slate-200 bg-white px-1.5 dark:border-darkmode-400 dark:bg-darkmode-600">
                    <button
                        disabled={effectivePageCount <= 1}
                        onClick={decreasePageCount}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Rimuovi ultima pagina"
                    >
                        <Lucide icon="ChevronLeft" className="h-3.5 w-3.5" />
                    </button>
                    <span className="min-w-[58px] text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                        {effectivePageCount} {effectivePageCount === 1 ? "pagina" : "pagine"}
                    </span>
                    <button
                        onClick={() => {
                            pushHistory();
                            markDirty();
                            setPageCount(p => Math.max(p, effectivePageCount) + 1);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded text-slate-500 transition-colors hover:bg-slate-50 active:scale-[0.98] dark:text-slate-300 dark:hover:bg-darkmode-500"
                        title="Aggiungi pagina"
                    >
                        <Lucide icon="ChevronRight" className="h-3.5 w-3.5" />
                    </button>
                </div>

                {/* Delete all */}
                <button
                    type="button"
                    onClick={() => setIsClearAllDialogOpen(true)}
                    disabled={!hasClearableContent}
                    className={clsx(
                        "flex h-8 items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30",
                        hasClearableContent
                            ? "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10"
                            : "border-slate-200 bg-white text-slate-400 dark:border-darkmode-400 dark:bg-darkmode-600",
                    )}
                    title="Elimina tutte le referenze e le etichette del menabò corrente"
                >
                    <Lucide icon="Trash2" className="h-3.5 w-3.5" />
                    Elimina tutto
                </button>

                {/* Delete selected */}
                <button
                    onClick={deleteSelected}
                    disabled={!selectedId}
                    className={clsx(
                        "flex h-8 w-8 items-center justify-center rounded border transition-colors active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-30",
                        selectedId
                            ? "border-danger/30 bg-danger/5 text-danger hover:bg-danger/10"
                            : "border-slate-200 bg-white text-slate-400 dark:border-darkmode-400 dark:bg-darkmode-600",
                    )}
                    title="Elimina selezionato (Canc)"
                >
                    <Lucide icon="Trash2" className="h-3.5 w-3.5" />
                </button>

            </div>

            {/* ── Workspace ── */}
            <div className="relative flex min-h-0 flex-1">
                <div
                    ref={workspaceRef}
                    className={clsx(
                        "min-w-0 flex-1 overflow-auto bg-slate-100/80 dark:bg-darkmode-700/40 [scrollbar-gutter:stable]",
                        toolMode === "pan" && (isPanning ? "cursor-grabbing" : "cursor-grab"),
                    )}
                    onWheel={onWorkspaceWheel}
                    onPointerDown={onWorkspacePointerDown}
                    onPointerMove={onWorkspacePointerMove}
                    onPointerUp={stopWorkspacePan}
                    onPointerCancel={stopWorkspacePan}
                    onPointerLeave={stopWorkspacePan}
                    onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
                >
                    <div
                        className="flex min-w-max flex-col items-center"
                        style={{ padding: PAGE_GAP, gap: PAGE_GAP }}
                        onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
                    >
                        {pageRows.map((row, rowIdx) => {
                            return (
                                <div
                                    key={rowIdx}
                                    className="flex flex-row items-center"
                                    style={{ gap: PAGE_GAP }}
                                >
                                    {row.map(pageIdx => {
                                        // Placeholder invisibile per tenere la prima pagina a destra
                                        if (pageIdx === -1) {
                                            return (
                                                <div
                                                    key="placeholder"
                                                    style={{ width: scaledW, flexShrink: 0 }}
                                                />
                                            );
                                        }

                                        const pageItems = paginated[pageIdx] ?? [];
                                        const pageLabel = mergedPageLabels[pageIdx];
                                        const isLocked = !!pageLabel;
                                        const pageLabelColor = pageLabel
                                            ? PALETTE[pageLabel.colorIdx % PALETTE.length]
                                            : PALETTE[0];
                                        const usedRefs = pageItems.reduce((s, i) => s + i.records.length, 0);
                                        const maxRefs = getMaxCellsForPage(pageIdx);
                                        const isOverLimit = isFinite(maxRefs) && usedRefs > maxRefs;
                                        const notes = pageNotes[pageIdx] ?? [];
                                        const hasNotes = notes.length > 0;
                                        const isNotesOpen = openNotesPage === pageIdx;

                                        return (
                                            <div key={pageIdx} className="group/page flex flex-col items-center gap-2">
                                                {/* Page header */}
                                                <div className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm dark:border-darkmode-400 dark:bg-darkmode-600">
                                                    <span className="select-none text-xs font-medium text-slate-500 dark:text-slate-300">
                                                        Pagina {pageIdx + 1} / {effectivePageCount}
                                                    </span>
                                                    <span className="h-4 w-px bg-slate-200 dark:bg-darkmode-400" />
                                                    <span
                                                        className="select-none text-xs font-semibold tabular-nums"
                                                        style={{ color: isOverLimit ? "#ef4444" : usedRefs === maxRefs ? "#f59e0b" : "#64748b" }}
                                                        title={isFinite(maxRefs) ? `${usedRefs} referenze su ${maxRefs} massimo` : `${usedRefs} referenze`}
                                                    >
                                                        {usedRefs} /
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        value={maxRefs}
                                                        onChange={e => handlePageMaxChange(pageIdx, e.target.value)}
                                                        onClick={e => e.stopPropagation()}
                                                        title="Massimo referenze in pagina"
                                                        className="h-6 w-14 rounded border border-slate-200 bg-white px-1.5 text-center text-xs font-semibold tabular-nums text-slate-600 outline-none transition-colors focus:border-primary/50 dark:border-darkmode-400 dark:bg-darkmode-700 dark:text-slate-200"
                                                    />
                                                    {pageLabel && (
                                                        <>
                                                            <span className="h-4 w-px bg-slate-200 dark:bg-darkmode-400" />
                                                            <Lucide icon="Lock" className="h-3 w-3 flex-shrink-0" style={{ color: pageLabelColor }} />
                                                            <span
                                                                className="select-none text-xs font-bold uppercase tracking-wide"
                                                                style={{ color: pageLabelColor }}
                                                            >
                                                                {pageLabel.text}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => removePageLabel(pageIdx)}
                                                                title="Rimuovi etichetta e sblocca pagina"
                                                                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded transition-colors hover:bg-slate-100 dark:hover:bg-darkmode-500"
                                                                style={{ color: pageLabelColor }}
                                                            >
                                                                <Lucide icon="X" className="h-2.5 w-2.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                    {effectivePageCount > 1 && (
                                                        <>
                                                            <span className="h-4 w-px bg-slate-200 dark:bg-darkmode-400" />
                                                            <button
                                                                type="button"
                                                                onClick={e => {
                                                                    e.stopPropagation();
                                                                    if (usedRefs > 0 || isLocked) {
                                                                        setPendingPageRemoval({ pageIndex: pageIdx, referenceCount: usedRefs, hasLabel: isLocked });
                                                                    } else {
                                                                        removePageAtIndex(pageIdx);
                                                                    }
                                                                }}
                                                                title="Elimina questa pagina"
                                                                className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-danger/10 hover:text-danger dark:hover:bg-danger/20"
                                                            >
                                                                <Lucide icon="Trash2" className="h-2.5 w-2.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Page sheet + insert buttons */}
                                                <div className="relative flex items-center">
                                                    {/* Insert page left */}
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); insertPageAt(pageIdx); }}
                                                        title="Inserisci pagina a sinistra"
                                                        className="absolute -left-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-md opacity-0 transition-all duration-150 hover:border-primary hover:text-primary hover:scale-110 hover:shadow-lg group-hover/page:opacity-100 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary"
                                                    >
                                                        <Lucide icon="Plus" className="h-4 w-4" />
                                                    </button>

                                                <div
                                                    className="relative flex-shrink-0 bg-white ring-1 ring-slate-200"
                                                    style={{
                                                        width: scaledW,
                                                        minHeight: scaledH,
                                                        boxShadow: "0 18px 40px -28px rgba(15,23,42,0.45), 0 2px 8px rgba(15,23,42,0.08)",
                                                    }}
                                                    onDragOver={e => {
                                                        const isLabelDrop = e.dataTransfer.types.includes(DRAG_TYPE_LABEL);
                                                        const isNoteDrop = e.dataTransfer.types.includes(DRAG_TYPE_NOTE);
                                                        if (isLocked && !isLabelDrop && !isNoteDrop) return;
                                                        e.preventDefault();
                                                        e.dataTransfer.dropEffect = "copy";
                                                    }}
                                                    onDrop={e => onPageDrop(e, pageIdx)}
                                                    onClick={e => { if (e.target === e.currentTarget) setSelectedId(null); }}
                                                >
                                                    {/* SVG overlay: margin guides */}
                                                    <svg
                                                        className="absolute inset-0 pointer-events-none"
                                                        width={scaledW}
                                                        height={scaledH}
                                                        style={{ zIndex: 0 }}
                                                    >
                                                        {/* Margin guide */}
                                                        <rect
                                                            x={MARGIN * scale}
                                                            y={MARGIN * scale}
                                                            width={(DOC_W - 2 * MARGIN) * scale}
                                                            height={(DOC_H - 2 * MARGIN) * scale}
                                                            fill="none"
                                                            stroke="#93c5fd"
                                                            strokeWidth="0.7"
                                                            strokeDasharray="4 3"
                                                            opacity="0.6"
                                                        />

                                                        {/* Corner registration marks */}
                                                        {(
                                                            [
                                                                [MARGIN * scale, MARGIN * scale],
                                                                [(DOC_W - MARGIN) * scale, MARGIN * scale],
                                                                [MARGIN * scale, (DOC_H - MARGIN) * scale],
                                                                [(DOC_W - MARGIN) * scale, (DOC_H - MARGIN) * scale],
                                                            ] as [number, number][]
                                                        ).map(([cx, cy], i) => (
                                                            <g key={i} opacity="0.55">
                                                                <line x1={cx - 6} y1={cy} x2={cx + 6} y2={cy} stroke="#93c5fd" strokeWidth="0.7" />
                                                                <line x1={cx} y1={cy - 6} x2={cx} y2={cy + 6} stroke="#93c5fd" strokeWidth="0.7" />
                                                            </g>
                                                        ))}
                                                    </svg>

                                                    {/* Items */}
                                                    <div
                                                        style={{
                                                            position: "absolute",
                                                            inset: 0,
                                                            display: "flex",
                                                            alignItems: "stretch",
                                                            padding: MARGIN * scale,
                                                            zIndex: 2,
                                                            pointerEvents: "none",
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                display: "flex",
                                                                flexDirection: "column",
                                                                alignItems: "stretch",
                                                                gap: 12 * scale,
                                                                width: "100%",
                                                                pointerEvents: "auto",
                                                            }}
                                                        >
                                                            {(() => {
                                                                const denominator = isFinite(maxRefs) ? maxRefs : (usedRefs > 0 ? usedRefs : 1);
                                                                const contentAreaH = (DOC_H - 2 * MARGIN) * scale;
                                                                const totalGapH = Math.max(0, pageItems.length - 1) * 12 * scale;
                                                                const itemBodyH = contentAreaH - totalGapH;

                                                                return pageItems.map(item => {
                                                                    const color = PALETTE[item.colorIdx % PALETTE.length];
                                                                    const isSelected = selectedId === item.id;
                                                                    const referenceCount = item.records.length;
                                                                    const itemH = Math.max(48 * scale, (referenceCount / denominator) * itemBodyH);

                                                                    return (
                                                                        <ContextMenu key={item.id}>
                                                                            <ContextMenuTrigger>
                                                                                <div
                                                                                    onClick={e => {
                                                                                        e.stopPropagation();
                                                                                        if (!isLocked) setSelectedId(item.id);
                                                                                    }}
                                                                                    style={{
                                                                                        display: "flex",
                                                                                        alignItems: "center",
                                                                                        justifyContent: "space-between",
                                                                                        gap: 10 * scale,
                                                                                        width: "100%",
                                                                                        height: itemH,
                                                                                        padding: `${9 * scale}px ${10 * scale}px ${9 * scale}px ${12 * scale}px`,
                                                                                        border: `${(isSelected ? 1.4 : 1) * scale}px solid ${hexToRgba(color, isSelected ? 0.62 : 0.28)}`,
                                                                                        borderRadius: 6 * scale,
                                                                                        background: `linear-gradient(90deg, ${hexToRgba(color, 0.12)} 0 ${4 * scale}px, rgba(255,255,255,0.96) ${4 * scale}px 100%)`,
                                                                                        boxShadow: isSelected
                                                                                            ? `0 ${9 * scale}px ${22 * scale}px ${hexToRgba(color, 0.18)}, inset 0 0 0 ${1 * scale}px rgba(255,255,255,0.72)`
                                                                                            : `0 ${6 * scale}px ${16 * scale}px rgba(15,23,42,0.09), inset 0 0 0 ${1 * scale}px rgba(255,255,255,0.72)`,
                                                                                        opacity: referenceCount === 0 ? 0.46 : 1,
                                                                                        transform: isSelected ? `translateY(${-1 * scale}px)` : "translateY(0)",
                                                                                        transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, opacity 160ms ease",
                                                                                        cursor: isLocked ? "default" : "pointer",
                                                                                    }}
                                                                                >
                                                                                    <div
                                                                                        style={{
                                                                                            display: "flex",
                                                                                            minWidth: 0,
                                                                                            flexDirection: "column",
                                                                                            alignItems: "flex-start",
                                                                                            gap: 3 * scale,
                                                                                        }}
                                                                                    >
                                                                                        <span
                                                                                            style={{
                                                                                                color: "#64748b",
                                                                                                fontSize: 6.8 * scale,
                                                                                                lineHeight: 1,
                                                                                                fontWeight: 800,
                                                                                                letterSpacing: 0.4 * scale,
                                                                                                textTransform: "uppercase",
                                                                                            }}
                                                                                        >
                                                                                            Gruppo scelto
                                                                                        </span>

                                                                                        <span
                                                                                            style={{
                                                                                                color: "#1f2937",
                                                                                                fontSize: (isSelected ? 23 : 22) * scale,
                                                                                                lineHeight: 1.12,
                                                                                                fontWeight: isSelected ? 800 : 760,
                                                                                                textAlign: "left",
                                                                                                overflowWrap: "anywhere",
                                                                                            }}
                                                                                        >
                                                                                            {(() => {
                                                                                                const dotIdx = item.label.indexOf(" · ");
                                                                                                if (dotIdx === -1) return item.label;
                                                                                                const gruppo = item.label.slice(0, dotIdx);
                                                                                                const reparto = item.label.slice(dotIdx + 3);
                                                                                                return (
                                                                                                    <>
                                                                                                        {gruppo}
                                                                                                        <span style={{ color: "#94a3b8", fontWeight: 500 }}> · </span>
                                                                                                        <span style={{ color }}>{reparto}</span>
                                                                                                    </>
                                                                                                );
                                                                                            })()}
                                                                                        </span>

                                                                                        <span
                                                                                            style={{
                                                                                                color,
                                                                                                fontSize: 16 * scale,
                                                                                                lineHeight: 1,
                                                                                                fontWeight: 700,
                                                                                            }}
                                                                                        >
                                                                                            {referenceCount} {referenceCount === 1 ? "referenza" : "referenze"}
                                                                                        </span>
                                                                                    </div>

                                                                                    {!isLocked && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={e => {
                                                                                                e.stopPropagation();
                                                                                                removePlacedLabel(item.id);
                                                                                            }}
                                                                                            title="Rimuovi"
                                                                                            style={{
                                                                                                display: "flex",
                                                                                                alignItems: "center",
                                                                                                justifyContent: "center",
                                                                                                width: 20 * scale,
                                                                                                height: 20 * scale,
                                                                                                flexShrink: 0,
                                                                                                background: hexToRgba(color, 0.08),
                                                                                                border: `${1 * scale}px solid ${hexToRgba(color, 0.22)}`,
                                                                                                borderRadius: 4 * scale,
                                                                                                color,
                                                                                                cursor: "pointer",
                                                                                                padding: 0,
                                                                                            }}
                                                                                        >
                                                                                            <Lucide icon="X" className="h-3 w-3" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            </ContextMenuTrigger>

                                                                            {!isLocked && (
                                                                                <ContextMenuContent className="z-[999999] bg-white text-slate-700 border border-slate-200 shadow-xl">
                                                                                    <ContextMenuItem
                                                                                        onClick={() => setSelectedId(item.id)}
                                                                                    >
                                                                                        <Lucide icon="MousePointer2" className="h-3.5 w-3.5" />
                                                                                        Seleziona
                                                                                    </ContextMenuItem>
                                                                                    <ContextMenuSeparator />
                                                                                    <ContextMenuItem
                                                                                        onClick={() => removePlacedLabel(item.id)}
                                                                                        className="text-red-500"
                                                                                    >
                                                                                        <Lucide icon="Trash" className="h-3.5 w-3.5" />
                                                                                        Elimina
                                                                                    </ContextMenuItem>
                                                                                </ContextMenuContent>
                                                                            )}
                                                                        </ContextMenu>
                                                                    );
                                                                });
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* Lock overlay — cattura tutti i pointer events quando la pagina è bloccata */}
                                                    {isLocked && (
                                                        <div
                                                            style={{
                                                                position: "absolute",
                                                                inset: 0,
                                                                zIndex: 10,
                                                                background: hexToRgba(pageLabelColor, 0.05),
                                                                display: "flex",
                                                                alignItems: "center",
                                                                justifyContent: "center",
                                                                pointerEvents: "all",
                                                                cursor: "default",
                                                                userSelect: "none",
                                                            }}
                                                            onClick={e => e.stopPropagation()}
                                                            onPointerDown={e => e.stopPropagation()}
                                                        >
                                                            <span
                                                                style={{
                                                                    fontSize: 58 * scale,
                                                                    fontWeight: 900,
                                                                    color: hexToRgba(pageLabelColor, 0.14),
                                                                    textTransform: "uppercase",
                                                                    letterSpacing: 4 * scale,
                                                                    textAlign: "center",
                                                                    lineHeight: 1.1,
                                                                    maxWidth: "82%",
                                                                    overflowWrap: "break-word",
                                                                    pointerEvents: "none",
                                                                }}
                                                            >
                                                                {pageLabel.text}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Empty page hint */}
                                                    {pageItems.length === 0 && !isLocked && (
                                                        <div
                                                            className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                                                            style={{ zIndex: 0 }}
                                                        >
                                                            <span
                                                                className="font-black select-none"
                                                                style={{ fontSize: 100 * scale, color: "#edf2f7", lineHeight: 1 }}
                                                            >
                                                                {pageIdx + 1}
                                                            </span>
                                                            <span
                                                                className="select-none mt-1"
                                                                style={{ fontSize: 11 * scale, color: "#c8d2dd", letterSpacing: 0.2 }}
                                                            >
                                                                Trascina i contenuti dalla lista
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Note di pagina — annotazioni, NON contenuto stampabile.
                                                        Linguetta compatta attaccata al BORDO SUPERIORE, fuori dall'area di
                                                        contenuto (translateY -100%), così non copre nulla. È SEMPRE visibile
                                                        quando ci sono note (anche col pannello aperto: stanno in punti diversi),
                                                        quindi compare subito al drop. Click = apri/chiudi il pannello. */}
                                                    {hasNotes && (
                                                        <button
                                                            type="button"
                                                            onClick={e => { e.stopPropagation(); if (isNotesOpen) closeNotesPanel(pageIdx); else setOpenNotesPage(pageIdx); }}
                                                            onPointerDown={e => e.stopPropagation()}
                                                            title={isNotesOpen ? "Chiudi note" : `${notes.length} ${notes.length === 1 ? "nota" : "note"} — clicca per aprire`}
                                                            className={clsx(
                                                                "absolute z-40 flex items-center gap-1.5 rounded-t-xl border border-b-0 px-2.5 py-1 shadow-[0_-10px_22px_-16px_rgba(180,83,9,0.85)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70",
                                                                isNotesOpen
                                                                    ? "border-amber-300 bg-gradient-to-r from-amber-200 via-amber-100 to-orange-100 text-amber-900 dark:border-amber-400/60 dark:from-amber-500/25 dark:via-amber-900/80 dark:to-darkmode-700 dark:text-amber-100"
                                                                    : "border-amber-200 bg-gradient-to-r from-amber-100 via-white to-orange-50 text-amber-800 hover:border-amber-300 hover:shadow-[0_-12px_26px_-16px_rgba(180,83,9,0.95)] dark:border-amber-500/35 dark:from-amber-500/15 dark:via-darkmode-700 dark:to-darkmode-700 dark:text-amber-200 dark:hover:border-amber-400/60",
                                                            )}
                                                            style={{ right: 12, top: 0, transform: "translateY(-100%)" }}
                                                        >
                                                            <Lucide icon="StickyNote" className="h-3.5 w-3.5" />
                                                            <span className="text-[11px] font-bold leading-none tabular-nums">
                                                                {notes.length}
                                                            </span>
                                                        </button>
                                                    )}

                                                    {isNotesOpen && (
                                                        <div
                                                            className="absolute z-40 flex max-h-full w-72 max-w-full flex-col overflow-hidden rounded-2xl border border-amber-200/80 bg-white/95 shadow-[0_24px_70px_-32px_rgba(146,64,14,0.55),0_10px_28px_-20px_rgba(15,23,42,0.45)] backdrop-blur dark:border-amber-500/30 dark:bg-darkmode-700/95"
                                                            style={isSingleColumn
                                                                // In colonna singola la pagina occupa tutta la larghezza:
                                                                // il pannello si apre dentro il foglio per non creare overflow
                                                                ? { right: 8, top: 8 }
                                                                : { left: "100%", top: 0, marginLeft: 8 }}
                                                            onClick={e => e.stopPropagation()}
                                                            onPointerDown={e => e.stopPropagation()}
                                                        >
                                                            <div className="flex items-start justify-between gap-3 border-b border-amber-100/80 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-3.5 py-3 dark:border-amber-500/20 dark:from-amber-500/10 dark:via-darkmode-700 dark:to-darkmode-700">
                                                                <div className="flex min-w-0 items-start gap-2.5">
                                                                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25">
                                                                        <Lucide icon="StickyNote" className="h-4 w-4" />
                                                                    </span>
                                                                    <div className="min-w-0">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="truncate text-xs font-semibold text-slate-700 dark:text-slate-100">
                                                                                Note pagina {pageIdx + 1}
                                                                            </span>
                                                                            {notes.length > 0 && (
                                                                                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold leading-none text-amber-700 ring-1 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-400/25">
                                                                                    {notes.length}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="mt-0.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
                                                                            Promemoria interni, esclusi dagli export.
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => closeNotesPanel(pageIdx)}
                                                                    title="Chiudi"
                                                                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/80 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 dark:text-slate-500 dark:hover:bg-darkmode-600 dark:hover:text-slate-200"
                                                                >
                                                                    <Lucide icon="X" className="h-3.5 w-3.5" />
                                                                </button>
                                                            </div>
                                                            <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.10),transparent_42%)] p-3">
                                                                {notes.length === 0 ? (
                                                                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/60 px-3 py-5 text-center dark:border-amber-500/25 dark:bg-amber-500/10">
                                                                        <Lucide icon="PencilLine" className="mx-auto mb-2 h-4 w-4 text-amber-500 dark:text-amber-300" />
                                                                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                                                                            Nessuna nota per questa pagina.
                                                                        </p>
                                                                        <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                                                                            Aggiungi un promemoria operativo.
                                                                        </p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-2.5">
                                                                        {notes.map((note, noteIdx) => (
                                                                            <div key={note.id} className="group/note relative overflow-hidden rounded-xl border border-amber-100 bg-white p-2.5 shadow-[0_10px_28px_-22px_rgba(146,64,14,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_16px_34px_-24px_rgba(146,64,14,0.75)] dark:border-amber-500/15 dark:bg-darkmode-600">
                                                                                <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-amber-300/80 dark:bg-amber-300/50" />
                                                                                <div className="mb-2 flex items-center justify-between gap-2 pl-1">
                                                                                    <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:text-slate-300">
                                                                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-400 dark:bg-amber-300" />
                                                                                        Nota {noteIdx + 1}
                                                                                    </span>
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => removePageNote(pageIdx, note.id)}
                                                                                        title="Elimina nota"
                                                                                        className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 opacity-70 transition-all hover:bg-red-50 hover:text-red-500 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 dark:text-slate-500 dark:hover:bg-red-500/10 dark:hover:text-red-300"
                                                                                    >
                                                                                        <Lucide icon="Trash2" className="h-3.5 w-3.5" />
                                                                                    </button>
                                                                                </div>
                                                                                <FormTextarea
                                                                                    autoFocus={noteIdx === notes.length - 1}
                                                                                    borderless
                                                                                    rows={4}
                                                                                    value={note.text}
                                                                                    onChange={e => updatePageNote(pageIdx, note.id, e.target.value)}
                                                                                    placeholder="Scrivi un promemoria…"
                                                                                    className="min-h-[88px] resize-none bg-transparent px-1 py-0 text-xs leading-relaxed text-slate-600 shadow-none placeholder:text-slate-400 focus:ring-0 dark:bg-transparent dark:text-slate-200 dark:placeholder:text-slate-500"
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="border-t border-amber-100/80 bg-white/80 p-2.5 dark:border-amber-500/20 dark:bg-darkmode-700/80">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addPageNote(pageIdx)}
                                                                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 py-2 text-xs font-semibold text-amber-800 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-100 hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:translate-y-0 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:border-amber-400/50 dark:hover:bg-amber-500/15"
                                                                >
                                                                    <Lucide icon="Plus" className="h-3.5 w-3.5" /> Aggiungi nota
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                </div>

                                                    {/* Insert page right */}
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); insertPageAt(pageIdx + 1); }}
                                                        title="Inserisci pagina a destra"
                                                        className="absolute -right-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-400 shadow-md opacity-0 transition-all duration-150 hover:border-primary hover:text-primary hover:scale-110 hover:shadow-lg group-hover/page:opacity-100 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary"
                                                    >
                                                        <Lucide icon="Plus" className="h-4 w-4" />
                                                    </button>
                                                </div>

                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {selectedItem && (
                    isPreviewPanelOpen ? (
                        <aside className="absolute inset-y-0 right-0 z-30 flex w-full max-w-[24rem] flex-shrink-0 flex-col border-l border-slate-200/80 bg-white shadow-2xl dark:border-darkmode-400 dark:bg-darkmode-600 lg:static lg:z-auto lg:w-96 lg:max-w-none lg:shadow-none">
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                                <div className="flex min-w-0 items-start gap-2.5">
                                    <span
                                        className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded border"
                                        style={{
                                            color: selectedColor,
                                            borderColor: hexToRgba(selectedColor, 0.28),
                                            background: hexToRgba(selectedColor, 0.08),
                                        }}
                                    >
                                        <Lucide icon="List" className="h-4 w-4" />
                                    </span>
                                    <div className="min-w-0">
                                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                            Anteprima referenze
                                        </div>
                                        <div className="truncate text-sm font-semibold text-slate-700 dark:text-slate-100">
                                            {selectedItem.label}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-shrink-0 items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleCopiaCodici}
                                        disabled={selectedPreviewItems.every(item => !item.codice || item.codice === "—")}
                                        title={codiciCopiati ? "Codici copiati" : "Copia tutti i codici"}
                                    >
                                        <Lucide
                                            icon={codiciCopiati ? "Check" : "Copy"}
                                            className={clsx("h-3.5 w-3.5", codiciCopiati && "text-green-500")}
                                        />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsPreviewPanelOpen(false)}
                                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-600 active:scale-[0.98] dark:hover:bg-darkmode-600 dark:hover:text-slate-200"
                                        title="Nascondi anteprima"
                                    >
                                        <Lucide icon="PanelRightClose" className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 border-b border-slate-200/80 px-4 py-3 text-xs dark:border-darkmode-400">
                                <div className="rounded border border-slate-200/80 bg-slate-50 px-2.5 py-2 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                                    <div className="text-slate-400">Referenze</div>
                                    <div className="mt-0.5 font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                                        {selectedPreviewItems.length}
                                    </div>
                                </div>
                                <div className="rounded border border-slate-200/80 bg-slate-50 px-2.5 py-2 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                                    <div className="text-slate-400">Pagine</div>
                                    <div className="mt-0.5 font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                                        {selectedGroupPagesLabel}
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-3">
                                {selectedPreviewItems.length === 0 ? (
                                    <div className="flex h-full flex-col items-center justify-center gap-2 px-5 text-center text-sm text-slate-400">
                                        <Lucide icon="ImageOff" className="h-6 w-6 text-slate-300" />
                                        Nessuna referenza disponibile per il gruppo selezionato.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2">
                                        {selectedPreviewItems.map((preview, index) => (
                                            <div
                                                key={`${preview.codice}-${index}`}
                                                className="flex gap-3 rounded border border-slate-200/80 bg-slate-50/70 p-2.5 transition-colors hover:border-slate-300 hover:bg-white dark:border-darkmode-400 dark:bg-darkmode-700/30 dark:hover:bg-darkmode-700/60"
                                            >
                                                <div className="relative flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-darkmode-400 dark:bg-darkmode-600">
                                                    <Lucide icon="Image" className="h-6 w-6 text-slate-300" />
                                                    {preview.foto_url && (
                                                        <img
                                                            src={preview.foto_url}
                                                            alt=""
                                                            className="absolute inset-0 h-full w-full object-contain p-1"
                                                            loading="lazy"
                                                            onError={e => {
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                                            style={{ background: selectedColor }}
                                                        />
                                                        <span className="truncate text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-100">
                                                            {preview.codice}
                                                        </span>
                                                    </div>
                                                    <div
                                                        className="mt-1 text-xs leading-snug text-slate-500 dark:text-slate-300"
                                                        style={{
                                                            display: "-webkit-box",
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient: "vertical",
                                                            overflow: "hidden",
                                                        }}
                                                        title={preview.descrizione}
                                                    >
                                                        {preview.descrizione}
                                                    </div>
                                                    <div className="mt-2 inline-flex max-w-full items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-300">
                                                        <Lucide icon="Layers3" className="h-3 w-3 flex-shrink-0" />
                                                        <span className="truncate">{preview.reparto}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </aside>
                    ) : (
                        <div className="flex w-9 flex-shrink-0 flex-col items-center border-l border-slate-200/80 bg-slate-50/80 pt-3 dark:border-darkmode-400 dark:bg-darkmode-700/40">
                            <button
                                type="button"
                                onClick={() => setIsPreviewPanelOpen(true)}
                                className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-600 active:scale-[0.98] dark:hover:bg-darkmode-600 dark:hover:text-slate-200"
                                title="Mostra anteprima"
                            >
                                <Lucide icon="PanelRightOpen" className="h-3.5 w-3.5" />
                            </button>
                            <div
                                className="mt-3 h-8 w-1 rounded-full"
                                style={{ background: selectedColor }}
                            />
                        </div>
                    )
                )}
            </div>

            {/* ── Status bar ── */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/80 bg-white px-4 py-2 text-xs text-slate-500 select-none dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-400">
                <span>A4 · {DOC_W}x{DOC_H}pt</span>
                <span className="text-slate-300">·</span>
                <span>{pageRows.length} {pageRows.length === 1 ? "riga" : "righe"}</span>
                <span className="text-slate-300">·</span>
                <span>{items.length} elementi</span>
                {lockedPageCount > 0 && (
                    <>
                        <span className="text-slate-300">·</span>
                        <span>{lockedPageCount} {lockedPageCount === 1 ? "pagina bloccata" : "pagine bloccate"}</span>
                    </>
                )}
                <span className="text-slate-300">·</span>
                <span>{toolMode === "pan" ? "Mano" : "Cursore"} · Ctrl+rotella zoom · V/H modalità</span>
                {selectedId && (
                    <>
                        <span className="text-slate-300">·</span>
                        <span className="font-medium text-primary">1 selezionato</span>
                        <span className="ml-auto text-slate-400">Canc · Esc</span>
                    </>
                )}
            </div>

            <Dialog
                open={!!pendingPageRemoval}
                onClose={() => setPendingPageRemoval(null)}
                className="z-[100000]"
                centered
            >
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium text-slate-700 dark:text-slate-100">
                            Rimuovi pagina
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            La pagina {pendingPageRemoval ? pendingPageRemoval.pageIndex + 1 : ""} contiene{" "}
                            {pendingPageRemoval?.referenceCount ?? 0}{" "}
                            {(pendingPageRemoval?.referenceCount ?? 0) === 1 ? "referenza" : "referenze"}
                            {pendingPageRemoval?.hasLabel ? " e un'etichetta" : ""}. Vuoi rimuoverla comunque?
                        </p>
                    </Dialog.Description>
                    <Dialog.Footer>
                        <button
                            type="button"
                            onClick={() => setPendingPageRemoval(null)}
                            className="mr-2 inline-flex h-9 items-center justify-center rounded border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-200 dark:hover:bg-darkmode-500"
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                if (!pendingPageRemoval) return;
                                removePageAtIndex(pendingPageRemoval.pageIndex);
                            }}
                            className="inline-flex h-9 items-center justify-center rounded border border-danger bg-danger px-4 text-sm font-medium text-white transition-colors hover:bg-danger/90"
                        >
                            Rimuovi
                        </button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>

            <Dialog
                open={isClearAllDialogOpen}
                onClose={() => setIsClearAllDialogOpen(false)}
                className="z-[100000]"
                centered
            >
                <Dialog.Panel>
                    <Dialog.Title>
                        <h2 className="mr-auto text-base font-medium text-slate-700 dark:text-slate-100">
                            Elimina tutto
                        </h2>
                    </Dialog.Title>
                    <Dialog.Description>
                        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                            Verranno rimosse tutte le referenze e le etichette del menabò corrente.
                        </p>
                    </Dialog.Description>
                    <Dialog.Footer>
                        <button
                            type="button"
                            onClick={() => setIsClearAllDialogOpen(false)}
                            className="mr-2 inline-flex h-9 items-center justify-center rounded border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-darkmode-400 dark:bg-darkmode-600 dark:text-slate-200 dark:hover:bg-darkmode-500"
                        >
                            Annulla
                        </button>
                        <button
                            type="button"
                            onClick={clearAllContent}
                            className="inline-flex h-9 items-center justify-center rounded border border-danger bg-danger px-4 text-sm font-medium text-white transition-colors hover:bg-danger/90"
                        >
                            Elimina tutto
                        </button>
                    </Dialog.Footer>
                </Dialog.Panel>
            </Dialog>
        </div>
    );
}
