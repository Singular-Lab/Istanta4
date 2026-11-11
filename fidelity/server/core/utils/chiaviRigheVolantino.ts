import { chiaveLocalita, chiaveTelefono, normalizePuntoVenditaText } from './puntoVenditaNormalization';

/**
 * Le chiavi con cui si riconosce lo stesso punto vendita stampato in volantini diversi, comuni
 * all'elenco delle righe non abbinate (che raggruppa le righe) e ai collegamenti fatti a mano (che
 * le salvano come regola della GDO):
 * - "tel:<cifre>": il telefono;
 * - "ind:<località>|<indirizzo>": la località e l'indirizzo, normalizzati;
 * - "riga:<testo>": il testo della riga, solo se non ha né telefono né indirizzo.
 * Un PV che ha cambiato indirizzo tenendo il telefono ha due chiavi ma resta uno: le righe con
 * almeno una chiave in comune stanno nello stesso gruppo.
 */

/** Una riga della lista di un volantino, con le chiavi calcolate quando è stata registrata. */
export interface RigaConChiavi {
  riga: string;
  localita: string | null;
  telefono?: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
  /**
   * Canale e area del volantino della riga ("<idCanale>|<idArea>", confrontoPuntiVendita.ts): un
   * collegamento fatto a mano vale solo per le righe della combinazione del suo PV. Null se il kit
   * non ha canale o area; undefined se chi chiama non la conosce (allora ogni regola vale).
   */
  combinazione?: string | null;
}

export function chiaviRigaVolantino(riga: RigaConChiavi): string[] {
  const chiavi: string[] = [];
  const telefono = riga.chiaveTelefono ?? chiaveTelefono(riga.telefono);
  if (telefono) chiavi.push(`tel:${telefono}`);
  if (riga.chiaveIndirizzo) chiavi.push(`ind:${chiaveLocalita(riga.localita) ?? ''}|${riga.chiaveIndirizzo}`);
  if (chiavi.length === 0) chiavi.push(`riga:${normalizePuntoVenditaText(riga.riga)}`);
  return chiavi;
}

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

export interface GruppoDiRighe<T> {
  righe: T[];
  /** Tutte le chiavi delle sue righe, in ordine alfabetico. */
  chiavi: string[];
}

/** Le righe raggruppate per chiave in comune, nell'ordine della loro prima riga. */
export function raggruppaPerChiavi<T extends RigaConChiavi>(righe: readonly T[]): GruppoDiRighe<T>[] {
  const chiaviDi = righe.map(chiaviRigaVolantino);
  const gruppi = new Gruppi(righe.length);
  const primoPerChiave = new Map<string, number>();
  chiaviDi.forEach((chiavi, indice) => {
    for (const chiave of chiavi) {
      const primo = primoPerChiave.get(chiave);
      if (primo === undefined) primoPerChiave.set(chiave, indice);
      else gruppi.unisci(primo, indice);
    }
  });

  const perRadice = new Map<number, { righe: T[]; chiavi: Set<string> }>();
  righe.forEach((riga, indice) => {
    const radice = gruppi.radice(indice);
    const gruppo = perRadice.get(radice) ?? { righe: [], chiavi: new Set<string>() };
    gruppo.righe.push(riga);
    for (const chiave of chiaviDi[indice]) gruppo.chiavi.add(chiave);
    perRadice.set(radice, gruppo);
  });
  return [...perRadice.values()].map(gruppo => ({ righe: gruppo.righe, chiavi: [...gruppo.chiavi].sort() }));
}

/** Un collegamento fatto a mano: le chiavi delle righe che vanno a quel punto vendita. */
export interface RegolaCollegamento {
  id: string;
  idPuntoVendita: string;
  chiavi: readonly string[];
  /** Data ISO o Date: a parità di chiave vince il collegamento più recente. */
  creatoIl: Date | string;
  /**
   * La combinazione canale/area del PV ("<idCanale>|<idArea>"): il collegamento vale solo per le
   * righe dei volantini di quella combinazione. Null o assente: vale per tutte (PV senza combinazione).
   */
  combinazione?: string | null;
}

/** Trova il collegamento fatto a mano che vale per una riga, se c'è. */
export class RegoleCollegamento {
  /** Per ogni chiave, i collegamenti che la contengono, dal più vecchio al più recente. */
  private readonly perChiave = new Map<string, RegolaCollegamento[]>();

  constructor(regole: readonly RegolaCollegamento[]) {
    const dallaPiuVecchia = [...regole].sort((a, b) => new Date(a.creatoIl).getTime() - new Date(b.creatoIl).getTime());
    for (const regola of dallaPiuVecchia) {
      for (const chiave of regola.chiavi) this.aggiungi(chiave, regola);
    }
  }

  private aggiungi(chiave: string, regola: RegolaCollegamento): void {
    const elenco = this.perChiave.get(chiave);
    if (elenco) elenco.push(regola);
    else this.perChiave.set(chiave, [regola]);
  }

  /** Il collegamento vale per la riga: stessa combinazione, o una delle due non nota. */
  private static vale(regola: RegolaCollegamento, riga: RigaConChiavi): boolean {
    if (regola.combinazione == null || riga.combinazione === undefined) return true;
    return riga.combinazione !== null && riga.combinazione.toLowerCase() === regola.combinazione.toLowerCase();
  }

  get vuote(): boolean {
    return this.perChiave.size === 0;
  }

  /**
   * La regola di una delle chiavi della riga, telefono, poi indirizzo, poi testo: per ogni chiave la
   * più recente che vale per la combinazione della riga.
   */
  per(riga: RigaConChiavi): RegolaCollegamento | null {
    for (const chiave of chiaviRigaVolantino(riga)) {
      const elenco = this.perChiave.get(chiave) ?? [];
      for (let indice = elenco.length - 1; indice >= 0; indice--) {
        if (RegoleCollegamento.vale(elenco[indice], riga)) return elenco[indice];
      }
    }
    return null;
  }

  /**
   * La regola impara le chiavi di una riga che ha collegato: un negozio che cambia indirizzo
   * tenendo il telefono si riconosce poi anche dal nuovo indirizzo. Una chiave che e' gia' di
   * un'altra regola valida per la stessa combinazione resta sua. Restituisce le chiavi imparate.
   */
  impara(regola: RegolaCollegamento, riga: RigaConChiavi): string[] {
    const nuove = chiaviRigaVolantino(riga).filter(chiave =>
      !(this.perChiave.get(chiave) ?? []).some(altra => altra === regola || RegoleCollegamento.vale(altra, riga)));
    for (const chiave of nuove) this.aggiungi(chiave, regola);
    return nuove;
  }
}
