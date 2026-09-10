import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import { useDrag, useDrop, XYCoord } from "react-dnd";
import { motion } from "framer-motion";
import Button from "@/components/Base/Button";
import { FormCheck, FormInput, FormSelect } from "@/components/Base/Form";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { v4 as uuidv4 } from "uuid";
import { Menu } from "@/components/Base/Headless";
import { PaginaWebPliant, SitemapType } from "../../../../lib/types";
import SitemapItem from "./sitemap/sitemap_item";

// Tipi della tua sitemap:


const ItemTypes = {
  SITEMAP: "sitemap",
  SITEMAP_PAGE: "sitemap_page",
};

interface EditState {
  active: boolean;
  index: number; // quale sitemap sto editando
}

const MemoizedSitemapItem = memo(SitemapItem);

const SitemapList: React.FC<{
  className?: string;
  sitemaps: SitemapType[];
  setSitemaps: React.Dispatch<React.SetStateAction<SitemapType[]>>;
  dataWorkspace: any;
  compactMode?: boolean;
}> = ({ className, sitemaps, setSitemaps, dataWorkspace, compactMode = false }) => {
  // Stato di editing di una sitemap
  // Se active=true e index=X, significa che sto modificando la sitemap in posizione X
  const [objectForEditSiteMap, setObjectForEditSiteMap] = useState<EditState>({
    active: false,
    index: -1,
  });

  // Memoizza la funzione di riordino delle intere sitemap
  const moveSitemap = useCallback((dragIndex: number, hoverIndex: number) => {
    setSitemaps((prev) => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, draggedItem);
      return updated;
    });
  }, [setSitemaps]);

  // Memoizza la funzione per aggiungere una nuova sitemap
  const addNewSitemap = useCallback(() => {
    setSitemaps(prev => [
      ...prev,
      {
        id: uuidv4(),
        titolo: "Nuova sitemap",
        pagine_collegate: [],
        impostazioni_avanzate: {
          show: false,
          mostra_menu_laterale: false
        },
      },
    ]);
  }, [setSitemaps]);

  // Memoizza la lista delle sitemap per evitare re-render inutili
  const sitemapItems = useMemo(() => 
    sitemaps.map((sitemap: SitemapType, i: number) => (
      <MemoizedSitemapItem
        key={sitemap.id}
        index={i}
        sitemap={sitemap}
        moveSitemap={moveSitemap}
        dataWorkspace={dataWorkspace}
        sitemaps={sitemaps}
        setSitemaps={setSitemaps}
        objectForEditSiteMap={objectForEditSiteMap}
        setObjectForEditSiteMap={setObjectForEditSiteMap}
      />
    )), 
    [sitemaps, moveSitemap, dataWorkspace, objectForEditSiteMap, setSitemaps, setObjectForEditSiteMap]
  );

  return (
    <div className={clsx(className)}>
      <div className="flex items-center h-full justify-end gap-3 mb-2">
            <Button
              size="xs"
              variant="soft-success"
              onClick={addNewSitemap}
            >

              <Lucide icon="Plus" className="w-4 h-4" />
            </Button>
      </div>


      {/* Lista delle sitemaps */}
      <div className={clsx(compactMode && "space-y-1")}>
        {sitemaps.length > 0 ? (
          sitemapItems
        ) : (
          !compactMode && (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-slate-500">Nessuna sitemap creata.</p>
              <p className="text-sm text-slate-400">
                Inizia aggiungendo la tua prima sitemap.
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default SitemapList;

// ------------------------------------------------------------------------------------
//  SITEMAP ITEM
// ------------------------------------------------------------------------------------


// ------------------------------------------------------------------------------------
//  PAGE ITEM: singolo collegamento (pagine_collegate)
// ------------------------------------------------------------------------------------
