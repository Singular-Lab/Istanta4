import { AnimatePresence, motion } from "framer-motion";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ServerCall } from "../../../lib/server_call";
import { TracciatiResponseDTO } from "../../../server/core/dto";
import Badge from "../../components/Base/Badge";
import Button from "../../components/Base/Button";
import { FormInput } from "../../components/Base/Form";
import Lucide from "../../components/Base/Lucide";
import PageHeader from "../../components/Base/PageHeader";
import { useNotification } from "../../context/NotificationContext";

/* =======================
   CONFIG VISIVO
   ======================= */
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 28;
const COL_WIDTH = 260;
const FONT =
    "11px Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
const PADDING_X = 8;
const OVERSCAN_ROWS = 6;
const OVERSCAN_COLS = 1;

/* =======================
   TYPES
   ======================= */
type SheetPreview = {
    name: string;
    rows: (string | number | null)[][];
};

interface LocationState {
    tracciato?: TracciatiResponseDTO;
}

/* =======================
   UTILS
   ======================= */
const formatCell = (cell: string | number | null | undefined): string => {
    if (cell === null || cell === undefined) return "-";
    const s = String(cell).trim();
    return s === "" ? "-" : s;
};

const getFileSize = (blob: any): string => {
    if (!blob?.data?.length) return "0.00";
    return (blob.data.length / (1024 * 1024)).toFixed(2);
};

const clamp = (n: number, min: number, max: number) =>
    Math.max(min, Math.min(max, n));

const ellipsize = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    const ell = "…";
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (ctx.measureText(text.slice(0, mid) + ell).width <= maxWidth) lo = mid;
        else hi = mid - 1;
    }
    return text.slice(0, lo) + ell;
};

/* =======================
   COMPONENT
   ======================= */
const DettaglioAnteprimaTracciato: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams<{ idTracciato?: string }>();
    const state = location.state as LocationState | null;
    const { showNotification } = useNotification();
    const [tracciato, setTracciato] =
        useState<TracciatiResponseDTO | null>(state?.tracciato ?? null);
    const [sheets, setSheets] = useState<SheetPreview[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [isLoading, setIsLoading] = useState(!state?.tracciato);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [hoveredCell, setHoveredCell] =
        useState<{ r: number; c: number } | null>(null);
    const [copiedCell, setCopiedCell] =
        useState<{ r: number; c: number } | null>(null);
    const [showCopyFeedback, setShowCopyFeedback] = useState(false);
    const [copyFeedbackPosition, setCopyFeedbackPosition] = useState({ x: 0, y: 0 });

    const scrollRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const headerInnerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    /* =======================
       DATA LOAD
       ======================= */
    useEffect(() => {
        if (tracciato) return;
        const id = params.idTracciato;
        if (!id) return;

        (async () => {
            try {
                setIsLoading(true);
                const res = await ServerCall.get<TracciatiResponseDTO>(
                    `/tracciati/${id}`
                );
                setTracciato(res);
            } catch (e: any) {
                setError(e?.message || "Errore caricamento tracciato");
            } finally {
                setIsLoading(false);
            }
        })();
    }, [params.idTracciato, tracciato]);

    useEffect(() => {
        if (!tracciato) return;
        (async () => {
            try {
                setIsParsing(true);
                const res = await ServerCall.get<{ sheets: SheetPreview[] }>(
                    `/tracciati/${tracciato.id}/parse`
                );
                setSheets(res.sheets);
            } catch (e: any) {
                setError(e?.message || "Errore parsing tracciato");
            } finally {
                setIsParsing(false);
            }
        })();
    }, [tracciato]);

    const activeSheet = sheets[0] ?? null;

    const { headerRow, rows } = useMemo(() => {
        if (!activeSheet) return { headerRow: [], rows: [] };
        const [header, ...body] = activeSheet.rows;
        if (!searchTerm) return { headerRow: header ?? [], rows: body };
        const q = searchTerm.toLowerCase();
        return {
            headerRow: header ?? [],
            rows: body.filter(r =>
                r.some(c => c && String(c).toLowerCase().includes(q))
            ),
        };
    }, [activeSheet, searchTerm]);

    const totalRows = rows.length;
    const totalCols = headerRow.length;
    const contentHeight = totalRows * ROW_HEIGHT;
    const contentWidth = totalCols * COL_WIDTH;

    /* =======================
       CANVAS RENDER
       ======================= */
    const draw = () => {
        const canvas = canvasRef.current;
        const scroll = scrollRef.current;
        if (!canvas || !scroll) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const w = scroll.clientWidth;
        const h = scroll.clientHeight;

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.clearRect(0, 0, w, h);
        ctx.font = FONT;
        ctx.textBaseline = "middle";

        const { scrollTop, scrollLeft } = scroll;

        if (headerInnerRef.current) {
            headerInnerRef.current.style.transform = `translateX(${-scrollLeft}px)`;
        }

        const startRow = clamp(
            Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS,
            0,
            totalRows
        );
        const endRow = clamp(
            Math.ceil((scrollTop + h) / ROW_HEIGHT) + OVERSCAN_ROWS,
            0,
            totalRows
        );

        const startCol = clamp(
            Math.floor(scrollLeft / COL_WIDTH) - OVERSCAN_COLS,
            0,
            totalCols
        );
        const endCol = clamp(
            Math.ceil((scrollLeft + w) / COL_WIDTH) + OVERSCAN_COLS,
            0,
            totalCols
        );

        for (let r = startRow; r < endRow; r++) {
            const y = r * ROW_HEIGHT - scrollTop;

            ctx.fillStyle = r % 2 === 0 ? "#fff" : "rgba(248,250,252,0.7)";
            ctx.fillRect(0, y, w, ROW_HEIGHT);

            for (let c = startCol; c < endCol; c++) {
                const x = c * COL_WIDTH - scrollLeft;

                if (hoveredCell?.r === r && hoveredCell?.c === c) {
                    ctx.fillStyle = "#e5e7eb"; // slate-200
                    ctx.fillRect(x, y, COL_WIDTH, ROW_HEIGHT);
                }

                if (copiedCell?.r === r && copiedCell?.c === c) {
                    ctx.fillStyle = "#d1fae5"; // emerald-100
                    ctx.fillRect(x, y, COL_WIDTH, ROW_HEIGHT);
                }

                ctx.strokeStyle = "#e2e8f0";
                ctx.strokeRect(x, y, COL_WIDTH, ROW_HEIGHT);

                const raw = formatCell(rows[r]?.[c]);
                const text = ellipsize(ctx, raw, COL_WIDTH - PADDING_X * 2);
                ctx.fillStyle = "#334155";
                ctx.fillText(text, x + PADDING_X, y + ROW_HEIGHT / 2);
            }
        }
    };

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        const onScroll = () => {
            if (rafRef.current) return;
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                draw();
            });
        };

        el.addEventListener("scroll", onScroll, { passive: true });
        draw();
        return () => el.removeEventListener("scroll", onScroll);
    }, [rows, headerRow, hoveredCell, copiedCell]);

    /* =======================
       EVENTS
       ======================= */
    const handleMouseMove = (e: React.MouseEvent) => {
        const scroll = scrollRef.current;
        if (!scroll) return;

        const rect = scroll.getBoundingClientRect();
        const x = e.clientX - rect.left + scroll.scrollLeft;
        const y = e.clientY - rect.top + scroll.scrollTop;

        const r = Math.floor(y / ROW_HEIGHT);
        const c = Math.floor(x / COL_WIDTH);

        if (r >= 0 && c >= 0 && r < totalRows && c < totalCols) {
            setHoveredCell({ r, c });
        } else {
            setHoveredCell(null);
        }
    };

    const handleMouseLeave = () => {
        setHoveredCell(null);
    };

    const handleClick = async (e: React.MouseEvent) => {
        if (!hoveredCell) return;
        const value = formatCell(rows[hoveredCell.r]?.[hoveredCell.c]);
        const columnName = formatCell(headerRow[hoveredCell.c]);

        try {
            // Try modern Clipboard API first (requires HTTPS in production)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                // Fallback for older browsers or non-HTTPS contexts
                const textarea = document.createElement("textarea");
                textarea.value = value;
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                textarea.style.top = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }

            // Show feedback at click position
            setCopyFeedbackPosition({ x: e.clientX, y: e.clientY });
            setShowCopyFeedback(true);

            // Highlight copied cell
            setCopiedCell(hoveredCell);

            // Clear feedback after animation
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
            copyTimeoutRef.current = setTimeout(() => {
                setCopiedCell(null);
                setShowCopyFeedback(false);
            }, 1200);
        } catch (err) {
            showNotification(
                <div className="flex items-center gap-2 text-danger">
                    <Lucide icon="CircleAlert" className="w-4 h-4" />
                    <span>Impossibile copiare il valore</span>
                </div>
            );
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
        };
    }, []);

    /* =======================
       RENDER
       ======================= */
    return (
        <div className="space-y-5">
            <PageHeader title="Anteprima Tracciato" description="Visualizza un'anteprima dettagliata del tracciato selezionato" />

            {/* Action Bar */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-between items-center"
            >
                <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>
                    <Lucide icon="ArrowLeft" className="w-4 h-4 mr-2" />
                    Torna indietro
                </Button>

                {tracciato && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-3"
                    >
                        <Badge variant="info" className="flex items-center gap-1.5">
                            <Lucide icon="FileSpreadsheet" className="w-3.5 h-3.5" />
                            {tracciato.filename || "Tracciato"}
                        </Badge>
                        {tracciato.blobfile && (
                            <Badge variant="info" className="flex items-center gap-1.5">
                                <Lucide icon="HardDrive" className="w-3.5 h-3.5" />
                                {getFileSize(tracciato.blobfile)} MB
                            </Badge>
                        )}
                    </motion.div>
                )}
            </motion.div>

            <div className="box box--stacked">
                <div className="p-5 space-y-5">
                    {isLoading || isParsing ? (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-16 gap-4"
                        >
                            <div className="relative">
                                <Lucide
                                    icon="Loader"
                                    className="w-10 h-10 text-primary animate-spin"
                                />
                            </div>
                            <p className="text-slate-600 font-medium">
                                {isLoading ? "Caricamento tracciato..." : "Analisi dati in corso..."}
                            </p>
                        </motion.div>
                    ) : error ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex flex-col items-center justify-center py-16 gap-3"
                        >
                            <div className="rounded-full bg-danger/10 p-4">
                                <Lucide icon="CircleAlert" className="w-8 h-8 text-danger" />
                            </div>
                            <p className="text-danger font-semibold">{error}</p>
                        </motion.div>
                    ) : (
                        <>
                            {/* Stats Bar */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center justify-between gap-4 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-lg border border-slate-200"
                            >
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-blue-100 p-2">
                                            <Lucide icon="Table2" className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Righe totali</p>
                                            <p className="text-lg font-bold text-slate-800">
                                                {rows.length.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="h-10 w-px bg-slate-300" />
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-full bg-emerald-100 p-2">
                                            <Lucide icon="Columns3" className="w-4 h-4 text-emerald-600" />
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500 font-medium">Colonne</p>
                                            <p className="text-lg font-bold text-slate-800">{totalCols}</p>
                                        </div>
                                    </div>
                                    {searchTerm && (
                                        <>
                                            <div className="h-10 w-px bg-slate-300" />
                                            <div className="flex items-center gap-2">
                                                <div className="rounded-full bg-amber-100 p-2">
                                                    <Lucide icon="Search" className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium">Risultati</p>
                                                    <p className="text-lg font-bold text-slate-800">
                                                        {rows.length.toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white px-3 py-2 rounded-md border border-slate-200">
                                    <Lucide icon="Info" className="w-4 h-4" />
                                    <span>Clicca su una cella per copiarla</span>
                                </div>
                            </motion.div>

                            {/* Search Bar */}
                            <div className="relative">
                                <Lucide
                                    icon="Search"
                                    className="absolute inset-y-0 left-0 z-10 w-4 h-4 my-auto ml-3 stroke-[1.3] text-slate-500"
                                />
                                <FormInput
                                    placeholder="Cerca nel tracciato..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-10"
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute inset-y-0 right-0 z-10 my-auto mr-3 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        <Lucide icon="X" className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Data Grid */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="border overflow-hidden bg-white shadow-sm relative"
                            >
                                {/* HEADER */}
                                <div
                                    className="sticky top-0 bg-gradient-to-r from-slate-100 to-slate-50 border-b border-slate-300 z-10"
                                    style={{ height: HEADER_HEIGHT }}
                                >
                                    <div className="overflow-hidden h-full">
                                        <div
                                            ref={headerInnerRef}
                                            style={{ width: contentWidth }}
                                            className="flex"
                                        >
                                            {headerRow.map((h, i) => (
                                                <div
                                                    key={i}
                                                    className="border-r border-slate-300 px-2 py-1 text-[11px] font-bold text-slate-700 truncate uppercase tracking-wide"
                                                    style={{ width: COL_WIDTH }}
                                                    title={formatCell(h)}
                                                >
                                                    {formatCell(h)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* BODY */}
                                <div
                                    className="relative cursor-pointer"
                                    onMouseMove={handleMouseMove}
                                    onMouseLeave={handleMouseLeave}
                                    onClick={handleClick}
                                >
                                    <div
                                        ref={scrollRef}
                                        className="overflow-auto max-h-[70vh] scrollbar-enhanced"
                                    >
                                        <div
                                            style={{
                                                width: contentWidth,
                                                height: contentHeight,
                                            }}
                                        />
                                    </div>

                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 pointer-events-none"
                                    />

                                    {/* Copy Feedback Popup */}
                                    <AnimatePresence>
                                        {showCopyFeedback && (
                                            <motion.div
                                                initial={{ scale: 0, opacity: 0 }}
                                                animate={{ scale: 1, opacity: 1 }}
                                                exit={{ scale: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                                className="fixed z-50 pointer-events-none"
                                                style={{
                                                    left: copyFeedbackPosition.x,
                                                    top: copyFeedbackPosition.y,
                                                    transform: "translate(-50%, -120%)",
                                                }}
                                            >
                                                <div className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2">
                                                    <Lucide icon="Check" className="w-4 h-4" />
                                                    <span className="text-sm font-semibold">Copiato!</span>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.div>

                            {/* Footer Info */}
                            <div className="flex items-center justify-between pt-2">
                                <Badge variant="primary" className="flex items-center gap-1.5">
                                    <Lucide icon="Rows3" className="w-3.5 h-3.5" />
                                    {rows.length} {rows.length === 1 ? "riga" : "righe"} visualizzate
                                </Badge>

                                {hoveredCell && (
                                    <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        className="text-xs text-slate-500 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-md"
                                    >
                                        <Lucide icon="MousePointer2" className="w-3.5 h-3.5" />
                                        Riga {hoveredCell.r + 1}, Colonna {hoveredCell.c + 1}
                                    </motion.div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DettaglioAnteprimaTracciato;
