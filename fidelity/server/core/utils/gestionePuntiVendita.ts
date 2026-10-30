import type { RigaNonAbbinata, SuggerimentoRiga } from '../../../lib/puntiVendita/analisi';
import type { RiferimentoStoria } from '../../../lib/puntiVendita/storia';
import { chiaveLocalita, chiaveTelefono, normalizePuntoVenditaText } from './puntoVenditaNormalization';
import { MINIMO_VOLANTINI_ASSENZA } from './storiaPuntoVendita';

/**
 * La qualità dei dati dei punti vendita nella gestione (contratto in lib/puntiVendita/analisi.ts):
 * righe dell'ultimo import Excel da rivedere e righe dei volantini che non corrispondono a nessun
 * PV dell'anagrafica, raggruppate per punto vendita stampato. Funzioni pure.
 */

/** Oltre questi minuti senza segnale un dispositivo attivo è offline, come nella gestione del PV (fra 5 e 15 è "in allerta"). */
export const MINUTI_DISPOSITIVO_OFFLINE = 15;

/**
 * Righe da rivedere dell'ultimo import Excel dei PV, dal suo avanzamento: quelle scartate o non
 * scritte (errori con il numero di riga) e quella in attesa di una decisione.
 */
export function righeDaRevisionare(avanzamento: unknown): number {
  if (!avanzamento || typeof avanzamento !== 'object') return 0;
  const { errori, rigaInAttesa } = avanzamento as { errori?: unknown; rigaInAttesa?: unknown };
  const righe = new Set<number>();
  for (const errore of Array.isArray(errori) ? errori : []) {
    const riga = Number((errore as { row?: unknown } | null)?.row);
    // La riga 0 e' l'import intero (interrotto, Nominatim fermo): non una riga da rivedere
    if (Number.isInteger(riga) && riga > 0) righe.add(riga);
  }
  return righe.size + (rigaInAttesa ? 1 : 0);
}

/** Una riga senza PV di una lista dei volantini della GDO, con il suo kit. */
export interface RigaSenzaPuntoVendita {
  idKit: string;
  /** Giorno dell'edizione (YYYY-MM-DD). */
  data: string;
  idCanale: string | null;
  nomeCanale: string | null;
  idArea: string | null;
  posizione: number;
  riga: string;
  localita: string | null;
  indirizzo: string | null;
  telefono: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
}

/** Un'edizione con la lista dei PV registrata: serve a dire se una riga non compare più. */
export interface EdizioneConLista {
  idCanale: string;
  idArea: string;
  data: string;
}

export interface PuntoVenditaConTelefono {
  id: string;
  nome: string;
  telefono: string | null;
}

const confronta = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Insiemi disgiunti sugli indici delle righe. */
class Gruppi {
  private readonly padre: number[];

  constructor(quanti: number) {
    this.padre = Array.from({ length: quanti }, (_, indice) => indice);
  }

  radice(indice: number): number {
    let corrente = indice;
    while (this.padre[corrente] !== corrente) {
      this.padre[corrente] = this.padre[this.padre[corrente]];
      corrente = this.padre[corrente];
    }
    return corrente;
  }

  unisci(a: number, b: number): void {
    const radiceA = this.radice(a);
    const radiceB = this.radice(b);
    if (radiceA !== radiceB) this.padre[Math.max(radiceA, radiceB)] = Math.min(radiceA, radiceB);
  }
}

/**
 * Le righe senza PV raggruppate per punto vendita stampato: stesso telefono, o stessa località e
 * stesso indirizzo (un PV che ha cambiato indirizzo tenendo il telefono resta uno). Una riga senza
 * telefono né indirizzo si riconosce solo dal testo. Per ogni gruppo il suggerimento:
 * - 'stesso_telefono': un PV dell'anagrafica ha lo stesso telefono;
 * - 'forse_chiuso': dopo la sua ultima volta, la sua insegna e area hanno avuto almeno
 *   MINIMO_VOLANTINI_ASSENZA edizioni con la lista senza di lui;
 * - 'da_aggiungere' altrimenti.
 * Dal gruppo visto più di recente.
 */
export function raggruppaRigheNonAbbinate(
  righe: readonly RigaSenzaPuntoVendita[],
  edizioniConLista: readonly EdizioneConLista[],
  puntiVendita: readonly PuntoVenditaConTelefono[],
): RigaNonAbbinata[] {
  const gruppi = new Gruppi(righe.length);
  const primoPerChiave = new Map<string, number>();
  const collega = (chiave: string, indice: number) => {
    const primo = primoPerChiave.get(chiave);
    if (primo === undefined) primoPerChiave.set(chiave, indice);
    else gruppi.unisci(primo, indice);
  };
  righe.forEach((riga, indice) => {
    const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
    if (telefono) collega(`tel:${telefono}`, indice);
    if (riga.chiaveIndirizzo) collega(`ind:${chiaveLocalita(riga.localita) ?? ''}|${riga.chiaveIndirizzo}`, indice);
    if (!telefono && !riga.chiaveIndirizzo) collega(`riga:${normalizePuntoVenditaText(riga.riga)}`, indice);
  });

  const perGruppo = new Map<number, RigaSenzaPuntoVendita[]>();
  righe.forEach((riga, indice) => {
    const radice = gruppi.radice(indice);
    perGruppo.set(radice, [...(perGruppo.get(radice) ?? []), riga]);
  });

  const perTelefono = new Map<string, PuntoVenditaConTelefono[]>();
  for (const puntoVendita of [...puntiVendita].sort((a, b) => confronta(a.nome, b.nome) || confronta(a.id, b.id))) {
    const telefono = chiaveTelefono(puntoVendita.telefono);
    if (telefono) perTelefono.set(telefono, [...(perTelefono.get(telefono) ?? []), puntoVendita]);
  }
  const edizioniPerInsegna = new Map<string, Set<string>>();
  for (const edizione of edizioniConLista) {
    const chiave = `${edizione.idCanale}|${edizione.idArea}`;
    edizioniPerInsegna.set(chiave, (edizioniPerInsegna.get(chiave) ?? new Set<string>()).add(edizione.data));
  }

  const suggerimento = (gruppo: readonly RigaSenzaPuntoVendita[], ultima: RigaSenzaPuntoVendita): SuggerimentoRiga => {
    for (const riga of [...gruppo].reverse()) {
      const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
      const trovato = telefono ? perTelefono.get(telefono)?.[0] : undefined;
      if (trovato) return { tipo: 'stesso_telefono', puntoVendita: { id: trovato.id, nome: trovato.nome } };
    }
    const dopo = [...(edizioniPerInsegna.get(`${ultima.idCanale ?? ''}|${ultima.idArea ?? ''}`) ?? [])].filter(data => data > ultima.data);
    return dopo.length >= MINIMO_VOLANTINI_ASSENZA ? { tipo: 'forse_chiuso' } : { tipo: 'da_aggiungere' };
  };

  return [...perGruppo.values()]
    .map((gruppo) => {
      const ordinate = [...gruppo].sort((a, b) => confronta(a.data, b.data) || confronta(a.idKit, b.idKit) || a.posizione - b.posizione);
      const ultima = ordinate[ordinate.length - 1];
      const canale: RiferimentoStoria | null = ultima.idCanale ? { id: ultima.idCanale, nome: ultima.nomeCanale ?? '' } : null;
      return {
        riga: ultima.riga,
        localita: ultima.localita,
        indirizzo: ultima.indirizzo,
        telefono: ultima.telefono ?? [...ordinate].reverse().find(riga => riga.telefono)?.telefono ?? null,
        volantini: new Set(ordinate.map(riga => riga.idKit)).size,
        primoVolantino: ordinate[0].data,
        ultimoVolantino: ultima.data,
        canale,
        suggerimento: suggerimento(ordinate, ultima),
      };
    })
    .sort((a, b) => confronta(b.ultimoVolantino, a.ultimoVolantino) || b.volantini - a.volantini || confronta(a.riga, b.riga));
}
