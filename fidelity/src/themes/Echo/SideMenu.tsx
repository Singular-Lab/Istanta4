import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { MouseEvent, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import SelettoreArea from "./SelettoreArea";
import {
  areaDellaPagina,
  areaDelPercorso,
  areeDellaPagina,
  areaIniziale,
  areeDelMenu,
  ElementoMenuFormattato,
  FormattedMenu,
  gruppiAttiviDelleAree,
  percorsoAttivo,
  prefissoArea,
  toggleGruppo,
} from "./side-menu";

interface SideMenuProps {
  menu: ElementoMenuFormattato[];
  /** Menu ridotto alle sole icone: i titoli diventano suggerimenti. */
  compresso?: boolean;
  errore?: boolean;
  onRiprova?: () => void;
  /** Chiamata dopo un click su una voce che porta a una pagina (chiude il menu su mobile). */
  onNavigate?: () => void;
  /**
   * Se c'è, le voci non portano alle pagine: sono pulsanti che passano il loro indirizzo a questa
   * funzione (anteprima dell'editor del menu, che non deve navigare).
   */
  onSeleziona?: (pathname: string) => void;
  /**
   * L'indirizzo della pagina aperta: quando la pagina non è una voce del menu il menu mostra l'area che
   * il catalogo delle pagine le assegna (spec interfaccia-operatore, "Area del menu per le pagine fuori
   * dal menu").
   */
  percorso?: string;
}

const classiBadge = (variant?: string) =>
  clsx("side-menu__link__badge", variant && `side-menu__link__badge--${variant}`);

/**
 * Menu laterale ad area attiva: mostra le voci di una sola area (Produzione, Visualizzazione...),
 * con sopra il selettore dell'area quando le aree sono più di una. L'area mostrata è quella della
 * pagina corrente; scegliere un'area dal selettore cambia solo le voci mostrate, e il menu torna
 * a seguire la pagina quando se ne apre un'altra. Se la pagina corrente non è nel menu vale l'area che
 * il catalogo delle pagine le assegna (la consultazione di una promozione è in Visualizzazione); senza,
 * resta l'ultima area mostrata, e all'inizio quella della pagina iniziale, o la prima.
 *
 * Dentro l'area un gruppo con sottovoci si apre e si chiude col click; il gruppo che contiene la
 * pagina corrente si apre da solo a ogni cambio pagina.
 */
function SideMenu({
  menu,
  compresso = false,
  errore = false,
  onRiprova,
  onNavigate,
  onSeleziona,
  percorso,
}: SideMenuProps) {
  // Due menu nella stessa pagina (layout e anteprima dell'editor) non devono ripetere gli id
  const idMenu = `side-menu-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const aree = useMemo(() => areeDelMenu(menu), [menu]);
  const [aperti, setAperti] = useState<Set<string>>(() => new Set(gruppiAttiviDelleAree(aree)));

  // A ogni cambio di pagina si aggiungono i gruppi della pagina corrente,
  // lasciando aperti quelli che l'operatore ha aperto
  useEffect(() => {
    const attivi = gruppiAttiviDelleAree(aree);
    if (attivi.length === 0) {
      return;
    }
    setAperti((precedenti) => {
      if (attivi.every((chiave) => precedenti.has(chiave))) {
        return precedenti;
      }
      return new Set([...precedenti, ...attivi]);
    });
  }, [aree]);

  // L'area segue la pagina corrente solo quando la pagina (o l'elenco delle aree che la contengono)
  // cambia: un'area scelta dal selettore resta finché non si apre un'altra pagina. Una pagina che sta
  // in più aree lascia il menu sull'area mostrata, se la contiene; altrimenti va nella prima che la
  // contiene. Una pagina che non è nel menu prende l'area del catalogo
  const conPagina = areeDellaPagina(aree);
  const pagina =
    conPagina.length > 0
      ? `${conPagina.map((a) => a.chiave).join(",")}|${percorsoAttivo(conPagina[0].elementi) ?? ""}`
      : `|${percorso ?? ""}`;
  const [paginaVista, setPaginaVista] = useState(pagina);
  const [areaScelta, setAreaScelta] = useState(() => (areaDellaPagina(aree) ?? areaDelPercorso(aree, percorso))?.chiave);
  const mostrata = aree.find((a) => a.chiave === areaScelta) ?? areaIniziale(aree);
  if (pagina !== paginaVista) {
    setPaginaVista(pagina);
    const areaPagina = areaDellaPagina(aree, mostrata?.chiave) ?? areaDelPercorso(aree, percorso);
    if (areaPagina) {
      setAreaScelta(areaPagina.chiave);
    }
  }
  const area = mostrata;

  const vociDi = (voci: Array<FormattedMenu | string>, prefisso: string, livello: number) =>
    voci.map((voce, indice) => {
      const chiave = prefisso + indice;

      if (typeof voce === "string") {
        return (
          <li className="side-menu__divider" key={chiave}>
            <span className="side-menu__divider__title">{voce}</span>
          </li>
        );
      }

      const suggerimento = compresso && livello === 0 ? voce.title : undefined;
      const contenuto = (
        <>
          <Lucide icon={voce.icon} className="side-menu__link__icon" />
          <span className="side-menu__link__title">{voce.title}</span>
          {voce.badge && (
            <span className={classiBadge(voce.badge.variant)}>{voce.badge.count}</span>
          )}
        </>
      );

      if (voce.subMenu && voce.subMenu.length > 0) {
        const aperto = aperti.has(chiave);
        const idSottomenu = `${idMenu}-gruppo-${chiave.replace(/[^A-Za-z0-9_-]/g, "-")}`;
        return (
          <li key={chiave}>
            <button
              type="button"
              title={suggerimento}
              aria-expanded={aperto}
              aria-controls={idSottomenu}
              disabled={voce.disabled}
              className={clsx([
                "side-menu__link",
                { "side-menu__link--disabled": voce.disabled },
                { "side-menu__link--parent-active": voce.active && !aperto },
              ])}
              onClick={() => setAperti((precedenti) => toggleGruppo(precedenti, chiave))}
            >
              {contenuto}
              <Lucide
                icon="ChevronDown"
                className={clsx("side-menu__link__chevron", { "rotate-180": aperto })}
              />
            </button>
            <div data-open={aperto} className="side-menu__submenu">
              <ul id={idSottomenu} className="side-menu__submenu__list">
                {vociDi(voce.subMenu, `${chiave}.`, livello + 1)}
              </ul>
            </div>
          </li>
        );
      }

      const classi = clsx([
        "side-menu__link",
        { "side-menu__link--disabled": voce.disabled },
        { "side-menu__link--active": voce.active && !voce.disabled },
      ]);

      if (voce.redirect) {
        return (
          <li key={chiave}>
            <a
              href={voce.redirect}
              target="_blank"
              rel="noopener noreferrer"
              title={suggerimento}
              className={classi}
            >
              {contenuto}
              <Lucide icon="ExternalLink" className="side-menu__link__external" />
            </a>
          </li>
        );
      }

      if (onSeleziona) {
        return (
          <li key={chiave}>
            <button
              type="button"
              title={suggerimento}
              aria-current={voce.active && !voce.disabled ? "page" : undefined}
              aria-disabled={voce.disabled || undefined}
              tabIndex={voce.disabled ? -1 : undefined}
              className={classi}
              onClick={() => {
                if (!voce.disabled && voce.pathname) {
                  onSeleziona(voce.pathname);
                }
              }}
            >
              {contenuto}
            </button>
          </li>
        );
      }

      return (
        <li key={chiave}>
          <Link
            to={voce.pathname ?? "#"}
            prefetch="intent"
            title={suggerimento}
            aria-current={voce.active && !voce.disabled ? "page" : undefined}
            aria-disabled={voce.disabled || undefined}
            tabIndex={voce.disabled ? -1 : undefined}
            className={classi}
            onClick={(event: MouseEvent) => {
              if (voce.disabled || !voce.pathname) {
                event.preventDefault();
                return;
              }
              if (event.button === 1 || event.metaKey || event.ctrlKey) {
                return;
              }
              onNavigate?.();
            }}
          >
            {contenuto}
          </Link>
        </li>
      );
    });

  return (
    <ul className="scrollable">
      {/* Dentro la <ul>: SimpleBar sposta i figli del contenitore e React non potrebbe inserirvi nodi */}
      {errore && (
        <li role="alert" className="flex flex-col items-center gap-2 mt-5 text-sm text-center text-slate-500">
          Impossibile caricare il menu
          <Button variant="outline-primary" size="sm" onClick={onRiprova}>
            Riprova
          </Button>
        </li>
      )}
      {area && aree.length > 1 && (
        <li className="side-menu__area">
          <SelettoreArea aree={aree} corrente={area.chiave} compresso={compresso} onScegli={setAreaScelta} />
        </li>
      )}
      {area && vociDi(area.elementi, prefissoArea(area.chiave), 0)}
    </ul>
  );
}

export default SideMenu;
