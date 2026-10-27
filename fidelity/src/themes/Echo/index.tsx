import "@/assets/css/themes/echo.css";
import { usePermissionContext } from "@/context/PermissionContext";
import { PERMISSIONS } from "@/constants/permissions";
import "@/assets/css/vendors/simplebar.css";
import logoI2 from "@/assets/images/logo-i2.svg";
import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import { useAppDispatch, useAppSelector } from "@/stores/hooks";
import { fetchSideMenu, selectSideMenu, selectSideMenuError } from "@/stores/sideMenuSlice_istanta";
import clsx from "clsx";
import { createRef, startTransition, useContext, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FormattedMenu, nestedMenu } from "./side-menu";
import SideMenu from "./SideMenu";
//@ts-ignore
// import logo from "@/assets/images/logo.svg";
import userIcon from "@/assets/images/users/user_icon_profile.png";
import ActivitiesPanel from "@/components/ActivitiesPanel";
import {
  ContextMenu
} from "@/components/Base/ContextMenu";
import Menu from "@/components/Base/Headless/Menu";
import SmartBreadcrumb from "@/components/Base/SmartBreadcrumb";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import MaintenanceModal from "@/components/MaintenanceModal";
import NotificationsPanel from "@/components/NotificationsPanel";
import QuickSearch from "@/components/QuickSearch";
import AccessoNegato, { DentroLayoutContext } from "@/components/AccessoNegato";
import withSessionCheck, { AccessoPaginaContext } from "@/components/SessionChecker";
import SwitchAccount from "@/components/SwitchAccount";
import { useUser } from "@/context/UserContext.tsx";
import { SocketProvider } from "@/hooks/useSocket";
import { useFetchAttivita, useFetchAvvisoManutenzione } from "@/query/query";
import { useMutation } from "@tanstack/react-query";
import SimpleBar from "simplebar";
import { TIPO_UTENTI } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { AppLoaderBridge } from "../../components/AppLoaderBridge";
import GlobalLoadingIndicator from "../../components/GlobalLoadingIndicator";

const findStartPageItem = (
  items: Array<FormattedMenu | string>
): FormattedMenu | undefined => {
  let firstNavigableItem: FormattedMenu | undefined;

  for (const item of items) {
    if (typeof item === "string") {
      continue;
    }

    if (!firstNavigableItem && item.pathname && !item.disabled) {
      firstNavigableItem = item;
    }

    if (item.start_page === true) {
      return item;
    }

    if (item.subMenu && item.subMenu.length > 0) {
      const nestedStartPage = findStartPageItem(item.subMenu);
      if (nestedStartPage) {
        return nestedStartPage;
      }
    }
  }

  return firstNavigableItem;
};

const CHIAVE_MENU_COMPRESSO = "fidelity.menu-compresso";

function Layout() {
  const accessoConsentito = useContext(AccessoPaginaContext);
  const { hasPermission } = usePermissionContext();

  const { user } = useUser();
  const dispatch = useAppDispatch();
  const [quickSearch, setQuickSearch] = useState(false);
  const [switchAccount, setSwitchAccount] = useState(false);
  const [notificationsPanel, setNotificationsPanel] = useState(false);
  const [activitiesPanel, setActivitiesPanel] = useState(false);
  const [activeMobileMenu, setActiveMobileMenu] = useState(false);
  const [menuCompresso, setMenuCompresso] = useState(() => {
    try {
      return localStorage.getItem(CHIAVE_MENU_COMPRESSO) === "1";
    } catch {
      return false;
    }
  });
  // Il menu compresso si riapre al passaggio del mouse, sopra al contenuto
  const [menuSorvolato, setMenuSorvolato] = useState(false);
  const menuRidotto = menuCompresso && !menuSorvolato;
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [maintenanceModal, setMaintenanceModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const attivita = useFetchAttivita();
  const avviso = useFetchAvvisoManutenzione();
  const bannerActive = !!(avviso.data?.attivo);
  const BANNER_H = 40; // altezza banner in px
  const [logoGDO, setLogoGDO] = useState<string | undefined>(undefined)
  const [hasUnreadAttivita, setHasUnreadAttivita] = useState(false);

  useEffect(() => {
    if (attivita?.data) {
      setHasUnreadAttivita(attivita.data.some(attivita => !attivita.is_read));
    }
  }, [attivita?.data]);


  useEffect(() => {
    if (logoGDO !== undefined) {
      return;
    }

    const controller = new AbortController();
    const fetchLogo = async () => {
      try {
        const url = `${ServerCall.getUrl()}/gdo/icona`;
        const response = await fetch(url, { method: "HEAD", signal: controller.signal, credentials: "include" });
        if (response.ok) {
          setLogoGDO(url);
        } else {
          setLogoGDO(undefined);
        }
      } catch (error) {
        if ((error as DOMException).name !== "AbortError") {
          setLogoGDO(undefined);
        }
      }
    };

    fetchLogo();
    return () => controller.abort();
  }, [logoGDO]);

  const [formattedMenu, setFormattedMenu] = useState<
    Array<FormattedMenu | string>
  >([]);
  const [startPage, setStartPage] = useState<FormattedMenu | undefined>(undefined)
  const sideMenuStore = useAppSelector(selectSideMenu);
  const sideMenuError = useAppSelector(selectSideMenuError);
  const sideMenu = () => nestedMenu(sideMenuStore, location);
  const scrollableRefMenu = createRef<HTMLDivElement>();
  const scrollBar = createRef<HTMLDivElement>()

  const [topBarActive, setTopBarActive] = useState(false);

  useEffect(() => {
    setStartPage(findStartPageItem(formattedMenu));
  }, [formattedMenu]);

  useEffect(() => {
    try {
      localStorage.setItem(CHIAVE_MENU_COMPRESSO, menuCompresso ? "1" : "0");
    } catch {
      // senza storage la scelta vale solo per la sessione
    }
  }, [menuCompresso]);

  const handleMenuToggle = (event: React.MouseEvent) => {
    event.preventDefault();
    setActiveMobileMenu(!activeMobileMenu);
  };


  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("fullscreen", isFullScreen);
  }, [isFullScreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // F11 → fullscreen custom
      if (e.key === "F11") {
        e.preventDefault();
        document.fullscreenElement
          ? exitFullscreen()
          : requestFullscreen();
      }

      // Cmd+Shift+F / Ctrl+Shift+F
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "f"
      ) {
        e.preventDefault();
        document.fullscreenElement
          ? exitFullscreen()
          : requestFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const requestFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen request failed:", err);
    }
  };

  const exitFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn("Exit fullscreen failed:", err);
    }
  };

  useEffect(() => {
    if (scrollableRefMenu.current) {
      new SimpleBar(scrollableRefMenu.current);
    }
    if (scrollBar.current) {
      new SimpleBar(scrollBar.current)
    }
    setFormattedMenu(sideMenu());

    // Il resize viene gestito nel nuovo useEffect con addEventListener
    // window.onresize = () => {
    //   compactLayout();
    // };
  }, [sideMenuStore, location]);

  window.onscroll = () => {
    // Topbar
    if (document.body.scrollTop > 0 || document.documentElement.scrollTop > 0) {
      setTopBarActive(true);
    } else {
      setTopBarActive(false);
    }
  };

  const mutationLogout = useMutation({
    mutationFn: async (): Promise<{ status: number }> => {
      const response = await ServerCall.get<{ status: number }>("/logout-user");
      return response;
    },
    onSuccess: (data: { status: number }) => {
      navigate("/login");
    }
  })

  return (
    <SocketProvider>
      <ContextMenu>
        <AppLoaderBridge />
        <GlobalLoadingIndicator />
        <MaintenanceBanner />
        <div
          style={{ height: "100%" }}
          className={clsx([
            "h-dvh",
            "echo group bg-gradient-to-b from-slate-200/70 to-slate-50 background relative min-h-screen",
            "before:content-[''] before:h-[370px] before:w-screen before:bg-gradient-to-t before:from-theme-1/80 before:to-theme-2 [&.background--hidden]:before:opacity-0 before:transition-[opacity,height] before:ease-in-out before:duration-300 before:top-0 before:fixed",
            "after:content-[''] after:h-[370px] after:w-screen [&.background--hidden]:after:opacity-0 after:transition-[opacity,height] after:ease-in-out after:duration-300 after:top-0 after:fixed after:bg-texture-white after:bg-contain after:bg-fixed after:bg-[center_-13rem] after:bg-no-repeat",
            topBarActive && "background--hidden",
          ])}
        >
          <div
            style={{ top: bannerActive ? BANNER_H : 0 }}
            className={clsx([

              "xl:ml-0 shadow-xl transition-[margin,padding] duration-300 xl:shadow-none fixed top-0 left-0 z-50 side-menu group inset-y-0",
              "after:content-[''] after:fixed after:inset-0 after:bg-black/80 after:xl:hidden ",
              { "ml-0 after:block": activeMobileMenu },
              { "-ml-[275px] after:hidden": !activeMobileMenu },
              { "side-menu--collapsed": menuCompresso },
              { "side-menu--on-hover": menuCompresso && menuSorvolato },
            ])}
            onMouseEnter={() => setMenuSorvolato(true)}
            onMouseLeave={() => setMenuSorvolato(false)}

          >
            <div
              className={clsx([
                "fixed ml-[275px] w-10 h-10 items-center justify-center xl:hidden z-50",
                { flex: activeMobileMenu },
                { hidden: !activeMobileMenu },
              ])}
            >
              <button
                type="button"
                aria-label="Chiudi menu"
                onClick={() => setActiveMobileMenu(false)}
                className="mt-5 ml-5"
              >
                <Lucide icon="X" className="w-8 h-8 text-white" />
              </button>
            </div>
            <div
              className={clsx([
                "h-full bg-white rounded-none z-20 relative w-[275px] border-r border-slate-200 overflow-hidden flex flex-col transition-[width,box-shadow] duration-200 ease-out",
                { "xl:w-[76px]": menuRidotto },
                { "xl:shadow-[8px_0_24px_-12px_rgba(15,23,42,0.25)]": menuCompresso && menuSorvolato },
              ])}
            >
              <nav aria-label="Menu principale" className="contents">
              <div
                className={clsx([
                  "flex-none hidden xl:flex items-center z-10 px-[22px] h-[65px] w-[275px] overflow-hidden relative border-b border-slate-200",
                ])}
              >
                <Link
                  to={startPage?.pathname ?? ""}
                  prefetch="intent"
                  aria-label="Istanta 2 – pagina iniziale"
                  className="flex items-center min-w-0 flex-1 -ml-1.5 p-1.5 rounded-control transition-colors duration-150 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-theme-1/50"
                >
                  <img className="flex-none w-8 h-8 rounded-control" src={logoI2} alt="Istanta 2" />
                  <div
                    className={clsx([
                      "ml-2.5 min-w-0 leading-tight whitespace-nowrap transition-opacity duration-200",
                      { "xl:opacity-0": menuRidotto },
                    ])}
                  >
                    <div className="text-sm font-medium text-primary">Istanta 2</div>
                    <div className="text-2xs text-slate-500">Web Platform</div>
                  </div>
                </Link>
                {logoGDO && (
                  <div
                    title="Logo GDO"
                    className={clsx([
                      "flex-none flex items-center justify-center w-8 h-8 ml-2 p-0.5 bg-white border border-slate-200 rounded-control transition-opacity duration-200",
                      { "xl:opacity-0": menuRidotto },
                    ])}
                  >
                    <img className="max-w-full max-h-full object-contain" src={logoGDO} alt="Logo GDO" />
                  </div>
                )}
              </div>
              <div
                ref={scrollableRefMenu}
                className={clsx([
                  "w-full h-full z-20 px-3 pt-3 overflow-y-auto overflow-x-hidden pb-3 [&:-webkit-scrollbar]:w-0 [&:-webkit-scrollbar]:bg-transparent",
                  "[&_.simplebar-content]:p-0 [&_.simplebar-track.simplebar-vertical]:w-[10px] [&_.simplebar-track.simplebar-vertical]:mr-0.5 [&_.simplebar-track.simplebar-vertical_.simplebar-scrollbar]:before:bg-slate-400/30",
                ])}
              >
                <SideMenu
                  menu={formattedMenu}
                  compresso={menuRidotto}
                  errore={!!sideMenuError}
                  onRiprova={() => dispatch(fetchSideMenu())}
                  onNavigate={() => setActiveMobileMenu(false)}
                />
              </div>
              <div className="flex-none hidden xl:block px-3 py-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setMenuCompresso(!menuCompresso)}
                  aria-label={menuCompresso ? "Espandi menu" : "Comprimi menu"}
                  title={menuCompresso ? "Espandi menu" : "Comprimi menu"}
                  className="side-menu__link side-menu__toggle"
                >
                  <Lucide
                    icon={menuCompresso ? "PanelLeftOpen" : "PanelLeftClose"}
                    className="side-menu__link__icon"
                  />
                  <span className="side-menu__link__title">Comprimi menu</span>
                </button>
              </div>
              </nav>
            </div>
            <div style={{ top: bannerActive ? BANNER_H : 0 }} className={clsx("fixed h-[65px] mt-3.5 inset-x-0 top-0 transition-[margin] duration-200", menuCompresso ? "xl:ml-[76px]" : "xl:ml-[275px]")}>
              <div
                className={clsx([
                  // Stessi margini laterali dell'area contenuto: barra e pagina restano allineate
                  "top-bar absolute inset-x-0 h-full mx-4 sm:mx-6 xl:mx-8 group",
                  "before:content-[''] before:absolute before:top-0 before:inset-x-0 before:-mt-[15px] before:h-[20px] before:backdrop-blur",
                  topBarActive && "top-bar--active",
                ])}
              >
                <div
                  className="
                  flex items-center w-full h-full transition-[padding,background-color,border-color] ease-in-out duration-300 box bg-transparent border-transparent shadow-none
                  group-[.top-bar--active]:box group-[.top-bar--active]:px-2
                  group-[.top-bar--active]:bg-transparent group-[.top-bar--active]:border-transparent group-[.top-bar--active]:bg-gradient-to-r group-[.top-bar--active]:from-theme-1 group-[.top-bar--active]:to-theme-2
                "
                >
                  <div className="flex items-center gap-1 xl:hidden">
                    <button
                      type="button"
                      onClick={handleMenuToggle}
                      className="p-2 text-white rounded-full hover:bg-white/5"
                      title="Apri/chiudi menu"
                      aria-label="Apri/chiudi menu"
                    >
                      <Lucide icon="PanelLeftClose" aria-hidden="true" className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-white rounded-full hover:bg-white/5"
                      aria-label="Ricerca veloce"
                      onClick={() => setQuickSearch(true)}
                    >
                      <Lucide icon="Search" aria-hidden="true" className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex-1 block order-0 float-start min-w-0 px-2">
                    <SmartBreadcrumb light small startPage={startPage?.pathname} />
                  </div>
                  <div
                    className="relative justify-center flex-1 hidden xl:flex flex-shrink-0"
                    onClick={() => setQuickSearch(true)}
                  >
                    <div className="bg-white/10 border-transparent border w-[350px] flex items-center py-2 px-3.5 rounded-control text-white/60 cursor-pointer hover:bg-white/15 transition-colors duration-300 hover:duration-100">
                      <Lucide icon="Search" aria-hidden="true" className="h-5 w-5" />
                      <div className="ml-2.5 mr-auto">Ricerca veloce...</div>
                      <div>⌘K</div>
                    </div>
                  </div>
                  <QuickSearch
                    quickSearch={quickSearch}
                    setQuickSearch={setQuickSearch}
                  />

                  {/* END: Search */}
                  {/* BEGIN: Notification & User Menu */}
                  <div className="flex items-center flex-1">
                    <div className="flex items-center gap-1 ml-auto">
                      {/* <a
                      href=""
                      className="p-2 text-white rounded-full hover:bg-white/5"
                      onClick={(e) => {
                        e.preventDefault();
                        setActivitiesPanel(true);
                      }}
                    >
                      <Lucide icon="LayoutGrid" aria-hidden="true" className="h-5 w-5" />
                    </a>
                    <a
                      href=""
                      className="p-2 text-white rounded-full hover:bg-white/5"
                    >
                      <Lucide icon="Moon" aria-hidden="true" className="h-5 w-5" />
                    </a> */}
                      <button
                        type="button"
                        className="p-2 text-white rounded-full hover:bg-white/5"
                        aria-label={isFullScreen ? "Esci da schermo intero" : "Schermo intero"}
                        onClick={() => {
                          if (isFullScreen) {
                            exitFullscreen();
                          } else {
                            requestFullscreen();
                          }
                        }}
                      >
                        <Lucide icon={isFullScreen ? "Minimize" : "Expand"} aria-hidden="true" className="h-5 w-5" />
                      </button>
                      {hasPermission(PERMISSIONS.SISTEMA.MANUTENZIONE) && (
                        <button
                          type="button"
                          className={`relative p-2 text-white rounded-full hover:bg-white/5 ${avviso.data?.attivo ? "text-warning" : ""}`}
                          onClick={() => setMaintenanceModal(true)}
                          title="Avviso manutenzione"
                          aria-label="Avviso manutenzione"
                        >
                          <Lucide icon="Wrench" aria-hidden="true" className="h-5 w-5" />
                          {avviso.data?.attivo && (
                            <div className="absolute top-1 right-1 w-3 h-3 flex items-center justify-center">
                              <span className="block w-2 h-2 bg-warning border-2 border-white rounded-full shadow-lg"></span>
                            </div>
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        className="relative p-2 text-white rounded-full hover:bg-white/5"
                        aria-label={hasUnreadAttivita ? "Notifiche, ci sono attività non lette" : "Notifiche"}
                        onClick={() => setNotificationsPanel(true)}
                      >
                        <Lucide icon="Bell" aria-hidden="true" className="h-5 w-5" />
                        {/* Mostra la bubble solo se ci sono attività */}
                        {/* Mostra il pallino di notifica solo se ci sono attività non lette */}
                        {hasUnreadAttivita && (
                          <div
                            className="absolute top-1 right-1 w-3 h-3 flex items-center justify-center"
                            aria-label="Notifiche non lette"
                          >
                            <span className="block w-2 h-2 bg-primary border-2 border-white rounded-full shadow-lg"></span>
                          </div>
                        )}
                      </button>
                    </div>
                    <Menu className="ml-5">
                      <Menu.Button
                        as="button"
                        type="button"
                        aria-label="Menu utente"
                        className="overflow-hidden rounded-full w-9 h-9 border-2 border-white/15 image-fit"
                      >
                        <img
                          alt=""
                          src={user?.meta?.photo ? `data:image/png;base64,${user?.meta?.photo}` : userIcon}
                        />
                      </Menu.Button>
                      <Menu.Items className="w-56 text-sm text-slate-700">
                        {user?.outsider == false && (
                          <>
                            <Menu.Item onClick={() => setSwitchAccount(true)}>
                              <Lucide icon="ToggleLeft" aria-hidden="true" className="w-4 h-4 mr-2" />
                              Cambia Account
                            </Menu.Item>
                            <Menu.Item onClick={() => startTransition(() => { navigate("profilo-utente?page=connected-services"); })}>
                              <Lucide icon="Settings" aria-hidden="true" className="w-4 h-4 mr-2" />
                              Servizi Connessi
                            </Menu.Item>
                            <Menu.Item onClick={() => startTransition(() => { navigate("profilo-utente?page=email-profilo-utente"); })}>
                              <Lucide icon="Inbox" aria-hidden="true" className="w-4 h-4 mr-2" />
                              Impostazioni Email
                            </Menu.Item>
                            <Menu.Item onClick={() => startTransition(() => { navigate("profilo-utente?page=security"); })}>
                              <Lucide icon="Lock" aria-hidden="true" className="w-4 h-4 mr-2" />
                              Reimposta Password
                            </Menu.Item>
                            <Menu.Divider />
                          </>
                        )}
                        <Menu.Item onClick={() => startTransition(() => { navigate("profilo-utente"); })}>
                          <Lucide icon="Users" aria-hidden="true" className="w-4 h-4 mr-2" />
                          Profilo Utente
                        </Menu.Item>
                        <Menu.Item onClick={() => startTransition(() => { navigate("hub"); })}>
                          <Lucide icon="SquareArrowRightExit" aria-hidden="true" className="w-4 h-4 mr-2" />
                          Torna al Hub
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => mutationLogout.mutate()}
                          className="text-danger hover:bg-danger/10"
                        >
                          <Lucide icon="Power" aria-hidden="true" className="w-4 h-4 mr-2" />
                          Esci
                        </Menu.Item>
                      </Menu.Items>
                    </Menu>
                  </div>
                  <ActivitiesPanel
                    activitiesPanel={activitiesPanel}
                    setActivitiesPanel={setActivitiesPanel}
                  />
                  <NotificationsPanel
                    notificationsPanel={notificationsPanel}
                    setNotificationsPanel={setNotificationsPanel}
                  />
                  <SwitchAccount
                    switchAccount={switchAccount}
                    setSwitchAccount={setSwitchAccount}
                    currentUserId={user?.id as string}
                  />
                  <MaintenanceModal
                    open={maintenanceModal}
                    onClose={() => setMaintenanceModal(false)}
                    avvisoAttivo={avviso.data}
                  />
                  {/* END: Notification & User Menu */}
                </div>
              </div>
            </div>
          </div>
          <div
            className={clsx([
              "h-full transition-[margin] duration-200 pt-[54px] pb-16 relative z-10 group mode",
              menuCompresso ? "xl:ml-[76px]" : "xl:ml-[275px]",
              { "mode--light": !topBarActive },
            ])}
          >
            {/* Un solo contenitore, con margini uguali ai due lati */}
            <div className="mt-16 px-4 sm:px-6 xl:px-8">
              {accessoConsentito ? <Outlet /> : <AccessoNegato />}
            </div>
          </div>
        </div>
      </ContextMenu>
    </SocketProvider>
  );
}

// L'accesso negato si mostra al posto della pagina, con il menu ancora disponibile.
const LayoutConMenu = (props: Record<string, never>) => (
  <DentroLayoutContext.Provider value={true}>
    <Layout {...props} />
  </DentroLayoutContext.Provider>
);
(LayoutConMenu as unknown as { mostraAccessoNegatoNelLayout: boolean }).mostraAccessoNegatoNelLayout = true;

export default withSessionCheck(LayoutConMenu);
