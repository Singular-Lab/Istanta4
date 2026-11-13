import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Migrazioni dello schema del database di Olimpo, applicate all'avvio (spec olimpo/schema-database-all-avvio).
 *
 * Ogni migrazione e' un file sql/NNNN_nome.sql: quattro cifre, numerate di seguito da 0001, nome in
 * minuscolo con trattini bassi. Lo schema di partenza lo crea ancora `synchronize` di Sequelize; le
 * migrazioni correggono quello che synchronize non sa fare, per esempio aggiungere un valore a un
 * tipo enum gia' esistente. Una migrazione applicata non si cambia piu': la correzione va in una nuova.
 *
 * All'avvio, in una sola transazione con un advisory lock (in produzione partono piu' worker insieme):
 * crea la tabella di storico se manca, applica nell'ordine le migrazioni non registrate e le registra
 * con la loro impronta. Un errore annulla tutto e ferma l'avvio.
 */

export const CARTELLA_SQL = join(__dirname, 'sql');
export const TABELLA_STORICO = 'migrazioni_schema';
/** Chiave fissa dell'advisory lock delle migrazioni di Olimpo. */
export const CHIAVE_LOCK = 46071001;
/** Variabile d'ambiente che, a "false", esclude le migrazioni dall'avvio. */
export const VARIABILE_ALL_AVVIO = 'OLIMPO_MIGRAZIONI_ALL_AVVIO';

export interface Migrazione {
  numero: number;
  /** Nome del file senza estensione, per esempio "0001_tipi_utente_fidelity": e' la chiave nello storico. */
  nome: string;
  sql: string;
  impronta: string;
}

export interface MigrazioneRegistrata {
  nome: string;
  impronta: string;
}

/** Esegue una query nella transazione delle migrazioni e restituisce le righe. */
export interface Esecutore {
  query<T = Record<string, unknown>>(sql: string, parametri?: unknown[]): Promise<T[]>;
}

/** Apre una transazione sul database di Olimpo e vi esegue `lavoro`: un errore la annulla. */
export interface Collegamento {
  inTransazione<T>(lavoro: (esegui: Esecutore) => Promise<T>): Promise<T>;
}

export interface Registro {
  log(messaggio: string): void;
  warn(messaggio: string): void;
}

export interface EsitoMigrazioni {
  /** Migrazioni applicate in questo avvio, nell'ordine. */
  applicate: string[];
  /** Migrazioni registrate nel database ma senza file: il database e' di una versione piu' recente. */
  sconosciute: string[];
}

const NOME_FILE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

/** Impronta del contenuto, indipendente dai fine riga (checkout Windows con autocrlf). */
export const improntaSql = (sql: string): string =>
  createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex');

/**
 * Legge le migrazioni della cartella, in ordine. Un nome fuori formato, un file vuoto o un buco nella
 * numerazione sono errori: meglio non partire che applicare una sequenza che non torna.
 */
export const leggiMigrazioni = (cartella: string = CARTELLA_SQL): Migrazione[] => {
  const migrazioni = readdirSync(cartella)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => {
      const parti = NOME_FILE.exec(file);
      if (!parti) {
        throw new Error(`Migrazione ${file}: il nome deve essere NNNN_nome.sql, con quattro cifre e il nome in minuscolo con trattini bassi`);
      }
      const sql = readFileSync(join(cartella, file), 'utf8');
      if (!sql.trim()) throw new Error(`Migrazione ${file}: il file e' vuoto`);
      return { numero: Number(parti[1]), nome: file.replace(/\.sql$/, ''), sql, impronta: improntaSql(sql) };
    });

  migrazioni.forEach((migrazione, indice) => {
    if (migrazione.numero !== indice + 1) {
      throw new Error(`Migrazioni: manca la numero ${String(indice + 1).padStart(4, '0')} prima di ${migrazione.nome}`);
    }
  });
  return migrazioni;
};

/**
 * Le migrazioni ancora da applicare, nell'ordine. Una migrazione registrata il cui file e' cambiato
 * ferma tutto; una registrata senza file (database di una versione piu' recente) torna fra le sconosciute.
 */
export const daApplicare = (
  migrazioni: readonly Migrazione[],
  registrate: readonly MigrazioneRegistrata[]
): { pendenti: Migrazione[]; sconosciute: string[] } => {
  const perNome = new Map(migrazioni.map((migrazione) => [migrazione.nome, migrazione]));
  const sconosciute: string[] = [];
  for (const registrata of registrate) {
    const file = perNome.get(registrata.nome);
    if (!file) {
      sconosciute.push(registrata.nome);
      continue;
    }
    if (file.impronta !== registrata.impronta.trim()) {
      throw new Error(
        `La migrazione ${registrata.nome} e' stata modificata dopo essere stata applicata: va rimessa com'era e la correzione va in una migrazione nuova`
      );
    }
  }
  const fatte = new Set(registrate.map((registrata) => registrata.nome));
  return { pendenti: migrazioni.filter((migrazione) => !fatte.has(migrazione.nome)), sconosciute };
};

/** Applica le migrazioni mancanti nella transazione di `esegui`, che tiene il lock fino alla fine. */
export const applicaMigrazioni = async (esegui: Esecutore, migrazioni: readonly Migrazione[]): Promise<EsitoMigrazioni> => {
  await esegui.query('SELECT pg_advisory_xact_lock($1)', [CHIAVE_LOCK]);
  await esegui.query(
    `CREATE TABLE IF NOT EXISTS ${TABELLA_STORICO} (
      nome VARCHAR(200) PRIMARY KEY,
      impronta CHAR(64) NOT NULL,
      applicata_il TIMESTAMPTZ NOT NULL DEFAULT now()
    )`
  );
  const registrate = await esegui.query<MigrazioneRegistrata>(`SELECT nome, impronta FROM ${TABELLA_STORICO} ORDER BY nome`);
  const { pendenti, sconosciute } = daApplicare(migrazioni, registrate);

  for (const migrazione of pendenti) {
    try {
      await esegui.query(migrazione.sql);
    } catch (errore) {
      throw new Error(`Migrazione ${migrazione.nome} non riuscita: ${(errore as Error).message}`);
    }
    await esegui.query(`INSERT INTO ${TABELLA_STORICO} (nome, impronta) VALUES ($1, $2)`, [migrazione.nome, migrazione.impronta]);
  }
  return { applicate: pendenti.map((migrazione) => migrazione.nome), sconosciute };
};

/**
 * Il passo dell'avvio: salta tutto se la variabile d'ambiente lo esclude, altrimenti legge le
 * migrazioni e le applica in una transazione, scrivendo nel log cosa ha fatto. Gli errori risalgono
 * e fermano l'avvio.
 */
export const migraAllAvvio = async (
  collegamento: Collegamento,
  registro: Registro,
  ambiente: Record<string, string | undefined> = process.env,
  cartella: string = CARTELLA_SQL
): Promise<EsitoMigrazioni | null> => {
  if ((ambiente[VARIABILE_ALL_AVVIO] ?? '').trim().toLowerCase() === 'false') {
    registro.warn(`Migrazioni del database NON applicate: ${VARIABILE_ALL_AVVIO}=false`);
    return null;
  }
  const migrazioni = leggiMigrazioni(cartella);
  const esito = await collegamento.inTransazione((esegui) => applicaMigrazioni(esegui, migrazioni));
  if (esito.sconosciute.length > 0) {
    registro.warn(`Il database ha migrazioni che questa versione di Olimpo non conosce: ${esito.sconosciute.join(', ')}`);
  }
  registro.log(
    esito.applicate.length > 0
      ? `Migrazioni del database applicate: ${esito.applicate.join(', ')}`
      : 'Migrazioni del database: nulla da applicare'
  );
  return esito;
};
