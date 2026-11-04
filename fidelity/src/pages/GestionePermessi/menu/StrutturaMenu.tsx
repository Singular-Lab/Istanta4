import Alert from '@/components/Base/Alert';
import Lucide from '@/components/Base/Lucide';
import Sezione from '@/components/Base/Sezione';
import { twMerge } from '@/utils/twMerge';
import { useRef, useState, type KeyboardEvent } from 'react';
import { useDrag, useDrop, type DropTargetMonitor } from 'react-dnd';
import { descrizioneSezione, type SezionePagina } from '../../../../lib/accessi/sezioni';
import {
  contaVoci,
  titoloDaSalvare,
  TRASCINA_PAGINA,
  TRASCINA_VOCE,
  type Destinazione,
  type GruppoMenu,
  type ModelloMenu,
  type PaginaTrascinata,
  type VoceMenu,
  type VoceScartata,
  type VoceTrascinata,
} from './modelloMenu';

type Trascinato = PaginaTrascinata | VoceTrascinata;

/** Azioni della struttura: le esegue l'editor, che tiene il modello. */
export interface AzioniStruttura {
  onRilascia: (tipo: typeof TRASCINA_PAGINA | typeof TRASCINA_VOCE, oggetto: Trascinato, destinazione: Destinazione) => void;
  onTastiera: (voceId: string, direzione: -1 | 1) => void;
  onTogli: (voceId: string, daTastiera: boolean) => void;
  onTitoloVoce: (voceId: string, titolo: string) => void;
  onAttiva: (voceId: string) => void;
  onIniziale: (voceId: string) => void;
  onAggiungiGruppo: (sezione: SezionePagina) => void;
  onTitoloGruppo: (gruppoId: string, titolo: string) => void;
  onTogliGruppo: (gruppoId: string) => void;
}

/** Una voce dell'altra area non si può lasciare qui: la sua area dipende dalla pagina. */
const eVietato = (monitor: DropTargetMonitor<Trascinato>, sezione: SezionePagina) =>
  monitor.getItemType() === TRASCINA_VOCE && monitor.getItem()?.sezione !== sezione;

/** Nella metà bassa della voce il rilascio va dopo, in quella alta prima. */
const sottoMeta = (monitor: DropTargetMonitor<Trascinato>, nodo: HTMLElement | null) => {
  const punto = monitor.getClientOffset();
  const riquadro = nodo?.getBoundingClientRect();
  return !!punto && !!riquadro && punto.y > riquadro.top + riquadro.height / 2;
};

/** Linea d'inserimento sopra o sotto la voce: navy, rossa se il rilascio non è ammesso. */
const Indicatore = ({ dopo, vietato }: { dopo: boolean; vietato: boolean }) => (
  <span
    aria-hidden="true"
    className={twMerge(
      'pointer-events-none absolute inset-x-1.5 h-0.5 rounded-full',
      dopo ? '-bottom-[3px]' : '-top-[3px]',
      vietato ? 'bg-danger' : 'bg-primary'
    )}
  />
);

interface RigaVoceProps {
  voce: VoceMenu;
  gruppoId: string;
  indice: number;
  sezione: SezionePagina;
  senzaPermesso: boolean;
  azioni: AzioniStruttura;
}

function RigaVoce({ voce, gruppoId, indice, sezione, senzaPermesso, azioni }: RigaVoceProps) {
  const riga = useRef<HTMLDivElement | null>(null);
  const [dopo, setDopo] = useState(false);

  const [{ trascinata }, trascina, anteprima] = useDrag<VoceTrascinata, unknown, { trascinata: boolean }>(
    () => ({
      type: TRASCINA_VOCE,
      item: { voceId: voce.id, sezione },
      collect: (monitor) => ({ trascinata: monitor.isDragging() }),
    }),
    [voce.id, sezione]
  );

  const [{ sopra, vietato }, rilascia] = useDrop<Trascinato, unknown, { sopra: boolean; vietato: boolean }>(
    () => ({
      accept: [TRASCINA_PAGINA, TRASCINA_VOCE],
      hover: (_oggetto, monitor) => setDopo(sottoMeta(monitor, riga.current)),
      drop: (oggetto, monitor) => {
        const tipo = monitor.getItemType() === TRASCINA_VOCE ? TRASCINA_VOCE : TRASCINA_PAGINA;
        azioni.onRilascia(tipo, oggetto, { gruppoId, indice: indice + (sottoMeta(monitor, riga.current) ? 1 : 0) });
      },
      collect: (monitor) => {
        const qui = monitor.isOver({ shallow: true });
        return { sopra: qui, vietato: qui && eVietato(monitor, sezione) };
      },
    }),
    [gruppoId, indice, sezione, azioni]
  );

  // Una voce senza titolo si salva con quello proposto dal catalogo
  const titolo = titoloDaSalvare(voce);

  const gestisciTasto = (evento: KeyboardEvent<HTMLButtonElement>) => {
    if (evento.key === 'ArrowUp' || evento.key === 'ArrowDown') {
      evento.preventDefault();
      azioni.onTastiera(voce.id, evento.key === 'ArrowUp' ? -1 : 1);
    } else if (evento.key === 'Delete' || evento.key === 'Backspace') {
      evento.preventDefault();
      azioni.onTogli(voce.id, true);
    }
  };

  return (
    <div
      ref={(nodo) => {
        riga.current = nodo;
        anteprima(rilascia(nodo));
      }}
      data-voce={voce.id}
      className={twMerge(
        'relative flex min-h-[42px] items-center gap-1.5 rounded-control border border-slate-200 bg-white py-1 pl-0.5 pr-1.5 transition-[box-shadow,opacity] hover:shadow-card dark:border-darkmode-400 dark:bg-darkmode-600',
        voce.disabilitato && 'bg-slate-50 dark:bg-darkmode-700',
        trascinata && 'opacity-40',
        vietato && 'ring-2 ring-red-300'
      )}
    >
      {sopra && <Indicatore dopo={dopo} vietato={vietato} />}
      <button
        type="button"
        ref={(nodo) => {
          trascina(nodo);
        }}
        data-presa={voce.id}
        aria-label={`Sposta ${titolo}: frecce su e giù, Canc per togliere`}
        title="Trascina per spostare"
        onKeyDown={gestisciTasto}
        className="grid h-[30px] w-6 flex-none cursor-grab place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-darkmode-400 dark:hover:text-slate-200"
      >
        <Lucide icon="GripVertical" aria-hidden="true" className="h-4 w-4" />
      </button>
      <Lucide icon={voce.icona || 'Circle'} aria-hidden="true" className="h-4 w-4 flex-none text-primary opacity-80 dark:text-slate-300" />
      <input
        type="text"
        value={voce.titolo}
        onChange={(e) => azioni.onTitoloVoce(voce.id, e.target.value)}
        placeholder={titolo}
        aria-label={`Titolo della voce ${voce.pathname}`}
        className={twMerge(
          'min-w-[60px] flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-medium text-slate-900 shadow-none hover:border-slate-200 focus:border-slate-400 focus:outline-none focus:ring-0 dark:text-slate-200 dark:hover:border-darkmode-400',
          voce.disabilitato && 'text-slate-400 dark:text-slate-500'
        )}
      />
      <code className="hidden max-w-[11rem] truncate font-mono text-2xs text-slate-500 sm:block" title={voce.pathname}>
        {voce.pathname}
      </code>
      {senzaPermesso && (
        <span
          title="Il ruolo non può aprirla: non comparirà nel suo menu"
          className="grid h-5 w-5 flex-none place-items-center rounded-full bg-amber-100 text-amber-800"
        >
          <Lucide icon="Lock" aria-hidden="true" className="h-3 w-3" />
          <span className="sr-only">Senza permesso</span>
        </span>
      )}
      <button
        type="button"
        aria-pressed={voce.iniziale}
        aria-label={`Pagina iniziale: ${titolo}`}
        title={voce.iniziale ? 'Pagina iniziale' : 'Rendi pagina iniziale'}
        onClick={() => azioni.onIniziale(voce.id)}
        className={twMerge(
          'grid h-7 w-7 flex-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-darkmode-400',
          voce.iniziale && 'text-amber-600 hover:text-amber-600'
        )}
      >
        <Lucide icon="Star" aria-hidden="true" className={twMerge('h-4 w-4', voce.iniziale && 'fill-amber-300')} />
      </button>
      <button
        type="button"
        aria-label={voce.disabilitato ? `Riattiva ${titolo}` : `Disattiva ${titolo}`}
        title={voce.disabilitato ? 'Riattiva la voce' : 'Disattiva la voce'}
        onClick={() => azioni.onAttiva(voce.id)}
        className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-darkmode-400"
      >
        <Lucide icon={voce.disabilitato ? 'EyeOff' : 'Eye'} aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={`Togli ${titolo} dal menu`}
        title="Togli dal menu"
        onClick={() => azioni.onTogli(voce.id, false)}
        className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-danger dark:hover:bg-darkmode-400"
      >
        <Lucide icon="X" aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Gruppo vuoto: riquadro tratteggiato in cui lasciare una pagina della sua area. */
function GruppoVuoto({ gruppoId, sezione, titoloArea, azioni }: { gruppoId: string; sezione: SezionePagina; titoloArea: string; azioni: AzioniStruttura }) {
  const [{ sopra, vietato }, rilascia] = useDrop<Trascinato, unknown, { sopra: boolean; vietato: boolean }>(
    () => ({
      accept: [TRASCINA_PAGINA, TRASCINA_VOCE],
      drop: (oggetto, monitor) => {
        const tipo = monitor.getItemType() === TRASCINA_VOCE ? TRASCINA_VOCE : TRASCINA_PAGINA;
        azioni.onRilascia(tipo, oggetto, { gruppoId, indice: 0 });
      },
      collect: (monitor) => {
        const qui = monitor.isOver({ shallow: true });
        return { sopra: qui, vietato: qui && eVietato(monitor, sezione) };
      },
    }),
    [gruppoId, sezione, azioni]
  );

  return (
    <div
      ref={(nodo) => {
        rilascia(nodo);
      }}
      className={twMerge(
        'rounded-control border-2 border-dashed border-slate-300 p-2.5 text-center text-xs text-slate-500 dark:border-darkmode-400',
        sopra && !vietato && 'border-primary bg-primary/5 text-primary',
        vietato && 'border-danger text-danger'
      )}
    >
      Trascina qui una pagina di {titoloArea}
    </div>
  );
}

interface GruppoProps {
  gruppo: GruppoMenu;
  sezione: SezionePagina;
  titoloArea: string;
  ereditato?: string;
  senzaPermesso: (percorso: string) => boolean;
  azioni: AzioniStruttura;
}

function Gruppo({ gruppo, sezione, titoloArea, ereditato, senzaPermesso, azioni }: GruppoProps) {
  const segnaposto = ereditato ? `Senza titolo: segue ${ereditato}` : 'Senza titolo';
  return (
    <div>
      <div className="flex items-center gap-1 px-0.5 pb-1 pt-0.5">
        <input
          type="text"
          value={gruppo.titolo}
          onChange={(e) => azioni.onTitoloGruppo(gruppo.id, e.target.value)}
          placeholder={segnaposto}
          title={
            ereditato
              ? `Senza un titolo proprio, nel menu queste voci stanno sotto «${ereditato}», il gruppo con titolo che le precede`
              : undefined
          }
          aria-label="Titolo del gruppo"
          data-titolo-gruppo={gruppo.id}
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-slate-500 shadow-none placeholder:font-medium placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-0 dark:hover:border-darkmode-400 dark:focus:bg-darkmode-800 dark:focus:text-slate-200"
        />
        {gruppo.voci.length === 0 && (
          <button
            type="button"
            aria-label="Togli il gruppo vuoto"
            title="Togli il gruppo vuoto"
            onClick={() => azioni.onTogliGruppo(gruppo.id)}
            className="grid h-7 w-7 flex-none place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-danger dark:hover:bg-darkmode-400"
          >
            <Lucide icon="Trash2" aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex min-h-[8px] flex-col gap-1">
        {gruppo.voci.length > 0 ? (
          gruppo.voci.map((voce, indice) => (
            <RigaVoce
              key={voce.id}
              voce={voce}
              gruppoId={gruppo.id}
              indice={indice}
              sezione={sezione}
              senzaPermesso={senzaPermesso(voce.pathname)}
              azioni={azioni}
            />
          ))
        ) : (
          <GruppoVuoto gruppoId={gruppo.id} sezione={sezione} titoloArea={titoloArea} azioni={azioni} />
        )}
      </div>
    </div>
  );
}

const testoScartate = (voci: VoceScartata[], motivo: VoceScartata['motivo']) => {
  const n = voci.filter((v) => v.motivo === motivo).length;
  if (n === 0) return null;
  if (motivo === 'senza-pagina') {
    return n === 1
      ? '1 voce non apre una pagina e verrà tolta al salvataggio'
      : `${n} voci non aprono una pagina e verranno tolte al salvataggio`;
  }
  return n === 1
    ? '1 voce ripete una pagina già nel menu e verrà tolta al salvataggio'
    : `${n} voci ripetono una pagina già nel menu e verranno tolte al salvataggio`;
};

interface StrutturaMenuProps {
  modello: ModelloMenu;
  scartate: VoceScartata[];
  ereditati: ReadonlyMap<string, string>;
  puoAprire: (percorso: string) => boolean;
  azioni: AzioniStruttura;
}

/** Colonna "Struttura del menu": per ogni area con voci, i gruppi e le voci, modificabili in linea. */
export default function StrutturaMenu({ modello, scartate, ereditati, puoAprire, azioni }: StrutturaMenuProps) {
  const avvisi = [testoScartate(scartate, 'senza-pagina'), testoScartate(scartate, 'doppione')].filter(
    (testo): testo is string => testo !== null
  );
  const senzaPermesso = (percorso: string) => !puoAprire(percorso);

  return (
    <Sezione
      compatta
      titolo="Struttura del menu"
      descrizione="L'area di ogni voce dipende dalla pagina che apre"
      className="min-w-0"
    >
      <div className="flex flex-col gap-3.5">
        {avvisi.length > 0 && (
          <Alert variant="soft-warning" icona="TriangleAlert">
            {avvisi.map((testo) => (
              <p key={testo} className="font-medium">
                {testo}
              </p>
            ))}
            <ul className="mt-1 list-inside list-disc text-xs">
              {scartate.map((voce, i) => (
                <li key={`${voce.pathname ?? ''}-${i}`}>
                  {voce.titolo || 'Senza titolo'}
                  {voce.pathname ? <code className="ml-1 font-mono text-2xs">{voce.pathname}</code> : ' (senza indirizzo)'}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        {modello.aree.length === 0 ? (
          <div className="rounded-control border-2 border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-darkmode-400">
            Il menu è vuoto: trascina una pagina dal catalogo o premi + accanto a una pagina.
          </div>
        ) : (
          modello.aree.map((area) => {
            const descrizione = descrizioneSezione(area.sezione);
            const conta = contaVoci(area);
            return (
              <section
                key={area.sezione}
                aria-label={`Area ${descrizione.titolo}`}
                className="rounded-card border border-slate-200 bg-slate-50/60 dark:border-darkmode-400 dark:bg-darkmode-700/40"
              >
                <div className="flex items-center gap-2.5 rounded-t-card border-b border-slate-200 bg-white px-3 py-2.5 dark:border-darkmode-400 dark:bg-darkmode-600">
                  <span className="grid h-7 w-7 flex-none place-items-center rounded-control bg-primary text-white">
                    <Lucide icon={descrizione.icona} aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{descrizione.titolo}</h3>
                  <span className="mr-auto font-mono text-2xs tabular-nums text-slate-500">
                    {conta} {conta === 1 ? 'voce' : 'voci'}
                  </span>
                  <button
                    type="button"
                    aria-label={`Aggiungi un gruppo in ${descrizione.titolo}`}
                    onClick={() => azioni.onAggiungiGruppo(area.sezione)}
                    className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 dark:text-slate-200"
                  >
                    <Lucide icon="Plus" aria-hidden="true" className="h-3.5 w-3.5" />
                    Gruppo
                  </button>
                </div>
                <div className="flex flex-col gap-2.5 px-2.5 pb-2.5 pt-2">
                  {area.gruppi.map((gruppo) => (
                    <Gruppo
                      key={gruppo.id}
                      gruppo={gruppo}
                      sezione={area.sezione}
                      titoloArea={descrizione.titolo}
                      ereditato={ereditati.get(gruppo.id)}
                      senzaPermesso={senzaPermesso}
                      azioni={azioni}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </Sezione>
  );
}
