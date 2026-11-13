import { FormInput } from '@/components/Base/Form';
import Lucide from '@/components/Base/Lucide';
import Sezione from '@/components/Base/Sezione';
import StatusBadge from '@/components/Base/StatusBadge';
import { twMerge } from '@/utils/twMerge';
import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { normalizzaPercorso } from '../../../../lib/accessi/pagine';
import { SEZIONI, titoloSezione, type SezionePagina } from '../../../../lib/accessi/sezioni';
import { PAGINE_CATALOGO, TRASCINA_PAGINA, type PaginaCatalogo, type PaginaTrascinata } from './modelloMenu';

interface PaginaDelCatalogoProps {
  pagina: PaginaCatalogo;
  /** Aree del menu in cui la pagina c'è già. */
  aree: readonly SezionePagina[];
  senzaPermesso: boolean;
  onAggiungi: (percorso: string) => void;
}

/**
 * Una pagina del catalogo: si trascina in qualunque area della struttura, anche se è già nel menu,
 * o si aggiunge col + in fondo alla sua area predefinita, se lì non c'è ancora.
 */
function PaginaDelCatalogo({ pagina, aree, senzaPermesso, onAggiungi }: PaginaDelCatalogoProps) {
  const [{ trascinata }, trascina] = useDrag<PaginaTrascinata, unknown, { trascinata: boolean }>(
    () => ({
      type: TRASCINA_PAGINA,
      item: { percorso: pagina.percorso, sezione: pagina.sezione },
      collect: (monitor) => ({ trascinata: monitor.isDragging() }),
    }),
    [pagina.percorso, pagina.sezione]
  );
  // "Usata": già nella sua area predefinita, dove la porterebbe il +
  const usata = aree.includes(pagina.sezione);
  const doveSta = aree.map(titoloSezione).join(' · ');

  return (
    <li
      ref={(nodo) => {
        trascina(nodo);
      }}
      title={pagina.percorso}
      className={twMerge(
        'group flex min-h-[34px] items-center gap-2.5 rounded-control px-2 py-1.5 text-sm text-slate-900 dark:text-slate-200',
        usata ? 'cursor-grab text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-darkmode-400' : 'cursor-grab hover:bg-slate-100 dark:hover:bg-darkmode-400',
        trascinata && 'opacity-40'
      )}
    >
      <Lucide
        icon={pagina.icona}
        aria-hidden="true"
        className={twMerge('h-4 w-4 flex-none text-primary', usata ? 'opacity-35' : 'opacity-70')}
      />
      <span className="min-w-0 flex-1 truncate">{pagina.titolo}</span>
      {aree.length > 0 ? (
        <span
          title={`Già nel menu: ${doveSta}`}
          className="max-w-[9rem] flex-none truncate rounded-full bg-slate-100 px-2 py-px text-3xs font-semibold text-slate-500 dark:bg-darkmode-400 dark:text-slate-300"
        >
          <span className="sr-only">Nel menu: </span>
          {doveSta}
        </span>
      ) : (
        senzaPermesso && (
          <span title="Il ruolo non ha il permesso di aprirla" className="inline-flex flex-none">
            <StatusBadge tono="warning" icon="Lock" etichetta="Senza permesso" />
          </span>
        )
      )}
      {!usata && (
        <button
          type="button"
          aria-label={`Aggiungi ${pagina.titolo} al menu`}
          title={`Aggiungi in fondo a ${titoloSezione(pagina.sezione)}`}
          onClick={() => onAggiungi(pagina.percorso)}
          className="grid h-[26px] w-[26px] flex-none place-items-center rounded-md text-primary opacity-0 transition-opacity hover:bg-primary/10 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Lucide icon="Plus" aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

interface CatalogoPagineProps {
  /** Per ogni pagina nel menu (percorso normalizzato), le aree in cui compare. */
  areeUsate: ReadonlyMap<string, readonly SezionePagina[]>;
  puoAprire: (percorso: string) => boolean;
  onAggiungi: (percorso: string) => void;
}

/** Colonna "Pagine": le pagine che si possono mettere nel menu, per area predefinita, con la ricerca. */
export default function CatalogoPagine({ areeUsate, puoAprire, onAggiungi }: CatalogoPagineProps) {
  const [cerca, setCerca] = useState('');
  const testo = cerca.trim().toLowerCase();
  const aree = SEZIONI.map((sezione) => ({
    ...sezione,
    pagine: PAGINE_CATALOGO.filter(
      (p) =>
        p.sezione === sezione.sezione &&
        (!testo || p.titolo.toLowerCase().includes(testo) || p.percorso.toLowerCase().includes(testo))
    ),
  })).filter((area) => area.pagine.length > 0);

  return (
    <Sezione compatta titolo="Pagine" descrizione="Trascinale in qualunque area o premi +" className="min-w-0">
      <div className="relative mb-2">
        <Lucide
          icon="Search"
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        />
        <FormInput
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca una pagina"
          aria-label="Cerca una pagina"
          className="pl-8"
        />
      </div>
      <div className="-mx-2 max-h-[560px] overflow-y-auto px-0.5 pb-1">
        {aree.length === 0 ? (
          <p className="px-2 py-2 text-xs text-slate-500">Nessuna pagina con «{cerca.trim()}».</p>
        ) : (
          aree.map((area) => (
            <div key={area.sezione}>
              <h3 className="flex items-center gap-2 px-2 pb-1.5 pt-3 text-2xs font-semibold uppercase tracking-wider text-slate-500">
                <Lucide icon={area.icona} aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
                {area.titolo}
              </h3>
              <ul aria-label={`Pagine di ${area.titolo}`}>
                {area.pagine.map((pagina) => (
                  <PaginaDelCatalogo
                    key={pagina.percorso}
                    pagina={pagina}
                    aree={areeUsate.get(normalizzaPercorso(pagina.percorso)) ?? []}
                    senzaPermesso={!puoAprire(pagina.percorso)}
                    onAggiungi={onAggiungi}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </Sezione>
  );
}
