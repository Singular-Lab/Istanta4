import logoI2 from '@/assets/images/logo-i2.svg';
import Lucide from '@/components/Base/Lucide';
import Sezione from '@/components/Base/Sezione';
import type { ElementoMenu, Menu } from '@/stores/sideMenuSlice_istanta';
import SideMenu from '@/themes/Echo/SideMenu';
import { nestedMenu } from '@/themes/Echo/side-menu';
import { useMemo } from 'react';
import { eSezioneMenu } from '../../../../lib/accessi/sezioni';
import type { MenuElement, MenuItem } from '../../../../lib/types';
import type { Anteprima } from './modelloMenu';

/** Permessi del ruolo per l'anteprima: il Superadmin vede tutto; senza permessi l'anteprima non filtra. */
export type StatoPermessi = 'superadmin' | 'caricamento' | 'pronti' | 'errore';

const perMenuLaterale = (voce: MenuItem): Menu => {
  const sottovoci = (voce.subMenu ?? []).map(perMenuLaterale);
  return {
    icon: voce.icon || 'Circle',
    title: voce.title,
    pathname: voce.pathname,
    disabled: voce.disabled,
    start_page: voce.start_page,
    ...(sottovoci.length > 0 ? { subMenu: sottovoci } : {}),
  };
};

const elementiLaterali = (elementi: readonly MenuElement[]): ElementoMenu[] =>
  elementi.map((elemento) => (typeof elemento === 'string' || eSezioneMenu(elemento) ? elemento : perMenuLaterale(elemento)));

const percorsiDi = (elementi: readonly ElementoMenu[]): string[] =>
  elementi.flatMap((elemento) =>
    typeof elemento === 'string' || eSezioneMenu(elemento)
      ? []
      : [...(elemento.pathname ? [elemento.pathname] : []), ...percorsiDi(elemento.subMenu ?? [])]
  );

interface AnteprimaMenuProps {
  anteprima: Anteprima;
  /** Il tipo di utente (e il sotto-ruolo) di cui si modifica il menu. */
  nomeRuolo: string;
  statoPermessi: StatoPermessi;
  /** La pagina scelta nell'anteprima (l'ultima aggiunta, o quella su cui si è fatto clic). */
  selezionata: string | null;
  onSeleziona: (percorso: string) => void;
}

/**
 * Colonna "Anteprima": il menu laterale come lo vedrà il ruolo, con le modifiche non salvate.
 * Le voci si possono scegliere per vedere la voce attiva, ma non portano alle pagine.
 */
export default function AnteprimaMenu({ anteprima, nomeRuolo, statoPermessi, selezionata, onSeleziona }: AnteprimaMenuProps) {
  const elementi = useMemo(() => elementiLaterali(anteprima.elementi), [anteprima.elementi]);
  const presenti = useMemo(() => new Set(percorsiDi(elementi)), [elementi]);
  const attiva = selezionata && presenti.has(selezionata) ? selezionata : anteprima.paginaIniziale;
  const menu = useMemo(() => nestedMenu(elementi, { pathname: attiva ?? '', search: '' }), [elementi, attiva]);
  const nascoste = anteprima.nascoste;

  return (
    <Sezione compatta titolo="Anteprima" descrizione={`Come lo vede ${nomeRuolo}`} className="min-w-0 xl:sticky xl:top-24">
      <ul className="mb-3 flex flex-col gap-1 text-xs text-slate-500">
        <li className="flex items-center gap-1.5">
          <Lucide icon="Star" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
          <span>Pagina iniziale: {anteprima.titoloIniziale ?? 'nessuna, il menu è vuoto'}</span>
        </li>
        {nascoste > 0 && (
          <li className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <Lucide icon="Lock" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
            <span>
              {nascoste === 1
                ? '1 voce nascosta: il ruolo non può aprirla'
                : `${nascoste} voci nascoste: il ruolo non può aprirle`}
            </span>
          </li>
        )}
        {statoPermessi === 'caricamento' && (
          <li className="flex items-center gap-1.5">
            <Lucide icon="LoaderCircle" aria-hidden="true" className="h-3.5 w-3.5 flex-none animate-spin" />
            <span>Caricamento dei permessi del ruolo…</span>
          </li>
        )}
        {statoPermessi === 'errore' && (
          <li className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
            <Lucide icon="TriangleAlert" aria-hidden="true" className="h-3.5 w-3.5 flex-none" />
            <span>Permessi del ruolo non caricati: l&apos;anteprima mostra tutte le voci</span>
          </li>
        )}
      </ul>

      {/* Stessa cornice del menu laterale di Echo: gli stili delle voci (echo.css) chiedono un antenato .echo */}
      <div className="echo mx-auto w-[277px] max-w-full overflow-hidden rounded-card border border-slate-200 bg-white">
        <div className="flex h-[520px] w-[275px] max-w-full flex-col" aria-label={`Menu di ${nomeRuolo}`} role="group">
          <div className="flex h-[65px] flex-none items-center border-b border-slate-200 px-[22px]">
            <img className="h-8 w-8 flex-none rounded-control" src={logoI2} alt="" />
            <div className="ml-2.5 min-w-0 whitespace-nowrap leading-tight">
              <div className="text-sm font-medium text-primary">Istanta 2</div>
              <div className="text-2xs text-slate-500">Web Platform</div>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
            {elementi.length > 0 ? (
              <SideMenu menu={menu} onSeleziona={onSeleziona} />
            ) : (
              <p className="mt-6 px-2 text-center text-xs text-slate-500">
                Nessuna voce: il ruolo vedrebbe un menu vuoto.
              </p>
            )}
          </div>
        </div>
      </div>
    </Sezione>
  );
}
