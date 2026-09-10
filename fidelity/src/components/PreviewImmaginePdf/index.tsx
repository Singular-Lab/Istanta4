import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Lucide from "../Base/Lucide";

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
    const [isPreloading, setIsPreloading] = useState(true);

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
    /* PRELOAD TUTTE LE PAGINE                                             */
    /* ------------------------------------------------------------------ */

    useEffect(() => {
        let loaded = 0;
        setIsPreloading(true);

        for (let page = 1; page <= totalPages; page++) {
            const img = new Image();
            img.src = `${imageUrl}&page=${page}`;
            img.onload = () => {
                loaded++;
                if (loaded === totalPages) {
                    setIsPreloading(false);
                }
            };
        }
    }, [imageUrl, totalPages]);

    useEffect(() => {
        const safePage = Math.min(Math.max(initialPage, 1), totalPages || 1);
        setCurrentPage(safePage > 1 ? safePage : 1);
        setIsFirstPage(safePage <= 1);
    }, [initialPage, imageUrl, totalPages]);

    /* ------------------------------------------------------------------ */
    /* PAGINE VISIBILI                                                     */
    /* ------------------------------------------------------------------ */

    const pagesToRender = useMemo(() => {
        if (isFirstPage) return [1];
        const right = currentPage + 1 <= totalPages ? currentPage + 1 : null;
        return right ? [currentPage, right] : [currentPage];
    }, [currentPage, isFirstPage, totalPages]);

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
                    >
                        <Lucide icon="ChevronLeft" />
                    </button>

                    {/* CONTENT */}
                    <div className="relative flex gap-1">
                        {isPreloading && (
                            <div className="absolute inset-0 z-20 flex items-center justify-center">
                                <Lucide
                                    icon="Loader"
                                    className="w-14 h-14 text-white animate-spin"
                                />
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
                        >
                            <Lucide icon="X" />
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
                    >
                        <Lucide icon="ChevronRight" />
                    </button>
                </div>
            </motion.div>
        </AnimatePresence>,
        portalContainer
    );
};
