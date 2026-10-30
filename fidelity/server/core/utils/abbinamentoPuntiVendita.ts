import type { TipoAbbinamento } from '../../../lib/puntiVendita/storia';
import { chiaveIndirizzo, chiaveLocalita, chiaveTelefono, civiciIndirizzo, editDistance } from './puntoVenditaNormalization';

/**
 * Abbinamento delle righe stampate nelle liste dei volantini ai punti vendita dell'anagrafica
 * della stessa GDO. Solo un'indicazione per la storia del punto vendita: non fonde e non scrive
 * mai l'anagrafica, e quando i candidati sono piu' d'uno la riga resta senza punto vendita.
 *
 * Regole, nell'ordine:
 * 1. telefono uguale, se quel telefono e' di un solo PV della GDO -> 'telefono';
 * 2. stessa localita' (la citta' del PV) e stesso indirizzo -> 'indirizzo';
 * 3. 'probabile': stesso indirizzo, unico nella GDO, anche se la localita' e' diversa (il volantino
 *    stampa la frazione: PRA invece di GENOVA); oppure stessa localita', indirizzo che differisce di
 *    un carattere e stessi numeri civici.
 */

/** Un punto vendita dell'anagrafica, con i campi che servono a riconoscerlo. */
export interface PuntoVenditaAnagrafica {
  id: string;
  citta: string | null;
  indirizzo: string | null;
  telefono: string | null;
}

/** Una riga della lista di un volantino, con le chiavi calcolate quando e' stata registrata. */
export interface RigaDaAbbinare {
  localita: string | null;
  chiaveIndirizzo: string | null;
  chiaveTelefono: string | null;
}

export interface Abbinamento {
  idPuntoVendita: string;
  tipo: TipoAbbinamento;
}

interface ChiaviPuntoVendita {
  id: string;
  localita: string | null;
  indirizzo: string | null;
  civici: string;
}

const aggiungi = <T>(mappa: Map<string, T[]>, chiave: string | null, valore: T): void => {
  if (!chiave) return;
  const elenco = mappa.get(chiave);
  if (elenco) elenco.push(valore);
  else mappa.set(chiave, [valore]);
};

/** Le chiavi dei punti vendita di una GDO, calcolate una volta per tutte le righe da abbinare. */
export class AbbinatorePuntiVendita {
  private readonly perTelefono = new Map<string, string[]>();
  private readonly perIndirizzo = new Map<string, ChiaviPuntoVendita[]>();
  private readonly perLocalita = new Map<string, ChiaviPuntoVendita[]>();

  constructor(puntiVendita: readonly PuntoVenditaAnagrafica[]) {
    for (const puntoVendita of puntiVendita) {
      const indirizzo = chiaveIndirizzo(puntoVendita.indirizzo);
      const chiavi: ChiaviPuntoVendita = {
        id: puntoVendita.id,
        localita: chiaveLocalita(puntoVendita.citta),
        indirizzo,
        civici: civiciIndirizzo(indirizzo),
      };
      aggiungi(this.perTelefono, chiaveTelefono(puntoVendita.telefono), puntoVendita.id);
      aggiungi(this.perIndirizzo, indirizzo, chiavi);
      aggiungi(this.perLocalita, chiavi.localita, chiavi);
    }
  }

  /** Il punto vendita della riga, o null se non ce n'e' uno solo che le corrisponde. */
  abbina(riga: RigaDaAbbinare): Abbinamento | null {
    if (riga.chiaveTelefono) {
      const conTelefono = this.perTelefono.get(riga.chiaveTelefono) ?? [];
      if (conTelefono.length === 1) return { idPuntoVendita: conTelefono[0], tipo: 'telefono' };
    }
    const indirizzo = riga.chiaveIndirizzo;
    if (!indirizzo) return null;

    const localita = chiaveLocalita(riga.localita);
    const stessoIndirizzo = this.perIndirizzo.get(indirizzo) ?? [];
    if (localita) {
      const qui = stessoIndirizzo.filter(puntoVendita => puntoVendita.localita === localita);
      if (qui.length === 1) return { idPuntoVendita: qui[0].id, tipo: 'indirizzo' };
      if (qui.length > 1) return null;
    }
    if (stessoIndirizzo.length === 1) return { idPuntoVendita: stessoIndirizzo[0].id, tipo: 'probabile' };
    if (stessoIndirizzo.length > 1 || !localita) return null;

    const civici = civiciIndirizzo(indirizzo);
    const vicini = (this.perLocalita.get(localita) ?? []).filter(puntoVendita =>
      puntoVendita.indirizzo !== null
      && puntoVendita.civici === civici
      && editDistance(puntoVendita.indirizzo, indirizzo) <= 1
    );
    return vicini.length === 1 ? { idPuntoVendita: vicini[0].id, tipo: 'probabile' } : null;
  }
}
