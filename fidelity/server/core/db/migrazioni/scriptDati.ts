#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryTypes, Transaction } from 'sequelize';
import { log } from '../../logger';
import { closeDatabase, initializeDatabase } from '../index';
import { sequelize } from '../SequelizeConnector';

/**
 * Registro degli script di dati (server/core/scripts): correzioni dei dati lanciate a mano, una
 * tantum o da ripetere. Le migrazioni dello schema hanno il loro storico, questi script no: uno non
 * ripetibile rilanciato per errore (migrate:utenti-gdo) tocca anche i dati creati da allora.
 *
 * Ogni esecuzione reale riuscita si registra in script_dati_eseguiti (migrazione 0010):
 * - non ripetibile e gia' registrato: rifiutato, salvo --forza;
 * - dry-run: mai registrato, e cio' che e' scritto nella transazione passata si annulla;
 * - errore: niente registrato, e cio' che e' scritto nella transazione passata si annulla.
 * Lo script che scrive nella transazione passata e' atomico insieme alla sua registrazione.
 * Il registro conosce solo le esecuzioni da questa versione in poi.
 *
 *   yarn script-dati:stato   script noti ed esecuzioni registrate
 */

export const TABELLA_SCRIPT_DATI = 'script_dati_eseguiti';

export interface ScriptDati {
  /** Chiave nel registro. */
  nome: string;
  ripetibile: boolean;
  /** Come si lancia, per i messaggi. */
  comando: string;
}

/** Script di dati noti: nome nel registro e se si possono ripetere. */
export const SCRIPT_DATI = {
  // Assegna alla GDO scelta gli utenti senza GDO: rilanciato, ci finirebbero anche gli utenti nuovi
  utentiGdo: { nome: 'migrate-utenti-gdo', ripetibile: false, comando: 'yarn migrate:utenti-gdo' },
  // I tre seguenti toccano solo cio' che non e' ancora nello stato voluto
  urlOlimpo: { nome: 'migrate-olimpo-urls', ripetibile: true, comando: 'yarn migrate:olimpo-urls' },
  accessi: { nome: 'migra-accessi', ripetibile: true, comando: 'yarn accessi:migra' },
  segretiProvider: { nome: 'cifra-segreti-provider', ripetibile: true, comando: 'yarn auth:segreti' },
} as const satisfies Record<string, ScriptDati>;

export interface OpzioniScriptDati {
  nome: string;
  ripetibile: boolean;
  comando?: string;
  /** Simulazione: non si registra e la transazione passata si annulla. */
  dryRun?: boolean;
  /** Riesegue uno script non ripetibile gia' registrato. */
  forza?: boolean;
}

export interface EsecuzioneScriptDati {
  nome: string;
  ripetibile: boolean;
  ultima_esecuzione: Date;
  esecuzioni: number;
  durata_ms: number | null;
  esito: unknown;
  versione_app: string | null;
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

const formattaData = (valore: Date | string): string =>
  `${new Date(valore).toISOString().replace('T', ' ').slice(0, 19)} UTC`;

const messaggioDi = (errore: unknown): string => (errore instanceof Error ? errore.message : String(errore));

// Un risultato non serializzabile non deve far fallire uno script gia' riuscito
const serializza = (valore: unknown): string | null => {
  if (valore === undefined) return null;
  try {
    return JSON.stringify(valore) ?? null;
  } catch {
    return null;
  }
};

const verificaRegistro = async (transaction?: Transaction): Promise<void> => {
  const [riga] = await sequelize.query<{ presente: boolean }>(
    `SELECT to_regclass('public.${TABELLA_SCRIPT_DATI}') IS NOT NULL AS presente`,
    { type: QueryTypes.SELECT, transaction }
  );
  if (!riga?.presente) {
    throw new Error(
      `Registro degli script di dati assente (tabella ${TABELLA_SCRIPT_DATI}): ` +
      'applicare prima le migrazioni (yarn migrazioni:applica)'
    );
  }
};

const COLONNE = 'nome, ripetibile, ultima_esecuzione, esecuzioni, durata_ms, esito, versione_app';

const leggiEsecuzione = async (nome: string, transaction: Transaction): Promise<EsecuzioneScriptDati | undefined> => {
  const [riga] = await sequelize.query<EsecuzioneScriptDati>(
    `SELECT ${COLONNE} FROM public.${TABELLA_SCRIPT_DATI} WHERE nome = :nome`,
    { type: QueryTypes.SELECT, replacements: { nome }, transaction }
  );
  return riga;
};

const registra = async (opzioni: OpzioniScriptDati, durataMs: number, risultato: unknown, transaction: Transaction): Promise<void> => {
  await sequelize.query(
    `INSERT INTO public.${TABELLA_SCRIPT_DATI} AS r (${COLONNE})
     VALUES (:nome, :ripetibile, now(), 1, :durata, CAST(:esito AS JSONB), :versione)
     ON CONFLICT (nome) DO UPDATE SET
       ripetibile = EXCLUDED.ripetibile,
       ultima_esecuzione = EXCLUDED.ultima_esecuzione,
       esecuzioni = r.esecuzioni + 1,
       durata_ms = EXCLUDED.durata_ms,
       esito = EXCLUDED.esito,
       versione_app = EXCLUDED.versione_app`,
    {
      replacements: {
        nome: opzioni.nome,
        ripetibile: opzioni.ripetibile,
        durata: durataMs,
        esito: serializza(risultato),
        versione: versioneApp(),
      },
      transaction,
    }
  );
};

const descriviPrecedente = (precedente: EsecuzioneScriptDati): string =>
  `il ${formattaData(precedente.ultima_esecuzione)}` +
  `${precedente.versione_app ? ` (versione ${precedente.versione_app})` : ''}` +
  `, ${precedente.esecuzioni} ${Number(precedente.esecuzioni) === 1 ? 'esecuzione' : 'esecuzioni'}`;

/**
 * Esegue uno script di dati e lo registra. Restituisce il risultato di `esegui`, oppure undefined
 * se lo script non ripetibile era gia' stato eseguito ed e' stato rifiutato (senza toccare nulla).
 * `esegui` riceve la transazione del registro: cio' che vi scrive si conferma solo insieme alla
 * registrazione, e si annulla in dry-run o in caso di errore.
 */
export const eseguiScriptDati = async <T>(
  opzioni: OpzioniScriptDati,
  esegui: (transaction: Transaction) => Promise<T>
): Promise<T | undefined> => {
  const { nome, ripetibile, dryRun = false, forza = false } = opzioni;
  const transaction = await sequelize.transaction();
  let conclusa = false;
  const concludi = async (conferma: boolean): Promise<void> => {
    conclusa = true;
    if (conferma) await transaction.commit();
    else await transaction.rollback();
  };

  try {
    await verificaRegistro(transaction);

    if (!dryRun) {
      // Due esecuzioni insieme passerebbero entrambe il controllo: la seconda si rifiuta
      const [lock] = await sequelize.query<{ preso: boolean }>(
        'SELECT pg_try_advisory_xact_lock(hashtext(:chiave)) AS preso',
        { type: QueryTypes.SELECT, replacements: { chiave: `script_dati:${nome}` }, transaction }
      );
      if (!lock?.preso) throw new Error(`Script di dati ${nome}: gia' in esecuzione in un altro processo`);
    }

    const precedente = await leggiEsecuzione(nome, transaction);
    if (precedente && !ripetibile) {
      const giaEseguito = `Script di dati ${nome}: non ripetibile, gia' eseguito ${descriviPrecedente(precedente)}`;
      const perForzare = `${opzioni.comando ?? nome} --forza`;
      if (dryRun) {
        log.warn(`${giaEseguito}. L'esecuzione reale verrebbe rifiutata senza --forza (${perForzare})`);
      } else if (!forza) {
        log.warn(`${giaEseguito}: non viene rieseguito e non cambia nulla. Per rieseguirlo comunque: ${perForzare}`);
        await concludi(false);
        return undefined;
      } else {
        log.warn(`${giaEseguito}: rieseguito con --forza`);
      }
    }

    const inizio = Date.now();
    const risultato = await esegui(transaction);
    const durataMs = Date.now() - inizio;

    if (dryRun) {
      await concludi(false);
      log.info(`Script di dati ${nome}: dry-run completato in ${durataMs} ms, non registrato`);
      return risultato;
    }

    await registra(opzioni, durataMs, risultato, transaction);
    await concludi(true);
    log.info(`Script di dati ${nome}: eseguito in ${durataMs} ms e registrato in ${TABELLA_SCRIPT_DATI}`);
    return risultato;
  } catch (errore) {
    if (!conclusa) await transaction.rollback().catch(() => undefined);
    log.error(`Script di dati ${nome}: non riuscito, niente registrato`, errore);
    throw errore;
  }
};

export const leggiRegistroScriptDati = async (): Promise<EsecuzioneScriptDati[]> => {
  await verificaRegistro();
  return sequelize.query<EsecuzioneScriptDati>(
    `SELECT ${COLONNE} FROM public.${TABELLA_SCRIPT_DATI} ORDER BY nome`,
    { type: QueryTypes.SELECT }
  );
};

export const stampaStatoScriptDati = async (): Promise<void> => {
  const registro = await leggiRegistroScriptDati();
  const perNome = new Map(registro.map(r => [r.nome, r] as const));
  const noti: ScriptDati[] = Object.values(SCRIPT_DATI);

  console.log('Script di dati');
  console.log('='.repeat(72));
  for (const script of noti) {
    const riga = perNome.get(script.nome);
    const tipo = script.ripetibile ? 'ripetibile' : 'NON ripetibile';
    console.log(`${script.nome.padEnd(28)} ${tipo.padEnd(15)} ${riga ? `eseguito ${descriviPrecedente(riga)}` : 'mai eseguito'}`);
  }
  for (const riga of registro.filter(r => !noti.some(s => s.nome === r.nome))) {
    console.log(`${riga.nome.padEnd(28)} ${'sconosciuto'.padEnd(15)} eseguito ${descriviPrecedente(riga)}`);
  }
  console.log('='.repeat(72));
  console.log('Il registro conosce solo le esecuzioni da quando esiste (migrazione 0010)');
};

const main = (): void => {
  const programma = new Command('script-dati').description('Registro degli script di dati di Fidelity');
  programma
    .command('stato')
    .description('Script di dati noti ed esecuzioni registrate')
    .action(async () => {
      try {
        await initializeDatabase(false);
        await stampaStatoScriptDati();
        await closeDatabase();
        process.exit(0);
      } catch (errore) {
        console.error(messaggioDi(errore));
        process.exit(1);
      }
    });
  programma.parse();
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
