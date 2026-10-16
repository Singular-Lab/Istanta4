import Button from '@/components/Base/Button';
import { FormInput, FormSelect } from '@/components/Base/Form';
import FormSwitch from '@/components/Base/Form/FormSwitch';
import { Dialog } from '@/components/Base/Headless';
import Lucide from '@/components/Base/Lucide';
import Tippy from '@/components/Base/Tippy';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { AREE, CodicePermesso, DefinizioneArea, DefinizioneAzione, voceDi } from '../../../lib/accessi/catalogo';
import { TIPO_UTENTI } from '../../../lib/enums';
import { Ambito, useConfigurazione, useConfronto, useRipristinaOverride, useRuoliGestibili, useSalvaConfigurazione } from './api';
import {
  azioniCheSiSpengono,
  Bozza,
  ConfigurazioneServer,
  differenze,
  FiltroPermessi,
  impostaArea,
  impostaPermesso,
  modificheDaInviare,
  passaFiltro,
  ripristinaEreditato,
  statoArea,
  valoreVisto,
} from './bozzaPermessi';
import { ETICHETTE_TIPO, etichettaSottoRuolo, ICONE_TIPO } from './ruoli';

const FILTRI: Array<{ valore: FiltroPermessi; etichetta: string }> = [
  { valore: 'tutti', etichetta: 'Tutti' },
  { valore: 'abilitati', etichetta: 'Abilitati' },
  { valore: 'disabilitati', etichetta: 'Disabilitati' },
  { valore: 'modificati', etichetta: 'Modificati' },
];

const ambitoUguale = (a: Ambito, b: Ambito) => a.tipo === b.tipo && a.idRuoloGdo === b.idRuoloGdo && a.idGdo === b.idGdo;

/* =======================
   ELENCO DEI RUOLI
   ======================= */

type VoceRuolo = { tipo: TIPO_UTENTI; idRuoloGdo: string | null; etichetta: string; icona: string; figlio: boolean };

const ElencoRuoli = ({
  voci,
  ambito,
  conteggi,
  totale,
  inSospeso,
  onSeleziona,
}: {
  voci: VoceRuolo[];
  ambito: Ambito;
  conteggi: Record<string, number>;
  totale: number;
  inSospeso: boolean;
  onSeleziona: (tipo: TIPO_UTENTI, idRuoloGdo: string | null) => void;
}) => {
  const [ricerca, setRicerca] = useState('');
  const visibili = voci.filter(v => v.etichetta.toLowerCase().indexOf(ricerca.trim().toLowerCase()) >= 0);
  return (
    <div className="box box--stacked flex flex-col lg:sticky lg:top-24">
      <div className="border-b border-dashed border-slate-300/70 p-4">
        <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Ruoli</div>
        <div className="relative mt-3">
          <Lucide icon="Search" className="absolute inset-y-0 left-0 z-10 my-auto ml-3 h-4 w-4 stroke-[1.3] text-slate-500" />
          <FormInput
            value={ricerca}
            onChange={e => setRicerca(e.target.value)}
            placeholder="Cerca ruolo..."
            formInputSize="sm"
            className="pl-9"
            aria-label="Cerca ruolo"
          />
        </div>
      </div>
      {/* Sotto lg la lista diventa pillole che vanno a capo: non spinge i permessi in fondo alla pagina. */}
      <nav className="flex flex-wrap gap-1.5 px-4 py-3 lg:flex-col lg:gap-0.5" aria-label="Ruoli">
        {visibili.map(v => {
          const attivo = v.tipo === ambito.tipo && v.idRuoloGdo === ambito.idRuoloGdo;
          const chiave = v.idRuoloGdo ? `${v.tipo}:${v.idRuoloGdo}` : v.tipo;
          return (
            <button
              key={chiave}
              type="button"
              onClick={() => onSeleziona(v.tipo, v.idRuoloGdo)}
              aria-current={attivo ? 'true' : undefined}
              className={clsx(
                'flex items-center gap-2.5 rounded-lg border border-slate-200/80 py-1.5 pl-2.5 pr-2.5 text-left text-sm transition-colors dark:border-darkmode-400 lg:w-full lg:border-transparent',
                // Sotto-ruolo: rientro di un'icona; il trattino occupa lo slot dell'icona, cosi' le etichette restano allineate
                v.figlio && 'lg:pl-[26px]',
                attivo
                  ? 'bg-primary/[0.07] font-medium text-primary dark:bg-darkmode-400 dark:text-slate-100'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-darkmode-400'
              )}
            >
              {!v.figlio && <Lucide icon={v.icona as any} className="h-4 w-4 flex-shrink-0 stroke-[1.4]" />}
              {v.figlio && (
                <span className="hidden h-4 w-4 flex-shrink-0 items-center justify-center lg:flex" aria-hidden>
                  <span className="h-px w-2.5 bg-slate-300" />
                </span>
              )}
              {v.figlio && <span className="text-slate-400 lg:hidden" aria-hidden>{ETICHETTE_TIPO[v.tipo] ?? v.tipo} ·</span>}
              <span className="truncate">{v.etichetta}</span>
              {attivo && inSospeso && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-warning" title="Modifiche non salvate" />}
              {/* Conteggio subito dopo il nome, come i badge del menu laterale */}
              <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] tabular-nums text-slate-500 dark:bg-darkmode-600">
                {conteggi[chiave] ?? '–'}/{totale}
              </span>
            </button>
          );
        })}
        {visibili.length === 0 && <div className="p-4 text-center text-sm text-slate-400">Nessun ruolo trovato</div>}
      </nav>
    </div>
  );
};

/* =======================
   AREA E RIGHE
   ======================= */

/**
 * Interruttore a tre stati per un'intera area. Lo stato parziale (alcune azioni
 * abilitate) ha pista ambra e pomello centrato con un trattino: non si confonde
 * né con "tutto" né con "niente".
 */
const InterruttoreArea = ({ stato, disabilitato, onClick, etichetta, abilitati, totale }: {
  stato: 'tutti' | 'nessuno' | 'misto';
  disabilitato?: boolean;
  onClick: () => void;
  etichetta: string;
  abilitati: number;
  totale: number;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={stato === 'tutti' ? true : stato === 'nessuno' ? false : 'mixed'}
    aria-label={etichetta}
    title={stato === 'misto' ? `Parziale: ${abilitati} di ${totale}` : stato === 'tutti' ? `Tutti abilitati (${totale})` : 'Nessuno abilitato'}
    disabled={disabilitato}
    onClick={e => { e.stopPropagation(); onClick(); }}
    className={clsx(
      'relative h-6 w-[38px] flex-shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      stato === 'tutti' && 'border-primary bg-primary',
      stato === 'misto' && 'border-warning/70 bg-warning/25',
      stato === 'nessuno' && 'border-slate-200 bg-slate-200 dark:border-darkmode-400 dark:bg-darkmode-400'
    )}
  >
    <span
      className={clsx(
        'absolute inset-y-0 my-auto flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-[1px_1px_3px_rgba(0,0,0,0.25)] transition-[left] duration-200',
        stato === 'tutti' ? 'left-[15px]' : stato === 'misto' ? 'left-[8px]' : 'left-px'
      )}
    >
      {stato === 'misto' && <span aria-hidden className="block h-0.5 w-2.5 rounded-full bg-warning" />}
    </span>
  </button>
);

const RigaPermesso = ({
  azione,
  accesso,
  config,
  bozza,
  sistema,
  onCambia,
  onRipristina,
}: {
  azione: DefinizioneAzione;
  accesso?: boolean;
  config: ConfigurazioneServer;
  bozza: Bozza;
  sistema?: boolean;
  onCambia: (codice: CodicePermesso, valore: boolean) => void;
  onRipristina: (codice: CodicePermesso) => void;
}) => {
  const visto = valoreVisto(config, bozza, azione.codice);
  const personalizzato = config.eredita && visto.impostato;
  const idInterruttore = `permesso-${azione.codice}`;
  return (
    <div
      className={clsx(
        'flex items-center gap-4 px-5 py-3 transition-colors',
        visto.inSospeso && 'bg-warning/[0.06]',
        accesso && 'bg-slate-50/70 dark:bg-darkmode-700/30'
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idInterruttore} className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-200">
            {azione.nome}
          </label>
          {accesso && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary dark:text-slate-200">
              <Lucide icon="DoorOpen" className="h-3 w-3" />
              Accesso all'area
            </span>
          )}
          {azione.pericolosa && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
              <Lucide icon="TriangleAlert" className="h-3 w-3" />
              Distruttiva
            </span>
          )}
          {config.eredita && !sistema && (
            personalizzato ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">
                <Lucide icon="GitBranch" className="h-3 w-3" />
                Personalizzato
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">Ereditato</span>
            )
          )}
          {visto.inSospeso && (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">Non salvato</span>
          )}
        </div>
        <Tippy content={azione.codice} options={{ placement: 'bottom-start', delay: [600, 0] }} className="block">
          <p className="mt-0.5 text-xs text-slate-500">{azione.descrizione}</p>
        </Tippy>
      </div>
      {personalizzato && (
        <Tippy content="Torna al valore ereditato dal livello superiore">
          <Button
            variant="outline-secondary"
            size="sm"
            className="flex-shrink-0 px-2 py-1 text-xs"
            onClick={() => onRipristina(azione.codice)}
          >
            <Lucide icon="Undo2" className="mr-1 h-3.5 w-3.5" />
            Ripristina
          </Button>
        </Tippy>
      )}
      {sistema ? (
        <span className="inline-flex flex-shrink-0 items-center gap-1 text-xs text-slate-400">
          <Lucide icon="Lock" className="h-3.5 w-3.5" />
          Solo Superadmin
        </span>
      ) : (
        <FormSwitch className="flex-shrink-0">
          <FormSwitch.Input
            id={idInterruttore}
            type="checkbox"
            checked={visto.abilitato}
            onChange={() => onCambia(azione.codice, !visto.abilitato)}
          />
        </FormSwitch>
      )}
    </div>
  );
};

const CardArea = ({
  area,
  config,
  bozza,
  filtro,
  ricerca,
  aperta,
  onApri,
  onCambia,
  onCambiaArea,
  onRipristina,
}: {
  area: DefinizioneArea;
  config: ConfigurazioneServer;
  bozza: Bozza;
  filtro: FiltroPermessi;
  ricerca: string;
  aperta: boolean;
  onApri: () => void;
  onCambia: (codice: CodicePermesso, valore: boolean) => void;
  onCambiaArea: (area: DefinizioneArea, valore: boolean) => void;
  onRipristina: (codice: CodicePermesso) => void;
}) => {
  const righe: Array<{ azione: DefinizioneAzione; accesso: boolean }> = [
    ...(area.accesso ? [{ azione: area.accesso, accesso: true }] : []),
    ...area.azioni.map(azione => ({ azione, accesso: false })),
  ].filter(r => area.sistema ? passaFiltro(config, bozza, r.azione.codice, 'tutti', ricerca) : passaFiltro(config, bozza, r.azione.codice, filtro, ricerca));
  if (righe.length === 0) return null;
  if (area.sistema && filtro !== 'tutti') return null;

  const { stato, abilitati, totale } = statoArea(config, bozza, area);
  const inSospeso = righe.some(r => r.azione.codice in bozza);
  // Con una ricerca attiva i gruppi si aprono da soli per mostrare i risultati.
  const mostra = aperta || ricerca.trim().length > 0 || filtro !== 'tutti';

  return (
    <div className={clsx('box box--stacked overflow-hidden', area.sistema && 'opacity-90')}>
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onApri}
          aria-expanded={mostra}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <div className={clsx('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', area.sistema ? 'bg-slate-100 text-slate-500 dark:bg-darkmode-400' : 'bg-primary/10 text-primary dark:text-slate-200')}>
            <Lucide icon={area.icona as any} className="h-[18px] w-[18px] stroke-[1.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-800 dark:text-slate-100">{area.nome}</span>
              {area.sistema && <Lucide icon="Lock" className="h-3.5 w-3.5 text-slate-400" />}
              {inSospeso && <span className="h-2 w-2 rounded-full bg-warning" title="Modifiche non salvate" />}
            </div>
            <div className="truncate text-xs text-slate-500">{area.descrizione}</div>
          </div>
          {!area.sistema && (
            <span className="hidden flex-shrink-0 text-xs tabular-nums text-slate-500 sm:inline">
              {abilitati} di {totale}
            </span>
          )}
          <Lucide icon="ChevronDown" className={clsx('h-4 w-4 flex-shrink-0 text-slate-400 transition-transform', mostra && 'rotate-180')} />
        </button>
        {!area.sistema && (
          <InterruttoreArea
            stato={stato}
            abilitati={abilitati}
            totale={totale}
            etichetta={`Tutta l'area ${area.nome}`}
            onClick={() => onCambiaArea(area, stato !== 'tutti')}
          />
        )}
      </div>
      {mostra && (
        <div className="divide-y divide-dashed divide-slate-200 border-t border-dashed border-slate-300/70 dark:divide-darkmode-400 dark:border-darkmode-400">
          {righe.map(r => (
            <RigaPermesso
              key={r.azione.codice}
              azione={r.azione}
              accesso={r.accesso}
              config={config}
              bozza={bozza}
              sistema={area.sistema}
              onCambia={onCambia}
              onRipristina={onRipristina}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* =======================
   RIEPILOGO
   ======================= */

const RiepilogoModifiche = ({
  aperto,
  config,
  bozza,
  descrizioneAmbito,
  salvataggio,
  onChiudi,
  onConferma,
}: {
  aperto: boolean;
  config: ConfigurazioneServer;
  bozza: Bozza;
  descrizioneAmbito: string;
  salvataggio: boolean;
  onChiudi: () => void;
  onConferma: () => void;
}) => {
  const elenco = differenze(config, bozza);
  const gruppi = [
    { titolo: 'Si abilitano', icona: 'CircleCheck', colore: 'text-success', voci: elenco.filter(d => !d.eredita && d.dopo) },
    { titolo: 'Si disabilitano', icona: 'CircleMinus', colore: 'text-danger', voci: elenco.filter(d => !d.eredita && !d.dopo) },
    { titolo: 'Tornano a ereditare', icona: 'Undo2', colore: 'text-info', voci: elenco.filter(d => d.eredita) },
  ].filter(g => g.voci.length > 0);

  return (
    <Dialog open={aperto} onClose={() => !salvataggio && onChiudi()} size="lg">
      <Dialog.Panel>
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lucide icon="ListChecks" className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-medium text-slate-800 dark:text-slate-100">Rivedi le modifiche</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {elenco.length} {elenco.length === 1 ? 'modifica' : 'modifiche'} per <span className="font-medium text-slate-700 dark:text-slate-200">{descrizioneAmbito}</span>.
                Valgono dalla prossima richiesta degli utenti interessati.
              </p>
            </div>
          </div>
          <div className="mt-5 max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            {gruppi.map(g => (
              <div key={g.titolo}>
                <div className={clsx('mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider', g.colore)}>
                  <Lucide icon={g.icona as any} className="h-3.5 w-3.5" />
                  {g.titolo} ({g.voci.length})
                </div>
                <ul className="divide-y divide-dashed divide-slate-200 rounded-lg border border-slate-200 dark:divide-darkmode-400 dark:border-darkmode-400">
                  {g.voci.map(v => (
                    <li key={v.codice} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="text-slate-700 dark:text-slate-200">{v.nome}</span>
                      <span className="text-xs text-slate-400">{v.area}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200/60 px-6 py-4 dark:border-darkmode-400">
          <Button variant="outline-secondary" onClick={onChiudi} disabled={salvataggio}>
            Torna alle modifiche
          </Button>
          <Button variant="primary" onClick={onConferma} disabled={salvataggio}>
            <Lucide icon="Save" className="mr-1.5 h-4 w-4" />
            {salvataggio ? 'Salvataggio...' : 'Conferma e salva'}
          </Button>
        </div>
      </Dialog.Panel>
    </Dialog>
  );
};

/* =======================
   PAGINA
   ======================= */

const PermessiRuoli = () => {
  const { showNotification } = useNotification();
  const ruoli = useRuoliGestibili();
  const [ambito, setAmbito] = useState<Ambito>({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: null, idGdo: null });
  const [ambitoInAttesa, setAmbitoInAttesa] = useState<Ambito | null>(null);
  const [bozza, setBozza] = useState<Bozza>({});
  const [ricerca, setRicerca] = useState('');
  const [filtro, setFiltro] = useState<FiltroPermessi>('tutti');
  const [aperte, setAperte] = useState<Record<string, boolean>>({});
  const [riepilogo, setRiepilogo] = useState(false);
  const [accessoDaTogliere, setAccessoDaTogliere] = useState<{ codice: CodicePermesso; azioni: CodicePermesso[] } | null>(null);
  const [ripristinoOverride, setRipristinoOverride] = useState(false);

  const configurazione = useConfigurazione(ambito);
  const confronto = useConfronto(ambito.idGdo);
  const salva = useSalvaConfigurazione();
  const ripristina = useRipristinaOverride();

  const config = configurazione.data;
  const numeroModifiche = Object.keys(bozza).length;
  const inSospeso = numeroModifiche > 0;

  // Uscire dalla pagina con modifiche non salvate chiede conferma al browser.
  useEffect(() => {
    if (!inSospeso) return;
    const avvisa = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avvisa);
    return () => window.removeEventListener('beforeunload', avvisa);
  }, [inSospeso]);

  const vociRuoli: VoceRuolo[] = useMemo(() => {
    const dati = ruoli.data;
    if (!dati) return [];
    const voci: VoceRuolo[] = [];
    for (const tipo of dati.tipi) {
      voci.push({ tipo, idRuoloGdo: null, etichetta: ETICHETTE_TIPO[tipo] ?? tipo, icona: ICONE_TIPO[tipo] ?? 'User', figlio: false });
      if (tipo === TIPO_UTENTI.GDO) {
        for (const r of dati.ruoliGdo) {
          voci.push({ tipo, idRuoloGdo: r.id, etichetta: etichettaSottoRuolo(r.nome), icona: 'User', figlio: true });
        }
      }
    }
    return voci;
  }, [ruoli.data]);

  const conteggi = useMemo(() => {
    const mappa: Record<string, number> = {};
    for (const c of confronto.data?.colonne ?? []) mappa[c.chiave] = c.permessi.length;
    return mappa;
  }, [confronto.data]);

  const totaleAssegnabili = useMemo(
    () => AREE.filter(a => !a.sistema).reduce((n, a) => n + a.azioni.length + (a.accesso ? 1 : 0), 0),
    []
  );

  const descrizioneAmbito = useMemo(() => {
    const ruolo = ambito.idRuoloGdo
      ? `${ETICHETTE_TIPO[ambito.tipo]} · ${etichettaSottoRuolo(ruoli.data?.ruoliGdo.find(r => r.id === ambito.idRuoloGdo)?.nome ?? '')}`
      : ETICHETTE_TIPO[ambito.tipo] ?? ambito.tipo;
    const gdo = ambito.idGdo ? ruoli.data?.gdo.find(g => g.id === ambito.idGdo)?.nome : null;
    return gdo ? `${ruolo} in ${gdo}` : ruolo;
  }, [ambito, ruoli.data]);

  const cambiaAmbito = (prossimo: Ambito) => {
    if (ambitoUguale(prossimo, ambito)) return;
    if (inSospeso) {
      setAmbitoInAttesa(prossimo);
      return;
    }
    setAmbito(prossimo);
  };

  const confermaCambioAmbito = () => {
    if (!ambitoInAttesa) return;
    setBozza({});
    setAmbito(ambitoInAttesa);
    setAmbitoInAttesa(null);
  };

  const onCambia = (codice: CodicePermesso, valore: boolean) => {
    if (!config) return;
    const voce = voceDi(codice);
    if (!valore && voce?.accesso) {
      const azioni = azioniCheSiSpengono(config, bozza, codice);
      if (azioni.length > 0) {
        setAccessoDaTogliere({ codice, azioni });
        return;
      }
    }
    setBozza(b => impostaPermesso(config, b, codice, valore));
  };

  const onCambiaArea = (area: DefinizioneArea, valore: boolean) => {
    if (!config) return;
    setBozza(b => impostaArea(config, b, area, valore));
    setAperte(a => ({ ...a, [area.id]: true }));
  };

  const onRipristina = (codice: CodicePermesso) => {
    if (!config) return;
    setBozza(b => ripristinaEreditato(config, b, codice));
  };

  const salvaModifiche = () => {
    salva.mutate(
      { ambito, modifiche: modificheDaInviare(bozza) },
      {
        onSuccess: () => {
          setBozza({});
          setRiepilogo(false);
          showNotification(`Permessi salvati per ${descrizioneAmbito}`, { variant: 'success' });
        },
        onError: (errore: any) => {
          showNotification(errore?.message || 'Salvataggio non riuscito', { variant: 'error' });
        },
      }
    );
  };

  const personalizzati = config?.eredita ? config.permessi.filter(p => p.impostato).length : 0;
  const abilitati = config ? config.permessi.filter(p => valoreVisto(config, bozza, p.codice).abilitato).length : 0;

  return (
    // Pannello ruoli a larghezza fissa: su schermi larghi lo spazio in piu' va ai permessi, non alla lista
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="w-full flex-shrink-0 lg:w-72 xl:w-80">
        {ruoli.isLoading ? (
          <div className="box box--stacked flex items-center gap-2 p-5 text-sm text-slate-500">
            <Lucide icon="Loader" className="h-4 w-4 animate-spin" /> Caricamento ruoli...
          </div>
        ) : (
          <ElencoRuoli
            voci={vociRuoli}
            ambito={ambito}
            conteggi={conteggi}
            totale={totaleAssegnabili}
            inSospeso={inSospeso}
            onSeleziona={(tipo, idRuoloGdo) => cambiaAmbito({ ...ambito, tipo, idRuoloGdo })}
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5">
        {/* Intestazione del ruolo e ambito */}
        <div className="box box--stacked p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-theme-1 to-theme-2/80 text-white">
                <Lucide icon={(ICONE_TIPO[ambito.tipo] ?? 'User') as any} className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-base font-medium text-slate-800 dark:text-slate-100">{descrizioneAmbito}</div>
                <div className="text-xs text-slate-500">
                  {ambito.idGdo
                    ? 'Override della GDO: valgono solo per i suoi utenti e prevalgono sui permessi del ruolo.'
                    : ambito.idRuoloGdo
                      ? 'Sotto-ruolo: eredita dal tipo GDO, salvo i permessi personalizzati qui.'
                      : 'Permessi del ruolo validi in tutte le GDO.'}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-1 xl:w-72">
              <label htmlFor="ambito-gdo" className="text-xs font-medium uppercase tracking-wider text-slate-500">Ambito</label>
              <FormSelect
                id="ambito-gdo"
                formSelectSize="sm"
                value={ambito.idGdo ?? ''}
                onChange={e => cambiaAmbito({ ...ambito, idGdo: e.target.value || null })}
              >
                <option value="">Tutte le GDO (permessi del ruolo)</option>
                {(ruoli.data?.gdo ?? []).map(g => (
                  <option key={g.id} value={g.id}>Override per {g.nome}</option>
                ))}
              </FormSelect>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-dashed border-slate-300/70 pt-4 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 font-medium text-success">
              <Lucide icon="CircleCheck" className="h-3.5 w-3.5" />
              {abilitati} abilitati su {totaleAssegnabili}
            </span>
            {config?.eredita && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info/10 px-2.5 py-1 font-medium text-info">
                <Lucide icon="GitBranch" className="h-3.5 w-3.5" />
                {personalizzati} personalizzati
              </span>
            )}
            {inSospeso && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-2.5 py-1 font-medium text-warning">
                <Lucide icon="PencilLine" className="h-3.5 w-3.5" />
                {numeroModifiche} non salvate
              </span>
            )}
            {ambito.idGdo && personalizzati > 0 && (
              <Button
                variant="outline-secondary"
                size="sm"
                className="ml-auto text-xs"
                onClick={() => setRipristinoOverride(true)}
                disabled={inSospeso}
              >
                <Lucide icon="RotateCcw" className="mr-1.5 h-3.5 w-3.5" />
                Ripristina tutti gli override
              </Button>
            )}
          </div>
        </div>

        {/* Ricerca e filtri */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Lucide icon="Search" className="absolute inset-y-0 left-0 z-10 my-auto ml-3 h-4 w-4 stroke-[1.3] text-slate-500" />
            <FormInput
              value={ricerca}
              onChange={e => setRicerca(e.target.value)}
              placeholder="Cerca un permesso o un'area..."
              className="pl-9"
              aria-label="Cerca un permesso"
            />
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-darkmode-400 dark:bg-darkmode-600" role="group" aria-label="Filtro">
            {FILTRI.map(f => (
              <button
                key={f.valore}
                type="button"
                aria-pressed={filtro === f.valore}
                onClick={() => setFiltro(f.valore)}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  filtro === f.valore ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-darkmode-400'
                )}
              >
                {f.etichetta}
              </button>
            ))}
          </div>
        </div>

        {/* Permessi per area */}
        {configurazione.isLoading || !config ? (
          configurazione.isError ? (
            <div className="box box--stacked flex flex-col items-center gap-3 p-10 text-center">
              <Lucide icon="TriangleAlert" className="h-8 w-8 text-danger" />
              <div className="text-sm text-slate-600">{(configurazione.error as any)?.message || 'Impossibile caricare i permessi'}</div>
              <Button variant="outline-secondary" size="sm" onClick={() => configurazione.refetch()}>Riprova</Button>
            </div>
          ) : (
            <div className="box box--stacked flex items-center gap-2 p-5 text-sm text-slate-500">
              <Lucide icon="Loader" className="h-4 w-4 animate-spin" /> Caricamento permessi...
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {AREE.map(area => (
              <CardArea
                key={area.id}
                area={area}
                config={config}
                bozza={bozza}
                filtro={filtro}
                ricerca={ricerca}
                aperta={!!aperte[area.id]}
                onApri={() => setAperte(a => ({ ...a, [area.id]: !a[area.id] }))}
                onCambia={onCambia}
                onCambiaArea={onCambiaArea}
                onRipristina={onRipristina}
              />
            ))}
            {AREE.every(area => ![...(area.accesso ? [area.accesso] : []), ...area.azioni].some(a => passaFiltro(config, bozza, a.codice, filtro, ricerca))) && (
              <div className="box box--stacked p-10 text-center text-sm text-slate-500">
                Nessun permesso corrisponde alla ricerca.
              </div>
            )}
          </div>
        )}

        {/* Spazio in fondo alla lista: l'ultima area scorre sopra la barra invece di restarci sotto */}
        {inSospeso && config && <div aria-hidden className="h-16" />}

        {/* Barra delle modifiche in sospeso */}
        {inSospeso && config && (
          <div className="sticky bottom-4 z-20">
            <div className="box box--stacked flex flex-col gap-3 border-warning/40 bg-white/95 p-4 shadow-lg backdrop-blur-sm dark:bg-darkmode-600/95 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="h-2.5 w-2.5 rounded-full bg-warning" />
                <span>
                  <span className="font-medium">{numeroModifiche} {numeroModifiche === 1 ? 'modifica' : 'modifiche'}</span> non salvate per {descrizioneAmbito}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline-secondary" size="sm" onClick={() => setBozza({})}>
                  Annulla
                </Button>
                <Button variant="primary" size="sm" onClick={() => setRiepilogo(true)}>
                  <Lucide icon="ListChecks" className="mr-1.5 h-4 w-4" />
                  Rivedi e salva
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {config && (
        <RiepilogoModifiche
          aperto={riepilogo}
          config={config}
          bozza={bozza}
          descrizioneAmbito={descrizioneAmbito}
          salvataggio={salva.isPending}
          onChiudi={() => setRiepilogo(false)}
          onConferma={salvaModifiche}
        />
      )}

      <ConfirmDialog
        open={!!ambitoInAttesa}
        title="Scartare le modifiche?"
        description={`Hai ${numeroModifiche} ${numeroModifiche === 1 ? 'modifica non salvata' : 'modifiche non salvate'} per ${descrizioneAmbito}. Cambiando ruolo o ambito andranno perse.`}
        confirmLabel="Scarta e cambia"
        confirmVariant="danger"
        onClose={() => setAmbitoInAttesa(null)}
        onConfirm={confermaCambioAmbito}
      />

      <ConfirmDialog
        open={!!accessoDaTogliere}
        title="Togliere l'accesso all'area?"
        description={
          accessoDaTogliere ? (
            <>
              Senza l'accesso a "{voceDi(accessoDaTogliere.codice)?.area.nome}" le sue azioni non hanno effetto, quindi si disattivano anche:
              <ul className="mt-2 list-inside list-disc">
                {accessoDaTogliere.azioni.map(c => <li key={c}>{voceDi(c)?.nome}</li>)}
              </ul>
            </>
          ) : ''
        }
        confirmLabel="Togli l'accesso"
        confirmVariant="danger"
        onClose={() => setAccessoDaTogliere(null)}
        onConfirm={() => {
          if (config && accessoDaTogliere) setBozza(b => impostaPermesso(config, b, accessoDaTogliere.codice, false));
          setAccessoDaTogliere(null);
        }}
      />

      <ConfirmDialog
        open={ripristinoOverride}
        title="Ripristinare tutti gli override?"
        description={`I ${personalizzati} permessi personalizzati per ${descrizioneAmbito} torneranno a ereditare dal ruolo.`}
        confirmLabel="Ripristina"
        confirmVariant="danger"
        loading={ripristina.isPending}
        onClose={() => setRipristinoOverride(false)}
        onConfirm={() =>
          ripristina.mutate(ambito, {
            onSuccess: () => {
              setRipristinoOverride(false);
              showNotification('Override ripristinati', { variant: 'success' });
            },
            onError: (errore: any) => showNotification(errore?.message || 'Ripristino non riuscito', { variant: 'error' }),
          })
        }
      />
    </div>
  );
};

export default PermessiRuoli;
