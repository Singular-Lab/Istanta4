// pages/WebPliant.tsx

import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { AnimatePresence, motion } from 'framer-motion';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLoaderData, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

// Utils and Types

import { useGestioneHeaderWebpliant } from '@/context/GestioneHeaderWebpliant';
import { useTimeline } from '@/context/TimeLinePromoContext';
import { Events, GRAVITA_PROBLEMA } from '@/stores/errorSlice';
import { useAppDispatch } from '@/stores/hooks';
import { DataFields, DataWebPliant, FilterCondition, PageLayoutItem, ReferenzeIstanta, SitemapType } from '../../../lib/types';

// Components
import Lucide from '@/components/Base/Lucide';
import ContentRenderer from './components/ContentRenderer';

// Styles
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";

// TypeScript interfaces




interface WebPliantLoaderData {
  referenze: ReferenzeIstanta[];
  dataWebPliant: DataWebPliant;
  config: any;
  pdfVolantini: {
    idCanale: string;
    idKit: string;
    idArea: string;
    nomeCanale: string;
    nomeArea: string;
    files_field: {
      nome_file: string;
      id_olimpo_cloud: string;
      tipo_export: string;
      codice_tipiexport: string;
      idPromo: string;
      url: string;
      url_download: string;
    }[];
  }[];
}

/**
 * Creates the page layout structure based on the provided data and configurations
 */
function createPageLayout(
  dataWebPliant: DataWebPliant,
  idPagina: string | null,
  renderContent: (item: PageLayoutItem, globalRefs: ReferenzeIstanta[], refsWishlist: DataFields[]) => React.ReactNode,
  filteredByDateReferenze: ReferenzeIstanta[],
  idSitemap: string | null,
  refsWishlist: DataFields[] | null
): React.ReactNode | undefined {
  if (!idPagina) {
    return null;
  }
  const showSidebar = idSitemap && dataWebPliant?.sitemap?.find(
    (pagina) => pagina.id === idSitemap
  )?.impostazioni_avanzate.mostra_menu_laterale;

  const currentPage = dataWebPliant.webpliant?.find((pagina) => pagina.id === idPagina);
  if (!currentPage) return null;

  if (showSidebar) {
    return (
      <main className={`mt-20 w-full min-h-svh ${styleWp["wp-shop-main"]}`}>
        <section
          className={clsx(
            styleWp["wp-shop-main"],
            styleWp["wp-d-flex"],
            styleWp["wp-mr-1"],
            styleWp["wp-pt-xl-5"]
          )}
          style={{ marginLeft: "2.75rem", maxWidth: "85%", justifySelf: "center" }}
        >
          <SidebarMenu
            sitemap={dataWebPliant.sitemap}
            idSitemap={idSitemap}
            dataWebPliant={dataWebPliant}
          />
          <div className="overflow-auto w-full h-full">
            {currentPage.struttura?.map((item) =>
              renderContent(item, [...filteredByDateReferenze], refsWishlist ?? [])
            )}
          </div>
        </section>
      </main>
    );
  } else {
    return (
      <main className="mt-20 w-full h-full">
        {currentPage.struttura?.map((item) =>
          renderContent(item, [...filteredByDateReferenze], refsWishlist ?? [])
        )}
      </main>
    );
  }
}

/**
 * Sidebar menu component for the web pliant layout
 */
const SidebarMenu: React.FC<{
  sitemap: SitemapType[];
  idSitemap: string | null;
  dataWebPliant: DataWebPliant;
}> = ({ sitemap, idSitemap, dataWebPliant }) => {
  if (sitemap === undefined || idSitemap === null) return null;
  const currentSitemap = sitemap.find((pagina) => pagina.id === idSitemap);
  if (!currentSitemap) return null;

  return (
    <div
      className={clsx(
        styleWp["wp-shop-sidebar"],
        styleWp["wp-side-sticky"],
        styleWp["wp-bg-body"]
      )}
      id="shopFilter"
    >
      <div
        className={clsx(
          styleWp["wp-aside-header"],
          styleWp["wp-d-flex"],
          styleWp["wp-d-lg-none"],
          styleWp["wp-align-items-center"]
        )}
      >
        <h3
          className={clsx(
            styleWp["wp-text-uppercase"],
            styleWp["wp-fs-6"],
            styleWp["wp-mb-0"]
          )}
        >
          Filter By
        </h3>
        <button
          className={clsx(
            styleWp["wp-btn-close-lg"],
            styleWp["wp-js-close-aside"],
            styleWp["wp-btn-close-aside"],
            styleWp["wp-ms-auto"]
          )}
        />
      </div>
      <div className={clsx(styleWp["wp-pt-4"], styleWp["wp-pt-lg-0"])} />
      <div className={clsx(styleWp["wp-accordion"])} id="categories-list">
        <div
          className={clsx(
            styleWp["wp-accordion-item"],
            styleWp["wp-mb-4"],
            styleWp["wp-pb-3"]
          )}
        >
          <h5 className={clsx(styleWp["wp-accordion-header"])} id="accordion-heading-11">
            <Disclosure defaultOpen={true}>
              {({ open }) => (
                <>
                  <DisclosureButton
                    className={clsx(
                      "p-0 border-0 fs-5",
                      styleWp["wp-accordion-button"],
                      styleWp["wp-accordion-toggle"],
                      styleWp["wp-text-uppercase"]
                    )}
                    style={{ border: 0 }}
                  >
                    {currentSitemap.titolo}
                    <Lucide
                      icon={"ChevronUp"}
                      className={clsx("ms-auto", {
                        "transform rotate-180": open,
                      })}
                    />
                  </DisclosureButton>
                  <AnimatePresence>
                    <DisclosurePanel
                      as={motion.div}
                      initial={{ height: 0 }}
                      animate={{ height: open ? "auto" : 0 }}
                      exit={{ height: 0 }}
                      className={clsx("border-0 overflow-hidden", styleWp["wp-accordion-collapse"])}
                      style={{ border: 0 }}
                    >
                      <div
                        className={clsx("px-0 pb-0 pt-3", styleWp["wp-accordion-body"])}
                        style={{ border: 0 }}
                      >
                        <ul className={clsx("list list-inline mb-0", styleWp["wp-accordion-list"])}>
                          {currentSitemap?.pagine_collegate?.map((item) => (
                            <li
                              className={clsx(styleWp["wp-list-item"])}
                              key={item.id}
                            >
                              <Link
                                to={`/webpliant/volantino?id=${dataWebPliant.idWorkspace}&idArea=${dataWebPliant.idArea}&idCanale=${dataWebPliant.idCanale}&idGDO=${dataWebPliant.idGDO}&idPV=${dataWebPliant.idPV}&idSitemap=${currentSitemap.id}&idPagina=${item.id}`}
                                className={clsx("py-1", styleWp["wp-menu-link"])}
                                style={{ fontSize: "0.9rem", fontWeight: "normal" }}
                              >
                                {item.titolo}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </DisclosurePanel>
                  </AnimatePresence>
                </>
              )}
            </Disclosure>
          </h5>
        </div>
      </div>
    </div>
  );
};

/**
 * WebPliant component that renders the main layout of the web pliant page
 */
const WebPliant: React.FC = memo(function WebPliant() {
  const appDispatch = useAppDispatch();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { setOggettoHeaderWebpliant } = useGestioneHeaderWebpliant();
  const [params] = useSearchParams();
  const { referenze, dataWebPliant, config } = useLoaderData() as WebPliantLoaderData;
  const { dateRange, setNumeroRefPromo } = useTimeline();
  // Extract query parameters
  const idPagina = params.get("idPagina");
  const idArea = params.get("idArea");
  const idCanale = params.get("idCanale");
  const idPV = params.get("idPV");
  const idSitemap = params.get("idSitemap");
  const date = params.get("date") || dayjs().format("YYYY-MM-DD");


  // Handle responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Initialize header configuration
  useEffect(() => {
    setOggettoHeaderWebpliant({
      showListaPagine: true,
      showWishlist: true,
      showLogo: true,
      showPuntiVendita: true,
    });
  }, [setOggettoHeaderWebpliant]);

  const filteredByDateReferenze = useMemo(() => {
    return referenze;
  }, [referenze]);
  useEffect(() => {
    let referenzePromo: ReferenzeIstanta[] = [];
    if (filteredByDateReferenze && filteredByDateReferenze.length > 0) {
      referenzePromo = filteredByDateReferenze
        .filter((ref) => ref.idPromo !== undefined)
        .sort((a, b) => a.idPromo!.localeCompare(b.idPromo!));
    }

    setNumeroRefPromo((prev) => [
      ...prev,
      {
        numeroRefPromo: referenzePromo.length,
        idPromo: referenzePromo[0]?.idPromo || "",
      },
    ]);
  }, [filteredByDateReferenze, setNumeroRefPromo]);

  const globalRefs = useMemo(() => filteredByDateReferenze, [filteredByDateReferenze]);

  // Check for empty carousels and log errors
  useEffect(() => {
    const pagina = dataWebPliant?.webpliant.find((p) => p.id === idPagina);
    if (!pagina) return;

    pagina.struttura.forEach((item) => {
      if (item.type === "carousel") {
        if (item.content == undefined || item.content == null) {
          return;
        }
        if (filteredByDateReferenze.length === 0 && item.content.filters?.length === 0 && !item.content.filtriContesto) {
          return;
        } else {
          if (filteredByDateReferenze.length === 0 && (item.content.filters?.length ?? 0) > 0) {
            appDispatch({
              type: "developerConsole/addErrore",
              payload: {
                id: uuidv4(),
                event: Events.MANCATA_CARICAMENTO_CAROSELLO,
                message: `Nessuna referenza trovata per il carosello con i filtri specificati. ${item.content.title
                    ? `Filtri: ${(item.content.filters ?? [])
                      .map((filter: FilterCondition) => `${filter.field}: ${filter.value}`)
                      .join(", ")}`
                    : ""
                  }`,
                data: {
                  filters: item.content.filters,
                  filtriContesto: item.content.filtriContesto,
                },
                gravita: GRAVITA_PROBLEMA.CRITICA,
                type: "CAROSELLO",
              },
            });
          } else {
            appDispatch({
              type: "developerConsole/removeErrore",
              payload: {
                event: Events.MANCATA_CARICAMENTO_CAROSELLO,
                id: item.id,
              },
            });
          }
        }
      }
    });
  }, [filteredByDateReferenze, dataWebPliant, idPagina, appDispatch]);

  // Temporary fix for accordion buttons
  useEffect(() => {
    const toggleButtons = document.querySelectorAll(".wp-accordion-toggle");

    const handleToggleClick = function (this: HTMLElement) {
      const content = this.nextElementSibling;
      if (content === null) return;

      const isOpen = (content as HTMLElement).style.display === "block";
      (content as HTMLElement).style.display = isOpen ? "none" : "block";
      this.textContent = isOpen ? "Scopri di più" : "Nascondi";
    };

    toggleButtons.forEach((button) => {
      button.addEventListener("click", handleToggleClick);
    });

    return () => {
      toggleButtons.forEach((button) => {
        button.removeEventListener("click", handleToggleClick);
      });
    };
  }, [idPagina]);

  /**
   * Optimized content renderer function
   */
  const optimizedRenderContent = useCallback((
    item: PageLayoutItem,
    globalRefs: ReferenzeIstanta[],
    refsWishlist: DataFields[] = []
  ): React.ReactNode => {
    return (
      <ContentRenderer
        items={[item]}
        globalRefs={globalRefs}
        refsWishlist={refsWishlist}
        config={config}
        dataWebPliant={dataWebPliant}
        idArea={idArea}
        idCanale={idCanale}
        idPV={idPV}
        referenze={filteredByDateReferenze}
        date={date}
        isMobile={isMobile}
      />
    );
  }, [config, dataWebPliant, idArea, idCanale, idPV, filteredByDateReferenze, date, isMobile]);

  return (
    <>
      {createPageLayout(
        { ...dataWebPliant, idPV: idPV || "" },
        idPagina,
        optimizedRenderContent,
        globalRefs,
        idSitemap,
        null
      )}
    </>
  );
});

export default WebPliant;
