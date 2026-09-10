import "@/assets/css/themes/echo.css";
import "@/assets/css/vendors/simplebar.css";
import logoSVG from "@/assets/images/logo.svg";
import Lucide from "@/components/Base/Lucide";
import { useAppDispatch, useAppSelector } from "@/stores/hooks";
import { selectSideMenu } from "@/stores/sideMenuSlice_istanta";
import clsx from "clsx";
import { createRef, Fragment, startTransition, useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FormattedMenu, nestedMenu } from "./side-menu";
//@ts-ignore
// import logo from "@/assets/images/logo.svg";
import userIcon from "@/assets/images/users/user_icon_profile.png";
import ActivitiesPanel from "@/components/ActivitiesPanel";
import {
  ContextMenu
} from "@/components/Base/ContextMenu";
import Popover from "@/components/Base/Headless/Popover";
import SmartBreadcrumb from "@/components/Base/SmartBreadcrumb";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import MaintenanceModal from "@/components/MaintenanceModal";
import NotificationsPanel from "@/components/NotificationsPanel";
import QuickSearch from "@/components/QuickSearch";
import withSessionCheck from "@/components/SessionChecker";
import SwitchAccount from "@/components/SwitchAccount";
import { useUser } from "@/context/UserContext.tsx";
import { SocketProvider } from "@/hooks/useSocket";
import { useFetchAttivita, useFetchAvvisoManutenzione } from "@/query/query";
import { useMutation } from "@tanstack/react-query";
import SimpleBar from "simplebar";
import { TIPO_UTENTI } from "../../../lib/enums";
import { ServerCall } from "../../../lib/server_call";
import { AppLoaderBridge } from "../../components/AppLoaderBridge";

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

function Layout() {

  const { user } = useUser();
  const dispatch = useAppDispatch();
  const [quickSearch, setQuickSearch] = useState(false);
  const [switchAccount, setSwitchAccount] = useState(false);
  const [notificationsPanel, setNotificationsPanel] = useState(false);
  const [activitiesPanel, setActivitiesPanel] = useState(false);
  const [activeMobileMenu, setActiveMobileMenu] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [maintenanceModal, setMaintenanceModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const pathnames = location.pathname.split('/').filter((x) => x);
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
  const sideMenu = () => nestedMenu(sideMenuStore, location);
  const scrollableRefMenu = createRef<HTMLDivElement>();
  const scrollBar = createRef<HTMLDivElement>()

  const [topBarActive, setTopBarActive] = useState(false);

  useEffect(() => {
    setStartPage(findStartPageItem(formattedMenu));
  }, [formattedMenu]);

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
  const menuItems = [
    {
      type: "item" as const,
      label: "Copia",
      shortcut: "⌘+C",
      realShortcut: "cmd+c",
      onClick: () => navigator.clipboard.writeText("testo da copiare"),
    },
    {
      type: "item" as const,
      label: "Incolla",
      shortcut: "⌘+V",
      realShortcut: "cmd+v",
      onClick: () => navigator.clipboard.readText(),
    },
    {
      type: "separator" as const,
    },
    {
      type: "checkbox" as const,
      label: "Mostra griglia",
      checked: true,
      onClick: () => console.log("Toggle griglia"),
    },
    {
      type: "sub" as const,
      label: "Più opzioni",
      items: [
        {
          type: "item" as const,
          label: "Opzione 1",
          onClick: () => console.log("Opzione 1"),
        },
        {
          type: "item" as const,
          label: "Opzione 2",
          onClick: () => console.log("Opzione 2"),
        },
      ],
    },
  ];
  const filteredPathnames = pathnames.filter((value) => value);



  return (
    <SocketProvider>
      <ContextMenu>
        <AppLoaderBridge />
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
            ])}

          >
            <div
              className={clsx([
                "fixed ml-[275px] w-10 h-10 items-center justify-center xl:hidden z-50",
                { flex: activeMobileMenu },
                { hidden: !activeMobileMenu },
              ])}
            >
              <a
                href=""
                onClick={(event) => {
                  event.preventDefault();
                  setActiveMobileMenu(false);
                }}
                className="mt-5 ml-5"
              >
                <Lucide icon="X" className="w-8 h-8 text-white" />
              </a>
            </div>
            <div
              className={clsx([
                "h-full bg-white/[0.97] rounded-none z-20 relative w-[275px] border-r border-slate-200/80 shadow-[2px_0_8px_-2px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col",
              ])}
            >
              <div
                className={clsx([
                  "flex-none hidden xl:flex items-center z-10 px-5 h-[65px] w-[275px] overflow-hidden relative border-b border-slate-100",
                ])}
              >
                <Link
                  to={startPage?.pathname ?? ""}
                  prefetch="intent"
                  className="flex items-center"
                >
                  {/*
                <div className="flex items-center justify-center w-[34px] rounded-lg h-[34px] bg-gradient-to-b from-theme-1 to-theme-2/80 transition-transform ease-in-out group-[.side-menu--collapsed.side-menu--on-hover]:xl:-rotate-180">
                  <div className="w-[16px] h-[16px] relative -rotate-45 [&_div]:bg-white">
                    <div className="absolute w-[21%] left-0 inset-y-0 my-auto rounded-full opacity-50 h-[75%]"></div>
                    <div className="absolute w-[21%] inset-0 m-auto h-[120%] rounded-full"></div>
                    <div className="absolute w-[21%] right-0 inset-y-0 my-auto rounded-full opacity-50 h-[75%]"></div>
                  </div>
                </div>
                */}
                  <div className="flex items-center justify-center">
                    <div>
                      <img className="w-14 h-14 object-contain" src={logoGDO ?? logoSVG} />
                    </div>
                  </div>

                  <div className="ml-3.5 font-medium">
                    Istanta 2 Web Platform
                  </div>
                </Link>
              </div>
              <div
                ref={scrollableRefMenu}
                className={clsx([
                  "w-full h-full z-20 px-5 overflow-y-auto overflow-x-hidden pb-3 [-webkit-mask-image:-webkit-linear-gradient(top,rgba(0,0,0,0),black_30px)] [&:-webkit-scrollbar]:w-0 [&:-webkit-scrollbar]:bg-transparent",
                  "[&_.simplebar-content]:p-0 [&_.simplebar-track.simplebar-vertical]:w-[10px] [&_.simplebar-track.simplebar-vertical]:mr-0.5 [&_.simplebar-track.simplebar-vertical_.simplebar-scrollbar]:before:bg-slate-400/30",
                ])}
              >
                <ul className="scrollable">
                  {formattedMenu.map((menu, menuKey) =>
                    typeof menu === "string" ? (
                      <li className="side-menu__divider" key={menuKey}>
                        {menu}
                      </li>
                    ) : (
                      <li key={menuKey}>
                        {menu.redirect ? (
                          <a
                            href={menu.redirect}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={clsx([
                              "side-menu__link",
                              { "side-menu__link--disabled": menu.disabled },
                            ])}
                          >
                            <Lucide icon={menu.icon} className="side-menu__link__icon" />
                            <div className="side-menu__link__title">{menu.title}</div>
                          </a>
                        ) : (
                          <Link
                            to={menu.pathname ?? "#"}
                            prefetch="intent"

                            className={clsx([
                              "side-menu__link",
                              { "side-menu__link--disabled": menu.disabled },
                              { "side-menu__link--active": menu.active && !menu.disabled },
                              { "side-menu__link--active-dropdown": menu.activeDropdown },
                            ])}
                            onClick={(event) => {
                              if (menu.disabled || !menu.pathname) {
                                event.preventDefault();
                                return;
                              }

                              if (event.button === 1 || event.metaKey || event.ctrlKey) {
                                return;
                              }

                              setFormattedMenu([...formattedMenu]);
                            }}
                          >
                            <Lucide icon={menu.icon} className="side-menu__link__icon" />
                            <div className="side-menu__link__title">{menu.title}</div>

                            {menu.badge && (
                              <div
                                className={clsx("side-menu__link__badge", {
                                  "side-menu__link__badge--info": menu.badge.variant === "info",
                                  "side-menu__link__badge--danger": menu.badge.variant === "danger",
                                  "side-menu__link__badge--warning": menu.badge.variant === "warning",
                                  "side-menu__link__badge--success": menu.badge.variant === "success",
                                  "side-menu__link__badge--primary": menu.badge.variant === "primary",
                                })}
                              >
                                {menu.badge.count}
                              </div>
                            )}

                            {menu.subMenu && menu.subMenu.length > 0 && (
                              <Lucide icon="ChevronDown" className="side-menu__link__chevron" />
                            )}
                          </Link>
                        )}

                        {menu.subMenu && menu.subMenu.length > 0 && (
                          <ul
                            data-open={menu.activeDropdown}
                            className="side-menu__submenu transition-all duration-300 ease-in-out overflow-hidden data-[open=true]:opacity-100 data-[open=true]:max-h-96 data-[open=true]:translate-y-0 data-[open=false]:opacity-0 data-[open=false]:max-h-0 data-[open=false]:-translate-y-2 data-[open=false]:!p-0 data-[open=false]:!mb-0"
                          >
                            {menu.subMenu.map((subMenu, subMenuKey) => (
                              <li key={subMenuKey}>
                                {subMenu.redirect ? (
                                  <a
                                    href={subMenu.redirect}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="side-menu__link"
                                  >
                                    <Lucide icon={subMenu.icon} className="side-menu__link__icon" />
                                    <div className="side-menu__link__title">{subMenu.title}</div>
                                  </a>
                                ) : (
                                  <Link
                                    prefetch="intent"

                                    to={subMenu.pathname ?? "#"}
                                    className={clsx([
                                      "side-menu__link",
                                      { "side-menu__link--disabled": subMenu.disabled },
                                      { "side-menu__link--active": subMenu.active },
                                      { "side-menu__link--active-dropdown": subMenu.activeDropdown },
                                    ])}
                                    onClick={(event) => {
                                      if (subMenu.disabled) {
                                        event.preventDefault();
                                        return;
                                      }

                                      if (event.button === 1 || event.metaKey || event.ctrlKey) {
                                        return;
                                      }

                                      setFormattedMenu([...formattedMenu]);
                                    }}
                                  >
                                    <Lucide icon={subMenu.icon} className="side-menu__link__icon" />
                                    <div className="side-menu__link__title">{subMenu.title}</div>
                                  </Link>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
            <div style={{ top: bannerActive ? BANNER_H : 0 }} className="fixed h-[65px] xl:ml-[275px] mt-3.5 inset-x-0 top-0">
              <div
                className={clsx([
                  "top-bar absolute left-0 xl:left-3.5 right-0 h-full mx-5 group",
                  "before:content-[''] before:absolute before:top-0 before:inset-x-0 before:-mt-[15px] before:h-[20px] before:backdrop-blur",
                  topBarActive && "top-bar--active",
                ])}
              >
                <div
                  className="
                  container flex items-center w-full h-full transition-[padding,background-color,border-color] ease-in-out duration-300 box bg-transparent border-transparent shadow-none
                  group-[.top-bar--active]:box group-[.top-bar--active]:px-2
                  group-[.top-bar--active]:bg-transparent group-[.top-bar--active]:border-transparent group-[.top-bar--active]:bg-gradient-to-r group-[.top-bar--active]:from-theme-1 group-[.top-bar--active]:to-theme-2
                "
                >
                  <div className="flex items-center gap-1 xl:hidden">
                    <a
                      href=""
                      onClick={handleMenuToggle}
                      className="p-2 text-white rounded-full hover:bg-white/5"
                      title="Apri/chiudi menu"
                    >
                      <Lucide icon="PanelLeftClose" className="w-[18px] h-[18px]" />
                    </a>
                    <a
                      href=""
                      className="p-2 text-white rounded-full hover:bg-white/5"
                      onClick={(e) => {
                        e.preventDefault();
                        setQuickSearch(true);
                      }}
                    >
                      <Lucide icon="Search" className="w-[18px] h-[18px]" />
                    </a>
                  </div>
                  <div className="flex-1 block order-0 float-start min-w-0 px-2">
                    <SmartBreadcrumb light small startPage={startPage?.pathname} />
                  </div>
                  <div
                    className="relative justify-center flex-1 hidden xl:flex flex-shrink-0"
                    onClick={() => setQuickSearch(true)}
                  >
                    <div className="bg-white/[0.12] border-transparent border w-[350px] flex items-center py-2 px-3.5 rounded-[0.5rem] text-white/60 cursor-pointer hover:bg-white/[0.15] transition-colors duration-300 hover:duration-100">
                      <Lucide icon="Search" className="w-[18px] h-[18px]" />
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
                      <Lucide icon="LayoutGrid" className="w-[18px] h-[18px]" />
                    </a>
                    <a
                      href=""
                      className="p-2 text-white rounded-full hover:bg-white/5"
                    >
                      <Lucide icon="Moon" className="w-[18px] h-[18px]" />
                    </a> */}
                      <a
                        href=""
                        className="p-2 text-white rounded-full hover:bg-white/5"
                        onClick={(e) => {
                          e.preventDefault();
                          if (isFullScreen) {
                            exitFullscreen();
                          } else {
                            requestFullscreen();
                          }
                        }}
                      >
                        <Lucide icon={isFullScreen ? "Minimize" : "Expand"} className="w-[18px] h-[18px]" />
                      </a>
                      {user?.tipo === TIPO_UTENTI.SUPERADMIN && (
                        <a
                          href=""
                          className={`relative p-2 text-white rounded-full hover:bg-white/5 ${avviso.data?.attivo ? "text-amber-300" : ""}`}
                          onClick={(e) => {
                            e.preventDefault();
                            setMaintenanceModal(true);
                          }}
                          title="Avviso manutenzione"
                        >
                          <Lucide icon="Wrench" className="w-[18px] h-[18px]" />
                          {avviso.data?.attivo && (
                            <div className="absolute top-1 right-1 w-3 h-3 flex items-center justify-center">
                              <span className="block w-2 h-2 bg-amber-400 border-2 border-white rounded-full shadow-lg"></span>
                            </div>
                          )}
                        </a>
                      )}
                      <a
                        href=""
                        className="relative p-2 text-white rounded-full hover:bg-white/5"
                        onClick={(e) => {
                          e.preventDefault();
                          setNotificationsPanel(true);
                        }}
                      >
                        <Lucide icon="Bell" className="w-[18px] h-[18px]" />
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
                      </a>
                    </div>
                    <Popover className="ml-5">
                      {({ close }) => (
                        <>
                          <Popover.Button className="overflow-hidden rounded-full w-[36px] h-[36px] border-[3px] border-white/[0.15] image-fit">
                            <img
                              alt=""
                              src={user?.meta?.photo ? `data:image/png;base64,${user?.meta?.photo}` : userIcon}
                            />
                          </Popover.Button>
                          <Popover.Panel className="w-56 mt-1 right-0">
                            <div className="py-1">
                              {user?.outsider == false && (
                                <Fragment>
                                  <button
                                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    onClick={() => {
                                      setSwitchAccount(true);
                                      close();
                                    }}
                                  >
                                    <Lucide icon="ToggleLeft" className="w-4 h-4 mr-2" />
                                    Cambia Account
                                  </button><button
                                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    onClick={() => {
                                      startTransition(() => { navigate("profilo-utente?page=connected-services"); });
                                      close();
                                    }}
                                  >
                                    <Lucide icon="Settings" className="w-4 h-4 mr-2" />
                                    Servizi Connessi
                                  </button><button
                                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    onClick={() => {
                                      startTransition(() => { navigate("profilo-utente?page=email-profilo-utente"); });
                                      close();
                                    }}
                                  >
                                    <Lucide icon="Inbox" className="w-4 h-4 mr-2" />
                                    Impostazioni Email
                                  </button><button
                                    className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                    onClick={() => {
                                      startTransition(() => { navigate("profilo-utente?page=security"); });
                                      close();
                                    }}
                                  >
                                    <Lucide icon="Lock" className="w-4 h-4 mr-2" />
                                    Reimposta Password
                                  </button>
                                </Fragment>
                              )}
                              <div className="border-t border-slate-200 my-1" />
                              <button
                                className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                onClick={() => {
                                  startTransition(() => { navigate("profilo-utente"); });
                                  close();
                                }}
                              >
                                <Lucide icon="Users" className="w-4 h-4 mr-2" />
                                Profilo Utente
                              </button>
                              <button
                                className="flex items-center w-full px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
                                onClick={() => {
                                  startTransition(() => { navigate("hub"); });
                                  close();
                                }}
                              >
                                <Lucide icon="SquareArrowRightExit" className="w-4 h-4 mr-2" />
                                Torna al Hub
                              </button>
                              <button
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                onClick={() => {
                                  mutationLogout.mutate();
                                  close();
                                }}
                              >
                                <Lucide icon="Power" className="w-4 h-4 mr-2" />
                                Esci
                              </button>
                            </div>
                          </Popover.Panel>
                        </>
                      )}
                    </Popover>
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
              "xl:ml-[275px] h-full duration-100 xl:pl-3.5 pt-[54px] pb-16 relative z-10 group mode",
              { "mode--light": !topBarActive },
            ])}
          >
            <div className="px-1 sm:px-5 mt-16">
              <div className="mx-1 sm:mx-5">
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </ContextMenu>
    </SocketProvider>
  );
}

export default withSessionCheck(Layout);
