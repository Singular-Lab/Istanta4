import { useCallback, useRef, useMemo } from "react";
import { SitemapType } from "../../../../../lib/types";
import { useDrag, useDrop, XYCoord } from "react-dnd";
import Lucide from "@/components/Base/Lucide";
import Button from "@/components/Base/Button";
import { FormSelect } from "@/components/Base/Form";
import React from "react";

const ItemTypes = {
    SITEMAP: "sitemap",
    SITEMAP_PAGE: "sitemap_page",
};

const PageItem: React.FC<{
    page: { id: string; titolo: string };
    pageIndex: number;
    parentIndex: number;
    moveChildPage: (dragIndex: number, hoverIndex: number) => void;
    sitemaps: SitemapType[];
    setSitemaps: React.Dispatch<React.SetStateAction<SitemapType[]>>;
    dataWorkspace: any;
}> = React.memo(({
    page,
    pageIndex,
    parentIndex,
    moveChildPage,
    sitemaps,
    setSitemaps,
    dataWorkspace,
}) => {
    const dropRef = useRef<HTMLLIElement | null>(null);
    const dragRef = useRef<HTMLDivElement | null>(null);

    const [{ isDragging }, drag, preview] = useDrag({
        type: ItemTypes.SITEMAP_PAGE,
        item: { pageIndex, parentIndex },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [{ isOver }, drop] = useDrop({
        accept: ItemTypes.SITEMAP_PAGE,
        hover(item: { pageIndex: number; parentIndex: number }, monitor) {
            if (!dropRef.current) return;
            if (item.parentIndex !== parentIndex) return;

            const dragIndex = item.pageIndex;
            const hoverIndex = pageIndex;
            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = dropRef.current?.getBoundingClientRect();
            if (!hoverBoundingRect) return;

            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset() as XYCoord;
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveChildPage(dragIndex, hoverIndex);
            item.pageIndex = hoverIndex;
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
        }),
    });

    drop(dropRef);
    preview(dropRef);
    drag(dragRef);

    // Memoizza le opzioni disponibili per evitare calcoli ripetuti
    const availablePages = useMemo(() => {
        if (!dataWorkspace?.webpliant) return [];
        
        return dataWorkspace.webpliant.filter((wp: any) => 
            !sitemaps[parentIndex]?.pagine_collegate?.find((p) => p.id === wp.id)
        );
    }, [dataWorkspace?.webpliant, sitemaps, parentIndex]);

    // Callback memoizzati
    const removePage = useCallback(() => {
        setSitemaps(prev =>
            prev.map((sitemap, idx) => {
                if (idx === parentIndex) {
                    return {
                        ...sitemap,
                        pagine_collegate: sitemap.pagine_collegate.filter((pc) => pc !== page),
                    };
                }
                return sitemap;
            })
        );
    }, [setSitemaps, parentIndex, page]);

    const updatePage = useCallback((selectedId: string) => {
        setSitemaps(prev => {
            const copy = [...prev];
            const current = copy[parentIndex];
            if (!current) return copy;

            const found = dataWorkspace?.webpliant?.find((p: any) => p.id === selectedId);
            if (!found) return copy;

            const newPages = current.pagine_collegate.map((pg) => {
                if (pg === page) {
                    return {
                        id: selectedId,
                        titolo: found.nome || "",
                    };
                }
                return pg;
            });

            copy[parentIndex] = {
                ...current,
                pagine_collegate: newPages,
            };
            return copy;
        });
    }, [setSitemaps, parentIndex, page, dataWorkspace]);

    const confirmSelection = useCallback(() => {
        // Qui puoi aggiungere logica extra se necessario
        // ad es. finalizzare la selezione.
    }, []);

    // Render condizionale basato su se la pagina ha un ID
    const isPageSelected = page.id !== "";
    
    return (
        <li
            ref={dropRef}
            className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1"
            style={{
                opacity: isDragging ? 0.5 : 1,
            }}
        >
            {/* Handle / icona di spostamento */}
            <div
                ref={dragRef}
                className="text-gray-400 hover:text-gray-600 cursor-move flex items-center"
            >
                <Lucide icon="Move" className="w-4 h-4" />
            </div>

            {isPageSelected ? (
                <>
                    <span className="text-xs flex-1">{page.titolo}</span>
                    <Button
                        size="xs"
                        variant="soft-danger"
                        onClick={removePage}
                    >
                        <Lucide icon="Trash2" className="w-3 h-3" />
                    </Button>
                </>
            ) : (
                // Se la pagina è in bozza (id="")
                <>
                    <FormSelect
                        formSelectSize="sm"
                        className="w-3/4"
                        defaultValue=""
                        onChange={(e) => updatePage(e.target.value)}
                    >
                        <option value="">Seleziona una pagina</option>
                        {availablePages.map((wp: any) => (
                            <option key={wp.id} value={wp.id}>
                                {wp.nome}
                            </option>
                        ))}
                    </FormSelect>

                    <Button
                        size="xs"
                        variant="soft-success"
                        onClick={confirmSelection}
                    >
                        <Lucide icon="Check" className="w-3 h-3" />
                    </Button>
                    <Button
                        size="xs"
                        variant="soft-danger"
                        onClick={removePage}
                    >
                        <Lucide icon="X" className="w-3 h-3" />
                    </Button>
                </>
            )}
        </li>
    );
}, (prevProps, nextProps) => {
    // Comparazione personalizzata per evitare re-render inutili
    return (
        prevProps.page.id === nextProps.page.id &&
        prevProps.page.titolo === nextProps.page.titolo &&
        prevProps.pageIndex === nextProps.pageIndex &&
        prevProps.parentIndex === nextProps.parentIndex &&
        prevProps.dataWorkspace === nextProps.dataWorkspace
    );
});

PageItem.displayName = 'PageItem';

export default PageItem;