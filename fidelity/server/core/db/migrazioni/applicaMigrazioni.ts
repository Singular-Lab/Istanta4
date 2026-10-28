import { readFileSync } from 'node:fs';
import { QueryTypes, Transaction } from 'sequelize';
import { RUOLO_UTENTE_GDO } from '../../../../lib/enums';
import { log } from '../../logger';
import { modelliManager } from '../../models';
import { RuoloUtenteGDO } from '../../models/ruolo_gdo';
import { sequelize } from '../SequelizeConnector';
import { leggiMigrazioni, Migrazione, TABELLA_STORICO } from './fileMigrazioni';
import { preparaOggettiDerivati, rimuoviOggettiDerivati } from './oggettiDerivati';
import { hashSchemaModelli } from './schemaModelli';
import { segnalaDifferenzeSchema } from './verificaSchema';

/**
 * Migrazioni versionate dello schema (server/core/db/migrazioni/sql), come le migration di EF in
 * Istanta: si applicano all'avvio, una volta sola, prima dei worker; un errore ferma l'avvio.
 *
 * - Tutto il giro sta sotto un advisory lock di transazione: container, PM2 e server che partono
 *   insieme si mettono in fila, e chi arriva dopo trova tutto applicato.
 * - Ogni migrazione ha la sua transazione con lock_timeout (tranne quelle "-- senza-transazione"):
 *   se fallisce si annulla solo lei e l'avvio si ferma.
 * - Database vuoto: si esegue la baseline 0000 e poi le altre.
 * - Database esistente senza storico: la baseline si adotta (registrata, non eseguita). Se i modelli
 *   sono quelli della baseline gira un'ultima volta l'allineamento con l'ALTER di Sequelize.
 * - View e materialized view si tolgono prima delle migrazioni e si ricreano dopo.
 */

export const CHIAVE_LOCK = 'migrazioni_schema';
export const LOCK_TIMEOUT = '30s';

const SQL_STORICO = `CREATE TABLE IF NOT EXISTS public.${TABELLA_STORICO} (
  nome VARCHAR(200) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  applicata_il TIMESTAMPTZ NOT NULL DEFAULT now(),
  durata_ms INTEGER NOT NULL DEFAULT 0,
  modo VARCHAR(10) NOT NULL CHECK (modo IN ('eseguita', 'adottata')),
  versione_app VARCHAR(50)
)`;

export type ModoMigrazione = 'eseguita' | 'adottata';

export interface RigaStorico {
  nome: string;
  checksum: string;
  modo: ModoMigrazione;
  applicata_il: Date;
  durata_ms: number;
  versione_app: string | null;
}

export interface StatoDatabase {
  /** La tabella migrazioni_schema esiste. */
  storico: boolean;
  /** Esiste gdo: il database non e' vuoto. */
  gdo: boolean;
}

export type Adozione = 'nessuna' | 'con-allineamento' | 'senza-allineamento';

export interface EsitoMigrazioni {
  /** Migrazioni registrate in questo giro, eseguite o adottate, in ordine. */
  applicate: string[];
  adozione: Adozione;
  oggettiRicreati: string[];
}

export interface OpzioniApplicazione {
  /** Per i test: altrimenti si leggono da sql/. */
  migrazioni?: Migrazione[];
  /** Per i test: altrimenti si calcola dai modelli. */
  hashModelli?: string;
}

let versioneLetta: string | null | undefined;
const versioneApp = (): string | null => {
  if (versioneLetta === undefined) {
    try {
      versioneLetta = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')).version ?? null;
    } catch {
      versioneLetta = null;
    }
  }
  return versioneLetta ?? null;
};

export const leggiStatoDatabase = async (): Promise<StatoDatabase> => {
  const [riga] = await sequelize.query<{ storico: boolean; gdo: boolean }>(
    `SELECT to_regclass('public.${TABELLA_STORICO}') IS NOT NULL AS storico, to_regclass('public.gdo') IS NOT NULL AS gdo`,
    { type: QueryTypes.SELECT }
  );
  return { storico: Boolean(riga?.storico), gdo: Boolean(riga?.gdo) };
};

export const leggiStorico = async (): Promise<RigaStorico[]> =>
  sequelize.query<RigaStorico>(
    `SELECT nome, checksum, modo, applicata_il, durata_ms, versione_app FROM ${TABELLA_STORICO} ORDER BY nome`,
    { type: QueryTypes.SELECT }
  );

/** Come Istanta con i "pending model changes": un modello cambiato senza migrazione non parte. */
export const verificaModelloAllineato = (migrazioni: Migrazione[], hashModelli: string): void => {
  const ultima = migrazioni[migrazioni.length - 1];
  if (!ultima || ultima.schemaDopo !== hashModelli) {
    throw new Error(
      'il modello non corrisponde all\'ultima migrazione: creare una migrazione con yarn migrazioni:nuova <nome> ' +
      `(modelli ${hashModelli}, ${ultima?.nome ?? 'nessuna migrazione'} ${ultima?.schemaDopo ?? '-'})`
    );
  }
};

/**
 * Una migrazione gia' applicata non si cambia: il database non la rieseguirebbe e le installazioni
 * divergerebbero. Restituisce le migrazioni registrate che il codice non conosce (versione piu' vecchia).
 */
export const controllaStorico = (migrazioni: Migrazione[], registrate: RigaStorico[]): string[] => {
  const perNome = new Map(migrazioni.map(m => [m.nome, m] as const));
  for (const riga of registrate) {
    const migrazione = perNome.get(riga.nome);
    if (migrazione && migrazione.checksum !== String(riga.checksum).trim()) {
      throw new Error(
        `La migrazione ${riga.nome} e' cambiata dopo essere stata applicata (checksum ${riga.checksum} nel database, ` +
        `${migrazione.checksum} nel file): una migrazione applicata non si modifica, la correzione va in una migrazione nuova`
      );
    }
  }
  return registrate.filter(riga => !perNome.has(riga.nome)).map(riga => riga.nome);
};

const registra = async (migrazione: Migrazione, modo: ModoMigrazione, durataMs: number, transaction?: Transaction): Promise<void> => {
  await sequelize.query(
    `INSERT INTO ${TABELLA_STORICO} (nome, checksum, durata_ms, modo, versione_app) VALUES (:nome, :checksum, :durata, :modo, :versione)`,
    {
      replacements: { nome: migrazione.nome, checksum: migrazione.checksum, durata: durataMs, modo, versione: versioneApp() },
      transaction,
    }
  );
};

const messaggioDi = (errore: unknown): string => (errore instanceof Error ? errore.message : String(errore));

const eseguiMigrazione = async (migrazione: Migrazione): Promise<void> => {
  const inizio = Date.now();
  try {
    if (migrazione.senzaTransazione) {
      // Per CREATE INDEX CONCURRENTLY e simili: niente rollback, la migrazione deve essere rieseguibile
      await sequelize.query(migrazione.sql);
      await registra(migrazione, 'eseguita', Date.now() - inizio);
    } else {
      await sequelize.transaction(async (transaction) => {
        // Una tabella bloccata da un processo ancora attivo fa fallire la migrazione invece di appendere l'avvio
        await sequelize.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`, { transaction });
        await sequelize.query(migrazione.sql, { transaction });
        await registra(migrazione, 'eseguita', Date.now() - inizio, transaction);
      });
    }
  } catch (errore) {
    log.error(`Migrazioni dello schema: ${migrazione.nome} non applicata, avvio interrotto`, errore);
    throw new Error(
      `Migrazione ${migrazione.nome} non applicata${migrazione.senzaTransazione ? '' : ' (annullata)'}: ${messaggioDi(errore)}`,
      { cause: errore }
    );
  }
  log.info(`Migrazioni dello schema: ${migrazione.nome} applicata in ${Date.now() - inizio} ms`);
};

/**
 * Database creato dalla vecchia sincronizzazione: la baseline descrive cio' che ha gia', quindi si
 * registra senza eseguirla. Se i modelli sono quelli della baseline (si sta installando questa
 * versione, o una successiva senza modifiche ai modelli) gira prima, un'ultima volta, l'ALTER di
 * Sequelize; altrimenti l'ALTER porterebbe lo schema oltre la baseline e si salta.
 */
const adottaBaseline = async (baseline: Migrazione, hashModelli: string): Promise<{ adozione: Adozione; falliti: string[] }> => {
  const inizio = Date.now();
  let adozione: Adozione;
  let falliti: string[] = [];
  if (hashModelli === baseline.schemaDopo) {
    log.info('Migrazioni dello schema: database esistente senza storico, ultimo allineamento ai modelli prima di adottare la baseline');
    const risultati = await modelliManager.allineamentoLegacyPerAdozione();
    falliti = risultati.filter(r => !r.successo).map(r => r.modello);
    adozione = 'con-allineamento';
  } else {
    log.warn(
      'Migrazioni dello schema: database esistente senza storico e modelli diversi dalla baseline: ' +
      'la baseline viene adottata senza allineamento. Controllare lo schema con yarn migrazioni:verifica'
    );
    adozione = 'senza-allineamento';
  }
  await registra(baseline, 'adottata', Date.now() - inizio);
  log.info(`Migrazioni dello schema: ${baseline.nome} adottata`);
  return { adozione, falliti };
};

/**
 * Un modello che l'ALTER non riesce ad allineare prima delle correzioni (0001: tipi convertiti,
 * righe orfane) ci riprova dopo. Cio' che resta non allineato finisce nel log, come prima.
 */
const riallineaDopoLeMigrazioni = async (modelli: string[]): Promise<void> => {
  log.info(`Migrazioni dello schema: nuovo allineamento di ${modelli.join(', ')} dopo le migrazioni`);
  const risultati = await modelliManager.allineamentoLegacyPerAdozione({ soloModelli: modelli });
  const ancora = risultati.filter(r => !r.successo);
  if (ancora.length > 0) {
    log.error('Migrazioni dello schema: modelli non allineati durante l\'adozione, controllare con yarn migrazioni:verifica', null, {
      modelli: ancora.map(r => `${r.modello}: ${r.errore ?? 'errore sconosciuto'}`),
    });
  }
};

// Dopo un errore lo schema e' quello di prima della migrazione fallita: le view si possono ricreare
const ripristinaOggettiDerivati = async (): Promise<void> => {
  try {
    await preparaOggettiDerivati(sequelize, { forza: true });
  } catch (errore) {
    log.warn('Migrazioni dello schema: view e materialized view non ricreate dopo l\'errore', { errore: messaggioDi(errore) });
  }
};

/** Ruoli GDO di sistema: dopo le migrazioni, quando la tabella esiste di sicuro. Idempotente. */
export const seedRuoliGdo = async (): Promise<void> => {
  try {
    const presenti = await RuoloUtenteGDO.findAll();
    const mancanti = Object.values(RUOLO_UTENTE_GDO)
      .filter(ruolo => !presenti.some(r => r.ruolo_ruolo_utente_gdo === ruolo))
      .map(ruolo => ({ createdat: new Date(), updatedat: new Date(), ruolo_ruolo_utente_gdo: ruolo }));
    if (mancanti.length > 0) {
      await RuoloUtenteGDO.bulkCreate(mancanti as any[], { ignoreDuplicates: false });
    }
  } catch (errore) {
    log.warn('Seed dei ruoli GDO non riuscito', { errore: messaggioDi(errore) });
  }
};

export const applicaMigrazioni = async (opzioni: OpzioniApplicazione = {}): Promise<EsitoMigrazioni> => {
  const migrazioni = opzioni.migrazioni ?? leggiMigrazioni();
  const hashModelli = opzioni.hashModelli ?? hashSchemaModelli();
  verificaModelloAllineato(migrazioni, hashModelli);

  return sequelize.transaction(async (transazioneLock) => {
    // Il lock dura quanto questa transazione, cioe' tutto il giro: si rilascia anche se il processo muore
    await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:chiave))', {
      replacements: { chiave: CHIAVE_LOCK },
      transaction: transazioneLock,
    });

    const stato = await leggiStatoDatabase();
    // Fuori dalla transazione del lock: le migrazioni, su altre connessioni, devono vederla
    if (!stato.storico) await sequelize.query(SQL_STORICO);
    const registrate = stato.storico ? await leggiStorico() : [];

    const sconosciute = controllaStorico(migrazioni, registrate);
    if (sconosciute.length > 0) {
      log.warn('Migrazioni dello schema: nel database ci sono migrazioni che questa versione non conosce (database piu\' recente del codice?)', {
        migrazioni: sconosciute,
      });
    }

    const giaRegistrate = new Set(registrate.map(r => r.nome));
    const pendenti = migrazioni.filter(m => !giaRegistrate.has(m.nome));
    // Storico vuoto e tabelle presenti: database creato dalla vecchia sincronizzazione
    const daAdottare = registrate.length === 0 && stato.gdo;
    const esito: EsitoMigrazioni = { applicate: [], adozione: 'nessuna', oggettiRicreati: [] };

    if (pendenti.length === 0) {
      log.info('Migrazioni dello schema: nessuna migrazione da applicare');
    } else {
      log.info(`Migrazioni dello schema: applico ${pendenti.length} migrazioni: ${pendenti.map(m => m.nome).join(', ')}`);
      // Una view che legge una colonna ne impedisce l'ALTER
      await rimuoviOggettiDerivati(sequelize);

      let daRiallineare: string[] = [];
      try {
        for (const migrazione of pendenti) {
          if (migrazione.numero === 0 && daAdottare) {
            const adottata = await adottaBaseline(migrazione, hashModelli);
            esito.adozione = adottata.adozione;
            daRiallineare = adottata.falliti;
          } else {
            await eseguiMigrazione(migrazione);
          }
          esito.applicate.push(migrazione.nome);
        }
      } catch (errore) {
        await ripristinaOggettiDerivati();
        throw errore;
      }

      if (daRiallineare.length > 0) await riallineaDopoLeMigrazioni(daRiallineare);
      log.info('Migrazioni dello schema: migrazioni applicate');
    }

    // Con migrazioni applicate si ricreano tutte; altrimenti solo quelle cambiate o mancanti
    const { ricreati } = await preparaOggettiDerivati(sequelize, { forza: pendenti.length > 0 });
    esito.oggettiRicreati = ricreati;

    await seedRuoliGdo();
    return esito;
  });
};

const VALORI_FALSI = ['false', '0', 'no'];

export interface ImpostazioniAvvio {
  applica: boolean;
  /** La variabile che ha deciso, per il log. */
  variabile: string;
  avvisi: string[];
}

/**
 * MIGRAZIONI_APPLICA_ALL_AVVIO (default true, come Migrazioni:ApplicaAllAvvio di Istanta);
 * DB_SYNC_ON_START=false resta come alias; DB_AUTO_SYNC non ha piu' effetto.
 */
export const leggiImpostazioniAvvio = (ambiente: NodeJS.ProcessEnv = process.env): ImpostazioniAvvio => {
  const avvisi: string[] = [];
  const valore = (ambiente.MIGRAZIONI_APPLICA_ALL_AVVIO ?? '').trim().toLowerCase();
  let applica = true;
  let variabile = 'MIGRAZIONI_APPLICA_ALL_AVVIO';

  if (valore !== '') {
    applica = !VALORI_FALSI.includes(valore);
  } else if ((ambiente.DB_SYNC_ON_START ?? '').trim().toLowerCase() === 'false') {
    applica = false;
    variabile = 'DB_SYNC_ON_START';
    avvisi.push('DB_SYNC_ON_START e\' deprecata: usare MIGRAZIONI_APPLICA_ALL_AVVIO=false');
  }

  if ((ambiente.DB_AUTO_SYNC ?? '') !== '')
    avvisi.push('DB_AUTO_SYNC e\' ignorata: lo schema cambia solo con le migrazioni (server/core/db/migrazioni)');

  return { applica, variabile, avvisi };
};

/**
 * Avvio del server, una volta sola e prima dei worker. Un database irraggiungibile, una migrazione
 * fallita o un modello senza migrazione fermano l'avvio; le differenze trovate dalla verifica no.
 */
export const applicaMigrazioniAllAvvio = async (ambiente: NodeJS.ProcessEnv = process.env): Promise<EsitoMigrazioni | null> => {
  const impostazioni = leggiImpostazioniAvvio(ambiente);
  for (const avviso of impostazioni.avvisi) log.warn(avviso);
  if (!impostazioni.applica) {
    log.warn(`Migrazioni dello schema non applicate all'avvio: ${impostazioni.variabile}=false. Lo schema va aggiornato a mano (yarn migrazioni:applica)`);
    return null;
  }

  await sequelize.authenticate();
  const esito = await applicaMigrazioni();
  await segnalaDifferenzeSchema();
  return esito;
};
