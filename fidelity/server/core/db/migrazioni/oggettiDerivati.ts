import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryTypes, Sequelize, Transaction } from 'sequelize';
import { log } from '../../logger';

/**
 * Oggetti derivati dalle tabelle: view, materialized view e le loro funzioni.
 *
 * Non sono schema: non si migrano, si ricreano. Ogni file di
 * db/oggetti_derivati e' autosufficiente (elimina e ricrea i suoi oggetti) e
 * i file girano in ordine di nome, quindi le dipendenze vanno nei prefissi
 * piu' bassi. Un file si riesegue solo se e' cambiato (impronta sha256 in
 * oggetti_derivati_schema), se manca uno dei suoi oggetti o se si forza:
 * cosi' un avvio normale non ricostruisce le materialized view.
 */

export const CARTELLA_OGGETTI_DERIVATI = fileURLToPath(new URL('../oggetti_derivati', import.meta.url));

export const TABELLA_IMPRONTE = 'oggetti_derivati_schema';

/**
 * Oggetti che le versioni precedenti creavano e nessun file crea piu'.
 * Sulle installazioni vecchie possono esserci ancora e bloccherebbero l'ALTER
 * delle colonne che leggono: la rimozione li toglie insieme agli altri. La
 * migrazione 0001 li elimina comunque una volta per tutte.
 */
const OBSOLETI = {
  materializzate: ['mv_aree_canali_combinazioni'],
  viste: [
    'v_utenti_completi_filtered',
    'v_combinazioni_canale_area_stats',
    'v_dashboard_utenti_attivita',
    'v_ordini_stampa_dettagli',
    'v_punti_vendita_completa',
    'v_tracciati_completi',
    'v_webhook_statistiche',
  ],
  funzioni: ['refresh_all_materialized_views', 'refresh_mv_aree_canali_combinazioni', 'sp_report_promozione'],
};

export interface OggettoDerivato {
  /** Nome del file, anche chiave in oggetti_derivati_schema. */
  nome: string;
  sql: string;
  impronta: string;
  viste: string[];
  materializzate: string[];
  /** Funzioni create dal file: la loro assenza fa ricreare il file. */
  funzioni: string[];
  /** Funzioni create o eliminate dal file (anche quelle delle versioni precedenti). */
  funzioniGestite: string[];
}

const nomi = (sql: string, espressione: RegExp): string[] =>
  [...new Set([...sql.matchAll(espressione)].map(([, nome]) => nome.toLowerCase()))];

/**
 * Ricava dal testo gli oggetti che il file crea; i commenti non contano.
 * L'impronta ignora i fine riga Windows: un checkout con autocrlf non deve
 * far ricreare gli oggetti.
 */
export const analizzaOggettoDerivato = (nome: string, sql: string): OggettoDerivato => {
  const senzaCommenti = sql.replace(/--[^\n]*/g, '');
  const funzioni = nomi(senzaCommenti, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?(\w+)\s*\(/gi);
  return {
    nome,
    sql,
    impronta: createHash('sha256').update(sql.replace(/\r\n/g, '\n'), 'utf8').digest('hex'),
    viste: nomi(senzaCommenti, /CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi),
    materializzate: nomi(senzaCommenti, /CREATE\s+MATERIALIZED\s+VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi),
    funzioni,
    funzioniGestite: [
      ...new Set([...funzioni, ...nomi(senzaCommenti, /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?(?:public\.)?(\w+)\s*\(/gi)]),
    ],
  };
};

/** File .sql della cartella, in ordine di nome. */
export const leggiOggettiDerivati = async (cartella = CARTELLA_OGGETTI_DERIVATI): Promise<OggettoDerivato[]> => {
  const files = (await readdir(cartella)).filter(file => file.endsWith('.sql')).sort();
  return Promise.all(files.map(async file => analizzaOggettoDerivato(file, await readFile(path.join(cartella, file), 'utf8'))));
};

const elenco = (valori: string[]) => valori.map(valore => `'${valore}'`).join(', ');

/**
 * SQL che elimina tutti gli oggetti derivati, nell'ordine inverso dei file:
 * prima chi dipende, poi le sue dipendenze. Le funzioni si eliminano per nome,
 * con tutti i loro overload (get_attivita_for_user ne ha avuti due).
 */
export const sqlRimozioneOggettiDerivati = (oggetti: OggettoDerivato[]): string => {
  const righe: string[] = [];
  const funzioni = new Set<string>();
  const inversi = [...oggetti].reverse();
  for (const gruppo of [...inversi, { ...OBSOLETI, funzioniGestite: OBSOLETI.funzioni }]) {
    for (const vista of gruppo.materializzate) righe.push(`DROP MATERIALIZED VIEW IF EXISTS public.${vista} CASCADE;`);
    for (const vista of gruppo.viste) righe.push(`DROP VIEW IF EXISTS public.${vista} CASCADE;`);
    for (const funzione of gruppo.funzioniGestite) funzioni.add(funzione);
  }
  if (funzioni.size > 0) {
    // Firme lette tutte prima di eliminare: se un DROP ... CASCADE ne ha gia'
    // tolta una, IF EXISTS la salta invece di trovare un oid senza nome.
    righe.push(`DO $$
DECLARE
  firme TEXT[];
  funzione TEXT;
BEGIN
  SELECT array_agg(p.oid::regprocedure::text) INTO firme
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.proname IN (${elenco([...funzioni])});

  FOREACH funzione IN ARRAY coalesce(firme, ARRAY[]::text[]) LOOP
    EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', funzione);
  END LOOP;
END $$;`);
  }
  return righe.join('\n');
};

/**
 * Elimina tutti gli oggetti derivati, compresi quelli delle versioni
 * precedenti. Va chiamata prima delle migrazioni: una view che legge una
 * colonna ne impedisce ALTER TYPE / ALTER COLUMN. preparaOggettiDerivati li
 * ricrea dopo, perche' li trova mancanti.
 */
export async function rimuoviOggettiDerivati(sequelize: Sequelize, cartella = CARTELLA_OGGETTI_DERIVATI): Promise<void> {
  const sql = sqlRimozioneOggettiDerivati(await leggiOggettiDerivati(cartella));
  await sequelize.transaction(async (transaction) => {
    await sequelize.query(sql, { transaction });
  });
  log.info('Oggetti derivati rimossi');
}

// Un solo processo alla volta, anche con piu' container sullo stesso database.
const SQL_LOCK = `SELECT pg_advisory_xact_lock(hashtext('oggetti_derivati'))`;

/** Oggetti del file che mancano nel database (view per pg_class, funzioni per pg_proc). */
const oggettiMancanti = async (sequelize: Sequelize, oggetto: OggettoDerivato, transaction: Transaction): Promise<string[]> => {
  const righe = await sequelize.query<{ nome: string }>(
    `SELECT nome FROM unnest(ARRAY[:relazioni]::text[]) AS nome
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = nome AND c.relkind IN ('v', 'm')
     )
     UNION ALL
     SELECT nome FROM unnest(ARRAY[:funzioni]::text[]) AS nome
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = nome
     )`,
    {
      replacements: { relazioni: [...oggetto.viste, ...oggetto.materializzate], funzioni: oggetto.funzioni },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  return righe.map(riga => riga.nome);
};

/** Perche' il file va rieseguito, o null se nel database e' gia' come nel file. */
const motivoRicreazione = async (sequelize: Sequelize, oggetto: OggettoDerivato, transaction: Transaction): Promise<string | null> => {
  const [registrata] = await sequelize.query<{ impronta: string }>(
    `SELECT impronta FROM ${TABELLA_IMPRONTE} WHERE nome = :nome`,
    { replacements: { nome: oggetto.nome }, type: QueryTypes.SELECT, transaction }
  );
  // Anche un'installazione che arriva dai vecchi script: gli oggetti ci sono, l'impronta no.
  if (!registrata) return 'impronta assente';
  if (registrata.impronta !== oggetto.impronta) return 'file cambiato';
  const mancanti = await oggettiMancanti(sequelize, oggetto, transaction);
  return mancanti.length > 0 ? `mancano ${mancanti.join(', ')}` : null;
};

/**
 * Crea gli oggetti derivati che mancano o il cui file e' cambiato (tutti con
 * forza) e ne registra l'impronta. Ogni file gira in una transazione; al
 * primo errore si ferma con il nome del file: l'avvio non deve proseguire
 * con oggetti mancanti o vecchi.
 */
export async function preparaOggettiDerivati(
  sequelize: Sequelize,
  opzioni: { forza: boolean; cartella?: string }
): Promise<{ ricreati: string[] }> {
  const oggetti = await leggiOggettiDerivati(opzioni.cartella);

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(SQL_LOCK, { transaction });
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS ${TABELLA_IMPRONTE} (
         nome VARCHAR(255) PRIMARY KEY,
         impronta CHAR(64) NOT NULL,
         creato_il TIMESTAMPTZ NOT NULL DEFAULT now()
       )`,
      { transaction }
    );
  });

  const ricreati: string[] = [];
  for (const oggetto of oggetti) {
    try {
      // Il controllo sta dentro la transazione, dopo il lock: un altro
      // processo puo' averlo appena ricreato.
      const motivo = await sequelize.transaction(async (transaction) => {
        await sequelize.query(SQL_LOCK, { transaction });
        const perche = opzioni.forza ? 'forzato' : await motivoRicreazione(sequelize, oggetto, transaction);
        if (!perche) return null;
        await sequelize.query(oggetto.sql, { transaction });
        await sequelize.query(
          `INSERT INTO ${TABELLA_IMPRONTE} (nome, impronta, creato_il) VALUES (:nome, :impronta, now())
           ON CONFLICT (nome) DO UPDATE SET impronta = EXCLUDED.impronta, creato_il = EXCLUDED.creato_il`,
          { replacements: { nome: oggetto.nome, impronta: oggetto.impronta }, transaction }
        );
        return perche;
      });
      if (motivo) {
        ricreati.push(oggetto.nome);
        log.info(`Oggetto derivato ${oggetto.nome} ricreato (${motivo})`);
      }
    } catch (errore) {
      const messaggio = errore instanceof Error ? errore.message : String(errore);
      throw new Error(`Oggetto derivato ${oggetto.nome} non creato: ${messaggio}`, { cause: errore });
    }
  }

  if (ricreati.length === 0) log.info('Oggetti derivati invariati');
  return { ricreati };
}
