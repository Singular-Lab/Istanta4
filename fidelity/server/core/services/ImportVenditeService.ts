import { randomUUID } from 'node:crypto';
import { BadRequestError } from '../../../lib/errors';
import type { AnteprimaImportVendite, ImportVendite, RiepilogoVendite } from '../../../lib/vendite/tipi';
import type { IAgenziaLib, ImportVenditeAgenzia } from '../agenzia_lib/types';
import { ImportVenditeInCorso, type FileVendite, type IImportVenditeService } from '../interfaces/IImportVenditeService';
import { log } from '../logger';
import type { IVenditeRepository } from '../repositories/VenditeRepository';
import {
  anteprimaImportVendite,
  chiaviPuntoVendita,
  preparaImportVendite,
  riconoscitorePuntoVendita,
  righeFileVendite,
  type ImportVenditePreparato,
} from '../vendite/preparaImportVendite';
import { importDaRiga } from '../vendite/statoImport';
import { TRACCIATO_VENDITE_GENERICO } from '../vendite/tracciatoGenerico';
import { eseguiImportVendite, type LavoroImportVendite } from './ImportVenditeJob';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lunghezza di importazioni_vendite.nome_file. */
const LUNGHEZZA_NOME_FILE = 255;

/** Righe scartate nei dettagli dell'errore "nessuna riga importabile": il resto e' nell'anteprima. */
const SCARTATE_NELL_ERRORE = 20;

export interface OpzioniImportVendite {
  /** Esegue l'import in background; di norma eseguiImportVendite. I test lo sostituiscono per attenderne la fine. */
  esegui?: (lavoro: LavoroImportVendite) => Promise<unknown>;
}

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e));

const descriviTracciato = (tracciato: ImportVenditeAgenzia) => `${tracciato.nome}: colonne ${tracciato.colonne.join(', ')}`;

/**
 * Import delle vendite del cliente (spec "Import delle vendite con il tracciato del cliente").
 * Il file si legge con il tracciato della libreria agenzia o con quello generico; il punto vendita si
 * riconosce dalla chiave del cliente nei meta (importVendite.chiaveMetaPuntoVendita, o la chiave
 * dell'import dei punti vendita) o, senza chiavi, dal nome. L'anteprima non scrive nulla; l'import
 * scrive in background a blocchi, uno per GDO alla volta, e reimportare la stessa vendita (prodotto,
 * punto vendita, periodo) la sostituisce. Stato e annullamento stanno nel database: funzionano da
 * qualunque processo.
 */
export class ImportVenditeService implements IImportVenditeService {
  private readonly esegui: (lavoro: LavoroImportVendite) => Promise<unknown>;

  constructor(
    private readonly repository: IVenditeRepository,
    private readonly agenziaLib: Pick<IAgenziaLib, 'importVendite' | 'importPuntiVendita'>,
    opzioni: OpzioniImportVendite = {},
  ) {
    this.esegui = opzioni.esegui ?? (lavoro => eseguiImportVendite(this.repository, lavoro));
  }

  private get tracciato(): ImportVenditeAgenzia {
    return this.agenziaLib.importVendite ?? TRACCIATO_VENDITE_GENERICO;
  }

  /** Il file letto e ogni riga decisa (da scrivere o scartata), senza scrivere nulla. */
  private async prepara(file: FileVendite, idGdo: string): Promise<{ tracciato: ImportVenditeAgenzia; preparato: ImportVenditePreparato }> {
    const tracciato = this.tracciato;
    let righe: Record<string, unknown>[];
    try {
      righe = righeFileVendite(file.contenuto, tracciato);
    } catch (e) {
      if (e instanceof BadRequestError) throw e;
      // leggiFile della libreria agenzia non riconosce il file
      throw new BadRequestError({ message: `File non riconosciuto dal tracciato ${descriviTracciato(tracciato)} (${messaggio(e)})` });
    }
    if (righe.length === 0) {
      throw new BadRequestError({ message: `Il file non contiene righe di vendita. Tracciato ${descriviTracciato(tracciato)}` });
    }
    const riconosci = riconoscitorePuntoVendita(await this.repository.puntiVenditaGdo(idGdo), chiaviPuntoVendita(this.agenziaLib));
    return { tracciato, preparato: preparaImportVendite(righe, tracciato, riconosci) };
  }

  async anteprima(file: FileVendite, idGdo: string): Promise<AnteprimaImportVendite> {
    const { tracciato, preparato } = await this.prepara(file, idGdo);
    return anteprimaImportVendite(preparato, tracciato);
  }

  async avvia(file: FileVendite, idGdo: string, idUtente: string): Promise<ImportVendite> {
    const { tracciato, preparato } = await this.prepara(file, idGdo);
    if (preparato.vendite.length === 0) {
      throw new BadRequestError({
        message: `Nessuna riga importabile: tutte le ${preparato.totale} righe sono scartate. Tracciato ${descriviTracciato(tracciato)}`,
        details: { scartate: preparato.scartate.slice(0, SCARTATE_NELL_ERRORE) },
      });
    }

    const avvio = await this.repository.avviaImport({
      id: randomUUID(),
      idGdo,
      nomeFile: (file.nome.trim() || 'vendite').slice(0, LUNGHEZZA_NOME_FILE),
      righe: preparato.totale,
      scartate: preparato.scartate.length,
      avviatoDa: UUID.test(idUtente) ? idUtente : null,
    });
    if (avvio.avviato === false) throw new ImportVenditeInCorso(importDaRiga(avvio.inCorso));

    const lavoro: LavoroImportVendite = {
      id: avvio.import.id,
      idGdo,
      vendite: preparato.vendite,
      scartate: preparato.scartate.length,
    };
    log.info('importVendite - avviato', {
      id: lavoro.id, idGdo, righe: preparato.totale, vendite: lavoro.vendite.length, scartate: lavoro.scartate,
    });
    // In background: l'esito lo scrive il lavoro nell'import, il client lo legge con lo stato
    void this.esegui(lavoro).catch(e => log.error('importVendite - lavoro non avviato', { id: lavoro.id, error: messaggio(e) }));
    return importDaRiga(avvio.import);
  }

  async stato(idGdo: string): Promise<ImportVendite | null> {
    const riga = await this.repository.ultimoImport(idGdo);
    return riga ? importDaRiga(riga) : null;
  }

  async annulla(idGdo: string): Promise<ImportVendite | null> {
    const riga = await this.repository.richiediAnnullamento(idGdo);
    if (riga?.stato === 'in_corso') log.info('importVendite - annullamento richiesto', { id: riga.id, idGdo });
    return riga ? importDaRiga(riga) : null;
  }

  async riepilogo(idGdo: string): Promise<RiepilogoVendite> {
    const [totali, ultimo, nome] = await Promise.all([
      this.repository.totali(idGdo),
      this.repository.ultimoImport(idGdo),
      this.repository.nomeGdo(idGdo),
    ]);
    return { gdo: { id: idGdo, nome: nome ?? 'GDO' }, ...totali, ultimoImport: ultimo ? importDaRiga(ultimo) : null };
  }
}
