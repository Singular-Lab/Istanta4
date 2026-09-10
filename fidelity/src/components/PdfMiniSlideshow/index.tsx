import { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Lucide from "../Base/Lucide";
import clsx from "clsx";

interface PdfMiniSlideshowProps {
    imageUrl: string;
    totalPages: number;
    onPageClick?: (page: number) => void;
    variant?: "info" | "success";
}

export const PdfMiniSlideshow: React.FC<PdfMiniSlideshowProps> = ({
    imageUrl,
    totalPages,
    onPageClick,
    variant = "info"
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const thumbnailsRef = useRef<HTMLDivElement>(null);

    const variantColors = {
        info: {
            bg: "bg-gradient-to-b from-info/5 to-info/10",
            border: "border-info/20",
            text: "text-info",
            buttonBg: "bg-info hover:bg-info/90",
            thumbActive: "ring-2 ring-info ring-offset-2",
            thumbInactive: "ring-1 ring-slate-200 hover:ring-info/50",
            badge: "bg-info text-white"
        },
        success: {
            bg: "bg-gradient-to-b from-success/5 to-success/10",
            border: "border-success/20",
            text: "text-success",
            buttonBg: "bg-success hover:bg-success/90",
            thumbActive: "ring-2 ring-success ring-offset-2",
            thumbInactive: "ring-1 ring-slate-200 hover:ring-success/50",
            badge: "bg-success text-white"
        }
    };

    const colors = variantColors[variant];

    useEffect(() => {
        setIsLoading(true);
    }, [currentPage, imageUrl]);

    // Scroll thumbnail attiva al centro
    useEffect(() => {
        if (thumbnailsRef.current) {
            const container = thumbnailsRef.current;
            const activeThumb = container.querySelector(`[data-page="${currentPage}"]`) as HTMLElement;
            if (activeThumb) {
                const containerWidth = container.offsetWidth;
                const thumbLeft = activeThumb.offsetLeft;
                const thumbWidth = activeThumb.offsetWidth;
                const scrollTo = thumbLeft - (containerWidth / 2) + (thumbWidth / 2);
                container.scrollTo({ left: scrollTo, behavior: 'smooth' });
            }
        }
    }, [currentPage]);

    const goToNextPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPage < totalPages) {
            setCurrentPage(prev => prev + 1);
        }
    };

    const goToPrevPage = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (currentPage > 1) {
            setCurrentPage(prev => prev - 1);
        }
    };

    const handleMainImageClick = () => {
        if (onPageClick) {
            onPageClick(currentPage);
        }
    };

    const goToPage = (page: number) => {
        setCurrentPage(page);
    };

    const getPageUrl = (page: number) => {
        return `${imageUrl}&page=${page}`;
    };

    return (
        <div className={clsx(
            "rounded-xl border overflow-hidden",
            colors.bg,
            colors.border
        )}>
            {/* Immagine principale */}
            <div className="relative">
                {/* Container immagine con aspect ratio */}
                <div
                    className="relative w-full bg-white cursor-pointer group max-h-[280px]"
                    style={{ aspectRatio: '21/9' }}
                    onClick={handleMainImageClick}
                >
                    {/* Loader */}
                    <AnimatePresence>
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-slate-50 z-10"
                            >
                                <div className="flex flex-col items-center gap-2">
                                    <Lucide icon="Loader" className={`w-8 h-8 ${colors.text} animate-spin`} />
                                    <span className="text-xs text-slate-500">Caricamento...</span>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Immagine */}
                    <AnimatePresence mode="wait">
                        <motion.img
                            key={currentPage}
                            src={getPageUrl(currentPage)}
                            alt={`Pagina ${currentPage}`}
                            onLoad={() => setIsLoading(false)}
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: isLoading ? 0 : 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.02 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full object-contain"
                        />
                    </AnimatePresence>

                    {/* Overlay hover - visibile solo su hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <div className="bg-white/95 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                            <Lucide icon="Maximize2" className={`w-4 h-4 ${colors.text}`} />
                            <span className={`text-sm font-medium ${colors.text}`}>Visualizza a schermo intero</span>
                        </div>
                    </div>

                    {/* Badge pagina corrente - visibile solo su hover */}
                    <div className={clsx(
                        "absolute top-3 left-3 px-3 py-1.5 rounded-full text-xs font-semibold shadow-md transition-opacity duration-300",
                        "opacity-0 group-hover:opacity-100",
                        colors.badge
                    )}>
                        Pagina {currentPage} di {totalPages}
                    </div>

                    {/* Frecce di navigazione - visibili solo su hover */}
                    {totalPages > 1 && (
                        <>
                            <motion.button
                                onClick={goToPrevPage}
                                disabled={currentPage === 1}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className={clsx(
                                    "absolute left-3 top-1/2 -translate-y-1/2 z-20",
                                    "w-10 h-10 rounded-full shadow-lg flex items-center justify-center",
                                    "transition-all duration-200",
                                    "opacity-0 group-hover:opacity-100",
                                    currentPage === 1
                                        ? "bg-slate-100 text-slate-300 cursor-not-allowed group-hover:opacity-50"
                                        : `${colors.buttonBg} text-white`
                                )}
                            >
                                <Lucide icon="ChevronLeft" className="w-5 h-5" />
                            </motion.button>

                            <motion.button
                                onClick={goToNextPage}
                                disabled={currentPage === totalPages}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                                className={clsx(
                                    "absolute right-3 top-1/2 -translate-y-1/2 z-20",
                                    "w-10 h-10 rounded-full shadow-lg flex items-center justify-center",
                                    "transition-all duration-200",
                                    "opacity-0 group-hover:opacity-100",
                                    currentPage === totalPages
                                        ? "bg-slate-100 text-slate-300 cursor-not-allowed group-hover:opacity-50"
                                        : `${colors.buttonBg} text-white`
                                )}
                            >
                                <Lucide icon="ChevronRight" className="w-5 h-5" />
                            </motion.button>
                        </>
                    )}
                </div>
            </div>

            {/* Thumbnails carosello */}
            {totalPages > 1 && (
                <div className="p-3 bg-white/80 backdrop-blur-sm border-t border-slate-100">
                    <div
                        ref={thumbnailsRef}
                        className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent"
                        style={{ scrollbarWidth: 'thin' }}
                    >
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <motion.button
                                key={page}
                                data-page={page}
                                onClick={() => goToPage(page)}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className={clsx(
                                    "relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden transition-all duration-200",
                                    "bg-slate-100",
                                    currentPage === page ? colors.thumbActive : colors.thumbInactive
                                )}
                            >
                                <img
                                    src={getPageUrl(page)}
                                    alt={`Miniatura pagina ${page}`}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                />
                                {/* Numero pagina overlay */}
                                <div className={clsx(
                                    "absolute bottom-0 left-0 right-0 py-0.5 text-center text-[10px] font-semibold",
                                    currentPage === page
                                        ? `${colors.badge}`
                                        : "bg-black/50 text-white"
                                )}>
                                    {page}
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PdfMiniSlideshow;
