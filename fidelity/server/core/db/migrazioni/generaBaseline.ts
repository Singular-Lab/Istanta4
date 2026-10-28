#!/usr/bin/env node
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sequelize } from '../SequelizeConnector';
import { CARTELLA_SQL, FILE_BASELINE, FILE_SCHEMA } from './fileMigrazioni';
import {
  descriviSchemaModelli,
  DescrizioneSchema,
  generatoreQuery,
  hashSchema,
  modelliInOrdineDiCreazione,
  nomeTabella,
  scriviSchema,
} from './schemaModelli';

/**
 * Genera sql/0000_baseline.sql e schema.json dai modelli Sequelize, senza database: lo stesso SQL
 * che produceva sequelize.sync() su un database vuoto (createTable + addIndex), ma scritto una volta
 * e congelato. `yarn migrazioni:baseline`; su una baseline gia' presente serve --sovrascrivi.
 *
 * Restano fuori: le tabelle ponte di belongsToMany (mai create dalla sync), sessions
 * (connect-pg-simple), accessi_stato (0001), view e materialized view (oggetti derivati) e gli
 * indici univoci con COALESCE dei permessi: 0001 crea permessi_ruolo_gdo_unique_override e
 * sostituisce l'indice del modello permessi_ruolo con uno dallo stesso nome, con COALESCE.
 */

// Uuid-ossp per uuid_generate_v4() nei default, postgis per la colonna GEOMETRY di utenti
export const ESTENSIONI = ['uuid-ossp', 'postgis'];

const sqlEstensione = (nome: string): string => `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = '${nome}') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS "${nome}";
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Estensione ${nome} assente e non creabile dall''utente %: %. Va creata da un superuser: CREATE EXTENSION "${nome}";', current_user, SQLERRM;
    END;
  END IF;
END $$;`;

// In public, dove le colonne lo cercano: Sequelize scrive il tipo come "public"."enum_..."
const sqlEnum = (nome: string, valori: string[]): string => {
  const qg = generatoreQuery();
  return `DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = ${qg.escape(nome)} AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public".${qg.quoteIdentifier(nome)} AS ENUM (${valori.map(valore => qg.escape(valore)).join(', ')});
  END IF;
END $$;`;
};

// Come QueryInterface.createTable + createTableQuery di Sequelize, ma una colonna per riga
const sqlTabella = (modello: any): string => {
  const qg = generatoreQuery();
  const tabella = nomeTabella(modello);
  const attributi = Object.fromEntries(
    // Come createTable: normalizeAttribute non e' nei tipi pubblici di Sequelize
    Object.entries<any>(modello.tableAttributes).map(([chiave, attributo]) => [chiave, (sequelize as any).normalizeAttribute({ ...attributo })])
  );
  const sqlAttributi: Record<string, string> = qg.attributesToSQL(attributi, { table: tabella, context: 'createTable' });

  const righe: string[] = [];
  const commenti: string[] = [];
  const chiavePrimaria: string[] = [];
  for (const [colonna, definizioneOriginale] of Object.entries(sqlAttributi)) {
    let definizione = definizioneOriginale;
    const commento = definizione.indexOf('COMMENT ');
    if (commento !== -1) {
      commenti.push(`COMMENT ON COLUMN ${qg.quoteTable(tabella)}.${qg.quoteIdentifier(colonna)} IS ${qg.escape(definizione.substring(commento + 8))};`);
      definizione = definizione.substring(0, commento);
    }
    if (definizione.includes('PRIMARY KEY')) chiavePrimaria.push(qg.quoteIdentifier(colonna));
    righe.push(`  ${qg.quoteIdentifier(colonna)} ${qg.dataTypeMapping(tabella, colonna, definizione).trim()}`);
  }
  for (const vincolo of Object.values<any>(modello.uniqueKeys ?? {})) {
    if (vincolo.customIndex)
      righe.push(`  UNIQUE (${vincolo.fields.map((campo: string) => qg.quoteIdentifier(campo)).join(', ')})`);
  }
  if (chiavePrimaria.length > 0) righe.push(`  PRIMARY KEY (${chiavePrimaria.join(', ')})`);

  return [`CREATE TABLE IF NOT EXISTS ${qg.quoteTable(tabella)} (\n${righe.join(',\n')}\n);`, ...commenti].join('\n');
};

const sqlIndici = (modello: any): string[] => {
  const qg = generatoreQuery();
  const tabella = nomeTabella(modello);
  return (modello._indexes as any[]).map((indice) => {
    if (indice.concurrently)
      throw new Error(`Indice ${indice.name}: CONCURRENTLY non puo' stare nella baseline, che gira in una transazione`);
    const sql: string = qg.addIndexQuery(tabella, { ...indice, fields: [...indice.fields] }, tabella);
    if (!/^CREATE (UNIQUE )?INDEX /.test(sql)) throw new Error(`Indice ${indice.name}: SQL inatteso da Sequelize: ${sql}`);
    return `${sql.replace(/^CREATE (UNIQUE )?INDEX /, 'CREATE $1INDEX IF NOT EXISTS ')};`;
  });
};

export interface Baseline {
  sql: string;
  descrizione: DescrizioneSchema;
  hash: string;
  statistiche: { tabelle: number; enum: number; indici: number };
}

export const generaBaseline = (): Baseline => {
  const descrizione = descriviSchemaModelli();
  const hash = hashSchema(descrizione);
  const modelli = modelliInOrdineDiCreazione();
  const enumerazioni = Object.entries(descrizione.enum).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const blocchiTabelle = modelli.map(modello => [sqlTabella(modello), ...sqlIndici(modello)].join('\n'));
  const indici = modelli.reduce((totale, modello) => totale + modello._indexes.length, 0);
  const statistiche = { tabelle: modelli.length, enum: enumerazioni.length, indici };

  const sql = [
    `-- schema-dopo: ${hash}`,
    `-- Baseline dello schema di Fidelity: ${statistiche.tabelle} tabelle, ${statistiche.enum} tipi enum, ${statistiche.indici} indici.`,
    '-- Generata dai modelli Sequelize con `yarn migrazioni:baseline`, tabelle in ordine di chiave esterna.',
    '-- Su un database vuoto crea tutto; su un database esistente non si esegue: viene registrata come',
    '-- adottata. E\' congelata: le modifiche allo schema vanno in una migrazione nuova.',
    '-- Fuori dalla baseline: tabelle ponte di belongsToMany, sessions, accessi_stato (0001), view e',
    '-- materialized view (oggetti derivati), indici univoci con COALESCE dei permessi (0001, che',
    '-- sostituisce con lo stesso nome l\'indice univoco del modello permessi_ruolo).',
    '',
    '-- Estensioni: di solito le crea lo script di inizializzazione del container PostgreSQL',
    ...ESTENSIONI.map(sqlEstensione),
    '',
    '-- Tipi enum',
    ...enumerazioni.map(([nome, valori]) => sqlEnum(nome, valori)),
    '',
    '-- Tabelle e indici',
    blocchiTabelle.join('\n\n'),
    '',
  ].join('\n');

  return { sql, descrizione, hash, statistiche };
};

// Niente database: la generazione deve funzionare anche senza, e non deve toccarne uno per sbaglio
const bloccaConnessioni = (): void => {
  const vietato = async () => {
    throw new Error('La generazione della baseline lavora senza database');
  };
  const istanza = sequelize as any;
  istanza.query = vietato;
  istanza.authenticate = vietato;
  istanza.connectionManager.getConnection = vietato;
};

const main = (): void => {
  bloccaConnessioni();
  const destinazione = path.join(CARTELLA_SQL, FILE_BASELINE);
  if (existsSync(destinazione) && !process.argv.includes('--sovrascrivi')) {
    console.error(`${destinazione} esiste gia': la baseline e' congelata. Per rigenerarla (solo prima del rilascio) usare --sovrascrivi`);
    process.exit(1);
  }
  const baseline = generaBaseline();
  writeFileSync(destinazione, baseline.sql, 'utf8');
  scriviSchema(baseline.descrizione, FILE_SCHEMA);
  console.log(`Baseline scritta in ${destinazione}`);
  console.log(`Schema scritto in ${FILE_SCHEMA}`);
  console.log(`Tabelle: ${baseline.statistiche.tabelle}, enum: ${baseline.statistiche.enum}, indici: ${baseline.statistiche.indici}`);
  console.log(`schema-dopo: ${baseline.hash}`);
  process.exit(0);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
