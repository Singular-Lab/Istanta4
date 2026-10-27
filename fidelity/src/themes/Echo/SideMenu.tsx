import Button from "@/components/Base/Button";
import Lucide from "@/components/Base/Lucide";
import clsx from "clsx";
import { MouseEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormattedMenu, gruppiAttivi, toggleGruppo } from "./side-menu";

interface SideMenuProps {
  menu: Array<FormattedMenu | string>;
  /** Menu ridotto alle sole icone: i titoli diventano suggerimenti. */
  compresso?: boolean;
  errore?: boolean;
  onRiprova?: () => void;
  /** Chiamata dopo un click su una voce che porta a una pagina (chiude il menu su mobile). */
  onNavigate?: () => void;
}

const classiBadge = (variant?: string) =>
  clsx("side-menu__link__badge", variant && `side-menu__link__badge--${variant}`);

/**
 * Voci del menu laterale. Un gruppo con sottovoci si apre e si chiude col click;
 * il gruppo che contiene la pagina corrente si apre da solo a ogni cambio pagina.
 */
function SideMenu({ menu, compresso = false, errore = false, onRiprova, onNavigate }: SideMenuProps) {
  const [aperti, setAperti] = useState<Set<string>>(() => new Set(gruppiAttivi(menu)));

  // A ogni cambio di pagina si aggiungono i gruppi della pagina corrente,
  // lasciando aperti quelli che l'operatore ha aperto
  useEffect(() => {
    const attivi = gruppiAttivi(menu);
    if (attivi.length === 0) {
      return;
    }
    setAperti((precedenti) => {
      if (attivi.every((chiave) => precedenti.has(chiave))) {
        return precedenti;
      }
      return new Set([...precedenti, ...attivi]);
    });
  }, [menu]);

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
        const idSottomenu = `side-menu-gruppo-${chiave.replace(/\./g, "-")}`;
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
      {vociDi(menu, "", 0)}
    </ul>
  );
}

export default SideMenu;
