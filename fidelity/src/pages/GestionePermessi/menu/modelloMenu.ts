import {
  normalizzaPercorso,
  puoAprirePagina,
  sezioneDiPercorso,
  voceDiMenuPer,
  VOCI_DI_MENU,
  type VoceDiMenu,
} from '../../../../lib/accessi/pagine';
import { eSezioneMenu, eSezionePagina, SEZIONI, sezionaMenu, type SezionePagina } from '../../../../lib/accessi/sezioni';
import type { MenuElement, MenuItem } from '../../../../lib/types';

/**
 * Logica dell'editor del menu, senza React.
 *
 * Il server salva il menu come elenco piatto (GET e PUT /menu/:tipo): separatori con il titolo di un
 * gruppo e voci con il percorso di una pagina e, se scelta, l'area. L'editor lo mostra per area
 * (lib/accessi/sezioni.ts), dentro i gruppi: una pagina può stare in qualunque area, anche in più
 * aree, al più una volta per area; senza un'area scelta sta in quella del catalogo. Al salvataggio
 * il menu torna piatto, area per area nell'ordine di SEZIONI.
 */

/** Voce del menu come la scambia il server. */
export interface MenuItemDTO {
  id_menu_item?: string;
  tipo_utente: string;
  ruolo_gdo?: string | null;
  titolo: string;
  tipo: 'separator' | 'item';
  icona?: string | null;
  pathname?: string | null;
  codice_permesso?: string | null;
  /** Area scelta per la voce; null o assente = area della pagina nel catalogo. */
  sezione?: string | null;
  disabilitato?: boolean;
  start_page?: boolean;
  ordinamento: number;
  id_parent?: string | null;
  subMenu?: MenuItemDTO[];
}

export interface VoceMenu {
  /** Identificativo locale dell'editor: non va al server. */
  id: string;
  pathname: string;
  titolo: string;
  icona: string | null;
  disabilitato: boolean;
  /** Pagina iniziale: al più una voce del menu. */
  iniziale: boolean;
  /** Sottovoci salvate: si conservano come sono, l'editor non ne crea. */
  subMenu?: MenuItemDTO[];
}

/** Gruppo di voci di un'area; titolo vuoto = gruppo senza intestazione. */
export interface GruppoMenu {
  id: string;
  titolo: string;
  voci: VoceMenu[];
}

export interface AreaMenu {
  sezione: SezionePagina;
  gruppi: GruppoMenu[];
}

/** Il menu nell'editor: le aree con almeno un gruppo, nell'ordine di SEZIONI. */
export interface ModelloMenu {
  aree: AreaMenu[];
}

/** Voce salvata che l'editor non tiene: verrà tolta al salvataggio. */
export interface VoceScartata {
  titolo: string;
  pathname: string | null;
  motivo: 'senza-pagina' | 'doppione';
}

export interface LetturaMenu {
  modello: ModelloMenu;
  scartate: VoceScartata[];
}

export interface Destinazione {
  gruppoId: string;
  /** Posizione nel gruppo, contata sulle voci come si vedono (prima dello spostamento). */
  indice: number;
}

export const MODELLO_VUOTO: ModelloMenu = { aree: [] };

/** Tipi del trascinamento (react-dnd): una pagina del catalogo, una voce o il titolo di un gruppo. */
export const TRASCINA_PAGINA = 'menu-pagina';
export const TRASCINA_VOCE = 'menu-voce';
export const TRASCINA_TITOLO = 'menu-titolo';
export type PaginaTrascinata = { percorso: string; sezione: SezionePagina };
export type VoceTrascinata = { voceId: string; sezione: SezionePagina; percorso: string };
export type TitoloTrascinato = { gruppoId: string; sezione: SezionePagina };

/* =======================
   CATALOGO DELLE PAGINE
   ======================= */

/** Pagina che si può mettere nel menu, con la sua area predefinita (quella del catalogo). */
export interface PaginaCatalogo extends VoceDiMenu {
  sezione: SezionePagina;
}

export const PAGINE_CATALOGO: readonly PaginaCatalogo[] = VOCI_DI_MENU.flatMap((voce) => {
  const sezione = sezioneDiPercorso(voce.percorso);
  return sezione ? [{ ...voce, sezione }] : [];
});

/* =======================
   UTILITÀ
   ======================= */

let progressivo = 0;
const nuovoId = (prefisso: 'v' | 'g'): string => {
  progressivo += 1;
  return `${prefisso}${progressivo}`;
};

const ORDINE_SEZIONI: SezionePagina[] = SEZIONI.map((s) => s.sezione);
const ordinaAree = (aree: readonly AreaMenu[]): AreaMenu[] =>
  [...aree].sort((a, b) => ORDINE_SEZIONI.indexOf(a.sezione) - ORDINE_SEZIONI.indexOf(b.sezione));

const clona = (modello: ModelloMenu): ModelloMenu => JSON.parse(JSON.stringify(modello)) as ModelloMenu;

const limita = (valore: number, minimo: number, massimo: number) => Math.min(Math.max(valore, minimo), massimo);

type PosizioneVoce = { area: AreaMenu; gruppo: GruppoMenu; indiceGruppo: number; indice: number };
type PosizioneGruppo = { area: AreaMenu; gruppo: GruppoMenu; indiceGruppo: number };

export const trovaVoce = (modello: ModelloMenu, voceId: string): PosizioneVoce | undefined => {
  for (const area of modello.aree) {
    for (let indiceGruppo = 0; indiceGruppo < area.gruppi.length; indiceGruppo++) {
      const gruppo = area.gruppi[indiceGruppo];
      const indice = gruppo.voci.findIndex((v) => v.id === voceId);
      if (indice >= 0) return { area, gruppo, indiceGruppo, indice };
    }
  }
  return undefined;
};

export const trovaGruppo = (modello: ModelloMenu, gruppoId: string): PosizioneGruppo | undefined => {
  for (const area of modello.aree) {
    const indiceGruppo = area.gruppi.findIndex((g) => g.id === gruppoId);
    if (indiceGruppo >= 0) return { area, gruppo: area.gruppi[indiceGruppo], indiceGruppo };
  }
  return undefined;
};

/** Tutte le voci, area per area e gruppo per gruppo. */
export const vociDelModello = (modello: ModelloMenu): VoceMenu[] =>
  ordinaAree(modello.aree).flatMap((area) => area.gruppi.flatMap((gruppo) => gruppo.voci));

/** Per ogni pagina già nel menu (percorso normalizzato), le aree in cui compare, nell'ordine di SEZIONI. */
export const areeDellePagine = (modello: ModelloMenu): Map<string, SezionePagina[]> => {
  const aree = new Map<string, SezionePagina[]>();
  for (const area of ordinaAree(modello.aree)) {
    for (const voce of area.gruppi.flatMap((g) => g.voci)) {
      const percorso = normalizzaPercorso(voce.pathname);
      const giaViste = aree.get(percorso) ?? [];
      if (!giaViste.includes(area.sezione)) aree.set(percorso, [...giaViste, area.sezione]);
    }
  }
  return aree;
};

/** Vero se l'area contiene già una voce della pagina (esclusa, se indicata, la voce `tranne`). */
const areaHaPagina = (area: AreaMenu | undefined, percorso: string, tranne?: string): boolean =>
  !!area &&
  area.gruppi.some((g) => g.voci.some((v) => v.id !== tranne && normalizzaPercorso(v.pathname) === normalizzaPercorso(percorso)));

/**
 * Vero se l'oggetto trascinato non si può lasciare nell'area perché l'area ha già la sua pagina.
 * Una voce si può sempre riordinare nella sua area.
 */
export const rilascioVietato = (area: AreaMenu, oggetto: PaginaTrascinata | VoceTrascinata): boolean =>
  'voceId' in oggetto
    ? oggetto.sezione !== area.sezione && areaHaPagina(area, oggetto.percorso, oggetto.voceId)
    : areaHaPagina(area, oggetto.percorso);

/** Le aree in cui l'editor accetta voci: tutte tranne Account, che raccoglie pagine fuori dal menu. */
export const AREE_EDITOR: readonly SezionePagina[] = ORDINE_SEZIONI.filter((sezione) => sezione !== 'account');

/**
 * Le aree da mostrare nell'editor: sempre tutte quelle di AREE_EDITOR, anche senza gruppi, così
 * una pagina si può mettere anche in un'area ancora vuota; Account solo se il menu ne ha.
 */
export const areeDaMostrare = (modello: ModelloMenu): AreaMenu[] =>
  ORDINE_SEZIONI.flatMap((sezione) => {
    const area = modello.aree.find((a) => a.sezione === sezione);
    if (area) return [area];
    return AREE_EDITOR.includes(sezione) ? [{ sezione, gruppi: [] }] : [];
  });

/** L'area del modello, creata in ordine se manca. */
const areaDi = (modello: ModelloMenu, sezione: SezionePagina): AreaMenu => {
  let area = modello.aree.find((a) => a.sezione === sezione);
  if (!area) {
    area = { sezione, gruppi: [] };
    modello.aree = ordinaAree([...modello.aree, area]);
  }
  return area;
};

export const contaVoci = (area: AreaMenu): number => area.gruppi.reduce((n, g) => n + g.voci.length, 0);

/* =======================
   LETTURA E SALVATAGGIO
   ======================= */

/**
 * Dal menu salvato al modello per area. Ogni voce va nell'area salvata con lei o, se non ce l'ha,
 * in quella della sua pagina; un separatore apre un gruppo, e un gruppo con voci di aree diverse
 * diventa un gruppo per ciascuna area, con lo stesso titolo. Le voci prima del primo separatore
 * stanno in un gruppo senza titolo. Un separatore senza titolo non apre un gruppo: nel menu
 * dell'utente non compare. Le voci senza pagina e i doppioni di una pagina già letta nella stessa
 * area non entrano nel modello: tornano in `scartate`. Resta pagina iniziale solo la prima voce segnata.
 */
export const leggiMenu = (voci: readonly MenuItemDTO[]): LetturaMenu => {
  const ordinate = [...voci].sort((a, b) => (a.ordinamento ?? 0) - (b.ordinamento ?? 0));
  const aree = new Map<SezionePagina, AreaMenu>();
  const gruppi = new Map<string, GruppoMenu>();
  const presenti = new Set<string>();
  const scartate: VoceScartata[] = [];
  let gruppoLetto = { numero: 0, titolo: '' };
  let inizialeTrovata = false;

  for (const dto of ordinate) {
    if (dto.tipo === 'separator') {
      const titolo = (dto.titolo ?? '').trim();
      if (titolo) gruppoLetto = { numero: gruppoLetto.numero + 1, titolo };
      continue;
    }
    const pathname = dto.pathname ?? '';
    const predefinita = pathname ? sezioneDiPercorso(pathname) : undefined;
    if (!predefinita) {
      scartate.push({ titolo: dto.titolo ?? '', pathname: dto.pathname ?? null, motivo: 'senza-pagina' });
      continue;
    }
    const sezione = eSezionePagina(dto.sezione) ? dto.sezione : predefinita;
    const presente = `${sezione}|${normalizzaPercorso(pathname)}`;
    if (presenti.has(presente)) {
      scartate.push({ titolo: dto.titolo ?? '', pathname, motivo: 'doppione' });
      continue;
    }
    presenti.add(presente);

    let area = aree.get(sezione);
    if (!area) {
      area = { sezione, gruppi: [] };
      aree.set(sezione, area);
    }
    const chiave = `${sezione}|${gruppoLetto.numero}`;
    let gruppo = gruppi.get(chiave);
    if (!gruppo) {
      gruppo = { id: nuovoId('g'), titolo: gruppoLetto.titolo, voci: [] };
      gruppi.set(chiave, gruppo);
      area.gruppi.push(gruppo);
    }
    const iniziale = !!dto.start_page && !inizialeTrovata;
    if (iniziale) inizialeTrovata = true;
    gruppo.voci.push({
      id: nuovoId('v'),
      pathname,
      titolo: dto.titolo ?? '',
      icona: dto.icona ?? null,
      disabilitato: !!dto.disabilitato,
      iniziale,
      ...(dto.subMenu && dto.subMenu.length > 0 ? { subMenu: dto.subMenu } : {}),
    });
  }

  return { modello: { aree: ordinaAree([...aree.values()]) }, scartate };
};

/** Il titolo con cui si salva una voce: una voce senza titolo non comparirebbe nel menu. */
export const titoloDaSalvare = (voce: VoceMenu): string =>
  voce.titolo.trim() || voceDiMenuPer(voce.pathname)?.titolo || voce.pathname;

/**
 * Dal modello al menu da salvare: area per area nell'ordine di SEZIONI, gruppo per gruppo. Un gruppo
 * con titolo apre con il suo separatore, uno senza titolo è solo una sequenza di voci; i gruppi vuoti
 * non si salvano. `ordinamento` è progressivo; le sottovoci restano come sono. Una voce porta
 * `sezione` solo se sta in un'area diversa da quella della sua pagina nel catalogo.
 */
export const serializzaMenu = (modello: ModelloMenu, tipoUtente: string): MenuItemDTO[] => {
  const risultato: MenuItemDTO[] = [];
  for (const area of ordinaAree(modello.aree)) {
    for (const gruppo of area.gruppi) {
      if (gruppo.voci.length === 0) continue;
      const titolo = gruppo.titolo.trim();
      if (titolo) {
        risultato.push({ tipo_utente: tipoUtente, tipo: 'separator', titolo, ordinamento: risultato.length });
      }
      for (const voce of gruppo.voci) {
        const altraArea = sezioneDiPercorso(voce.pathname) !== area.sezione;
        risultato.push({
          tipo_utente: tipoUtente,
          tipo: 'item',
          titolo: titoloDaSalvare(voce),
          icona: voce.icona,
          pathname: voce.pathname,
          ...(altraArea ? { sezione: area.sezione } : {}),
          disabilitato: voce.disabilitato,
          start_page: voce.iniziale,
          ordinamento: risultato.length,
          ...(voce.subMenu ? { subMenu: voce.subMenu } : {}),
        });
      }
    }
  }
  return risultato;
};

/** Impronta del menu così come verrebbe salvato: due modelli uguali per il server hanno la stessa. */
export const firmaMenu = (modello: ModelloMenu): string => JSON.stringify(serializzaMenu(modello, ''));

/**
 * Il titolo che un gruppo senza titolo mostra davvero nel menu: senza un separatore proprio, le sue
 * voci seguono il gruppo con titolo che le precede nel menu salvato, anche se di un'altra area.
 * Solo i gruppi senza titolo che ne ereditano uno compaiono nella mappa.
 */
export const titoliEreditati = (modello: ModelloMenu): Map<string, string> => {
  const ereditati = new Map<string, string>();
  let ultimo = '';
  for (const area of ordinaAree(modello.aree)) {
    for (const gruppo of area.gruppi) {
      const titolo = gruppo.titolo.trim();
      if (!titolo && ultimo) ereditati.set(gruppo.id, ultimo);
      if (titolo && gruppo.voci.length > 0) ultimo = titolo;
    }
  }
  return ereditati;
};

/* =======================
   MODIFICHE
   ======================= */

export type EsitoInserimento =
  | { esito: 'aggiunta'; modello: ModelloMenu; voceId: string; sezione: SezionePagina }
  | { esito: 'gia-presente'; modello: ModelloMenu; sezione: SezionePagina }
  | { esito: 'non-pagina'; modello: ModelloMenu };

/**
 * Mette una pagina nel menu. Lasciata in un gruppo va nel punto indicato, qualunque sia l'area del
 * gruppo; senza destinazione va in fondo alla sua area predefinita (creata con un gruppo senza
 * titolo se manca). Una pagina già presente nell'area di arrivo non si aggiunge di nuovo.
 */
export const inserisciPagina = (modello: ModelloMenu, percorso: string, destinazione?: Destinazione): EsitoInserimento => {
  const predefinita = sezioneDiPercorso(percorso);
  if (!predefinita) return { esito: 'non-pagina', modello };
  const dove = destinazione ? trovaGruppo(modello, destinazione.gruppoId) : undefined;
  const sezione = dove?.area.sezione ?? predefinita;
  if (areaHaPagina(modello.aree.find((a) => a.sezione === sezione), percorso)) {
    return { esito: 'gia-presente', modello, sezione };
  }

  const proposta = voceDiMenuPer(percorso);
  const voce: VoceMenu = {
    id: nuovoId('v'),
    pathname: proposta?.percorso ?? normalizzaPercorso(percorso),
    titolo: proposta?.titolo ?? '',
    icona: proposta?.icona ?? null,
    disabilitato: false,
    iniziale: false,
  };

  const nuovo = clona(modello);
  const arrivo = destinazione ? trovaGruppo(nuovo, destinazione.gruppoId) : undefined;
  if (arrivo && destinazione) {
    arrivo.gruppo.voci.splice(limita(destinazione.indice, 0, arrivo.gruppo.voci.length), 0, voce);
    return { esito: 'aggiunta', modello: nuovo, voceId: voce.id, sezione };
  }

  const area = areaDi(nuovo, sezione);
  if (area.gruppi.length === 0) area.gruppi.push({ id: nuovoId('g'), titolo: '', voci: [] });
  area.gruppi[area.gruppi.length - 1].voci.push(voce);
  return { esito: 'aggiunta', modello: nuovo, voceId: voce.id, sezione };
};

export type EsitoSpostamento =
  | { esito: 'spostata' | 'invariata'; modello: ModelloMenu }
  | { esito: 'gia-presente'; modello: ModelloMenu; sezione: SezionePagina };

/** Sposta una voce in un gruppo di qualunque area, se quell'area non ha già la stessa pagina. */
export const spostaVoce = (modello: ModelloMenu, voceId: string, destinazione: Destinazione): EsitoSpostamento => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  const a = trovaGruppo(nuovo, destinazione.gruppoId);
  if (!da || !a) return { esito: 'invariata', modello };
  if (a.area !== da.area && areaHaPagina(a.area, da.gruppo.voci[da.indice].pathname, voceId)) {
    return { esito: 'gia-presente', modello, sezione: a.area.sezione };
  }

  const [voce] = da.gruppo.voci.splice(da.indice, 1);
  let indice = destinazione.indice;
  if (a.gruppo === da.gruppo && da.indice < indice) indice -= 1;
  a.gruppo.voci.splice(limita(indice, 0, a.gruppo.voci.length), 0, voce);
  return { esito: 'spostata', modello: nuovo };
};

export type EsitoTastiera =
  | { esito: 'spostata' | 'prima' | 'ultima' | 'invariata'; modello: ModelloMenu }
  | { esito: 'gia-presente'; modello: ModelloMenu; sezione: SezionePagina };

/**
 * Sposta una voce di un posto verso l'alto (-1) o il basso (1): in cima o in fondo a un gruppo passa
 * al gruppo precedente o successivo; in cima o in fondo all'area passa in fondo all'area precedente
 * o in cima alla successiva, fra quelle dell'editor (areeDaMostrare), anche vuota. 'gia-presente':
 * l'area vicina ha già la stessa pagina. 'prima' e 'ultima': non può andare oltre.
 */
export const spostaConTastiera = (modello: ModelloMenu, voceId: string, direzione: -1 | 1): EsitoTastiera => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  if (!da) return { esito: 'invariata', modello };
  const { area, gruppo, indiceGruppo, indice } = da;

  if (direzione === -1 && indice > 0) {
    const [voce] = gruppo.voci.splice(indice, 1);
    gruppo.voci.splice(indice - 1, 0, voce);
  } else if (direzione === -1 && indiceGruppo > 0) {
    const [voce] = gruppo.voci.splice(indice, 1);
    area.gruppi[indiceGruppo - 1].voci.push(voce);
  } else if (direzione === 1 && indice < gruppo.voci.length - 1) {
    const [voce] = gruppo.voci.splice(indice, 1);
    gruppo.voci.splice(indice + 1, 0, voce);
  } else if (direzione === 1 && indiceGruppo < area.gruppi.length - 1) {
    const [voce] = gruppo.voci.splice(indice, 1);
    area.gruppi[indiceGruppo + 1].voci.unshift(voce);
  } else {
    const ordine = areeDaMostrare(nuovo).map((a) => a.sezione);
    const vicina = ordine[ordine.indexOf(area.sezione) + direzione];
    if (!vicina) return { esito: direzione === -1 ? 'prima' : 'ultima', modello };
    const pathname = gruppo.voci[indice].pathname;
    if (areaHaPagina(nuovo.aree.find((a) => a.sezione === vicina), pathname)) {
      return { esito: 'gia-presente', modello, sezione: vicina };
    }
    const [voce] = gruppo.voci.splice(indice, 1);
    const arrivo = areaDi(nuovo, vicina);
    if (arrivo.gruppi.length === 0) arrivo.gruppi.push({ id: nuovoId('g'), titolo: '', voci: [] });
    if (direzione === -1) arrivo.gruppi[arrivo.gruppi.length - 1].voci.push(voce);
    else arrivo.gruppi[0].voci.unshift(voce);
  }
  return { esito: 'spostata', modello: nuovo };
};

/* =======================
   TITOLI DEI GRUPPI
   ======================= */

/**
 * Toglie il titolo di un gruppo dalla sua posizione: le sue voci passano in fondo al gruppo che lo
 * precede nell'area o, se è il primo, restano in un gruppo senza titolo al suo posto. Restituisce
 * il gruppo che le ha accolte e da quale posizione ci stanno. Lavora sul modello passato.
 */
const staccaTitolo = (area: AreaMenu, indiceGruppo: number): { ospite: GruppoMenu; inizio: number } => {
  const [gruppo] = area.gruppi.splice(indiceGruppo, 1);
  if (indiceGruppo > 0) {
    const ospite = area.gruppi[indiceGruppo - 1];
    const inizio = ospite.voci.length;
    ospite.voci.push(...gruppo.voci);
    return { ospite, inizio };
  }
  const ospite: GruppoMenu = { id: nuovoId('g'), titolo: '', voci: gruppo.voci };
  area.gruppi.splice(0, 0, ospite);
  return { ospite, inizio: 0 };
};

/**
 * Rimette il titolo davanti alla voce `indice` del gruppo `arrivo` (in fondo, con indice pari alle
 * sue voci): le voci da lì in poi passano al gruppo del titolo, che conserva id e titolo. Il gruppo
 * di arrivo e quello che ha accolto le voci (`ospite`), se restano vuoti e senza titolo, spariscono;
 * un gruppo con titolo rimasto vuoto resta, come un gruppo appena creato.
 */
const rimettiTitolo = (modello: ModelloMenu, titolo: GruppoMenu, arrivo: GruppoMenu, indice: number, ospite: GruppoMenu) => {
  const dove = trovaGruppo(modello, arrivo.id);
  if (!dove) return;
  const voci = arrivo.voci.splice(limita(indice, 0, arrivo.voci.length));
  dove.area.gruppi.splice(dove.indiceGruppo + 1, 0, { id: titolo.id, titolo: titolo.titolo, voci });
  const superfluo = (g: GruppoMenu) => (g === arrivo || g === ospite) && !g.titolo.trim() && g.voci.length === 0;
  for (const area of modello.aree) area.gruppi = area.gruppi.filter((g) => !superfluo(g));
  modello.aree = modello.aree.filter((a) => a.gruppi.length > 0);
};

export type EsitoTitolo = { esito: 'spostato' | 'prima' | 'ultima' | 'invariato'; modello: ModelloMenu };

/**
 * Sposta il titolo di un gruppo davanti alla voce `destinazione.indice` del gruppo indicato, anche in
 * un'altra area: il titolo fa da separatore. Le voci che lo seguono, fino al titolo successivo,
 * entrano nel suo gruppo; quelle che lascia restano al loro posto, sotto il titolo che ora le
 * precede. Le voci non cambiano area. Un gruppo senza titolo non ha un titolo da spostare.
 */
export const spostaTitolo = (modello: ModelloMenu, gruppoId: string, destinazione: Destinazione): EsitoTitolo => {
  const nuovo = clona(modello);
  const da = trovaGruppo(nuovo, gruppoId);
  const a = trovaGruppo(nuovo, destinazione.gruppoId);
  if (!da || !a || !da.gruppo.titolo.trim()) return { esito: 'invariato', modello };
  if (a.gruppo === da.gruppo && destinazione.indice <= 0) return { esito: 'invariato', modello };

  const titolo = da.gruppo;
  const { ospite, inizio } = staccaTitolo(da.area, da.indiceGruppo);
  // Dentro il proprio gruppo la posizione si conta da dove le sue voci sono finite
  const nelSuo = a.gruppo === titolo;
  const arrivo = nelSuo ? ospite : a.gruppo;
  const indice = nelSuo ? inizio + destinazione.indice : destinazione.indice;
  rimettiTitolo(nuovo, titolo, arrivo, indice, ospite);
  return { esito: 'spostato', modello: nuovo };
};

/**
 * Sposta il titolo di un gruppo di una voce verso l'alto (-1) o il basso (1), dentro la sua area:
 * scendendo lascia la sua prima voce al gruppo precedente, salendo prende l'ultima voce che lo
 * precede. I titoli e i gruppi vuoti che incontra non contano. 'prima' e 'ultima': è già in cima
 * o in fondo all'area.
 */
export const spostaTitoloConTastiera = (modello: ModelloMenu, gruppoId: string, direzione: -1 | 1): EsitoTitolo => {
  const nuovo = clona(modello);
  const da = trovaGruppo(nuovo, gruppoId);
  if (!da || !da.gruppo.titolo.trim()) return { esito: 'invariato', modello };

  const prima = da.area.gruppi.slice(0, da.indiceGruppo).reduce((n, g) => n + g.voci.length, 0);
  const totale = da.area.gruppi.reduce((n, g) => n + g.voci.length, 0);
  const posizione = prima + direzione;
  if (posizione < 0) return { esito: 'prima', modello };
  if (posizione > totale) return { esito: 'ultima', modello };

  const titolo = da.gruppo;
  const { ospite } = staccaTitolo(da.area, da.indiceGruppo);
  // La posizione conta le voci dell'area; al confine fra due gruppi il titolo va in cima al secondo
  let contate = 0;
  for (let i = 0; i < da.area.gruppi.length; i++) {
    const gruppo = da.area.gruppi[i];
    const ultimo = i === da.area.gruppi.length - 1;
    if (posizione < contate + gruppo.voci.length || (posizione === contate + gruppo.voci.length && ultimo)) {
      rimettiTitolo(nuovo, titolo, gruppo, posizione - contate, ospite);
      return { esito: 'spostato', modello: nuovo };
    }
    contate += gruppo.voci.length;
  }
  return { esito: 'invariato', modello };
};

/** La voce che prende il posto di quella tolta (la successiva nell'area, se no la precedente). */
export const vicinaDi = (modello: ModelloMenu, voceId: string): string | undefined => {
  const da = trovaVoce(modello, voceId);
  if (!da) return undefined;
  const voci = da.area.gruppi.flatMap((g) => g.voci);
  const posizione = voci.findIndex((v) => v.id === voceId);
  return (voci[posizione + 1] ?? voci[posizione - 1])?.id;
};

export const togliVoce = (modello: ModelloMenu, voceId: string): ModelloMenu => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  if (!da) return modello;
  da.gruppo.voci.splice(da.indice, 1);
  return nuovo;
};

export const aggiornaVoce = (
  modello: ModelloMenu,
  voceId: string,
  modifiche: Partial<Pick<VoceMenu, 'titolo' | 'disabilitato'>>
): ModelloMenu => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  if (!da) return modello;
  Object.assign(da.gruppo.voci[da.indice], modifiche);
  return nuovo;
};

/** Rende la voce pagina iniziale, togliendo il segno alle altre; sulla voce già segnata lo toglie. */
export const impostaPaginaIniziale = (modello: ModelloMenu, voceId: string): ModelloMenu => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  if (!da) return modello;
  const eraIniziale = da.gruppo.voci[da.indice].iniziale;
  for (const voce of vociDelModello(nuovo)) voce.iniziale = false;
  da.gruppo.voci[da.indice].iniziale = !eraIniziale;
  return nuovo;
};

export const aggiungiGruppo = (modello: ModelloMenu, sezione: SezionePagina): { modello: ModelloMenu; gruppoId: string } => {
  const nuovo = clona(modello);
  const area = areaDi(nuovo, sezione);
  const gruppo: GruppoMenu = { id: nuovoId('g'), titolo: '', voci: [] };
  area.gruppi.push(gruppo);
  return { modello: nuovo, gruppoId: gruppo.id };
};

/** I titoli dei gruppi sono in maiuscolo, come nel menu. */
export const rinominaGruppo = (modello: ModelloMenu, gruppoId: string, titolo: string): ModelloMenu => {
  const nuovo = clona(modello);
  const dove = trovaGruppo(nuovo, gruppoId);
  if (!dove) return modello;
  dove.gruppo.titolo = titolo.toUpperCase();
  return nuovo;
};

/** Toglie un gruppo vuoto; un'area senza più gruppi esce dal modello (l'editor la mostra vuota). */
export const togliGruppo = (modello: ModelloMenu, gruppoId: string): ModelloMenu => {
  const nuovo = clona(modello);
  const dove = trovaGruppo(nuovo, gruppoId);
  if (!dove || dove.gruppo.voci.length > 0) return modello;
  dove.area.gruppi.splice(dove.indiceGruppo, 1);
  nuovo.aree = nuovo.aree.filter((a) => a.gruppi.length > 0);
  return nuovo;
};

/* =======================
   ANTEPRIMA
   ======================= */

/** Chi può aprire cosa: senza permessi noti (null) l'anteprima non filtra. */
export const aperturaConsentita = (permessi: ReadonlySet<string> | null, superadmin: boolean) =>
  (percorso: string): boolean =>
    superadmin || permessi === null ? true : puoAprirePagina(percorso, (codice) => permessi.has(codice));

const voceDaDto = (dto: MenuItemDTO): MenuItem => ({
  icon: dto.icona || 'Circle',
  title: dto.titolo,
  pathname: dto.pathname || undefined,
  disabled: dto.disabilitato || undefined,
  start_page: dto.start_page || undefined,
  ...(eSezionePagina(dto.sezione) ? { area: dto.sezione } : {}),
  subMenu: (dto.subMenu ?? []).map(voceDaDto),
});

/** Il menu salvato come lo legge il menu laterale: i gruppi con titolo diventano intestazioni. */
const elementiDaDto = (voci: readonly MenuItemDTO[]): MenuElement[] =>
  voci.map((dto) => (dto.tipo === 'separator' ? dto.titolo : voceDaDto(dto)));

/** Come filtraMenu del server: solo le pagine consentite, intestazioni solo sopra una voce. */
const filtraElementi = (menu: readonly MenuElement[], puoAprire: (percorso: string) => boolean): MenuElement[] => {
  const voci: MenuElement[] = [];
  for (const elemento of menu) {
    if (eSezioneMenu(elemento)) continue;
    if (typeof elemento === 'string') {
      voci.push(elemento);
      continue;
    }
    const sottovoci = Array.isArray(elemento.subMenu) ? (filtraElementi(elemento.subMenu, puoAprire) as MenuItem[]) : [];
    const consentita = elemento.pathname ? puoAprire(elemento.pathname) : sottovoci.length > 0;
    if (!consentita) continue;
    voci.push({ ...elemento, subMenu: sottovoci });
  }
  return voci.filter((elemento, i) => {
    if (typeof elemento !== 'string') return true;
    const successivo = voci[i + 1];
    return successivo !== undefined && typeof successivo !== 'string';
  });
};

const vociInOrdine = (menu: readonly MenuElement[]): MenuItem[] =>
  menu.flatMap((voce) =>
    typeof voce === 'string' || eSezioneMenu(voce) ? [] : [voce, ...(Array.isArray(voce.subMenu) ? vociInOrdine(voce.subMenu) : [])]
  );

/** Come il server: resta segnata come pagina iniziale solo la prima voce attiva con quel percorso. */
const segnaPaginaIniziale = (menu: readonly MenuElement[], percorso: string | null): MenuElement[] => {
  let segnata = false;
  const segna = (voci: readonly MenuElement[]): MenuElement[] =>
    voci.map((voce) => {
      if (typeof voce === 'string' || eSezioneMenu(voce)) return voce;
      const iniziale = !segnata && percorso !== null && voce.pathname === percorso && !voce.disabled;
      if (iniziale) segnata = true;
      const { start_page: _precedente, ...resto } = voce;
      const subMenu = Array.isArray(voce.subMenu) ? (segna(voce.subMenu) as MenuItem[]) : voce.subMenu;
      return { ...resto, ...(iniziale ? { start_page: true } : {}), subMenu };
    });
  return segna(menu);
};

export interface Anteprima {
  /** Il menu del ruolo diviso in sezioni, pronto per il menu laterale. */
  elementi: MenuElement[];
  /** Pagina con cui il ruolo entra: la voce segnata se consentita e attiva, se no la prima. */
  paginaIniziale: string | null;
  titoloIniziale: string | null;
  /** Voci del modello che il ruolo non può aprire. */
  nascoste: number;
}

/** Il menu come lo vedrà il ruolo, con le modifiche non salvate: come lo costruisce il server per /menu/me. */
export const anteprimaMenu = (modello: ModelloMenu, puoAprire: (percorso: string) => boolean): Anteprima => {
  const consentiti = filtraElementi(
    elementiDaDto(serializzaMenu(modello, '')),
    (percorso) => puoAprire(percorso) && sezioneDiPercorso(percorso) !== undefined
  );
  const navigabili = vociInOrdine(consentiti).filter((voce) => voce.pathname && !voce.disabled);
  const iniziale = navigabili.find((voce) => voce.start_page) ?? navigabili[0];
  return {
    elementi: segnaPaginaIniziale(sezionaMenu(consentiti, sezioneDiPercorso), iniziale?.pathname ?? null),
    paginaIniziale: iniziale?.pathname ?? null,
    titoloIniziale: iniziale?.title ?? null,
    nascoste: vociDelModello(modello).filter((voce) => !puoAprire(voce.pathname)).length,
  };
};
