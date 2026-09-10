import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { Link, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';

// Local Components
import DeveloperConsole, { ConsoleMode } from './DevConsole';

// Styles
import stylesWP from "@/assets/css/webpliant/stylewp.module.scss";

// Types and Utils
import { RootState } from '@/stores/store';
import { TIPO_PAGINA, TIPO_UTENTI } from '../../../lib/enums';
import {
  ConfigWebpliant,
  DataFields,
  LoghiInsegne,
  PaginaWebPliant,
  PuntiVenditaAttributes,
  ReferenzeIstanta,
  SitemapType
} from '../../../lib/types';

// Hooks and Contexts
import { GestioneHeaderWebpliantProvider, useGestioneHeaderWebpliant } from '@/context/GestioneHeaderWebpliant';
import { GestioneReferenzeProvider, useGestioneReferenze } from '@/context/GestioneReferenzeContext';
import { useUser } from '@/context/UserContext';
import { useAppLoading } from '@/hooks/useAppLoading';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';
import { useFetchAllPuntiVendita, useFetchConfig } from '@/query/query';

// Assets

// Utils
import { filtroSitemMap } from './utility';
// Rimosso import vecchio sistema - ora si usa useWebpliantParamsManager
import Dock from '@/components/Base/Dock';
import CookieConsent from '@/components/CookieConsent';
import { useWishlistEvents } from '@/utils/wishlistEvents';
import { Colorize } from '../../../lib/Colorize';

// =============================================
// CUSTOM HOOKS FOR STATE MANAGEMENT
// =============================================

/**
 * Custom hook to manage UI state
 */
const useUIState = () => {
  const [query, setQuery] = useState<string>('');
  const [isGoingUp, setIsGoingUp] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [mode, setMode] = useState<ConsoleMode>();
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isMenuOpenPhone, setIsMenuOpenPhone] = useState<string>("");
  const [isMenuVenditaOpen, setIsMenuVenditaOpen] = useState<boolean>(false);
  const [isMenuLista, setIsMenuLista] = useState<boolean>(false);
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);


  useEffect(() => {
    console.log("isOpen", isOpen);
  }, [isOpen]);
  useEffect(() => {
    console.log("MODE", mode);
  }, [mode]);

  return {
    query, setQuery,
    isGoingUp, setIsGoingUp,
    isOpen, setIsOpen,
    mode, setMode,
    isMenuOpen, setIsMenuOpen,
    isMenuOpenPhone, setIsMenuOpenPhone,
    isMenuVenditaOpen, setIsMenuVenditaOpen,
    isMenuLista, setIsMenuLista,
    isSearchOpen, setIsSearchOpen,
  };
};

/**
 * Custom hook to manage URL parameters and routing state
 */
const useWebpliantParams = () => {
  const location = useLocation();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const date = searchParams.get("date") || dayjs().format("YYYY-MM-DD");
  const [idPV, setIdPV] = useState<string | null>(searchParams.get('idPV'));
  const [idWorkspace, setIdWorkspace] = useState<string | null>(searchParams.get('id'));
  const [Debug, setDebug] = useState<string>(searchParams.get('debug') || "false");
  const [idArea, setIdArea] = useState<string | null>(searchParams.get('idArea'));
  const [idCanale, setIdCanale] = useState<string | null>(searchParams.get('idCanale'));
  const [idGDO, setIdGDO] = useState<string | null>(searchParams.get('idGDO'));
  const [guidIdWishlist] = useState<string | null>(() => {
    // Effettua il parse del valore JSON se presente in localStorage
    const paramsStorage = localStorage.getItem('webpliant-params-storage');
    let sessionWishlistId: string | null = null;
    if (paramsStorage) {
      try {
        const parsed = JSON.parse(paramsStorage);
        sessionWishlistId = parsed.sessionWishlistId || null;
      } catch (e) {
        sessionWishlistId = null;
      }
    }
    return sessionWishlistId || searchParams.get('sessionWishlistId');
  });
  const [idPagina, setIdPagina] = useState<string | null>(searchParams.get('idPagina'));

  useEffect(() => {
    console.log(Colorize.bgBlue("GUID ID WISHLIST"), guidIdWishlist);
  }, [guidIdWishlist]);

  return {
    location,
    date,
    idPV, setIdPV,
    idWorkspace, setIdWorkspace,
    Debug, setDebug,
    idArea, setIdArea,
    idCanale, setIdCanale,
    idGDO, setIdGDO,
    guidIdWishlist,
    idPagina, setIdPagina,
  };
};

/**
 * Custom hook to manage referenze and wishlist data
 */
const useReferenzeData = () => {
  const [selectedRef, setSelectedRef] = useState<{ score: number; ref: ReferenzeIstanta } | null>(null);
  const [refLista, setRefLista] = useState<DataFields[] | null>(null);
  const [color, setColor] = useState<string | null>(null);

  return {
    selectedRef, setSelectedRef,
    refLista, setRefLista,
    color, setColor,
  };
};

/**
 * Custom hook to manage geolocation state
 */
const useGeolocationState = () => {
  const [userLocationChoice, setUserLocationChoice] = useState(() => {
    const savedChoice = localStorage.getItem('userLocationChoice');
    return savedChoice !== null ? savedChoice === 'true' : null;
  });
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  return {
    userLocationChoice, setUserLocationChoice,
    lat, setLat,
    lon, setLon,
  };
};

// =============================================
// BUSINESS LOGIC HOOKS
// =============================================

/**
 * Custom hook to handle API calls
 */
const useWebpliantAPI = (sessionWishlistId: string, guidIdWishlist: string | null) => {
  const { refLista, setRefLista, setColor } = useReferenzeData();
  // TODO: Migrazione al nuovo sistema - temporaneo stub
  const ids = { sessionIdWebpliant: '', sessionWishlistId: '', URL_WEBPLIANT: '' };
  const refreshReferenze = () => { };

  const fetchColorGDO = useCallback(async () => {
    try {
      const res = await ServerCall.get<string>("/getColorGDO");
      setColor(res);
    } catch (error) {
      console.error('Error fetching colorGDO:', error);
    }
  }, [setColor]);

  const fetchReferenzeWishlist = useCallback(async () => {
    try {
      const res = await ServerCall.get<DataFields[]>(`/getAllReferenzeFromWishlistId?id=${sessionWishlistId}`);
      setRefLista(res);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  }, [sessionWishlistId, setRefLista]);

  const fetchDataWishlist = useCallback(async (dataWebPliant: any, setters: any) => {
    try {
      const res = await ServerCall.get<any>(`/getParamsWishlistId?id=${guidIdWishlist}`);
      console.log("Data wishlist:", res);
      const { idPV, idCanale, idArea, idGDO, idWorkspace, idPagina } = res;

      setters.setIdPV(idPV);
      setters.setIdCanale(idCanale);
      setters.setIdArea(idArea);
      setters.setIdGDO(idGDO);
      setters.setIdWorkspace(idWorkspace);
      setters.setIdPagina(idPagina);
      console.log("ID pagina:", idPagina);
      if (!idPagina) {
        const homepage = dataWebPliant?.webpliant?.find((s: PaginaWebPliant) => s.tipo === TIPO_PAGINA.HOMEPAGE);
        if (homepage) {
          setters.setIdPagina(homepage.id.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    }
  }, [guidIdWishlist]);

  const fetchRefs = useCallback(async () => {
    try {
      if (ids.sessionWishlistId) {
        const refs = (await refreshReferenze() as unknown) as DataFields[];
        setRefLista(refs);
      }
    } catch (error) {
      console.error('Error fetching referenze:', error);
    }
  }, [ids.sessionWishlistId, refreshReferenze, setRefLista]);

  return {
    fetchColorGDO,
    fetchReferenzeWishlist,
    fetchDataWishlist,
    fetchRefs,
    refLista,
    setRefLista
  };
};

/**
 * Custom hook to handle geolocation filtering
 */
const useGeolocationFilter = (allPuntiVendita: PuntiVenditaAttributes[] | undefined) => {
  const [allPuntiVenditaFiltered, setAllPuntiVenditaFiltered] = useState<PuntiVenditaAttributes[]>([]);

  const filtraPuntiVendita = useCallback((posizione: GeolocationPosition) => {
    console.log(`Latitudine: ${posizione.coords.latitude}`);
    console.log(`Longitudine: ${posizione.coords.longitude}`);
    const latitudine = posizione.coords.latitude;
    const longitudine = posizione.coords.longitude;

    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const nearbyPuntiVendita = allPuntiVendita?.filter((pv) => {
      if (pv.lat_puntivendita == null || pv.lon_puntivendita == null) {
        return false;
      }
      const R = 6371;
      const dLat = toRadians(pv.lat_puntivendita - latitudine);
      const dLon = toRadians(pv.lon_puntivendita - longitudine);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(latitudine)) * Math.cos(toRadians(pv.lat_puntivendita)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return distance <= 100;
    });

    if (nearbyPuntiVendita?.length === 0) {
      setAllPuntiVenditaFiltered(allPuntiVendita || []);
    } else {
      setAllPuntiVenditaFiltered(nearbyPuntiVendita || []);
    }
  }, [allPuntiVendita]);

  useEffect(() => {
    if (allPuntiVendita) {
      setAllPuntiVenditaFiltered(allPuntiVendita);
    }
  }, [allPuntiVendita]);

  return {
    allPuntiVenditaFiltered,
    setAllPuntiVenditaFiltered,
    filtraPuntiVendita,
  };
};

// =============================================
// MAIN COMPONENT TYPES
// =============================================

export interface WebpliantLayoutProps { }

/**
 * Loading spinner component shown during page transitions
 */

/**
 * Lazy loading image component for better performance
 */
const LazyImageWrapper: FC<React.ImgHTMLAttributes<HTMLImageElement>> = (props) => {
  return <img className={props.className} {...props} />;
};

/**
 * Developer Console Button Component
 */
interface DevConsoleButtonsProps {
  isOpen: boolean;
  toggleOpen: () => void;
  handleFloatButtonClick: () => void;
  handleFloatButtonTimeLine: () => void;
  numeroErrori: number;
}

const DevConsoleButtons: FC<DevConsoleButtonsProps> = ({
  isOpen,
  toggleOpen,
  handleFloatButtonClick,
  handleFloatButtonTimeLine,
  numeroErrori
}) => {
  const items = [
    {
      icon: <Lucide icon="CircleAlert" width={48} height={48} />,
      label: "Gestione Errori",
      className: "text-red-500",
      onClick: () => {
        toggleOpen();
      }
    },
    {
      icon: <Lucide icon="ListChecks" width={48} height={48} />,
      label: "Gestione Referenze",
      className: "text-blue-500",
      onClick: () => {
        handleFloatButtonClick();
      }
    },
    {
      icon: <Lucide icon="Clock" width={48} height={48} />,
      label: "Timeline",
      className: "text-yellow-500",
      onClick: () => {
        handleFloatButtonTimeLine();
      }
    }
  ];

  return (
    <Dock
      items={items}
      panelHeight={80}
      baseItemSize={50}
      distance={100}
      magnification={70}
      className=" z-[9999999] "
    />
  );
};

/**
 * Main Webpliant Layout Component
 * Includes:
 *  - Header desktop + mobile
 *  - Menu from sitemap
 *  - Optional DevConsole in singular/admin mode
 *  - <Outlet> for pages
 *  - Footer
 */
const WebpliantLayout: FC<WebpliantLayoutProps> = () => {
  // =============================================
  // State Management
  // =============================================

  const { query, setQuery, isGoingUp, setIsGoingUp, isOpen, setIsOpen, mode, setMode, isMenuOpen, setIsMenuOpen, isMenuOpenPhone, setIsMenuOpenPhone, isMenuVenditaOpen, setIsMenuVenditaOpen, isMenuLista, setIsMenuLista, isSearchOpen, setIsSearchOpen } = useUIState();
  const { location, date, idPV, setIdPV, idWorkspace, setIdWorkspace, Debug, setDebug, idArea, setIdArea, idCanale, setIdCanale, idGDO, setIdGDO, guidIdWishlist, idPagina, setIdPagina } = useWebpliantParams();
  const { selectedRef, setSelectedRef, color, setColor } = useReferenzeData();
  const [wishlistUpdating, setWishlistUpdating] = useState<boolean>(false);
  const { userLocationChoice, setUserLocationChoice, lat, setLat, lon, setLon } = useGeolocationState();
  const { data: allPuntiVendita } = useFetchAllPuntiVendita(idGDO || "");
  const { allPuntiVenditaFiltered, setAllPuntiVenditaFiltered, filtraPuntiVendita } = useGeolocationFilter(allPuntiVendita);
  const { referenza } = useGestioneReferenze();
  const numeroErrori = useSelector((state: RootState) =>
    Object.values(state.developerConsoleReducer.errori).reduce((acc, arr) => acc + arr.length, 0)
  );
  const dataConfig = useFetchConfig();

  // Add missing ref for DevConsole
  const refDevConsole = useRef<any>(null);

  // =============================================
  // Hooks and Context
  // =============================================
  const navigate = useNavigate();
  const isLoading = useAppLoading();
  const { user } = useUser();
  const { oggettoHeaderWebpliant, setOggettoHeaderWebpliant } = useGestioneHeaderWebpliant();
  const { notifyItemRemoved, events: wishlistEvents } = useWishlistEvents();

  // Usa il nuovo sistema centralizzato
  const webpliantParams = useWebpliantParamsManager();
  const {
    sessionWishlistId,
    sessionIdWebpliant,
    URL_WEBPLIANT,
    idArea: newIdArea,
    idCanale: newIdCanale,
    idGDO: newIdGDO,
    idPV: newIdPV,
    idWorkspace: newIdWorkspace,
    idPagina: newIdPagina
  } = webpliantParams;

  // Compatibilità temporanea per il vecchio formato ids
  const ids = {
    sessionIdWebpliant,
    sessionWishlistId,
    URL_WEBPLIANT
  };

  // Funzione stub per refreshReferenze (sarà implementata correttamente dopo)
  const refreshReferenze = async () => [] as DataFields[];

  // 🔄 OVERRIDE: Usa i parametri dal nuovo sistema invece dei vecchi useState
  // Questo sostituisce gradualmente il vecchio sistema di gestione stato
  React.useEffect(() => {
    if (newIdArea) setIdArea(newIdArea);
    if (newIdCanale) setIdCanale(newIdCanale);
    if (newIdGDO) setIdGDO(newIdGDO);
    if (newIdPV) setIdPV(newIdPV);
    if (newIdWorkspace) setIdWorkspace(newIdWorkspace);
    if (newIdPagina) setIdPagina(newIdPagina);
  }, [newIdArea, newIdCanale, newIdGDO, newIdPV, newIdWorkspace, newIdPagina]);

  // =============================================
  // Safe Load Data from Loader
  // =============================================

  let loaderData: {
    dataWebPliant?: {
      nomeWorkspace: string;
      idArea: string;
      idCanale: string;
      idGDO: string;
      idWorkspace: string;
      webpliant: Array<PaginaWebPliant>;
      sitemap: Array<any>;
    };
    config?: ConfigWebpliant;
  } = {};

  loaderData = useLoaderData() as typeof loaderData;
  const dataWebPliant = loaderData.dataWebPliant;
  const config = loaderData.config as ConfigWebpliant;

  // =============================================
  // Query Hooks
  // =============================================


  // =============================================
  // API Calls
  // =============================================
  const { fetchColorGDO, fetchReferenzeWishlist, fetchDataWishlist, fetchRefs, refLista, setRefLista } = useWebpliantAPI(sessionWishlistId as string, guidIdWishlist);

  // =============================================
  // Effects
  // =============================================

  useEffect(() => {
    console.log(Colorize.bgBlue("Fetching wishlist refs"), guidIdWishlist);
    if (guidIdWishlist) {
      fetchReferenzeWishlist();
      fetchDataWishlist(dataWebPliant, {
        setIdPV,
        setIdCanale,
        setIdArea,
        setIdGDO,
        setIdWorkspace,
        setIdPagina
      });
    }
  }, [guidIdWishlist, fetchReferenzeWishlist, fetchDataWishlist, dataWebPliant, setIdPV, setIdCanale, setIdArea, setIdGDO, setIdWorkspace, setIdPagina])

  // =============================================
  // Effects
  // =============================================

  // Initialize data
  useEffect(() => {
    fetchColorGDO();
  }, [fetchColorGDO]);

  // Fetch wishlist refs when id changes or menu opens
  useEffect(() => {
    if (ids.sessionWishlistId) {
      fetchRefs();
    }
  }, [ids.sessionWishlistId, isMenuLista, fetchRefs]);

  // Set mode based on user type
  useEffect(() => {
    if (user?.tipo === TIPO_UTENTI.SUPERADMIN || Debug === "true") {
      setMode("superadmin");
    }
  }, [user]);

  // Calculate number of errors

  // Handling scroll for sticky header
  useEffect(() => {

    let lastScrollTop = 0;
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > lastScrollTop) {
        setIsGoingUp(false);
      } else {
        setIsGoingUp(scrollTop !== 0);
      }
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    // Only ask if the menu is open and user hasn't made a choice yet
    if (isMenuVenditaOpen && userLocationChoice === null) {
      // Ask the user if they want to use geolocation
      const wantsGeolocation = window.confirm("Vuoi utilizzare la tua posizione per trovare i punti di vendita più vicini?");

      // Save user's choice in state and localStorage
      setUserLocationChoice(wantsGeolocation);
      localStorage.setItem('userLocationChoice', wantsGeolocation.toString());

      // If user accepts, try to get location
      if (wantsGeolocation) {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            filtraPuntiVendita,
            (error) => {
              console.error("Error getting location:", error);
              alert("Unable to retrieve your location. Please check your location settings.");
            }
          );
        } else {
          console.warn("Geolocation is not supported by this browser.");
          alert("Geolocation is not supported by your browser.");
        }
      }
    }
    // If menu is open and user previously agreed to geolocation
    else if (isMenuVenditaOpen && userLocationChoice === true) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          filtraPuntiVendita,
          (error) => {
            console.error("Error getting location:", error);
          }
        );
      }
    }
  }, [isMenuVenditaOpen, userLocationChoice, filtraPuntiVendita]);


  // Preload key images

  // Handle body overflow when menu is open
  useEffect(() => {
    if (isMenuLista) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  }, [isMenuLista]);

  useEffect(() => {
    refDevConsole.current?.toggleVisibilityGestioneReferenze();
  }, [referenza])

  // Listen agli eventi wishlist per aggiornare la sidebar in tempo reale
  useEffect(() => {
    // Funzione di refresh centralizzata per evitare duplicazioni
    const refreshSidebarWishlist = async (eventType: string) => {
      console.log(`🔔 ${eventType} event received in WebpliantLayout, refreshing sidebar...`);
      if (sessionWishlistId) {
        setWishlistUpdating(true);
        try {
          await fetchReferenzeWishlist();
        } finally {
          setWishlistUpdating(false);
        }
      }
    };

    const unsubscribeItemAdded = wishlistEvents.on('item-added', (event) => {
      if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
        refreshSidebarWishlist('Item added');
      }
    });

    const unsubscribeItemRemoved = wishlistEvents.on('item-removed', (event) => {
      if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
        refreshSidebarWishlist('Item removed');
      }
    });

    const unsubscribeWishlistUpdated = wishlistEvents.on('wishlist-updated', (event) => {
      if (!event.wishlistId || event.wishlistId === sessionWishlistId) {
        refreshSidebarWishlist('Wishlist updated');
      }
    });

    return () => {
      unsubscribeItemAdded();
      unsubscribeItemRemoved();
      unsubscribeWishlistUpdated();
    };
  }, [sessionWishlistId, fetchReferenzeWishlist, wishlistEvents])

  // Handle search query timing

  // =============================================
  // Handlers and Utility Functions
  // =============================================

  const handleSelectRef = (ref: { score: number; ref: ReferenzeIstanta }) => {
    setSelectedRef(ref);
    setIsSearchOpen(false);
    setQuery('');
  };

  const handleFloatButtonClick = (): void => {
    if (refDevConsole.current) {
      refDevConsole.current.toggleVisibilityGestioneReferenze();
    } else {
      console.warn('DevConsole reference is null');
    }
  };

  const handleFloatButtonTimeLine = (): void => {
    if (refDevConsole.current) {
      refDevConsole.current.toggleVisibilityTimeLine();
    } else {
      console.warn('DevConsole reference is null');
    }
  };

  const toggleOpen = useCallback(() => {
    setIsOpen(o => !o);
    if (refDevConsole.current) {
      refDevConsole.current.toggleVisibilityErrori();
    } else {
      console.warn('DevConsole reference is null');
    }
  }, []);

  const handleShare = useCallback(() => {
    const currentUrl = `${window.location.origin}/webpliant/wishlist?guidIdWishlist=${sessionWishlistId}&c=true`;
    const shareData = {
      title: 'Condividi la tua wishlist',
      text: 'Guarda la mia wishlist',
      url: currentUrl,
    };

    if (navigator.share) {
      navigator.share(shareData)
        .then(() => console.log('Condivisione avviata con successo'))
        .catch((error) => console.error('Errore durante la condivisione:', error));
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl)
        .then(() => alert('Link copiato negli appunti!'))
        .catch((err) => console.error('Errore durante la copia del link:', err));
    } else {
      console.warn('API Web Share e Clipboard non supportate');
    }
  }, [sessionWishlistId]);

  // =============================================
  // Link Generation Logic with Caching
  // =============================================


  const createDinamicLink = useCallback(
    ({
      idWorkspace,
      idArea,
      idCanale,
      idGDO,
      idPV,
      idPaginaLoc,
      idSitemap
    }: {
      idWorkspace: string;
      idArea: string;
      idCanale: string;
      idGDO: string;
      idPV: string;
      idPaginaLoc: string | undefined;
      idSitemap: string | undefined;
    }) => {

      const sp = new URLSearchParams();

      // If no page ID provided, default to homepage
      if (!idPaginaLoc) {
        const homepage = dataWebPliant?.webpliant?.find((s) => s.tipo === TIPO_PAGINA.HOMEPAGE);
        if (homepage) {
          sp.set('idPagina', homepage.id.toString());
        }
      }
      if (!idPaginaLoc) {
        if (location.state?.idPagina) {
          sp.set('idPagina', location.state.idPagina);
        }
      }
      // Add parameters
      if (idWorkspace) sp.set('id', idWorkspace);
      if (idArea) sp.set('idArea', idArea);
      if (idCanale) sp.set('idCanale', idCanale);
      if (idGDO) sp.set('idGDO', idGDO);
      if (idPV) sp.set('idPV', idPV);
      if (idPaginaLoc) sp.set('idPagina', idPaginaLoc);
      if (idSitemap) {
        sp.set('idSitemap', idSitemap);
      } else {
        sp.delete('idSitemap');
      }

      const result = `/webpliant/volantino?${sp.toString()}`;

      // Cache the result
      return result;
    },
    [
      dataWebPliant,
      idWorkspace, idArea, idCanale, idGDO, idPV, idPagina,
      location.state
    ]);

  // =============================================
  // Menu Rendering Logic
  // =============================================
  const renderLinkMenuItems = useMemo(() => {
    if (!dataWebPliant?.sitemap) return null;

    const sitemapFiltrata = filtroSitemMap(
      dataWebPliant.sitemap,
      dataWebPliant.webpliant,
      {
        idPV: idPV as string,
        idCanale: idCanale as string,
        idArea: idArea as string
      },
      date
    );
    return sitemapFiltrata?.map((item, index) => {
      if (item?.pagine_collegate?.length > 1) {
        // Case with dropdown
        return (
          <li key={index} className={clsx(stylesWP["wp-navigation__item"])} style={{ position: "relative" }}>
            <a href="#" style={{ fontFamily: "Jost" }} className={clsx(stylesWP["wp-navigation__link"], "jost")}>
              {item.titolo}
            </a>
            <ul
              className={clsx(stylesWP["wp-default-menu"], stylesWP["wp-list-unstyled"])}
              style={{ fontFamily: "Jost", position: "absolute", top: "100%", left: "0", zIndex: 9999999 }}
            >
              {item.pagine_collegate.map((pagina_collegata: any) => (
                <li key={pagina_collegata.id} className={clsx(stylesWP["wp-sub-menu__item"])}>
                  <Link
                    to={createDinamicLink({
                      idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                      idArea: idArea || location.state?.idArea || "",
                      idCanale: idCanale || location.state?.idCanale || "",
                      idGDO: idGDO || location.state?.idGDO || "",
                      idPV: idPV || location.state?.idPV || "",
                      idPaginaLoc: pagina_collegata.id,
                      idSitemap: item.id
                    })}
                    className={clsx(stylesWP["wp-menu-link"], stylesWP["wp-menu-link_us-s"])}
                  >
                    {pagina_collegata.titolo}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        );
      } else {
        // Single page case
        const singlePage = item?.pagine_collegate?.[0];

        return (
          <li key={index} style={{ fontFamily: "Jost" }} className={clsx(stylesWP["wp-navigation__item"])}>
            {item.link_esterno ? (
              <a
                href={item.link_esterno}
                target="_blank"
                rel="noopener noreferrer"
                className={clsx(stylesWP["wp-navigation__link"], stylesWP["wp-js-nav-right"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "jost")}
              >
                {item.titolo}
              </a>
            ) : (
              <Link
                to={createDinamicLink({
                  idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                  idArea: idArea || location.state?.idArea || "",
                  idCanale: idCanale || location.state?.idCanale || "",
                  idGDO: idGDO || location.state?.idGDO || "",
                  idPV: idPV || location.state?.idPV || "",
                  idPaginaLoc: singlePage?.id,
                  idSitemap: undefined
                })}
                className={clsx(stylesWP["wp-navigation__link"], "jost")}
              >
                {item.titolo}
              </Link>
            )}
          </li>
        );
      }
    });
  }, [dataWebPliant?.sitemap, dataWebPliant?.webpliant, ids, createDinamicLink]);

  // Function to get logo URL
  const getLogoUrl = useCallback(() => {
    if (!dataConfig?.data?.webpliant?.logo_header) return "";
    return dataConfig.data.webpliant.logo_header?.find((logo: LoghiInsegne) => {
      const area = idArea || location.state?.idArea;
      const canale = idCanale || location.state?.idCanale;

      if (logo.idArea && logo.idCanale) {
        return logo.idArea === area && logo.idCanale === canale;
      } else if (logo.idArea) {
        return logo.idArea === area;
      } else if (logo.idCanale) {
        return logo.idCanale === canale;
      }
      return false;
    })?.url || "";
  }, [dataConfig?.data?.webpliant?.logo_header, idArea, idCanale, location.state]);


  // =========================================================
  // 5) Render
  // =========================================================
  return (
    <>
      <Helmet>
        <meta charSet="utf-8" />
        {/* Il favicon viene gestito dinamicamente in main.tsx in base all'ambiente */}
        <meta name="description" content={dataConfig?.data?.webpliant?.meta_volantino?.description || ''} />
        <title>{dataConfig?.data?.webpliant?.meta_volantino?.title || 'WebPliant'}</title>
      </Helmet>
      <div
        className={clsx(stylesWP["webpliant"], stylesWP["bootstrap-sandbox"], "flex flex-wrap min-h-screen flex-col", {
          [stylesWP["wp-mobile-menu-opened"]]: isMenuOpen,
          ["overflow-hidden"]: isMenuOpen,
          ["h-0"]: isMenuOpen,
          [stylesWP["wp-page-overlay_visible"]]: isOpen,
        })}
      >
        {/* HEADER MOBILE */}
        <div className={clsx(stylesWP["wp-header-mobile"], stylesWP["wp-header_sticky"], stylesWP["wp-position-absolute"])}>
          <div className={clsx(stylesWP["wp-container"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "h-100")} style={{ height: "100%" }}>
            {
              oggettoHeaderWebpliant.showListaPagine && (
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label="ul di selezione"
                  className={clsx(stylesWP["wp-mobile-nav-activator"], stylesWP["wp-d-block"], stylesWP["wp-position-relative"])}
                >
                  <Lucide style={{ width: "25px", height: "18px" }} icon={isMenuOpen ? "X" : "Menu"} />
                </button>
              )
            }

            <div className={stylesWP["wp-logo"]}>
              <Link aria-label="Logo" to={createDinamicLink({
                idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                idArea: idArea || location.state?.idArea || "",
                idCanale: idCanale || location.state?.idCanale || "",
                idGDO: idGDO || location.state?.idGDO || "",
                idPV: idPV || location.state?.idPV || "",
                idPaginaLoc: undefined,
                idSitemap: undefined
              })} >
                {dataConfig?.data?.webpliant?.logo_header && (
                  <LazyImageWrapper
                    src={getLogoUrl()}
                    alt={`Logo ${dataWebPliant?.nomeWorkspace}`}
                    className={clsx(stylesWP["wp-logo__image"], stylesWP["wp-d-block"], "max-h-20")}
                    style={{ maxHeight: "60px", width: "auto", maxWidth: "100px" }}

                  />
                )}
              </Link>
            </div>
            {
              oggettoHeaderWebpliant.showPuntiVendita && (
                <button
                  onClick={() => setIsMenuVenditaOpen(!isMenuVenditaOpen)}
                  aria-label=""
                  className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                  data-aside="cartDrawer"
                >
                  <Lucide icon="Store" />
                </button>
              )
            }
            {
              oggettoHeaderWebpliant.showWishlist && (
                <button
                  onClick={() => setIsMenuLista(!isMenuLista)}
                  aria-label=""
                  className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                  data-aside="cartDrawer"
                >
                  <Lucide icon="Heart" />
                </button>
              )
            }
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-label=""
              className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
              data-aside="cartDrawer"
            >
              <Lucide icon="Search" />
            </button>
            {isSearchOpen && (
              <div className="fixed inset-0 bg-white flex flex-col items-center justify-start z-50 pt-20">
                <div className="w-11/12 max-w-lg">
                  <div className="flex items-start mb-10">
                    <button
                      onClick={() => setIsSearchOpen(false)}
                      className="mr-4 text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </button>
                    <h2 className="text-xl font-semibold">Cerca i prodotti in promozione</h2>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      placeholder="Cosa stai cercando?"
                      className={clsx("w-full border  py-3 pl-10 pr-4  border-black outline-none focus:border-black focus:ring-0  text-sm")}
                      // className="w-full py-3 pl-10 pr-4 border-b-2 border-gray-300 focus:border-blue-500 outline-none text-lg"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          setIsSearchOpen(false);
                          navigate(`/webpliant/ricerca?query=${query}`, {
                            state: {
                              idArea,
                              idCanale,
                              idGDO,
                              idPV,
                              idWorkspace,
                            }
                          });
                          setSelectedRef(null);
                        }
                      }}
                      autoFocus
                    />
                  </div>

                  <button
                    onClick={() => {
                      setIsSearchOpen(false);
                      navigate(`/webpliant/ricerca?query=${query}`, {
                        state: {
                          idArea,
                          idCanale,
                          idGDO,
                          idPV,
                          idWorkspace,
                        }
                      });
                      setSelectedRef(null);
                    }}
                    className={
                      clsx(stylesWP["wp-btn"],
                        stylesWP["wp-btn-sm"],
                        stylesWP["wp-btn-outline-primary"],
                        stylesWP["wp-text-uppercase"],
                        stylesWP["wp-font-weight-bold"],
                        "w-full",
                        "jost")}
                  >
                    Cerca
                  </button>
                </div>
              </div>
            )}
          </div>

          <nav className={clsx(stylesWP["wp-header-mobile__navigation"], stylesWP["wp-navigation"], stylesWP["wp-d-flex"], "flex-column", "w-full", stylesWP["wp-position-absolute"], "top-100", stylesWP["wp-bg-body"], "overflow-auto", "w-full")}>
            <div className={stylesWP["wp-container"]} style={{ height: "100%" }}>
              <div className={stylesWP["overflow-hidden"]} style={{ height: "100%" }}>
                <ul
                  className={clsx(stylesWP["wp-navigation__list"], stylesWP["wp-list-unstyled"], stylesWP["wp-position-relative"])}
                  style={{ transform: isMenuOpenPhone ? "translateX(-100%)" : "translateX(0%)" }}
                >
                  {oggettoHeaderWebpliant.showListaPagine && dataWebPliant?.sitemap?.map((item: SitemapType, index) => {
                    if (item?.pagine_collegate?.length > 1) {
                      // Menu annidato
                      return (
                        <li key={index} className={stylesWP["wp-navigation__item"]}>
                          <a
                            href="#"
                            className={clsx(stylesWP["wp-navigation__link"], stylesWP["wp-js-nav-right"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "jost")}
                            style={{ justifyContent: "space-between" }}
                            onClick={(e) => {
                              e.preventDefault();
                              setIsMenuOpenPhone(isMenuOpenPhone === item.id ? "" : item.id);
                            }}
                          >
                            {item.titolo}
                            {!isMenuOpenPhone && <Lucide icon="ChevronRight" />}
                          </a>
                          {isMenuOpenPhone === item.id && (
                            <div
                              className={clsx(stylesWP["wp-sub-menu"], stylesWP["wp-position-absolute"], stylesWP["wp-top-0"], stylesWP["wp-start-100"], "w-full", {
                                [stylesWP["wp-d-none"]]: !isMenuOpenPhone
                              })}
                            >
                              <button
                                onClick={() => setIsMenuOpenPhone("")}
                                className={clsx(stylesWP["wp-navigation__link"], stylesWP["wp-js-nav-left"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], stylesWP["wp-border-bottom"], stylesWP["wp-mb-2"])}
                              >
                                <Lucide icon="ChevronLeft" />
                                Torna indietro
                              </button>
                              <ul className={clsx(stylesWP["wp-list-unstyled"])} style={{ fontFamily: "Jost" }}>
                                {dataWebPliant?.sitemap
                                  ?.find((s) => s.id === item.id)
                                  ?.pagine_collegate?.map((pagina_collegata: any) => (
                                    <li
                                      key={pagina_collegata.id}
                                      className={stylesWP["wp-sub-menu__item"]}
                                      style={{
                                        display: 'list-item',
                                        textAlign: '-webkit-match-parent',
                                        unicodeBidi: 'isolate'
                                      }}
                                    >
                                      <Link
                                        onClick={() => setIsMenuOpen(false)}
                                        to={createDinamicLink({
                                          idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                                          idArea: idArea || location.state?.idArea || "",
                                          idCanale: idCanale || location.state?.idCanale || "",
                                          idGDO: idGDO || location.state?.idGDO || "",
                                          idPV: idPV || location.state?.idPV || "",
                                          idPaginaLoc: pagina_collegata.id,
                                          idSitemap: item.id
                                        })}
                                        className={clsx(stylesWP["wp-menu-link"], stylesWP["wp-menu-link_us-s"])}
                                      >
                                        {pagina_collegata.titolo}
                                      </Link>
                                    </li>
                                  ))}
                              </ul>
                            </div>
                          )}
                        </li>
                      );
                    } else {
                      return (
                        <li key={index} className={clsx(stylesWP["wp-navigation__item"])} style={{ fontFamily: "Jost" }}>
                          {item.link_esterno ? (
                            <a
                              href={item.link_esterno}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={clsx(stylesWP["wp-navigation__link"], stylesWP["wp-js-nav-right"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "jost")}
                            >
                              {item.titolo}
                            </a>
                          ) : (
                            <Link
                              onClick={(e) => setIsMenuOpen(false)}
                              to={createDinamicLink({
                                idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                                idArea: idArea || location.state?.idArea || "",
                                idCanale: idCanale || location.state?.idCanale || "",
                                idGDO: idGDO || location.state?.idGDO || "",
                                idPV: idPV || location.state?.idPV || "",
                                idPaginaLoc: item?.pagine_collegate?.[0]?.id,
                                idSitemap: undefined
                              })}
                              className={clsx(stylesWP["wp-navigation__link"], stylesWP["wp-js-nav-right"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "jost")}
                            >
                              {item.titolo}
                            </Link>
                          )}
                        </li>
                      );
                    }
                  })}
                </ul>
              </div>
            </div>
          </nav>
        </div>

        {/* HEADER DESKTOP */}
        <header
          id="header"
          style={{ padding: "0 1.25rem" }}
          className={clsx(stylesWP["wp-header"], stylesWP["wp-header-fullwidth"], stylesWP["wp-header-transparent-bg"], {
            [stylesWP["wp-header_sticky-active"]]: isGoingUp,
            [stylesWP["wp-position-absolute"]]: !isGoingUp
          })}
        >
          <div style={{ padding: "1rem" }} className={clsx(stylesWP["wp-header-desk"], stylesWP["wp-header-desk_type_2"])}>
            <nav className={clsx(stylesWP["wp-navigation"], stylesWP["wp-d-flex"])}>
              <div className={stylesWP["wp-logo"]}>
                <Link aria-label="Logo" to={createDinamicLink({
                  idWorkspace: idWorkspace || location.state?.idWorkspace || "",
                  idArea: idArea || location.state?.idArea || "",
                  idCanale: idCanale || location.state?.idCanale || "",
                  idGDO: idGDO || location.state?.idGDO || "",
                  idPV: idPV || location.state?.idPV || "",
                  idPaginaLoc: undefined,
                  idSitemap: undefined
                })} className={clsx(stylesWP["wp-logo__link"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"])}>
                  {dataConfig?.data?.webpliant?.logo_header && (
                    <LazyImageWrapper
                      src={getLogoUrl()}
                      alt={`Logo ${dataWebPliant?.nomeWorkspace}`}
                      className={clsx(stylesWP["wp-logo__image"], stylesWP["wp-d-block"], stylesWP["wp-header-logo"], "max-h-20")}
                      style={{ maxHeight: "60px", width: "auto", maxWidth: "100px" }}
                    />
                  )}
                </Link>
              </div>

              <ul style={{ alignItems: "anchor-center" }} className={clsx(stylesWP["wp-navigation__list"], stylesWP["wp-list-unstyled"], stylesWP["wp-d-flex"])}>
                {renderLinkMenuItems}
              </ul>
            </nav>

            <div className={clsx(stylesWP["wp-header-tools"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], stylesWP["wp-mr-8"])}>
              {
                oggettoHeaderWebpliant.showPuntiVendita && (
                  <>
                    <img
                      loading="lazy"
                      className={"h-8"}
                      src={"/static/images/120x120_pinmap.png"}
                      alt=""
                    />
                    <div className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"], stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], stylesWP["wp-mt-0"])}>
                      <span>
                        {allPuntiVenditaFiltered?.find((pv) => pv.id_puntivendita === idPV)?.nome_puntivendita || "Seleziona un punto vendita"}
                      </span>
                      <span className={clsx(stylesWP["wp-text-secondary"], stylesWP["wp-text-small"], stylesWP["wp-italic"])} style={{ fontSize: '0.8rem', lineHeight: '1rem', marginTop: '-0.2rem' }}>
                        {allPuntiVenditaFiltered?.find((pv) => pv.id_puntivendita === idPV)?.indirizzo_puntivendita || ""}
                      </span>
                    </div>
                    <button
                      onClick={() => setIsMenuVenditaOpen(!isMenuVenditaOpen)}
                      aria-label=""
                      className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                      data-aside="cartDrawer"
                    >
                      <Lucide icon="Store" />
                    </button>
                  </>
                )
              }
              {
                oggettoHeaderWebpliant.showWishlist && (
                  <button
                    onClick={() => setIsMenuLista(!isMenuLista)}
                    aria-label=""
                    className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                    data-aside="cartDrawer"
                  >
                    <Lucide icon="Heart" />
                  </button>
                )
              }
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label=""
                className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                data-aside="cartDrawer"
              >
                <Lucide icon="Search" />
              </button>
              <input
                type="text"
                placeholder="Cerca..."
                className={clsx("w-full border border-black outline-none focus:border-black focus:ring-0  text-sm")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                style={{ display: isSearchOpen ? "block" : "none", maxWidth: "300px" }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setIsSearchOpen(false);
                    navigate(`/webpliant/ricerca?query=${query
                      }${idWorkspace ? `&id=${idWorkspace}` : ""
                      }${idArea ? `&idArea=${idArea}` : ""
                      }${idCanale ? `&idCanale=${idCanale}` : ""
                      }${idGDO ? `&idGDO=${idGDO}` : ""
                      }${idPV ? `&idPV=${idPV}` : ""}`
                    );
                    setSelectedRef(null);
                  }
                }}
              />
            </div>
          </div>
        </header>

        {/* DEV CONSOLE: pulsanti e log */}
        {(mode !== "final_user" && Debug === "true") && (
          <DevConsoleButtons
            isOpen={isOpen}
            toggleOpen={toggleOpen}
            handleFloatButtonClick={handleFloatButtonClick}
            handleFloatButtonTimeLine={handleFloatButtonTimeLine}
            numeroErrori={numeroErrori}
          />
        )}

        <Outlet />

        {/* Developer Console vera e propria */}
        {(mode !== "final_user" && Debug === "true") && <DeveloperConsole ref={refDevConsole} mode={mode || "final_user"} />}

        {/* ASIDE */}
        <motion.div
          className={clsx(stylesWP["wp-aside"], stylesWP["wp-aside_right"], stylesWP["wp-cart-drawer"], {
            [stylesWP["wp-aside_visible"]]: isMenuVenditaOpen
          })}
          id="cartDrawer"
        >
          <div className={clsx(stylesWP["wp-aside-header"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"])}>
            <h3 className={clsx(stylesWP["wp-text-uppercase"], stylesWP["wp-fs-6"], stylesWP["wp-mb-0"])}>Punti vendita</h3>
            <button
              className={clsx(stylesWP["wp-btn-close-lg"], stylesWP["wp-js-close-aside"], stylesWP["wp-btn-close-aside"], stylesWP["wp-ms-auto"])}
              onClick={() => setIsMenuVenditaOpen(!isMenuVenditaOpen)}
            />
          </div>
          <div style={{ height: "87%" }} className={clsx(stylesWP["wp-aside-content"], stylesWP["wp-cart-drawer-items-list"])}>
            <div className={clsx(stylesWP["wp-cart-drawer-item"], stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], "mb-4")}>
              <input
                id="capSearch"
                type="text"
                placeholder="Inserisci CAP"
                className={clsx("w-full border border-black outline-none focus:border-black focus:ring-0  text-sm p-2")}
                onChange={(e) => {
                  const cap = e.target.value.trim();
                  if (cap) {
                    const filteredPuntiVendita = allPuntiVenditaFiltered?.filter((pv) =>
                      pv.cap_puntivendita.startsWith(cap)
                    );
                    setAllPuntiVenditaFiltered(filteredPuntiVendita);
                  } else {
                    setAllPuntiVenditaFiltered(allPuntiVendita || []);
                  }
                }}
              />
            </div>
            {allPuntiVenditaFiltered && allPuntiVenditaFiltered.map((pv, i) => (
              <React.Fragment key={pv.id_puntivendita}>
                <div className={clsx(stylesWP["wp-cart-drawer-item"], stylesWP["wp-d-flex"], stylesWP["wp-position-relative"])}>
                  {pv.lat_puntivendita && pv.lon_puntivendita ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${pv.lat_puntivendita},${pv.lon_puntivendita}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        loading="lazy"
                        className={stylesWP["wp-cart-drawer-item__img"]}
                        src="/static/images/120x120_pinmap.png"
                        alt=""
                      />
                    </a>
                  ) : (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        `${pv.indirizzo_puntivendita},${pv.cap_puntivendita} ${pv.citta_puntivendita}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <img
                        loading="lazy"
                        className={stylesWP["wp-cart-drawer-item__img"]}
                        src="/static/images/120x120_pinmap.png"
                        alt=""
                      />
                    </a>
                  )}
                  <div className={clsx(stylesWP["wp-cart-drawer-item__info"], stylesWP["wp-flex-grow-1"])}>
                    <h6 className={clsx(stylesWP["wp-cart-drawer-item__title"], stylesWP["wp-fw-normal"])}>{pv.nome_puntivendita}</h6>
                    <p className={clsx(stylesWP["wp-cart-drawer-item__option"], stylesWP["wp-text-secondary"])}>
                      {pv.indirizzo_puntivendita}
                    </p>
                    <p className={clsx(stylesWP["wp-cart-drawer-item__option"], stylesWP["wp-text-secondary"])}>
                      Cap. {pv.cap_puntivendita}
                    </p>
                  </div>
                  <a
                    href={createDinamicLink({
                      idWorkspace: pv.idWorkspace_PuntiVendita || "",
                      idArea: pv.idArea_PuntiVendita || "",
                      idCanale: pv.idCanale_puntiVendita || "",
                      idGDO: idGDO || "",
                      idPV: pv.id_puntivendita || "",
                      idPaginaLoc: undefined,
                      idSitemap: undefined
                    })}
                    className={clsx(stylesWP["wp-btn"], stylesWP["wp-btn-sm"], stylesWP["wp-align-self-center"], {
                      [stylesWP["wp-btn-primary"]]: pv.id_puntivendita === idPV,
                      [stylesWP["wp-text-white"]]: pv.id_puntivendita === idPV,
                      [stylesWP["wp-btn-outline-primary"]]: pv.id_puntivendita !== idPV,
                    })}
                  >
                    {pv.id_puntivendita === idPV ? "Selezionato" : "Seleziona"}
                  </a>
                </div>
                {allPuntiVenditaFiltered.length - 1 !== i && <hr className={stylesWP["wp-cart-drawer-divider"]} />}
              </React.Fragment>
            ))}
          </div>

        </motion.div>
        <motion.div
          className={clsx(stylesWP["wp-aside"], stylesWP["wp-aside_right"], stylesWP["wp-overflow-hidden"], stylesWP["wp-cart-drawer"], {
            [stylesWP["wp-aside_visible"]]: isMenuLista
          })}
          id="cartDrawer"
        >
          <div className={clsx(stylesWP["wp-aside-header"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"])}>
            <h3 className={clsx(stylesWP["wp-text-uppercase"], stylesWP["wp-fs-6"], stylesWP["wp-mb-0"])}>
              WishList
              {wishlistUpdating && (
                <span className="ml-2 text-blue-500 text-xs">
                  🔄 Aggiornamento...
                </span>
              )}
            </h3>
            <button
              className={clsx(stylesWP["wp-btn-close-lg"], stylesWP["wp-js-close-aside"], stylesWP["wp-btn-close-aside"], stylesWP["wp-ms-auto"])}
              onClick={() => setIsMenuLista(!isMenuLista)}
            />
          </div>
          <div style={{ height: "87%" }} className={clsx(stylesWP["wp-aside-content"], stylesWP["wp-cart-drawer-items-list"], stylesWP["wp-d-flex"], stylesWP["wp-flex-column"])}>
            <ul style={{ height: "78%", float: "right" }} className={clsx(stylesWP["wp-list-unstyled"], stylesWP["wp-p-0"], stylesWP["wp-m-0"])}>
              {refLista && refLista.map((ref, i) => (
                <li key={ref.codice_referenza as string} className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <img src={Array.isArray(ref["foto"]) ? ref["foto"][0] : ""} alt="" className="w-14 h-14 mr-2 object-contain" />
                  <span className={clsx(stylesWP["wp-text-small"], stylesWP["wp-flex-grow-1"])}>
                    {ref?.descrizione_uno} {ref?.descrizione_due} {ref?.descrizione_tre}
                  </span>
                  <button
                    onClick={async () => {
                      try {
                        // Aggiorna UI immediatamente
                        setRefLista((prev) => prev?.filter((item) => item.codice_referenza !== ref.codice_referenza) || null);

                        // Effettua rimozione sul server
                        await ServerCall.post("/deleteWishlistItem", { codice: ref.codice_referenza, wishlistId: sessionWishlistId });

                        // Emetti evento per notificare altri componenti
                        notifyItemRemoved(ref.codice_referenza as string, sessionWishlistId);

                        console.log('✅ Item removed from wishlist sidebar:', ref.codice_referenza);
                      } catch (error) {
                        console.error('❌ Errore durante la rimozione dalla sidebar:', error);
                        // TODO: In caso di errore, potresti voler ricaricare la lista
                      }
                    }}
                    className={clsx(stylesWP["wp-btn"], stylesWP["wp-btn-sm"], stylesWP["wp-btn-outline-danger"])}
                  >
                    Elimina
                  </button>
                </li>
              ))}
            </ul>
            <div className={clsx("flex flex-row justify-end", stylesWP["wp-aside-footer"])}>
              <div className={clsx(stylesWP["wp-aside-footer"], "p-4")}>
                <button
                  onClick={() => {
                    handleShare()
                  }}
                  className={clsx(stylesWP["wp-btn"], stylesWP["wp-btn-sm"], stylesWP["wp-btn-outline-primary"])}
                >
                  Condividi Wishlist
                </button>
              </div>
              <div className={clsx(stylesWP["wp-aside-footer"], "p-4")}>
                <button
                  onClick={() => {
                    navigate(`/webpliant/wishlist?guidIdWishlist=${sessionWishlistId}`, {
                      state: {
                        idArea,
                        idCanale,
                        idGDO,
                        idPV,
                        idWorkspace,
                        idPagina
                      }
                    });
                    setIsMenuLista(false);
                  }}
                  className={clsx(stylesWP["wp-btn"], stylesWP["wp-btn-sm"], stylesWP["wp-btn-outline-primary"])}
                >
                  Vai alla wishlist
                </button>
              </div>
            </div>
          </div>
        </motion.div>


        {/* FOOTER */}
        <footer className={clsx(stylesWP["wp-footer"], "w-full", stylesWP["wp-footer_type_2"], stylesWP["wp-dark"], "mt-auto")}>
          <div className={stylesWP["wp-footer-bottom"]}>
            <div className={clsx(stylesWP["wp-container"], stylesWP["wp-d-md-flex"], stylesWP["wp-align-items-center"])}>
              <span className={clsx(stylesWP["wp-footer-copyright"], stylesWP["wp-me-auto"])}>
                ©{dayjs().format('YYYY')} <strong>WebPliant</strong> - Istanta.it
              </span>
            </div>
          </div>
        </footer>

        {/* Cookie Consent Modal */}
        <CookieConsent />
      </div>
    </>
  );
};

function App() {
  const config = useFetchConfig();
  return (
    <GestioneReferenzeProvider>
      <GestioneHeaderWebpliantProvider>
        <WebpliantLayout />
      </GestioneHeaderWebpliantProvider>
    </GestioneReferenzeProvider>
  );
}

export default App
