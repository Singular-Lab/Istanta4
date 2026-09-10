import { useAppDispatch } from '@/stores/hooks';
import clsx from 'clsx';
import parse from 'html-react-parser';
import React, { lazy, Suspense, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

// Components
import RicetteContent from '../RicetteContent';
import VideoBanner from '../VideoBanner';
const CarouselContainer = lazy(() => import('@/pages/WebPliant/CarouselContainer'));

// Utils
import {
  applyFiltriPolicyVisualizzazione,
} from '../utils';

// Types
import { Events, GRAVITA_PROBLEMA } from '@/stores/errorSlice';
import { DataFields, PageLayoutItem, ReferenzeIstanta } from '../../../../lib/types';

// Styles
import styleWp from "@/assets/css/webpliant/stylewp.module.scss";
import PdfVolantiniViewer from '@/pages/WebPliant/PdfVolantiniViewer';
import { LoadingWebpliant } from '@/pages/WebpliantLayout/LoadingWebpliant';
import GridReferenze from '../GridReferenze';

// =============================================
// TYPES
// =============================================

interface ContentRendererProps {
  items: PageLayoutItem[];
  globalRefs: ReferenzeIstanta[];
  refsWishlist: DataFields[];
  config: any;
  dataWebPliant: any;
  idArea: string | null;
  idCanale: string | null;
  idPV: string | null;
  referenze: ReferenzeIstanta[];
  date: string;
  isMobile: boolean;
}

interface RenderContentProps {
  item: PageLayoutItem;
  globalRefs: ReferenzeIstanta[];
  refsWishlist: DataFields[];
  config: any;
  dataWebPliant: any;
  idArea: string | null;
  idCanale: string | null;
  idPV: string | null;
  referenze: ReferenzeIstanta[];
  date: string;
  isMobile: boolean;
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

/**
 * Maps CSS classes in HTML content
 */
const mapCssClasses = (htmlContent: { html: string, filters: any[], subtitle: string, title: string }): string => {
  return htmlContent?.html?.replace(/class="([^"]+)"/g, (_match: string, classNames: string): string => {
    const mappedClasses = classNames
      .split(" ")
      .map((cls: string) => styleWp[cls] || cls)
      .join(" ");
    return `class="${mappedClasses}"`;
  });
};

// =============================================
// SPECIALIZED RENDERERS
// =============================================

/**
 * Renders image with optional link wrapper
 */
const ImageRenderer: React.FC<{
  item: PageLayoutItem;
  isMobile: boolean;
  onError: (error: any) => void;
}> = ({ item, isMobile, onError }) => {
  const buildLinkUrl = useCallback(() => {
    const currentSearchParams = new URLSearchParams(window.location.search);

    if (item.content?.link) {
      const url = new URL(item.content?.link, window.location.origin);
      currentSearchParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      if (item.content?.page) {
        url.searchParams.set("idPagina", item.content?.page);
      }
      return url.toString();
    }

    if (item.content?.page) {
      const url = new URL(`/webpliant/volantino`, window.location.origin);
      currentSearchParams.forEach((value, key) => {
        url.searchParams.set(key, value);
      });
      url.searchParams.set("idPagina", item.content?.page);
      return url.toString();
    }

    return undefined;
  }, [item.content?.link, item.content?.page]);

  const link = buildLinkUrl();
  const src = isMobile && item.content?.srcMobile ? item.content?.srcMobile : item.content?.src;

  const imageStyles = {
    border: item.content?.srcMobile ? "0" : "1px solid #000",
    minWidth: "100%",
    minHeight: "100%",
    maxWidth: "100%",
    height: "auto",
    objectFit: "cover" as const,
    padding: "0",
  };

  const handleImageError = () => {
    onError({
      id: uuidv4(),
      event: Events.MANCATA_IMMAGINE_BANNER,
      message: `Immagine non trovata per il banner con i seguenti dettagli: ID: ${item.id}, Src: ${item.content?.src}`,
      data: { src: item.content?.src },
      gravita: GRAVITA_PROBLEMA.CRITICA,
      type: "IMMAGINE_BANNER",
    });
  };

  const imageElement = (
    <img
      style={imageStyles}
      className={clsx(styleWp["wp-grid-banner__item"], styleWp["wp-container"])}
      src={src}
      alt={item.content?.title}
      onError={handleImageError}
    />
  );

  if (link) {
    return (
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Link esterno"
        className={styleWp["wp-container"]}
      >
        {imageElement}
      </a>
    );
  }

  return <div className={styleWp["wp-container"]}>{imageElement}</div>;
};

/**
 * Main content renderer component
 */
const ContentRenderer: React.FC<ContentRendererProps> = React.memo(({
  items,
  globalRefs,
  refsWishlist,
  config,
  dataWebPliant,
  idArea,
  idCanale,
  idPV,
  referenze,
  date,
  isMobile,
}) => {
  const appDispatch = useAppDispatch();

  const addError = useCallback((error: any) => {
    appDispatch({
      type: "developerConsole/addErrore",
      payload: error,
    });
  }, [appDispatch]);

  const renderContent = useCallback((
    item: PageLayoutItem,
    currentGlobalRefs: ReferenzeIstanta[],
    refsWishlist: DataFields[] = []
  ): React.ReactNode => {
    // Check visibility based on policy
    const canShow = applyFiltriPolicyVisualizzazione(item, idArea, idCanale, idPV, referenze, date);
    if (!canShow) {
      return null;
    }

    switch (item.type) {
      case "video":
        return <VideoBanner key={item.id} src={item.content?.src} item={item} />;

      case "text":
        return (
          <div key={item.id} className="w-full p-4 flex flex-col items-center text-center">
            <div className="text-3xl font-bold mb-2 text-gray-800 dark:text-gray-100">
              {parse(item?.content?.text)}
            </div>
          </div>
        );

      case 'carousel': {
        return (
          <Suspense fallback={<LoadingWebpliant />}>
            <CarouselContainer
              key={item.id}
              item={item}
              config={config}
              refsWishlist={refsWishlist}
              pagine={dataWebPliant?.webpliant ?? []}
              idAreaProps={dataWebPliant?.idArea ?? ""}
              idCanaleProps={dataWebPliant?.idCanale ?? ""}
            />
          </Suspense>
        );
      }

      case "row":
        return (
          <div
            key={item.id}
            className="flex mt-3 md:m-5 justify-center flex-col lg:flex-row items-center"
          >
            {item.children?.map((child: PageLayoutItem) => {
              const childContent = renderContent(child, currentGlobalRefs, refsWishlist);
              if (child.type === "image") {
                return (
                  <div
                    key={child.id}
                    className="max-w-[600px] max-h-[600px] mt-5 lg:mt-0 w-full h-full lg:max-w-[450px] lg:max-h-[450px] md:w-full md:h-full"
                  >
                    {childContent}
                  </div>
                );
              }
              return childContent;
            })}
          </div>
        );

      case "col":
        return (
          <div key={item.id} className="flex flex-col">
            {item.children?.map((child: PageLayoutItem) => renderContent(child, currentGlobalRefs, refsWishlist))}
          </div>
        );

      case "image":
        return (
          <div
            key={item.id}
            className={clsx(
              "flex items-center flex-wrap",
              styleWp["wp-grid-banner"],
              styleWp["wp-position-relative"],
              "mb-3 flex-col"
            )}
          >
            <ImageRenderer item={item} isMobile={isMobile} onError={addError} />
          </div>
        );

      case "ricetta_ai":
        return <RicetteContent key={item.id} item={item} />;

      case "space":
        const marginTop = `${item.content?.marginTop || 0}${item.content?.marginTopUnit || "px"}`;
        const marginBottom = `${item.content?.marginBottom || 0}${item.content?.marginBottomUnit || "px"}`;

        return (
          <div key={item.id} style={{ marginTop, marginBottom }}>
            {item.content?.abilitaHr ? <hr /> : <>&nbsp;</>}
          </div>
        );

      case "griglia_referenze": {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <GridReferenze
              key={item.id}
              item={item}
              config={config}
              refsWishlist={refsWishlist}
            />
          </Suspense>
        )
      }

      case "ruota_della_fortuna":
        return (
          <div className={clsx("container", "flex", styleWp["wp-justify-content-center"], "my-10")}>
            <iframe
              src={"/static/game/index.html"}
              style={{
                width: "100%",
                height: "100%",
                aspectRatio: "1280 / 720",
              }}
              key={item.id}
              title="Ruota della fortuna"
            />
          </div>
        );

      case "html":
        const contentMapped = mapCssClasses(item.content);
        return <div key={item.id}>{parse(contentMapped)}</div>;

      case 'banner':
        return (
          <section className={clsx(styleWp["wp-blog-page-title"], styleWp["wp-mb-4"], styleWp["wp-mb-xl-5"])}>
            <div className={styleWp["wp-title-bg"]}>
              <img
                loading="lazy"
                src={typeof item.content?.banner === 'string' ? item.content?.banner : undefined}
                width={1780}
                height={420}
                alt=""
              />
            </div>
            <div className={styleWp["wp-container"]}>
              <h2 className={clsx(styleWp["wp-page-title"], "font_color_white")}>{item.content?.bannerTitle}</h2>
              <div className={styleWp["wp-blog__filter"]}>
                <span className={clsx(styleWp["h3"], "font_color_white")}>
                  {item.content?.bannerText}
                </span>
              </div>
            </div>
          </section>
        );
      case "pdf_volantino":
        console.log(item)
        console.log("idCanale", idCanale);
        console.log("idArea", idArea);
        console.log("idPV", idPV);
        console.log("idsKitDesign", item.content?.selectedKitDesign);
        console.log("idsTipiDiExport", item.content?.selectedTipoExport);

        return <PdfVolantiniViewer idCanale={idCanale} idArea={idArea} idPV={idPV} idsKitDesign={item.content?.selectedKitDesign} idsTipiDiExport={item.content?.selectedTipoExport} />;


      default:
        return null;
    }
  }, [idArea, idCanale, idPV, referenze, config, appDispatch, isMobile, date, dataWebPliant]);

  return (
    <>
      {items.map((item) => renderContent(item, [...globalRefs], refsWishlist))}
    </>
  );
});

ContentRenderer.displayName = 'ContentRenderer';

export default ContentRenderer;
