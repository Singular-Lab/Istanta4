import type {
  AvvioImportVendite,
  ControlloImportVendite,
  EsitoImportVendite,
  IVenditeRepository,
  NuovoImportVendite,
  TotaliVendite,
} from '../core/repositories/VenditeRepository';
import type { PuntoVenditaGdo, VenditaDaScrivere } from '../core/vendite/preparaImportVendite';
import { MESSAGGIO_IMPORT_VENDITE_INTERROTTO, type RigaImportVendite } from '../core/vendite/statoImport';

export interface VenditaSalvata extends Omit<VenditaDaScrivere, 'riga'> {
  idGdo: string;
  idImport: string;
}

/**
 * Le tabelle vendite_prodotti e importazioni_vendite in memoria, con le regole di VenditeRepository:
 * upsert per GDO, prodotto, punto vendita e periodo (sostituisce, non somma); un solo import
 * 'in_corso' per GDO; gli 'in_corso' senza battito non bloccano e diventano 'interrotto'; il lavoro
 * legge l'annullamento a ogni blocco. Due servizi che condividono l'istanza simulano due processi
 * che condividono il database. Le righe restituite sono copie, come quelle lette dal database.
 */
export class VenditeRepositoryInMemoria implements IVenditeRepository {
  readonly puntiVendita = new Map<string, PuntoVenditaGdo[]>();
  readonly importazioni: RigaImportVendite[] = [];
  readonly vendite = new Map<string, VenditaSalvata>();
  /** Dimensione di ogni blocco ricevuto da scriviVendite, in ordine. */
  readonly blocchi: number[] = [];
  battiti = 0;
  /** Chiamata prima di scrivere il blocco n (da 1): per annullare, fallire o fermare da "un altro processo". */
  primaDiScrivere?: (blocco: number) => void | Promise<void>;
  /** Fa fallire concludiImport. */
  erroreConclusione?: Error;
  /** Nomi delle GDO per il riepilogo. */
  readonly nomiGdo = new Map<string, string>();

  constructor(puntiVendita: Record<string, PuntoVenditaGdo[]> = {}) {
    for (const [idGdo, elenco] of Object.entries(puntiVendita)) this.puntiVendita.set(idGdo, elenco);
  }

  private trova(id: string): RigaImportVendite | undefined {
    return this.importazioni.find(riga => riga.id === id);
  }

  /** Simula un server fermo: l'import non da' piu' segni di vita da oltre MINUTI_IMPORT_INTERROTTO. */
  fermaBattito(id: string): void {
    const riga = this.trova(id);
    if (!riga) return;
    riga.battito_il = new Date(Date.now() - 10 * 60 * 1000);
    riga.senza_battito = riga.stato === 'in_corso';
  }

  venditeDellaGdo(idGdo: string): VenditaSalvata[] {
    return [...this.vendite.values()].filter(v => v.idGdo === idGdo);
  }

  async puntiVenditaGdo(idGdo: string): Promise<PuntoVenditaGdo[]> {
    return (this.puntiVendita.get(idGdo) ?? []).map(pv => ({ ...pv }));
  }

  async avviaImport(nuovo: NuovoImportVendite): Promise<AvvioImportVendite> {
    for (const riga of this.importazioni) {
      if (riga.id_gdo === nuovo.idGdo && riga.stato === 'in_corso' && riga.senza_battito) {
        Object.assign(riga, {
          stato: 'interrotto', errore: riga.errore ?? MESSAGGIO_IMPORT_VENDITE_INTERROTTO, terminato_il: riga.battito_il, senza_battito: false,
        });
      }
    }
    const inCorso = this.importazioni.find(riga => riga.id_gdo === nuovo.idGdo && riga.stato === 'in_corso');
    if (inCorso) return { avviato: false, inCorso: { ...inCorso } };
    const adesso = new Date();
    const riga: RigaImportVendite = {
      id: nuovo.id,
      id_gdo: nuovo.idGdo,
      stato: 'in_corso',
      nome_file: nuovo.nomeFile,
      righe: nuovo.righe,
      elaborate: nuovo.scartate,
      scritte: 0,
      scartate: nuovo.scartate,
      errore: null,
      avviato_da: nuovo.avviatoDa,
      avviato_il: adesso,
      terminato_il: null,
      battito_il: adesso,
      annullato: false,
      senza_battito: false,
    };
    this.importazioni.push(riga);
    return { avviato: true, import: { ...riga } };
  }

  async avanzamento(id: string, conteggi: { elaborate: number; scritte: number }): Promise<ControlloImportVendite> {
    const riga = this.trova(id);
    if (!riga || riga.stato !== 'in_corso') return 'perso';
    Object.assign(riga, conteggi, { battito_il: new Date(), senza_battito: false });
    return riga.annullato ? 'annullato' : 'continua';
  }

  async battito(id: string): Promise<void> {
    this.battiti++;
    const riga = this.trova(id);
    if (riga?.stato === 'in_corso') Object.assign(riga, { battito_il: new Date(), senza_battito: false });
  }

  async scriviVendite(idGdo: string, idImport: string, vendite: readonly VenditaDaScrivere[]): Promise<number> {
    this.blocchi.push(vendite.length);
    await this.primaDiScrivere?.(this.blocchi.length);
    const dellaGdo = new Set((this.puntiVendita.get(idGdo) ?? []).map(pv => pv.id));
    let scritte = 0;
    for (const vendita of vendite) {
      if (!dellaGdo.has(vendita.idPuntoVendita)) continue;
      const { codiceProdotto, idPuntoVendita, dal, al, pezzi, valore } = vendita;
      this.vendite.set([idGdo, codiceProdotto, idPuntoVendita, dal, al].join('|'), {
        codiceProdotto, idPuntoVendita, dal, al, pezzi, valore, idGdo, idImport,
      });
      scritte++;
    }
    return scritte;
  }

  async concludiImport(id: string, esito: EsitoImportVendite): Promise<void> {
    if (this.erroreConclusione) throw this.erroreConclusione;
    const riga = this.trova(id);
    if (riga?.stato === 'in_corso') Object.assign(riga, esito, { terminato_il: new Date(), battito_il: new Date() });
  }

  async ultimoImport(idGdo: string): Promise<RigaImportVendite | null> {
    const dellaGdo = this.importazioni.filter(riga => riga.id_gdo === idGdo);
    const ultimo = dellaGdo[dellaGdo.length - 1];
    return ultimo ? { ...ultimo } : null;
  }

  async richiediAnnullamento(idGdo: string): Promise<RigaImportVendite | null> {
    for (const riga of this.importazioni) {
      if (riga.id_gdo === idGdo && riga.stato === 'in_corso') riga.annullato = true;
    }
    return this.ultimoImport(idGdo);
  }

  async nomeGdo(idGdo: string): Promise<string | null> {
    return this.nomiGdo.get(idGdo) ?? null;
  }

  async totali(idGdo: string): Promise<TotaliVendite> {
    const vendite = this.venditeDellaGdo(idGdo);
    const date = (campo: 'dal' | 'al') => vendite.map(v => v[campo]).sort();
    return {
      righe: vendite.length,
      prodotti: new Set(vendite.map(v => v.codiceProdotto)).size,
      puntiVendita: new Set(vendite.map(v => v.idPuntoVendita)).size,
      dal: date('dal')[0] ?? null,
      al: date('al').at(-1) ?? null,
    };
  }
}
