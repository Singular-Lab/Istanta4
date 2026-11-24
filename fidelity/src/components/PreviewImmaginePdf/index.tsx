import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Lucide from "../Base/Lucide";
import Spinner from "../Base/Spinner";
import { pagineDaPrecaricare, pagineVisibili } from "./paginePrecaricate";

interface PreviewImmaginePdfProps {
    imageUrl: string;
    totalPages: number;
    initialPage?: number;
    onClose: () => void;
}

export const PreviewImmaginePdf: React.FC<PreviewImmaginePdfProps> = ({
    imageUrl,
    totalPages,
    initialPage = 1,
    onClose
}) => {
    const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
    // Le pagine di cui il browser ha già l'immagine: lo spinner resta finché non ci sono quelle che si vedono
    const [pronte, setPronte] = useState<ReadonlySet<number>>(() => new Set());

    const [currentPage, setCurrentPage] = useState(initialPage > 1 ? initialPage : 1);
    const [isFirstPage, setIsFirstPage] = useState(initialPage <= 1);
    const [isTransitioning, setIsTransitioning] = useState(false);

    /* ------------------------------------------------------------------ */
    /* PORTAL                                                             */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        let container = document.getElementById("portal-root-immagini-pop");
        if (!container) {
            container = document.createElement("div");
            container.id = "portal-root-immagini-pop";
            document.body.appendChild(container);
        }
        setPortalContainer(container);
    }, []);

    /* ------------------------------------------------------------------ */
    /* PRECARICAMENTO DELLE PAGINE VICINE                                  */
    /* ------------------------------------------------------------------ */

    // Prima si scaricavano tutte le pagine all'apertura (40 richieste insieme per un volantino da 40 pagine):
    // ora quelle che si vedono e le aperture subito prima e subito dopo, perché girando siano pronte.
    useEffect(() => {
        setPronte(new Set());
    }, [imageUrl, totalPages]);

    useEffect(() => {
        const pagine = pagineDaPrecaricare(currentPage, isFirstPage, totalPages);
        for (const page of pagine) {
            const img = new Image();
            img.onload = () => setPronte(prima => (prima.has(page) ? prima : new Set(prima).add(page)));
            img.src = `${imageUrl}&page=${page}`;
        }
    }, [imageUrl, totalPages, currentPage, isFirstPage]);

    useEffect(() => {
        const safePage = Math.min(Math.max(initialPage, 1), totalPages || 1);
        setCurrentPage(safePage > 1 ? safePage : 1);
        setIsFirstPage(safePage <= 1);
    }, [initialPage, imageUrl, totalPages]);

    /* ------------------------------------------------------------------ */
    /* PAGINE VISIBILI                                                     */
    /* ------------------------------------------------------------------ */

    const pagesToRender = useMemo(() => pagineVisibili(currentPage, isFirstPage, totalPages), [currentPage, isFirstPage, totalPages]);
    const isPreloading = pagesToRender.some(page => !pronte.has(page));

    /* ------------------------------------------------------------------ */
    /* NAVIGAZIONE                                                         */
    /* ------------------------------------------------------------------ */

    const goNext = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);

        if (isFirstPage) {
            setIsFirstPage(false);
            setCurrentPage(2);
        } else {
            const next = currentPage + 2;
            if (next <= totalPages) {
                setCurrentPage(next);
            }
        }
    };

    const goPrev = () => {
        if (isTransitioning) return;
        setIsTransitioning(true);

        if (currentPage === 2) {
            setIsFirstPage(true);
            setCurrentPage(1);
        } else {
            const prev = currentPage - 2;
            if (prev >= 1) {
                setCurrentPage(prev);
            }
        }
    };

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "ArrowRight") goNext();
            if (e.key === "ArrowLeft") goPrev();
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [currentPage, isFirstPage, isTransitioning]);

    useEffect(() => {
        setIsTransitioning(false);
    }, [currentPage, isFirstPage]);

    const hasPrev = !isFirstPage;
    const hasNext = isFirstPage
        ? totalPages > 1
        : currentPage + 2 <= totalPages;

    if (!portalContainer) return null;

    /* ------------------------------------------------------------------ */
    /* RENDER                                                              */
    /* ------------------------------------------------------------------ */

    return createPortal(
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-[1000000] flex items-center justify-center bg-black/80"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <div
                    className="relative flex items-center"
                    onClick={e => e.stopPropagation()}
                >
                    {/* LEFT */}
                    <button
                        onClick={goPrev}
                        disabled={!hasPrev}
                        className={clsx(
                            "absolute left-[-60px] rounded-full bg-black/60 p-3 text-white",
                            !hasPrev && "opacity-30 cursor-not-allowed"
                        )}
                        aria-label="Pagina precedente"
                    >
                        <Lucide aria-hidden="true" icon="ChevronLeft" />
                    </button>

                    {/* CONTENT */}
                    <div className="relative flex gap-1">
                        {isPreloading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                                <Spinner size="lg" etichetta="Caricamento anteprima" className="text-white" />
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={pagesToRender.join("-")}
                                className="flex gap-1"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 1.05 }}
                                transition={{ duration: 0.3 }}
                            >
                                {pagesToRender.map((page, i) => (
                                    <img
                                        key={page}
                                        src={`${imageUrl}&page=${page}`}
                                        className={clsx(
                                            "max-h-[85vh] bg-white max-w-[45vw] object-contain shadow-2xl",
                                            i === 0 && "rounded-l-md",
                                            i === pagesToRender.length - 1 && "rounded-r-md"
                                        )}
                                        alt={`Pagina ${page}`}
                                    />
                                ))}
                            </motion.div>
                        </AnimatePresence>

                        {/* CLOSE */}
                        <button
                            onClick={onClose}
                            className="absolute top-2 right-2 rounded-full bg-black/60 p-2 text-white"
                            aria-label="Chiudi anteprima"
                        >
                            <Lucide aria-hidden="true" icon="X" />
                        </button>

                        {/* PAGE INDICATOR */}
                        <div className="absolute top-2 left-2 bg-black/60 px-3 py-1 text-sm text-white rounded-full">
                            {pagesToRender.join("-")} / {totalPages}
                        </div>
                    </div>

                    {/* RIGHT */}
                    <button
                        onClick={goNext}
                        disabled={!hasNext}
                        className={clsx(
                            "absolute right-[-60px] rounded-full bg-black/60 p-3 text-white",
                            !hasNext && "opacity-30 cursor-not-allowed"
                        )}
                        aria-label="Pagina successiva"
                    >
                        <Lucide aria-hidden="true" icon="ChevronRight" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>,
        portalContainer
    );
};
