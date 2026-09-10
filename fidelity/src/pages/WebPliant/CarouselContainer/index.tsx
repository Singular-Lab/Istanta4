// components/carousel/CarouselContainer.tsx

import React, {
  memo,
  useReducer,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import styleEditor from '@/assets/css/editor.module.scss';
import { Tab, TabGroup, TabList, TabPanel, TabPanels, Transition } from '@headlessui/react';
import clsx from 'clsx';
import parse from 'html-react-parser';
import { CarouselState, carouselReducer } from '../carouselReducer';
import CarouselSwiper from '../CarouselSwiper';
import { ServerCall } from '../../../../lib/server_call';
import { t } from 'i18next';
import { v4 as uuid } from 'uuid';
import { Config, ConfigWebpliant, DataFields, PageLayoutItem, PaginaWebPliant, ReferenzeIstanta } from '../../../../lib/types';
import styleWp from "@/assets/css/webpliant/stylewp\.module\.scss"
import { TIPO_PAGINA } from '../../../../lib/enums';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import LoadingSpinner from '@/components/LoadingSpinner';
import EmptyState from '@/components/EmptyState';

interface CarouselContainerProps {
  item: PageLayoutItem;
  config: Config;
  refsWishlist?: DataFields[] | null;
  pagine: PaginaWebPliant[];
  isEditor?: boolean;
  idAreaProps?: string;
  idCanaleProps?: string;
}

const CarouselContainer: React.FC<CarouselContainerProps> = memo(function CarouselContainer({
  item,
  config,
  refsWishlist,
  pagine,
  isEditor,
  idAreaProps,
  idCanaleProps,
}) {
 
  const [fetchedReferenze, setFetchedReferenze] = useState<ReferenzeIstanta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [state, dispatch] = useReducer(carouselReducer, {
    tabs: [],
    activeTab: '',
    referenzeGroupedBy: [[]],
  } as CarouselState);
  const [dataScrittaRef, setDataScrittaRef] = useState<string>('');

  const url = new URL(window.location.href);
  const idCanale = idCanaleProps ?? url.searchParams.get('idCanale');
  const idArea = idAreaProps ?? url.searchParams.get('idArea');
  const idGDO = url.searchParams.get('idGDO');
  const idPV = url.searchParams.get('idPV');
  const idSitemap = url.searchParams.get('idSitemap');
  const idWorkspace = url.searchParams.get('id');
  const date = url.searchParams.get("date") || dayjs().format("YYYY-MM-DD");

  const itemMemo = useMemo(() => item, [item]);
  const linkCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchReferenze = async () => {
      setIsLoading(true);
      try {
        const response = await ServerCall.post<ReferenzeIstanta[]>('/get_filtered_referenze', {
          idWorkspace,
          idArea,
          idCanale,
          idPV,
          dataSelezionata: date,
          item,
          isEditor
        });
        if (response) {
          console.log("response", response);
          setFetchedReferenze(response);
        }
      } catch (error) {
        console.error("Failed to fetch filtered referenze:", error);
        setFetchedReferenze([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchReferenze();
  }, [itemMemo, idWorkspace, idArea, idCanale, idPV, date]);
  
  const createDinamicLink = useCallback(
    ({
      idWorkspace,
      idArea,
      idCanale,
      idGDO,
      idPV,
      idPagina,
      idSitemap
    }: {
      idWorkspace: string;
      idArea: string;
      idCanale: string;
      idGDO: string;
      idPV: string;
      idPagina: string | undefined;
      idSitemap: string | undefined;
    }) => {
      const cacheKey = `${idWorkspace}-${idArea}-${idCanale}-${idGDO}-${idPV}-${idPagina}-${idSitemap}`;

      // Use cached result if available
      if (linkCache.current.has(cacheKey)) {
        return linkCache.current.get(cacheKey);
      }
      
      const sp = new URLSearchParams();
      
      // If no page ID provided, default to homepage
      if (!idPagina) {
        const homepage = pagine.find((s) => s.tipo === TIPO_PAGINA.HOMEPAGE);
        if (homepage) {
          sp.set('idPagina', homepage.id.toString());
        }
      }
      
      // Add parameters
      if (idWorkspace) sp.set('id', idWorkspace);
      if (idArea) sp.set('idArea', idArea);
      if (idCanale) sp.set('idCanale', idCanale);
      if (idGDO) sp.set('idGDO', idGDO);
      if (idPV) sp.set('idPV', idPV);
      if (idPagina) sp.set('idPagina', idPagina);
      if (idSitemap) {
        sp.set('idSitemap', idSitemap);
      } else {
        sp.delete('idSitemap');
      }
      
      const result = `/webpliant/volantino?${  sp.toString()}`;
      
      // Cache the result
      linkCache.current.set(cacheKey, result);
      return result;
    },
    [pagine]
  );
  useEffect(() => {
    if (!isLoading) {
        dispatch({ type: 'INIT', payload: { referenze: fetchedReferenze, item: itemMemo } });
    }
  }, [fetchedReferenze, itemMemo, isLoading]);

  const { tabs, activeTab, referenzeGroupedBy, displayNames } = state;

  const handleChangeTab = useCallback(
    (tab: string) => {
      dispatch({ type: 'SET_ACTIVE_TAB', payload: tab });
    },
    [dispatch]
  );

  const currentIndex = useMemo(() => tabs.indexOf(activeTab), [tabs, activeTab]);

  useEffect(() => {
    if (fetchedReferenze.length > 0) {
        const fetchDataScrittaRef = async () => {
          const response = await ServerCall.put<string>('/getDataValiditaPerCarosello', {
            designContent: itemMemo.content,
            referenze: fetchedReferenze,
          });
          if (!response) {
            return '';
          }
          return response;
        };
    
        fetchDataScrittaRef().then((data) => {
          setDataScrittaRef(data);
        });
    }
  }, [itemMemo, fetchedReferenze]);

  useEffect(() => {
    // Rimuovi slide vuote se necessario
    const removeEmptySlides = () => {
      const slides = document.querySelectorAll('.swiper-slide');
      slides.forEach((slide) => {
        if (slide.innerHTML.trim() === '') {
          slide.remove();
        }
      });
    };
    removeEmptySlides();
  }, [itemMemo]);

  const renderLogoPositionTesto = useCallback((item: any): React.ReactNode => {
    if (!item.content?.logo) {
      return (
        <>
          {item.content?.title &&
            item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
              <div
                className="text-center mb-1 mb-md-3 pb-xl-2 pt-5"
                style={{ fontWeight: 500 }}
              >
              {parse(item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>'
                ? item.content?.title
                : '')}
              </div>
            )}
        </>
      );
    }
    switch (item.content?.logo.posizione) {
      case 'top':
        return (
          <>
            <div className="flex justify-center pt-5 pb-3">
              <img
                height={item.content?.logo.height}
                width={item.content?.logo.width}
                src={item.content?.logo.srcLogoCarosello}
                alt="Carousel Logo"
              />
            </div>
            {item.content?.title &&
              item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
                <div
                  className="text-center mb-1 mb-md-3 pb-xl-2 pt-3"
                  style={{ fontWeight: 500 }}
                >
                  {parse(item.content?.title)}
                </div>
              )}
          </>
        );
      case 'bottom':
        return (
          <>
            {item.content?.title &&
              item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
                <div
                  className="text-center mb-1 mb-md-3 pb-xl-2 pt-5"
                  style={{ fontWeight: 500 }}
                >
                  {parse(item.content?.title)}
                </div>
              )}
            <div className="flex justify-center pb-3">
              <img
                height={item.content?.logo.height}
                width={item.content?.logo.width}
                src={item.content?.logo.srcLogoCarosello}
                alt="Carousel Logo"
              />
            </div>
          </>
        );
      case 'left':
        return (
          <div className="flex justify-center items-center pt-5 pb-3">
            <div className="flex justify-start">
              <img
                height={item.content?.logo.height}
                width={item.content?.logo.width}
                src={item.content?.logo.srcLogoCarosello}
                alt="Carousel Logo"
              />
            </div>
            {item.content?.title &&
              item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
                <div
                  className="text-center mb-1 mb-md-3 pb-xl-2 pl-3"
                  style={{ fontWeight: 500 }}
                >
                  {parse(item.content?.title)}
                </div>
              )}
          </div>
        );
      case 'right':
        return (
          <div className="flex justify-center items-center pt-5 pb-3">
            {item.content?.title &&
              item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
                <div
                  className="text-center mb-1 mb-md-3 pb-xl-2 pr-3"
                  style={{ fontWeight: 500 }}
                >
                  {parse(item.content?.title)}
                </div>
              )}
            <div className="flex justify-end">
              <img
                height={item.content?.logo.height}
                width={item.content?.logo.width}
                src={item.content?.logo.srcLogoCarosello}
                alt="Carousel Logo"
              />
            </div>
          </div>
        );
      default:
        return (
          <>
            {item.content?.title &&
              item.content?.title.trim() !== '<p class="editor-paragraph"><br></p>' && (
                <div
                  className="text-center mb-1 mb-md-3 pb-xl-2 pt-5"
                  style={{ fontWeight: 500 }}
                >
                  {parse(item.content?.title)}
                </div>
              )}
          </>
        );
    }
  }, []);

  if (isLoading) {
    return (
        <div className="w-full h-96 flex justify-center items-center">
            <LoadingSpinner />
        </div>
    )
  }

  if (fetchedReferenze.length === 0) {
    if(isEditor) {
      return (
        <EmptyState
          icon="GalleryHorizontal"
          title="Carosello"
          description="Imposta i filtri in modo corretto per visualizzare le referenze"
        />
      )
    }else{
      return null;
    }
  }
  if (item.type !== 'carousel') {
    return null;
  }

  return (
    <div
      style={{
        backgroundImage: itemMemo.content?.backgroundImage
          ? `url(${itemMemo.content?.backgroundImage})`
          : undefined,
        backgroundSize: 'cover',
        backgroundColor: itemMemo.content?.backgroundColor || 'transparent',
      }}
      className="pb-16"
    >
      <section className={clsx(styleWp["wp-products-carousel"], styleWp["wp-container"])}>
        {renderLogoPositionTesto(itemMemo)}
        {(() => {
          const className = styleEditor['editor-paragraph'];
          if (
            itemMemo.content?.subtitle &&
            itemMemo.content?.subtitle.trim() !== `<p class="${  className  }"><br></p>`
          ) {
            return (
              <div
                className={clsx(
                  'jost text-center text-gray-600 dark:text-gray-400 mb-4',
                  className
                )}
              >
                {parse(itemMemo.content?.subtitle)}
              </div>
            );
          }
          return null;
        })()}

        <div
          className="text-xl font-bold text-center mb-2 uppercase"
          style={{ color: itemMemo.content?.options ? itemMemo.content?.options?.validita?.color : 'transparent' }}
        >
          {dataScrittaRef !== '' ? dataScrittaRef : null}
        </div>

        {itemMemo.content?.options?.carouselType === 'groupedby' && tabs.length > 0 ? (
          <TabGroup
            selectedIndex={currentIndex}
            onChange={(index) => {
              console.log('Selected tab index:', index);
              handleChangeTab(tabs[index])
            }}
          >
            <TabList className={clsx(
              styleWp["wp-nav"],
              styleWp["wp-nav-tabs"],
              styleWp["wp-justify-content-center"],
              styleWp["wp-mb-xl-5"],
              "my-3 text-uppercase"
            )}>
              {tabs.map((tab, index) => (
                <Tab as={React.Fragment} key={index}>
                  {({ selected }) => {
                    const label = displayNames?.[index];
                    // funzione di utilità per riconoscere un'immagine in Base64
                    const isBase64Image = typeof label === "string"
                      && /^data:image\/[a-zA-Z]+;base64,/.test(label);

                    return (
                      <button
                        className={clsx(
                          styleWp['wp-nav-link'],
                          styleWp['wp-nav-link_underscore'],
                          activeTab === tab
                            ? styleWp['wp-active']
                            : styleWp['wp-inactive'],
                        )}
                      >
                        {isBase64Image
                          ? <img
                            src={label as string}
                            alt={`Tab ${index}`}
                            className='md:!max-h-[48px] !max-h-[32px]'
                            style={{verticalAlign: 'middle' }}
                          />
                          : t(label as string)
                        }
                      </button>
                    );
                  }}
                </Tab>
              ))}
            </TabList>

            
            <TabPanels>
              {referenzeGroupedBy.map((group, index) => (
                <TabPanel key={uuid()}>
                  <CarouselSwiper
                    key={index}
                    referenze={group}
                    item={itemMemo}
                    config={config}
                    refsWishlist={refsWishlist}
                  />
                </TabPanel>
              ))}
            </TabPanels>
          </TabGroup>
        ) : (
          <CarouselSwiper
            key={itemMemo.id}
            referenze={referenzeGroupedBy[0]}
            item={itemMemo}
            config={config}
          />
        )}
        {itemMemo.content?.pulsante_mostra_tutto && (
          <div className="text-center mt-4">
            <Link
              to={
                createDinamicLink({
                  idWorkspace: idWorkspace ?? '',
                  idArea: idArea ?? '',
                  idCanale: idCanale ?? '',
                  idGDO: idGDO ?? '',
                  idPV: idPV ?? '',
                  idPagina: itemMemo.content?.pulsante_mostra_tutto.idPaginaCollegata,
                  idSitemap: idSitemap ?? undefined,
                }) || '/'
              }
              style={{
                color:"white",
              }}
             className={clsx(
              styleWp["wp-btn"],
              styleWp["wp-btn-primary"],
              styleWp["wp-btn-lg"],
              styleWp["wp-mt-4"],
              styleWp["text-white"]
             )}
            >
              {itemMemo.content?.pulsante_mostra_tutto.label}
            </Link>
          </div>
        )}
      </section>
    </div>
  );
});

export default CarouselContainer;
