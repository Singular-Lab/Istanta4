import PageItem from "../pageitem";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDrag, useDrop, XYCoord } from "react-dnd";
import { motion } from "framer-motion";
import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { v4 as uuidv4 } from "uuid";
import { Menu, Popover } from "@/components/Base/Headless";
import { SitemapType } from "../../../../../lib/types";

const ItemTypes = {
    SITEMAP: "sitemap",
    SITEMAP_PAGE: "sitemap_page",
};

const SitemapItem: React.FC<{
    sitemap: SitemapType;
    index: number;
    moveSitemap: (dragIndex: number, hoverIndex: number) => void;
    sitemaps: SitemapType[];
    setSitemaps: React.Dispatch<React.SetStateAction<SitemapType[]>>;
    dataWorkspace: any;
    objectForEditSiteMap: { active: boolean; index: number };
    setObjectForEditSiteMap: React.Dispatch<React.SetStateAction<{ active: boolean; index: number }>>;
}> = React.memo(({
    sitemap,
    index,
    moveSitemap,
    sitemaps,
    setSitemaps,
    dataWorkspace,
    objectForEditSiteMap,
    setObjectForEditSiteMap,
}) => {
    // Riferimento per la drop zone
    const dropRef = useRef<HTMLDivElement | null>(null);
    // Riferimento per l'handle di trascinamento
    const dragRef = useRef<HTMLDivElement | null>(null);

    // Memoizza se questo sitemap è in editing
    const isEditing = useMemo(() => 
        objectForEditSiteMap.active && objectForEditSiteMap.index === index,
        [objectForEditSiteMap, index]
    );

    // DRAG & DROP per la sitemap intera
    const [{ isDragging }, drag, preview] = useDrag({
        type: ItemTypes.SITEMAP,
        item: { index },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const [{ isOver }, drop] = useDrop({
        accept: ItemTypes.SITEMAP,
        hover(item: { index: number }, monitor) {
            if (!dropRef.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = dropRef.current?.getBoundingClientRect();
            if (!hoverBoundingRect) return;

            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset() as XYCoord;
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveSitemap(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
        collect: (monitor) => ({
            isOver: monitor.isOver({ shallow: true }),
        }),
    });

    drop(dropRef);
    preview(dropRef);
    drag(dragRef);

    // Callback memoizzati per evitare re-render - OTTIMIZZATI con funzioni più specifiche
    const updateSitemapAtIndex = useCallback((updater: (sitemap: SitemapType) => SitemapType) => {
        setSitemaps(prev => {
            const newSitemaps = [...prev];
            newSitemaps[index] = updater(prev[index]);
            return newSitemaps;
        });
    }, [setSitemaps, index]);

    const updateSitemapTitle = useCallback((newTitle: string) => {
        updateSitemapAtIndex(prev => ({ ...prev, titolo: newTitle }));
    }, [updateSitemapAtIndex]);

    const toggleEdit = useCallback(() => {
        setObjectForEditSiteMap(prev => ({
            active: prev.index === index ? !prev.active : true,
            index
        }));
    }, [setObjectForEditSiteMap, index]);

    const deleteSitemap = useCallback(() => {
        setSitemaps(prev => prev.filter((_, idx) => idx !== index));
        if (objectForEditSiteMap.index === index) {
            setObjectForEditSiteMap({ active: false, index: -1 });
        }
    }, [setSitemaps, index, objectForEditSiteMap, setObjectForEditSiteMap]);

    const addPage = useCallback(() => {
        updateSitemapAtIndex(prev => ({
            ...prev,
            pagine_collegate: [
                ...prev.pagine_collegate,
                { id: "", titolo: "Seleziona pagina..." },
            ],
        }));
    }, [updateSitemapAtIndex]);

    const toggleExternalLink = useCallback(() => {
        updateSitemapAtIndex(prev => ({
            ...prev,
            link_esterno: prev.link_esterno === undefined ? "" : undefined,
            // Non puoi avere pagine e link esterno contemporaneamente
            pagine_collegate: prev.link_esterno === undefined ? [] : prev.pagine_collegate, 
        }));
    }, [updateSitemapAtIndex]);

    const updateExternalLink = useCallback((value: string) => {
        updateSitemapAtIndex(prev => ({ ...prev, link_esterno: value }));
    }, [updateSitemapAtIndex]);

    const toggleAdvancedSettings = useCallback(() => {
        updateSitemapAtIndex(prev => ({
            ...prev,
            impostazioni_avanzate: {
                ...prev.impostazioni_avanzate,
                show: !prev.impostazioni_avanzate?.show,
            },
        }));
    }, [updateSitemapAtIndex]);

    const toggleSideMenu = useCallback((checked: boolean) => {
        updateSitemapAtIndex(prev => ({
            ...prev,
            impostazioni_avanzate: {
                ...prev.impostazioni_avanzate,
                mostra_menu_laterale: checked,
            },
        }));
    }, [updateSitemapAtIndex]);
    
    // Riordinamento pagine collegate
    const moveChildPage = useCallback((dragIndex: number, hoverIndex: number) => {
        updateSitemapAtIndex(prev => {
            const pages = [...prev.pagine_collegate];
            const [draggedPage] = pages.splice(dragIndex, 1);
            pages.splice(hoverIndex, 0, draggedPage);
            return { ...prev, pagine_collegate: pages };
        });
    }, [updateSitemapAtIndex]);

    const hasExternalLink = sitemap.link_esterno !== undefined;

    return (
        <motion.div
            ref={dropRef}
            className={clsx(
                "bg-white dark:bg-darkmode-600 border dark:border-darkmode-500 rounded-lg shadow-sm transition-all mb-3",
                { "ring-2 ring-primary/50": isOver },
                { "opacity-50": isDragging }
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-darkmode-500/50 border-b dark:border-darkmode-500">
                <div className="flex items-center gap-3">
                    <div ref={dragRef} className="cursor-move text-slate-400 hover:text-primary">
                        <Lucide icon="Move" className="w-5 h-5" />
                    </div>
                    {isEditing ? (
                        <FormInput
                            className="w-auto"
                            value={sitemap.titolo}
                            onChange={(e) => updateSitemapTitle(e.target.value)}
                            onBlur={toggleEdit}
                            autoFocus
                        />
                    ) : (
                        <span className="font-semibold text-base text-slate-800 dark:text-slate-200">{sitemap.titolo}</span>
                    )}
                </div>
                <Popover className="relative">
                    <Popover.Button as={Button} variant="outline-secondary" size="sm" className="!p-2">
                        <Lucide icon="Ellipsis" className="w-5 h-5"/>
                    </Popover.Button>
                    <Popover.Panel className="w-56 z-50">
                        <div className="p-1">
                            <div
                                onClick={toggleEdit}
                                className="flex items-center p-2 transition duration-300 ease-in-out rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-400"
                                >
                                <Lucide icon="Pen" className="w-4 h-4 mr-2" />
                                {isEditing ? "Salva" : "Rinomina"}
                            </div>
                            <div
                                onClick={() => !hasExternalLink && addPage()}
                                className={clsx(
                                    "flex items-center p-2 transition duration-300 ease-in-out rounded-md",
                                    hasExternalLink ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-400"
                                )}
                                >
                                <Lucide icon="Plus" className="w-4 h-4 mr-2" />
                                Aggiungi Pagina
                            </div>
                            <div
                                onClick={toggleExternalLink}
                                className="flex items-center p-2 transition duration-300 ease-in-out rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-400"
                                >
                                <Lucide icon="Link" className="w-4 h-4 mr-2" />
                                {hasExternalLink ? "Rimuovi Link Esterno" : "Aggiungi Link Esterno"}
                            </div>
                            <div
                                onClick={toggleAdvancedSettings}
                                className="flex items-center p-2 transition duration-300 ease-in-out rounded-md cursor-pointer hover:bg-slate-100 dark:hover:bg-darkmode-400"
                                >
                                <Lucide icon="Settings" className="w-4 h-4 mr-2" />
                                Impostazioni
                            </div>
                            <div className="h-px my-1 -mx-1 bg-slate-200/60 dark:bg-darkmode-400"></div>
                            <div
                                onClick={deleteSitemap}
                                className="flex items-center p-2 transition duration-300 ease-in-out rounded-md cursor-pointer text-danger hover:bg-danger/10"
                                >
                                <Lucide icon="Trash2" className="w-4 h-4 mr-2" />
                                Elimina
                            </div>
                        </div>
                    </Popover.Panel>
                </Popover>
            </div>

            {/* Content Area */}
            <div className="p-4 space-y-3">
                {hasExternalLink ? (
                    <div className="flex items-center gap-2">
                        <Lucide icon="Link" className="w-4 h-4 text-slate-500"/>
                        <FormInput
                            type="text"
                            value={sitemap.link_esterno}
                            placeholder="Inserisci URL esterno..."
                            onChange={(e) => updateExternalLink(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                ) : (
                    sitemap.pagine_collegate.length > 0 ? (
                        <ul className="space-y-2">
                            {sitemap.pagine_collegate.map((page, i2) => (
                                <PageItem
                                    key={page.id}
                                    page={page}
                                    pageIndex={i2}
                                    moveChildPage={moveChildPage}
                                    dataWorkspace={dataWorkspace}
                                    sitemaps={sitemaps}
                                    setSitemaps={setSitemaps}
                                    parentIndex={index}
                                />
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-4 text-slate-500">
                            <p>Nessuna pagina collegata.</p>
                            <p className="text-sm">Aggiungi pagine dal menu opzioni.</p>
                        </div>
                    )
                )}
            </div>
            
            {/* Advanced Settings */}
            {sitemap.impostazioni_avanzate?.show && (
                <motion.div 
                    className="p-4 border-t border-slate-200/60 dark:border-darkmode-500 bg-slate-50/50 dark:bg-darkmode-700"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                >
                    <FormCheck>
                        <FormCheck.Input 
                            id={`mostra_menu_laterale_${sitemap.id}`} 
                            type="checkbox"
                            checked={sitemap.impostazioni_avanzate?.mostra_menu_laterale || false}
                            onChange={(e) => toggleSideMenu(e.target.checked)}
                        />
                        <FormCheck.Label htmlFor={`mostra_menu_laterale_${sitemap.id}`}>
                            Mostra nel menu di navigazione
                        </FormCheck.Label>
                    </FormCheck>
                </motion.div>
            )}
        </motion.div>
    );
}, (prevProps, nextProps) => {
    return (
        prevProps.sitemap === nextProps.sitemap &&
        prevProps.index === nextProps.index &&
        prevProps.objectForEditSiteMap === nextProps.objectForEditSiteMap &&
        prevProps.dataWorkspace === nextProps.dataWorkspace
    );
});

SitemapItem.displayName = 'SitemapItem';

export default SitemapItem;