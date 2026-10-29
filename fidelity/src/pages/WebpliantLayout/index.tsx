import Lucide from '@/components/Base/Lucide';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import React, { FC, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { Link, Outlet, useLoaderData, useLocation, useNavigate } from 'react-router-dom';
import { ServerCall } from '../../../lib/server_call';

// Local Components
// Console e gestione referenze servono solo in debug/superadmin: fuori dal chunk del volantino
// (si portano dietro editor, dropzone, axios e il loader di monaco)
import type { ConsoleMode } from './DevConsole';
const DeveloperConsole = lazy(() => import('./DevConsole'));

// Styles
import stylesWP from "@/assets/css/webpliant/stylewp.module.scss";

// Types and Utils
import { RootState } from '@/stores/store';
import { TIPO_PAGINA, TIPO_UTENTI } from '../../../lib/enums';
import {
  Config,
  DataFields,
  LoghiInsegne,
  PaginaWebPliant,
  PuntiVenditaAttributes,
  ReferenzeIstanta,
  SitemapType
} from '../../../lib/types';
import { urlFoto } from '@/utils/helper';

// Hooks and Contexts
import { GestioneHeaderWebpliantProvider, useGestioneHeaderWebpliant } from '@/context/GestioneHeaderWebpliant';
import { GestioneReferenzeProvider, useGestioneReferenze } from '@/context/GestioneReferenzeContext';
import { useUser } from '@/context/UserContext';
import { useAppLoading } from '@/hooks/useAppLoading';
import { useWebpliantParamsManager } from '@/hooks/useWebpliantParamsManager';
import { useFetchAllPuntiVendita, useFetchConfig } from '@/query/query';
import { GestoreParametriPresente } from '@/pages/WebPliant/gestoreParametri';

// Assets

// Utils
import { filtroSitemMap } from './utility';
import { CLASSE_CAMPO_PUBBLICO, CLASSE_TITOLO_PANNELLO_PUBBLICO } from './StatiPubblici';
// Rimosso import vecchio sistema - ora si usa useWebpliantParamsManager
import Dock from '@/components/Base/Dock';
import CookieConsent from '@/components/CookieConsent';
import { useWishlistEvents } from '@/utils/wishlistEvents';

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
  // Niente più /getColorGDO: il colore letto finiva in uno stato che nessuno usava
  const { refLista, setRefLista } = useReferenzeData();
  // TODO: Migrazione al nuovo sistema - temporaneo stub
  const ids = { sessionIdWebpliant: '', sessionWishlistId: '', URL_WEBPLIANT: '' };
  const refreshReferenze = () => { };

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
      const { idPV, idCanale, idArea, idGDO, idWorkspace, idPagina } = res;

      setters.setIdPV(idPV);
      setters.setIdCanale(idCanale);
      setters.setIdArea(idArea);
      setters.setIdGDO(idGDO);
      setters.setIdWorkspace(idWorkspace);
      setters.setIdPagina(idPagina);
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

/** Comandi esposti dalla DeveloperConsole tramite ref. */
type ComandiDevConsole = {
  toggleVisibilityErrori: () => void;
  toggleVisibilityTimeLine: () => void;
  toggleVisibilityGestioneReferenze: () => void;
};

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
      className: "text-danger",
      onClick: () => {
        toggleOpen();
      }
    },
    {
      icon: <Lucide icon="ListChecks" width={48} height={48} />,
      label: "Gestione Referenze",
      className: "text-info",
      onClick: () => {
        handleFloatButtonClick();
      }
    },
    {
      icon: <Lucide icon="Clock" width={48} height={48} />,
      label: "Timeline",
      className: "text-warning",
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
      className="z-[1100]"
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
  // Feedback locale: i toast globali (z-50) finirebbero sotto aside/header del volantino
  const [erroreGeolocalizzazione, setErroreGeolocalizzazione] = useState<string | null>(null);
  const [linkCopiato, setLinkCopiato] = useState(false);
  const { data: allPuntiVendita } = useFetchAllPuntiVendita(idGDO || "");
  const { allPuntiVenditaFiltered, setAllPuntiVenditaFiltered, filtraPuntiVendita } = useGeolocationFilter(allPuntiVendita);
  const { referenza } = useGestioneReferenze();
  const numeroErrori = useSelector((state: RootState) =>
    Object.values(state.developerConsoleReducer.errori).reduce((acc, arr) => acc + arr.length, 0)
  );
  const dataConfig = useFetchConfig();

  // Add missing ref for DevConsole
  const refDevConsole = useRef<ComandiDevConsole | null>(null);
  // La console arriva con il suo chunk dopo il primo render: i cambi di referenza avvenuti nel
  // frattempo si applicano appena si monta, come quando era già presente
  const toggleReferenzeInSospeso = useRef(false);
  const collegaDevConsole = useCallback((istanza: ComandiDevConsole | null) => {
    refDevConsole.current = istanza;
    if (istanza && toggleReferenzeInSospeso.current) {
      toggleReferenzeInSospeso.current = false;
      istanza.toggleVisibilityGestioneReferenze();
    }
  }, []);

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
    config?: Config | null;
  } = {};

  loaderData = useLoaderData() as typeof loaderData;
  const dataWebPliant = loaderData.dataWebPliant;

  // =============================================
  // Query Hooks
  // =============================================


  // =============================================
  // API Calls
  // =============================================
  const { fetchReferenzeWishlist, fetchDataWishlist, fetchRefs, refLista, setRefLista } = useWebpliantAPI(sessionWishlistId as string, guidIdWishlist);

  // =============================================
  // Effects
  // =============================================

  useEffect(() => {
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
      // Niente confirm: il permesso alla posizione lo chiede già il browser
      setUserLocationChoice(true);
      localStorage.setItem('userLocationChoice', 'true');

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          filtraPuntiVendita,
          (error) => {
            console.error("Error getting location:", error);
            if (error.code === error.PERMISSION_DENIED) {
              // Rifiuto dal prompt del browser: non è un errore da mostrare, non richiedere più
              setUserLocationChoice(false);
              localStorage.setItem('userLocationChoice', 'false');
            } else {
              setErroreGeolocalizzazione("Impossibile rilevare la tua posizione: controlla le impostazioni di localizzazione oppure cerca per CAP.");
            }
          }
        );
      } else {
        console.warn("Geolocation is not supported by this browser.");
        setErroreGeolocalizzazione("Il tuo browser non supporta la geolocalizzazione: cerca il punto vendita per CAP.");
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
    if (refDevConsole.current) {
      refDevConsole.current.toggleVisibilityGestioneReferenze();
    } else {
      toggleReferenzeInSospeso.current = !toggleReferenzeInSospeso.current;
    }
  }, [referenza])

  // Listen agli eventi wishlist per aggiornare la sidebar in tempo reale
  useEffect(() => {
    // Funzione di refresh centralizzata per evitare duplicazioni
    const refreshSidebarWishlist = async (eventType: string) => {
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
        .catch((error) => console.error('Errore durante la condivisione:', error));
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl)
        .then(() => {
          setLinkCopiato(true);
          setTimeout(() => setLinkCopiato(false), 2500);
        })
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
          <div className={clsx(stylesWP["wp-container"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], "h-full")}>
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
                  aria-label="Scegli il punto vendita"
                  className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                  data-aside="cartDrawer"
                >
                  <Lucide icon="Store" aria-hidden="true" />
                </button>
              )
            }
            {
              oggettoHeaderWebpliant.showWishlist && (
                <button
                  onClick={() => setIsMenuLista(!isMenuLista)}
                  aria-label="Lista dei desideri"
                  className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                  data-aside="wishlistDrawer"
                >
                  <Lucide icon="Heart" aria-hidden="true" />
                </button>
              )
            }
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              aria-label="Cerca i prodotti in promozione"
              className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
              data-aside="cartDrawer"
            >
              <Lucide icon="Search" aria-hidden="true" />
            </button>
            {isSearchOpen && (
              <div className="fixed inset-0 bg-white flex flex-col items-center justify-start z-50 pt-20">
                <div className="w-11/12 max-w-lg">
                  <div className="flex items-start mb-10">
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(false)}
                      className={clsx(stylesWP["wp-text-secondary"], "mr-8")}
                      aria-label="Chiudi la ricerca"
                    >
                      <Lucide icon="ArrowLeft" aria-hidden="true" className="h-6 w-6" />
                    </button>
                    <h2 className={clsx(CLASSE_TITOLO_PANNELLO_PUBBLICO, stylesWP["wp-mb-0"])}>Cerca i prodotti in promozione</h2>
                  </div>

                  <div className="relative mb-6">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lucide icon="Search" aria-hidden="true" className={clsx(stylesWP["wp-text-muted"], "h-5 w-5")} />
                    </div>
                    <input
                      type="search"
                      aria-label="Cerca i prodotti in promozione"
                      placeholder="Cosa stai cercando?"
                      className={clsx(CLASSE_CAMPO_PUBBLICO, "!pl-10")}
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
            <div className={clsx(stylesWP["wp-container"], "h-full")}>
              <div className="h-full overflow-hidden">
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
                      src="/images/map-marker.png"
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
                      aria-label="Scegli il punto vendita"
                      className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                      data-aside="cartDrawer"
                    >
                      <Lucide icon="Store" aria-hidden="true" />
                    </button>
                  </>
                )
              }
              {
                oggettoHeaderWebpliant.showWishlist && (
                  <button
                    onClick={() => setIsMenuLista(!isMenuLista)}
                    aria-label="Lista dei desideri"
                    className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                    data-aside="wishlistDrawer"
                  >
                    <Lucide icon="Heart" aria-hidden="true" />
                  </button>
                )
              }
              <button
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label="Cerca i prodotti in promozione"
                className={clsx(stylesWP["wp-header-tools__item"], stylesWP["wp-header-tools__cart"], stylesWP["wp-js-open-aside"])}
                data-aside="cartDrawer"
              >
                <Lucide icon="Search" aria-hidden="true" />
              </button>
              <input
                type="text"
                placeholder="Cerca..."
                className={CLASSE_CAMPO_PUBBLICO}
                aria-label="Cerca i prodotti in promozione"
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
        {(mode !== "final_user" && Debug === "true") && (
          <Suspense fallback={null}>
            <DeveloperConsole ref={collegaDevConsole} mode={mode || "final_user"} />
          </Suspense>
        )}

        {/* ASIDE */}
        <motion.div
          className={clsx(stylesWP["wp-aside"], stylesWP["wp-aside_right"], stylesWP["wp-cart-drawer"], {
            [stylesWP["wp-aside_visible"]]: isMenuVenditaOpen
          })}
          id="cartDrawer"
        >
          <div className={clsx(stylesWP["wp-aside-header"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"])}>
            <h3 className={clsx(CLASSE_TITOLO_PANNELLO_PUBBLICO, stylesWP["wp-mb-0"])}>Punti vendita</h3>
            <button
              className={clsx(stylesWP["wp-btn-close-lg"], stylesWP["wp-js-close-aside"], stylesWP["wp-btn-close-aside"], stylesWP["wp-ms-auto"])}
              onClick={() => setIsMenuVenditaOpen(!isMenuVenditaOpen)}
            />
          </div>
          <div className={clsx(stylesWP["wp-aside-content"], stylesWP["wp-cart-drawer-items-list"], "h-[87%]")}>
            <div className={clsx(stylesWP["wp-cart-drawer-item"], stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], "mb-4")}>
              {erroreGeolocalizzazione && (
                <p role="alert" className={clsx(stylesWP["wp-text-danger"], "mb-2 text-sm")}>{erroreGeolocalizzazione}</p>
              )}
              <input
                id="capSearch"
                type="text"
                inputMode="numeric"
                aria-label="CAP"
                placeholder="Inserisci CAP"
                className={CLASSE_CAMPO_PUBBLICO}
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
                        src="/images/map-marker.png"
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
                        src="/images/map-marker.png"
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
          id="wishlistDrawer"
        >
          <div className={clsx(stylesWP["wp-aside-header"], stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"])}>
            <h3 className={clsx(CLASSE_TITOLO_PANNELLO_PUBBLICO, stylesWP["wp-mb-0"])}>
              Wishlist
              {wishlistUpdating && (
                <span role="status" className={clsx(stylesWP["wp-text-secondary"], "ml-2 text-xs normal-case")}>
                  Aggiornamento...
                </span>
              )}
            </h3>
            <button
              className={clsx(stylesWP["wp-btn-close-lg"], stylesWP["wp-js-close-aside"], stylesWP["wp-btn-close-aside"], stylesWP["wp-ms-auto"])}
              onClick={() => setIsMenuLista(!isMenuLista)}
            />
          </div>
          <div className={clsx(stylesWP["wp-aside-content"], stylesWP["wp-cart-drawer-items-list"], stylesWP["wp-d-flex"], stylesWP["wp-flex-column"], "h-[87%]")}>
            <ul className={clsx(stylesWP["wp-list-unstyled"], stylesWP["wp-p-0"], stylesWP["wp-m-0"], "float-right h-[78%]")}>
              {refLista && refLista.map((ref, i) => (
                <li key={ref.codice_referenza as string} className={clsx(stylesWP["wp-d-flex"], stylesWP["wp-align-items-center"], stylesWP["wp-mb-2"])}>
                  <img src={urlFoto(ref["foto"])[0] ?? ""} alt="" loading="lazy" decoding="async" width={56} height={56} className="w-14 h-14 mr-2 object-contain" />
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
                  {linkCopiato ? "Link copiato negli appunti!" : "Condividi Wishlist"}
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
  const queryClient = useQueryClient();
  const { config: configDalLoader } = useLoaderData() as { config?: Config | null };
  // Il loader ha già letto /get_config: messa nella cache di React Query, useFetchConfig non la
  // richiede una terza volta (né qui, né nel layout, né nella ricerca)
  useState(() => {
    if (configDalLoader && queryClient.getQueryData(['config']) === undefined) {
      queryClient.setQueryData<Config>(['config'], configDalLoader);
    }
    return true;
  });
  useFetchConfig();
  return (
    <GestioneReferenzeProvider>
      <GestioneHeaderWebpliantProvider>
        {/* Il layout ha il suo useWebpliantParamsManager: le card sotto non ne creano altri */}
        <GestoreParametriPresente>
          <WebpliantLayout />
        </GestoreParametriPresente>
      </GestioneHeaderWebpliantProvider>
    </GestioneReferenzeProvider>
  );
}

export default App
