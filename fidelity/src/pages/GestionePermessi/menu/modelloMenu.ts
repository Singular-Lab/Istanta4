import {
  normalizzaPercorso,
  puoAprirePagina,
  sezioneDiPercorso,
  voceDiMenuPer,
  VOCI_DI_MENU,
  type VoceDiMenu,
} from '../../../../lib/accessi/pagine';
import { eSezioneMenu, SEZIONI, sezionaMenu, type SezionePagina } from '../../../../lib/accessi/sezioni';
import type { MenuElement, MenuItem } from '../../../../lib/types';

/**
 * Logica dell'editor del menu, senza React.
 *
 * Il server salva il menu come elenco piatto (GET e PUT /menu/:tipo): separatori con il titolo di un
 * gruppo e voci con il percorso di una pagina. L'editor lo mostra per area: ogni voce sta nell'area
 * della pagina che apre (lib/accessi/sezioni.ts), dentro i gruppi; al salvataggio torna piatto,
 * area per area nell'ordine di SEZIONI.
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

/** Il menu nell'editor: le aree presenti, nell'ordine di SEZIONI. */
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

/** Tipi del trascinamento (react-dnd): una pagina del catalogo o una voce del menu. */
export const TRASCINA_PAGINA = 'menu-pagina';
export const TRASCINA_VOCE = 'menu-voce';
export type PaginaTrascinata = { percorso: string; sezione: SezionePagina };
export type VoceTrascinata = { voceId: string; sezione: SezionePagina };

/* =======================
   CATALOGO DELLE PAGINE
   ======================= */

/** Pagina che si può mettere nel menu, con la sua area. */
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

/** I percorsi (normalizzati) delle pagine già nel menu. */
export const percorsiNelMenu = (modello: ModelloMenu): Set<string> =>
  new Set(vociDelModello(modello).map((v) => normalizzaPercorso(v.pathname)));

export const contaVoci = (area: AreaMenu): number => area.gruppi.reduce((n, g) => n + g.voci.length, 0);

/* =======================
   LETTURA E SALVATAGGIO
   ======================= */

/**
 * Dal menu salvato al modello per area. Ogni voce va nell'area della sua pagina; un separatore apre
 * un gruppo, e un gruppo con voci di aree diverse diventa un gruppo per ciascuna area, con lo stesso
 * titolo. Le voci prima del primo separatore stanno in un gruppo senza titolo. Un separatore senza
 * titolo non apre un gruppo: nel menu dell'utente non compare. Le voci senza pagina e i doppioni di
 * una pagina già letta non entrano nel modello: tornano in `scartate`. Resta pagina iniziale solo la
 * prima voce segnata.
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
    const sezione = pathname ? sezioneDiPercorso(pathname) : undefined;
    if (!sezione) {
      scartate.push({ titolo: dto.titolo ?? '', pathname: dto.pathname ?? null, motivo: 'senza-pagina' });
      continue;
    }
    const percorso = normalizzaPercorso(pathname);
    if (presenti.has(percorso)) {
      scartate.push({ titolo: dto.titolo ?? '', pathname, motivo: 'doppione' });
      continue;
    }
    presenti.add(percorso);

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
 * non si salvano. `ordinamento` è progressivo; le sottovoci restano come sono.
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
        risultato.push({
          tipo_utente: tipoUtente,
          tipo: 'item',
          titolo: titoloDaSalvare(voce),
          icona: voce.icona,
          pathname: voce.pathname,
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
  | { esito: 'aggiunta'; modello: ModelloMenu; voceId: string; sezione: SezionePagina; altraArea: boolean }
  | { esito: 'gia-presente' | 'non-pagina'; modello: ModelloMenu };

/**
 * Mette una pagina nel menu. Lasciata in un gruppo della sua area va nel punto indicato; senza
 * destinazione, o lasciata in un'altra area, va in fondo alla sua area (creata con un gruppo senza
 * titolo se manca) e `altraArea` lo segnala. Una pagina già nel menu non si aggiunge di nuovo.
 */
export const inserisciPagina = (modello: ModelloMenu, percorso: string, destinazione?: Destinazione): EsitoInserimento => {
  const sezione = sezioneDiPercorso(percorso);
  if (!sezione) return { esito: 'non-pagina', modello };
  if (percorsiNelMenu(modello).has(normalizzaPercorso(percorso))) return { esito: 'gia-presente', modello };

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
  const dove = destinazione ? trovaGruppo(nuovo, destinazione.gruppoId) : undefined;
  if (dove && destinazione && dove.area.sezione === sezione) {
    dove.gruppo.voci.splice(limita(destinazione.indice, 0, dove.gruppo.voci.length), 0, voce);
    return { esito: 'aggiunta', modello: nuovo, voceId: voce.id, sezione, altraArea: false };
  }

  let area = nuovo.aree.find((a) => a.sezione === sezione);
  if (!area) {
    area = { sezione, gruppi: [] };
    nuovo.aree = ordinaAree([...nuovo.aree, area]);
  }
  if (area.gruppi.length === 0) area.gruppi.push({ id: nuovoId('g'), titolo: '', voci: [] });
  area.gruppi[area.gruppi.length - 1].voci.push(voce);
  return { esito: 'aggiunta', modello: nuovo, voceId: voce.id, sezione, altraArea: !!dove };
};

export type EsitoSpostamento = { esito: 'spostata' | 'altra-area' | 'invariata'; modello: ModelloMenu };

/** Sposta una voce in un gruppo della stessa area; un'altra area non si accetta. */
export const spostaVoce = (modello: ModelloMenu, voceId: string, destinazione: Destinazione): EsitoSpostamento => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  const a = trovaGruppo(nuovo, destinazione.gruppoId);
  if (!da || !a) return { esito: 'invariata', modello };
  if (a.area.sezione !== da.area.sezione) return { esito: 'altra-area', modello };

  const [voce] = da.gruppo.voci.splice(da.indice, 1);
  let indice = destinazione.indice;
  if (a.gruppo === da.gruppo && da.indice < indice) indice -= 1;
  a.gruppo.voci.splice(limita(indice, 0, a.gruppo.voci.length), 0, voce);
  return { esito: 'spostata', modello: nuovo };
};

export type EsitoTastiera = { esito: 'spostata' | 'prima' | 'ultima' | 'invariata'; modello: ModelloMenu };

/**
 * Sposta una voce di un posto verso l'alto (-1) o il basso (1) dentro la sua area: in cima o in fondo
 * a un gruppo passa al gruppo precedente o successivo. 'prima' e 'ultima': non può andare oltre.
 */
export const spostaConTastiera = (modello: ModelloMenu, voceId: string, direzione: -1 | 1): EsitoTastiera => {
  const nuovo = clona(modello);
  const da = trovaVoce(nuovo, voceId);
  if (!da) return { esito: 'invariata', modello };
  const { area, gruppo, indiceGruppo, indice } = da;

  if (direzione === -1) {
    if (indice > 0) {
      const [voce] = gruppo.voci.splice(indice, 1);
      gruppo.voci.splice(indice - 1, 0, voce);
    } else if (indiceGruppo > 0) {
      const [voce] = gruppo.voci.splice(indice, 1);
      area.gruppi[indiceGruppo - 1].voci.push(voce);
    } else {
      return { esito: 'prima', modello };
    }
  } else if (indice < gruppo.voci.length - 1) {
    const [voce] = gruppo.voci.splice(indice, 1);
    gruppo.voci.splice(indice + 1, 0, voce);
  } else if (indiceGruppo < area.gruppi.length - 1) {
    const [voce] = gruppo.voci.splice(indice, 1);
    area.gruppi[indiceGruppo + 1].voci.unshift(voce);
  } else {
    return { esito: 'ultima', modello };
  }
  return { esito: 'spostata', modello: nuovo };
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
  let area = nuovo.aree.find((a) => a.sezione === sezione);
  if (!area) {
    area = { sezione, gruppi: [] };
    nuovo.aree = ordinaAree([...nuovo.aree, area]);
  }
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

/** Toglie un gruppo vuoto; un'area senza più gruppi sparisce. */
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
