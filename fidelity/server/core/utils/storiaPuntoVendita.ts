import type {
  AnnoStoria,
  EventoStoria,
  PeriodoInsegna,
  PeriodoRecapito,
  PromoStoria,
  RiferimentoStoria,
  StoriaPuntoVendita,
  TipoAbbinamento,
} from '../../../lib/puntiVendita/storia';
import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono } from './puntoVenditaNormalization';

/**
 * La storia di un punto vendita calcolata dalle sue apparizioni nelle liste dei volantini.
 *
 * Un'edizione e' il giorno d'inizio della promo: due volantini con la stessa data (il PV stampato
 * nel volantino di due insegne la stessa settimana) sono la stessa edizione e non spezzano un
 * periodo. Un cambio (insegna, area, indirizzo, telefono) diventa un evento solo se dura almeno
 * MINIMO_EDIZIONI_CAMBIO edizioni: un volantino isolato non basta. Un tratto di una sola edizione
 * fra due tratti uguali si riassorbe.
 */

export const MINIMO_EDIZIONI_CAMBIO = 2;
/** Volantini consecutivi della sua insegna e area senza il PV perche' risulti assente. */
export const MINIMO_VOLANTINI_ASSENZA = 3;

/** Il punto vendita in un volantino, come lo legge il repository. */
export interface ApparizioneStoria {
  idKit: string;
  titoloKit: string;
  promo: PromoStoria;
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
  /** Giorno dell'edizione (YYYY-MM-DD): inizio della validita' della promo. */
  data: string;
  rigaStampata: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
  abbinamento: TipoAbbinamento;
}

/** Recapiti attuali del punto vendita in anagrafica. */
export interface PuntoVenditaAttuale {
  id: string;
  indirizzo: string | null;
  telefono: string | null;
}

/** Un volantino della stessa insegna e area, con la lista registrata, in cui il PV non c'e'. */
export interface VolantinoSenzaPuntoVendita {
  idKit: string;
  data: string;
}

interface Edizione {
  data: string;
  apparizioni: ApparizioneStoria[];
}

interface Tratto<T> {
  valore: T;
  /** Indici della prima e dell'ultima edizione. */
  inizio: number;
  fine: number;
  apparizioni: ApparizioneStoria[];
}

interface Insegna {
  canale: RiferimentoStoria;
  area: RiferimentoStoria;
}

interface Recapito {
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
}

const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** In ordine di edizione; a parita' per fine validita', titolo e kit, cosi' l'ordine non cambia fra due letture. */
export function ordinaApparizioni(apparizioni: readonly ApparizioneStoria[]): ApparizioneStoria[] {
  return [...apparizioni].sort((a, b) =>
    confronta(a.data, b.data)
    || confronta(a.promo.validitaAl ?? '', b.promo.validitaAl ?? '')
    || confronta(a.titoloKit, b.titoloKit)
    || confronta(a.idKit, b.idKit));
}

/** Un volantino conta una volta anche se il PV compare due volte nella sua lista. */
function unaPerKit(apparizioni: ApparizioneStoria[]): ApparizioneStoria[] {
  const visti = new Set<string>();
  return apparizioni.filter(apparizione => {
    if (visti.has(apparizione.idKit)) return false;
    visti.add(apparizione.idKit);
    return true;
  });
}

function edizioniDi(apparizioni: ApparizioneStoria[]): Edizione[] {
  const edizioni: Edizione[] = [];
  for (const apparizione of apparizioni) {
    const ultima = edizioni[edizioni.length - 1];
    if (ultima && ultima.data === apparizione.data) ultima.apparizioni.push(apparizione);
    else edizioni.push({ data: apparizione.data, apparizioni: [apparizione] });
  }
  return edizioni;
}

/**
 * Tratti di edizioni consecutive con valori compatibili. Un'edizione che contiene anche il valore del
 * tratto in corso lo prolunga (le altre apparizioni di quella data non contano); altrimenti apre un
 * tratto nuovo, col valore che continua nell'edizione successiva se ce n'e' piu' d'uno.
 */
function tratti<T>(
  edizioni: Edizione[],
  valoreDi: (apparizione: ApparizioneStoria) => T,
  compatibili: (a: T, b: T) => boolean,
  unisci: (a: T, b: T) => T,
): Tratto<T>[] {
  const risultato: Tratto<T>[] = [];
  edizioni.forEach((edizione, indice) => {
    const valori = edizione.apparizioni.map(apparizione => ({ apparizione, valore: valoreDi(apparizione) }));
    const corrente = risultato[risultato.length - 1];
    const continuano = corrente ? valori.filter(({ valore }) => compatibili(corrente.valore, valore)) : [];
    if (corrente && continuano.length > 0) {
      corrente.fine = indice;
      for (const { apparizione, valore } of continuano) {
        corrente.valore = unisci(corrente.valore, valore);
        corrente.apparizioni.push(apparizione);
      }
      return;
    }
    const dopo = edizioni[indice + 1]?.apparizioni.map(valoreDi) ?? [];
    const scelto = valori.find(({ valore }) => dopo.some(successivo => compatibili(valore, successivo))) ?? valori[0];
    const stessi = valori.filter(({ valore }) => compatibili(scelto.valore, valore));
    risultato.push({
      valore: stessi.slice(1).reduce((somma, { valore }) => unisci(somma, valore), scelto.valore),
      inizio: indice,
      fine: indice,
      apparizioni: stessi.map(({ apparizione }) => apparizione),
    });
  });

  // Un'edizione isolata fra due tratti uguali e' rumore: i due tratti diventano uno
  let indice = 1;
  while (indice < risultato.length - 1) {
    const [prima, isolato, dopo] = [risultato[indice - 1], risultato[indice], risultato[indice + 1]];
    if (isolato.inizio === isolato.fine && compatibili(prima.valore, dopo.valore)) {
      prima.valore = unisci(prima.valore, dopo.valore);
      prima.fine = dopo.fine;
      prima.apparizioni.push(...dopo.apparizioni);
      risultato.splice(indice, 2);
    } else {
      indice++;
    }
  }
  return risultato;
}

const durata = <T>(tratto: Tratto<T>): number => tratto.fine - tratto.inizio + 1;

/**
 * Coppie (da, a) dei cambi confermati: ogni tratto di almeno MINIMO_EDIZIONI_CAMBIO edizioni si
 * confronta con l'ultimo tratto confermato (il primo lo e' sempre), cosi' un tratto isolato in mezzo
 * non diventa ne' l'origine ne' la destinazione di un evento.
 */
function cambiConfermati<T>(elenco: Tratto<T>[]): Array<{ da: Tratto<T>; a: Tratto<T> }> {
  const cambi: Array<{ da: Tratto<T>; a: Tratto<T> }> = [];
  let confermato = elenco[0];
  for (const tratto of elenco.slice(1)) {
    if (durata(tratto) < MINIMO_EDIZIONI_CAMBIO) continue;
    cambi.push({ da: confermato, a: tratto });
    confermato = tratto;
  }
  return cambi;
}

const primaData = <T>(tratto: Tratto<T>): string => tratto.apparizioni[0].data;
const ultimaData = <T>(tratto: Tratto<T>): string => {
  const ultima = tratto.apparizioni[tratto.apparizioni.length - 1];
  return ultima.promo.validitaAl ?? ultima.data;
};
const numeroKit = (apparizioni: ApparizioneStoria[]): number => new Set(apparizioni.map(apparizione => apparizione.idKit)).size;

const stessaInsegna = (a: Insegna, b: Insegna): boolean => a.canale.id === b.canale.id && a.area.id === b.area.id;

/** Indirizzo e telefono mancanti in un volantino non sono un cambio: si confrontano solo quelli stampati. */
const recapitiCompatibili = (a: Recapito, b: Recapito): boolean =>
  (a.chiaveIndirizzo === null || b.chiaveIndirizzo === null || a.chiaveIndirizzo === b.chiaveIndirizzo)
  && (a.chiaveTelefono === null || b.chiaveTelefono === null || a.chiaveTelefono === b.chiaveTelefono);

const unisciRecapiti = (a: Recapito, b: Recapito): Recapito => ({
  localita: a.localita ?? b.localita,
  indirizzo: a.chiaveIndirizzo !== null ? a.indirizzo : b.indirizzo,
  chiaveIndirizzo: a.chiaveIndirizzo ?? b.chiaveIndirizzo,
  telefono: a.chiaveTelefono !== null ? a.telefono : b.telefono,
  chiaveTelefono: a.chiaveTelefono ?? b.chiaveTelefono,
});

/** L'indirizzo per gli eventi: con la localita' davanti solo se e' cambiata anche quella. */
function indirizzoEvento(recapito: Recapito, altro: Recapito): string {
  const indirizzo = recapito.indirizzo ?? '';
  const cambiaLocalita = chiaveLocalita(recapito.localita) !== chiaveLocalita(altro.localita);
  return cambiaLocalita && recapito.localita ? `${recapito.localita}, ${indirizzo}` : indirizzo;
}

function anni(apparizioni: ApparizioneStoria[]): AnnoStoria[] {
  const perAnno = new Map<number, ApparizioneStoria[]>();
  for (const apparizione of apparizioni) {
    const anno = Number(apparizione.data.slice(0, 4));
    perAnno.set(anno, [...(perAnno.get(anno) ?? []), apparizione]);
  }
  return [...perAnno.entries()].sort(([a], [b]) => a - b).map(([anno, diQuellAnno]) => {
    const insegne = new Map<string, { canale: RiferimentoStoria; area: RiferimentoStoria; kit: Set<string> }>();
    for (const apparizione of diQuellAnno) {
      const chiave = `${apparizione.canale.id}|${apparizione.area.id}`;
      const voce = insegne.get(chiave) ?? { canale: apparizione.canale, area: apparizione.area, kit: new Set<string>() };
      voce.kit.add(apparizione.idKit);
      insegne.set(chiave, voce);
    }
    return {
      anno,
      volantini: numeroKit(diQuellAnno),
      insegne: [...insegne.values()]
        .map(({ canale, area, kit }) => ({ canale, area, volantini: kit.size }))
        .sort((a, b) => b.volantini - a.volantini || confronta(a.canale.nome, b.canale.nome) || confronta(a.area.nome, b.area.nome)),
    };
  });
}

/** Insegna, area e data dell'ultima apparizione: servono a cercare i volantini successivi senza il PV. */
export function ultimaApparizione(apparizioni: readonly ApparizioneStoria[]): ApparizioneStoria | null {
  const ordinate = ordinaApparizioni(apparizioni);
  return ordinate[ordinate.length - 1] ?? null;
}

const dataEvento = (evento: EventoStoria): string => (evento.tipo === 'assente' ? evento.dal : evento.data);

export function calcolaStoria(
  puntoVendita: PuntoVenditaAttuale,
  elencoApparizioni: readonly ApparizioneStoria[],
  volantiniSenza: readonly VolantinoSenzaPuntoVendita[] = [],
): StoriaPuntoVendita {
  const apparizioni = unaPerKit(ordinaApparizioni(elencoApparizioni));
  if (apparizioni.length === 0) {
    return { idPuntoVendita: puntoVendita.id, sintesi: null, anni: [], insegne: [], recapiti: [], eventi: [] };
  }
  const edizioni = edizioniDi(apparizioni);
  const eventi: EventoStoria[] = [];

  const trattiInsegna = tratti<Insegna>(
    edizioni,
    ({ canale, area }) => ({ canale, area }),
    stessaInsegna,
    a => a,
  );
  for (const { da, a } of cambiConfermati(trattiInsegna)) {
    const data = primaData(a);
    if (da.valore.canale.id !== a.valore.canale.id) eventi.push({ tipo: 'cambio_insegna', data, da: da.valore.canale, a: a.valore.canale });
    if (da.valore.area.id !== a.valore.area.id) eventi.push({ tipo: 'cambio_area', data, da: da.valore.area, a: a.valore.area });
  }

  const trattiRecapito = tratti<Recapito>(
    edizioni,
    ({ localita, indirizzo, telefono, chiaveIndirizzo: indirizzoChiave, chiaveTelefono: telefonoChiave }) => ({
      localita, indirizzo, telefono, chiaveIndirizzo: indirizzoChiave, chiaveTelefono: telefonoChiave,
    }),
    recapitiCompatibili,
    unisciRecapiti,
  );
  for (const { da, a } of cambiConfermati(trattiRecapito)) {
    const data = primaData(a);
    const prima = da.valore;
    const dopo = a.valore;
    if (prima.chiaveIndirizzo && dopo.chiaveIndirizzo && prima.chiaveIndirizzo !== dopo.chiaveIndirizzo) {
      eventi.push({ tipo: 'cambio_indirizzo', data, da: indirizzoEvento(prima, dopo), a: indirizzoEvento(dopo, prima) });
    }
    if (prima.chiaveTelefono && dopo.chiaveTelefono && prima.chiaveTelefono !== dopo.chiaveTelefono) {
      eventi.push({ tipo: 'cambio_telefono', data, da: prima.telefono ?? '', a: dopo.telefono ?? '' });
    }
  }

  const ultima = apparizioni[apparizioni.length - 1];
  const senza = volantiniSenza.filter(volantino => volantino.data > ultima.data);
  if (new Set(senza.map(volantino => volantino.data)).size >= MINIMO_VOLANTINI_ASSENZA) {
    const primo = [...senza].sort((a, b) => confronta(a.data, b.data))[0];
    eventi.push({ tipo: 'assente', dal: primo.data, volantiniSenza: new Set(senza.map(volantino => volantino.idKit)).size });
  }

  const indirizzoAttuale = chiaveIndirizzo(puntoVendita.indirizzo);
  const telefonoAttuale = chiaveTelefono(puntoVendita.telefono);
  const insegne: PeriodoInsegna[] = trattiInsegna.map(tratto => ({
    canale: tratto.valore.canale,
    area: tratto.valore.area,
    dal: primaData(tratto),
    al: ultimaData(tratto),
    volantini: numeroKit(tratto.apparizioni),
  }));
  const recapiti: PeriodoRecapito[] = trattiRecapito.map(tratto => ({
    localita: tratto.valore.localita,
    indirizzo: tratto.valore.indirizzo,
    telefono: tratto.valore.telefono,
    dal: primaData(tratto),
    al: ultimaData(tratto),
    volantini: numeroKit(tratto.apparizioni),
    diversoDallAttuale: Boolean(
      (indirizzoAttuale && tratto.valore.chiaveIndirizzo && tratto.valore.chiaveIndirizzo !== indirizzoAttuale)
      || (telefonoAttuale && tratto.valore.chiaveTelefono && tratto.valore.chiaveTelefono !== telefonoAttuale)
    ),
  }));

  const canali = new Map<string, RiferimentoStoria>();
  for (const apparizione of apparizioni) if (!canali.has(apparizione.canale.id)) canali.set(apparizione.canale.id, apparizione.canale);

  return {
    idPuntoVendita: puntoVendita.id,
    sintesi: {
      primoVolantino: apparizioni[0].data,
      ultimoVolantino: ultima.data,
      numeroVolantini: apparizioni.length,
      insegne: [...canali.values()],
    },
    anni: anni(apparizioni),
    insegne,
    recapiti,
    // Dal piu' recente; a parita' di data resta l'ordine in cui sono stati trovati
    eventi: eventi
      .map((evento, posizione) => ({ evento, posizione }))
      .sort((a, b) => confronta(dataEvento(b.evento), dataEvento(a.evento)) || a.posizione - b.posizione)
      .map(({ evento }) => evento),
  };
}
