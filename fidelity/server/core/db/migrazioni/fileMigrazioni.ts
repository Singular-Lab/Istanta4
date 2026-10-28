import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Lettura dei file di migrazione: sql/NNNN_nome.sql, quattro cifre, numerazione contigua da 0000
 * (la baseline). In testa al file, righe di commento:
 *   -- schema-dopo: <sha256 della descrizione dei modelli dopo questa migrazione>   (obbligatoria)
 *   -- senza-transazione                                                             (facoltativa)
 * Un errore qui ferma l'avvio: meglio che applicare una sequenza che non torna.
 */

export const CARTELLA_MIGRAZIONI = path.dirname(fileURLToPath(import.meta.url));
export const CARTELLA_SQL = path.join(CARTELLA_MIGRAZIONI, 'sql');
export const FILE_SCHEMA = path.join(CARTELLA_MIGRAZIONI, 'schema.json');
export const FILE_BASELINE = '0000_baseline.sql';

/** Storico delle migrazioni applicate, nel database. */
export const TABELLA_STORICO = 'migrazioni_schema';

/** Valore provvisorio dell'intestazione, finche' l'hash non viene calcolato: non si applica. */
export const SEGNAPOSTO_HASH = 'DA_CALCOLARE';

const NOME_FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const HASH = /^[0-9a-f]{64}$/;
// Il runner apre gia' la transazione: un COMMIT nel file chiuderebbe la sua a meta'
// (END; resta lecito: chiude i blocchi annidati di PL/pgSQL)
const CONTROLLO_TRANSAZIONE = /^\s*(?:(?:BEGIN|COMMIT|ROLLBACK)(?:\s+(?:TRANSACTION|WORK))?\s*;|START\s+TRANSACTION\b)/im;

export interface Migrazione {
  numero: number;
  /** Nome del file senza .sql: e' la chiave nello storico. */
  nome: string;
  file: string;
  sql: string;
  checksum: string;
  schemaDopo: string;
  senzaTransazione: boolean;
}

/** Checksum del contenuto, indipendente dai fine riga (checkout Windows con autocrlf). */
export const checksumSql = (sql: string): string =>
  createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');

/** Righe di commento in testa al file, fino alla prima istruzione. */
export const leggiIntestazione = (sql: string): string[] => {
  const righe: string[] = [];
  for (const riga of sql.replace(/\r\n/g, '\n').split('\n')) {
    const pulita = riga.trim();
    if (pulita === '') continue;
    if (!pulita.startsWith('--')) break;
    righe.push(pulita);
  }
  return righe;
};

export const analizzaMigrazione = (file: string, sql: string): Migrazione => {
  const nomeFile = path.basename(file);
  const corrispondenza = NOME_FILE.exec(nomeFile);
  if (!corrispondenza)
    throw new Error(`Migrazione ${nomeFile}: il nome deve essere NNNN_nome.sql (quattro cifre, minuscole, cifre e _)`);

  const intestazione = leggiIntestazione(sql);
  let schemaDopo: string | null = null;
  let senzaTransazione = false;
  for (const riga of intestazione) {
    const hash = /^--\s*schema-dopo:\s*(\S*)\s*$/i.exec(riga);
    if (hash) schemaDopo = hash[1];
    if (/^--\s*senza-transazione\s*$/i.test(riga)) senzaTransazione = true;
  }

  if (!schemaDopo)
    throw new Error(`Migrazione ${nomeFile}: manca l'intestazione "-- schema-dopo: <hash>" in testa al file`);
  if (schemaDopo === SEGNAPOSTO_HASH)
    throw new Error(`Migrazione ${nomeFile}: l'intestazione schema-dopo e' ancora ${SEGNAPOSTO_HASH}, va calcolata prima di applicarla`);
  if (!HASH.test(schemaDopo))
    throw new Error(`Migrazione ${nomeFile}: schema-dopo "${schemaDopo}" non e' uno sha256 esadecimale`);
  if (CONTROLLO_TRANSAZIONE.test(sql))
    throw new Error(`Migrazione ${nomeFile}: non deve contenere BEGIN/COMMIT/ROLLBACK, la transazione la apre il runner`);

  return {
    numero: Number(corrispondenza[1]),
    nome: nomeFile.replace(/\.sql$/, ''),
    file,
    sql,
    checksum: checksumSql(sql),
    schemaDopo,
    senzaTransazione,
  };
};

/** Numerazione unica e contigua da 0000: un buco o un doppione vuol dire un merge sbagliato. */
export const verificaNumerazione = (migrazioni: Migrazione[]): void => {
  if (migrazioni.length === 0)
    throw new Error(`Nessuna migrazione trovata: serve almeno ${FILE_BASELINE}`);
  const ordinate = [...migrazioni].sort((a, b) => a.numero - b.numero);
  ordinate.forEach((m, indice) => {
    if (m.numero !== indice) {
      const doppione = ordinate.filter(x => x.numero === m.numero).map(x => x.nome);
      throw new Error(doppione.length > 1
        ? `Migrazioni con lo stesso numero: ${doppione.join(', ')}`
        : `Numerazione delle migrazioni non contigua: attesa ${String(indice).padStart(4, '0')}, trovata ${m.nome}`);
    }
  });
};

export const leggiMigrazioni = (cartella: string = CARTELLA_SQL): Migrazione[] => {
  const file = readdirSync(cartella).filter(f => f.endsWith('.sql')).sort();
  const migrazioni = file.map(f => analizzaMigrazione(path.join(cartella, f), readFileSync(path.join(cartella, f), 'utf8')));
  verificaNumerazione(migrazioni);
  return migrazioni.sort((a, b) => a.numero - b.numero);
};
