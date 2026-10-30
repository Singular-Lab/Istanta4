import { TIPO_MENU_ITEM } from '../enums';
import { PERIODI_MATERIALI, PeriodoMateriali, percorsoPop, percorsoVolantini } from '../materiali/periodi';
import { paginaPer } from './pagine';

/**
 * Le pagine Materiali (in corso, attivi, storico) sono state sostituite dalle viste Volantini
 * e POP. I vecchi percorsi restano come redirect nel router; i menu salvati si convertono:
 *
 * - le voci Materiali puntano alle viste Volantini dello stesso periodo, con il permesso
 *   ricalcolato dal catalogo delle pagine; il titolo cambia solo se è ancora quello predefinito,
 *   l'icona resta;
 * - subito dopo l'ultima voce convertita, sotto lo stesso padre, arrivano le voci POP dei periodi
 *   che il menu aveva, nello stesso ordine e con la stessa icona delle voci Volantini;
 * - Volantini e POP sono due sezioni: l'intestazione 'MATERIALI' diventa 'MATERIALI VOLANTINO' e
 *   subito prima della prima voce POP che la segue (stesso padre, prima dell'intestazione
 *   successiva) arriva l'intestazione 'MATERIALI POP'. Lo stesso vale per i menu già convertiti
 *   con l'intestazione unica 'VOLANTINI E POP'. Un menu senza intestazioni resta senza, e
 *   un'intestazione rinominata dall'amministratore resta com'è.
 *
 * La conversione si può ripetere: su un menu già convertito non cambia nulla.
 */

/** Le pagine Materiali sostituite: periodo e titolo con cui le seminava il menu predefinito. */
const PAGINE_MATERIALI: Readonly<Record<string, { periodo: PeriodoMateriali; titoloPredefinito: string }>> = {
  '/materiali-in-corso': { periodo: 'in-corso', titoloPredefinito: 'Materiali in corso' },
  '/materiali-attivi': { periodo: 'attivi', titoloPredefinito: 'Materiali attivi' },
  '/storico-materiali': { periodo: 'storico', titoloPredefinito: 'Storico materiali' },
};

/** Vecchio percorso della pagina Materiali → vista Volantini dello stesso periodo. */
export const PERCORSI_MATERIALI: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(PAGINE_MATERIALI).map(([vecchio, { periodo }]) => [vecchio, percorsoVolantini(periodo)])
);

export const TITOLO_VOLANTINI: Readonly<Record<PeriodoMateriali, string>> = {
  'in-corso': 'Volantini in corso',
  attivi: 'Volantini attivi',
  storico: 'Volantini storico',
};

export const TITOLO_POP: Readonly<Record<PeriodoMateriali, string>> = {
  'in-corso': 'POP in corso',
  attivi: 'POP attivi',
  storico: 'POP storico',
};

export const SEPARATORE_MATERIALI = 'MATERIALI';
/** L'intestazione unica delle prime conversioni: ora si divide in due sezioni, come 'MATERIALI'. */
export const SEPARATORE_VOLANTINI_E_POP = 'VOLANTINI E POP';
export const SEPARATORE_VOLANTINI = 'MATERIALI VOLANTINO';
export const SEPARATORE_POP = 'MATERIALI POP';

/** Intestazioni che la conversione rinomina in SEPARATORE_VOLANTINI e divide. */
const INTESTAZIONI_DA_DIVIDERE: readonly string[] = [SEPARATORE_MATERIALI, SEPARATORE_VOLANTINI_E_POP];

const PERCORSI_POP: ReadonlySet<string> = new Set(PERIODI_MATERIALI.map(periodo => percorsoPop(periodo)));

/** Le voci che la conversione può aggiungere: la voce POP di un periodo o l'intestazione POP. */
export type VoceNuovaMenu = PeriodoMateriali | 'intestazione-pop';

/**
 * I campi di una voce di menu che la conversione legge e scrive: li hanno sia le righe di
 * menu_items sia le voci del menu predefinito (che non hanno padre).
 */
export interface VoceMenuConvertibile {
  id_menu_item: string;
  id_parent?: string | null;
  tipo: string;
  titolo: string;
  icona?: string | null;
  pathname?: string | null;
  codice_permesso?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
}

export interface EsitoConversioneMenu<V> {
  /**
   * Il menu convertito: le voci di prima, aggiornate, con le voci POP subito dopo l'ultima voce
   * convertita e l'intestazione 'MATERIALI POP' subito prima della prima voce POP della sezione.
   */
  voci: V[];
  /** Voci già presenti che cambiano (percorso, titolo, permesso od ordinamento), nella forma nuova. */
  aggiornate: V[];
  /** Voci da aggiungere: le voci POP e le intestazioni 'MATERIALI POP'. */
  inserite: V[];
}

const permessoDi = (percorso: string): string | null => paginaPer(percorso)?.permesso ?? null;

const stessoTesto = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Le voci nell'ordine in cui compaiono nel menu: ogni voce seguita dalle sue sottovoci. */
const ordineNelMenu = <V extends VoceMenuConvertibile>(voci: readonly V[]): V[] => {
  const figli = new Map<string | null, V[]>();
  for (const voce of voci) {
    const padre = voce.id_parent ?? null;
    const fratelli = figli.get(padre);
    if (fratelli) fratelli.push(voce);
    else figli.set(padre, [voce]);
  }
  const ordinate: V[] = [];
  const visitate = new Set<V>();
  const visita = (padre: string | null) => {
    for (const voce of [...(figli.get(padre) ?? [])].sort((a, b) => a.ordinamento - b.ordinamento)) {
      if (visitate.has(voce)) continue;
      visitate.add(voce);
      ordinate.push(voce);
      visita(voce.id_menu_item);
    }
  };
  visita(null);
  // Sottovoci di un padre che non c'è più: in coda, così ogni voce ha comunque una posizione.
  return [...ordinate, ...voci.filter(voce => !visitate.has(voce))];
};

/**
 * Voci POP dei periodi delle voci convertite, subito dopo l'ultima convertita e sotto lo stesso
 * padre; le voci che seguono scendono per fare posto. Aggiunge le voci nuove a `voci` e le restituisce.
 */
const aggiungiVociPop = <V extends VoceMenuConvertibile>(
  voci: V[],
  convertite: Array<{ voce: V; periodo: PeriodoMateriali }>,
  cambiate: Set<V>,
  nuovoId: (voce: VoceNuovaMenu) => string
): V[] => {
  if (convertite.length === 0) return [];

  // Periodi nell'ordine in cui le voci convertite compaiono nel menu; ogni periodo una volta sola.
  const ordine = ordineNelMenu(voci);
  convertite.sort((a, b) => ordine.indexOf(a.voce) - ordine.indexOf(b.voce));
  const ultima = convertite[convertite.length - 1].voce;
  const percorsiPresenti = new Set(voci.map(voce => voce.pathname));
  const daAggiungere = PERIODI_MATERIALI
    .filter(periodo => !percorsiPresenti.has(percorsoPop(periodo)))
    .map(periodo => convertite.find(c => c.periodo === periodo))
    .filter((c): c is { voce: V; periodo: PeriodoMateriali } => c !== undefined)
    .sort((a, b) => ordine.indexOf(a.voce) - ordine.indexOf(b.voce));
  if (daAggiungere.length === 0) return [];

  // Le voci che seguono l'ultima convertita, sotto lo stesso padre, scendono per fare posto.
  const padre = ultima.id_parent ?? null;
  for (const voce of voci) {
    if ((voce.id_parent ?? null) !== padre || voce.ordinamento <= ultima.ordinamento) continue;
    voce.ordinamento += daAggiungere.length;
    cambiate.add(voce);
  }

  const inserite = daAggiungere.map(({ voce: volantini, periodo }, i): V => {
    const pathname = percorsoPop(periodo);
    const pop: V = {
      ...volantini,
      id_menu_item: nuovoId(periodo),
      titolo: TITOLO_POP[periodo],
      icona: volantini.icona ?? null,
      pathname,
      codice_permesso: permessoDi(pathname),
      // Una voce disattivata dall'amministratore resta tale anche nella sua compagna POP;
      // la pagina iniziale invece resta una sola.
      disabilitato: volantini.disabilitato ?? false,
      start_page: false,
      ordinamento: ultima.ordinamento + 1 + i,
    };
    if ('id_parent' in volantini || 'id_parent' in ultima) pop.id_parent = padre;
    return pop;
  });
  voci.splice(voci.indexOf(ultima) + 1, 0, ...inserite);
  return inserite;
};

/**
 * Divide la sezione di ogni intestazione indicata: l'intestazione POP va subito prima della prima
 * voce POP della sezione (stesso padre, prima dell'intestazione successiva), che scende con le
 * voci seguenti. Una sezione senza voci POP resta com'è. Aggiunge le intestazioni a `voci` e le
 * restituisce; le voci appena aggiunte (`nuove`) scendono senza contare fra le aggiornate.
 */
const dividiSezioni = <V extends VoceMenuConvertibile>(
  voci: V[],
  intestazioni: readonly V[],
  cambiate: Set<V>,
  nuove: ReadonlySet<V>,
  nuovoId: (voce: VoceNuovaMenu) => string
): V[] => {
  const aggiunte: V[] = [];
  for (const intestazione of intestazioni) {
    const padre = intestazione.id_parent ?? null;
    const fratelli = ordineNelMenu(voci).filter(voce => (voce.id_parent ?? null) === padre);
    const seguenti = fratelli.slice(fratelli.indexOf(intestazione) + 1);
    const fine = seguenti.findIndex(voce => voce.tipo === TIPO_MENU_ITEM.SEPARATOR);
    const sezione = fine === -1 ? seguenti : seguenti.slice(0, fine);
    const primaPop = sezione.find(voce => PERCORSI_POP.has(voce.pathname ?? ''));
    if (!primaPop) continue;

    const ordinamento = primaPop.ordinamento;
    for (const voce of fratelli.slice(fratelli.indexOf(primaPop))) {
      voce.ordinamento += 1;
      if (!nuove.has(voce)) cambiate.add(voce);
    }
    const pop: V = {
      ...intestazione,
      id_menu_item: nuovoId('intestazione-pop'),
      titolo: SEPARATORE_POP,
      ordinamento,
    };
    voci.splice(voci.indexOf(primaPop), 0, pop);
    aggiunte.push(pop);
  }
  return aggiunte;
};

/**
 * Converte UN menu (le voci di un tipo di utente e sotto-ruolo, sottovoci comprese, in un elenco
 * piatto). Non modifica le voci ricevute. `nuovoId` dà l'identificativo di ciascuna voce aggiunta:
 * le voci POP, per periodo, e l'intestazione 'MATERIALI POP'.
 */
export const convertiMenuMateriali = <V extends VoceMenuConvertibile>(
  vociMenu: readonly V[],
  nuovoId: (voce: VoceNuovaMenu) => string
): EsitoConversioneMenu<V> => {
  const voci = vociMenu.map(voce => ({ ...voce }));
  const cambiate = new Set<V>();
  const convertite: Array<{ voce: V; periodo: PeriodoMateriali }> = [];
  const intestazioni: V[] = [];

  for (const voce of voci) {
    if (voce.tipo === TIPO_MENU_ITEM.SEPARATOR && INTESTAZIONI_DA_DIVIDERE.includes(voce.titolo.trim())) {
      voce.titolo = SEPARATORE_VOLANTINI;
      cambiate.add(voce);
      intestazioni.push(voce);
      continue;
    }
    const materiali = voce.pathname ? PAGINE_MATERIALI[voce.pathname] : undefined;
    if (!materiali) continue;
    const { periodo, titoloPredefinito } = materiali;
    voce.pathname = percorsoVolantini(periodo);
    voce.codice_permesso = permessoDi(voce.pathname);
    // Un titolo scelto dall'amministratore resta com'è.
    if (stessoTesto(voce.titolo, titoloPredefinito)) voce.titolo = TITOLO_VOLANTINI[periodo];
    cambiate.add(voce);
    convertite.push({ voce, periodo });
  }

  // Prima le voci POP, poi le intestazioni: la sezione POP comincia dalla prima voce POP.
  const vociPop = aggiungiVociPop(voci, convertite, cambiate, nuovoId);
  const intestazioniPop = dividiSezioni(voci, intestazioni, cambiate, new Set(vociPop), nuovoId);
  return {
    voci,
    aggiornate: voci.filter(voce => cambiate.has(voce)),
    inserite: [...vociPop, ...intestazioniPop],
  };
};
