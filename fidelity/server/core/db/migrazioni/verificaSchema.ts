import { readFileSync } from 'node:fs';
import { QueryTypes } from 'sequelize';
import { log } from '../../logger';
import { sequelize } from '../SequelizeConnector';
import { FILE_SCHEMA, TABELLA_STORICO } from './fileMigrazioni';
import type { DescrizioneSchema } from './schemaModelli';

/**
 * Confronto in sola lettura fra il database e schema.json: tabelle, colonne (tipo e nullabilita'),
 * indici ed enum. Non corregge nulla: serve a vedere un'installazione che si e' allontanata dai
 * modelli (adozione senza allineamento, interventi a mano). `yarn migrazioni:verifica`, e all'avvio
 * dopo le migrazioni solo come avviso.
 *
 * Gravita': "problema" e' cio' che i modelli si aspettano e manca o e' diverso; "informazione" e'
 * cio' che c'e' in piu' (colonne, indici o valori enum di versioni precedenti), di solito innocuo.
 *
 * Gli indici si confrontano per nome e unicita', non per colonne: cosi' l'indice univoco con
 * COALESCE che 0001 crea al posto di quello del modello permessi_ruolo (stesso nome) e' conforme.
 */

// Tabelle che non vengono dai modelli ma sono attese nel database
export const TABELLE_DI_SERVIZIO = [TABELLA_STORICO, 'oggetti_derivati_schema', 'accessi_stato', 'sessions', 'spatial_ref_sys'];
// Copie di sicurezza delle migrazioni (0002: tracciati_orfani_20261028, _2, ...)
const PREFISSI_DI_SERVIZIO = ['tracciati_orfani_'];

const eTabellaDiServizio = (tabella: string): boolean =>
  TABELLE_DI_SERVIZIO.includes(tabella) || PREFISSI_DI_SERVIZIO.some(prefisso => tabella.startsWith(prefisso));

export type Gravita = 'problema' | 'informazione';

export interface Differenza {
  gravita: Gravita;
  tipo: string;
  oggetto: string;
  atteso?: string;
  trovato?: string;
}

export interface Catalogo {
  tabelle: string[];
  colonne: Array<{ tabella: string; colonna: string; tipo: string; nullable: boolean }>;
  indici: Array<{ tabella: string; nome: string; definizione: string }>;
  /** In ordine di enumsortorder. */
  enum: Array<{ nome: string; valore: string }>;
}

const normalizza = (tipo: string): string => tipo.toLowerCase().replace(/"/g, '').replace(/\s*,\s*/g, ',').trim();

// Indici dei vincoli (chiave primaria, UNIQUE): li crea PostgreSQL con questi nomi
const eIndiceDiVincolo = (nome: string): boolean => /_pkey$/.test(nome) || /_key\d*$/.test(nome);

const raggruppa = <T, K>(righe: T[], chiave: (riga: T) => K): Map<K, T[]> => {
  const gruppi = new Map<K, T[]>();
  for (const riga of righe) {
    const k = chiave(riga);
    if (!gruppi.has(k)) gruppi.set(k, []);
    gruppi.get(k)!.push(riga);
  }
  return gruppi;
};

export const confrontaSchema = (atteso: DescrizioneSchema, catalogo: Catalogo): Differenza[] => {
  const differenze: Differenza[] = [];
  const aggiungi = (d: Differenza) => differenze.push(d);
  const tabelleDb = new Set(catalogo.tabelle);
  const colonneDb = raggruppa(catalogo.colonne, r => r.tabella);
  const indiciDb = raggruppa(catalogo.indici, r => r.tabella);

  for (const tabella of Object.keys(atteso.tabelle).sort()) {
    const definizione = atteso.tabelle[tabella];
    if (!tabelleDb.has(tabella)) {
      aggiungi({ gravita: 'problema', tipo: 'tabella mancante', oggetto: tabella });
      continue;
    }

    const colonne = new Map((colonneDb.get(tabella) ?? []).map(r => [r.colonna, r] as const));
    for (const [nome, colonna] of Object.entries(definizione.colonne)) {
      const trovata = colonne.get(nome);
      const oggetto = `${tabella}.${nome}`;
      if (!trovata) {
        aggiungi({ gravita: 'problema', tipo: 'colonna mancante', oggetto, atteso: colonna.tipo });
        continue;
      }
      if (normalizza(trovata.tipo) !== normalizza(colonna.tipo))
        aggiungi({ gravita: 'problema', tipo: 'tipo diverso', oggetto, atteso: colonna.tipo, trovato: trovata.tipo });
      if (trovata.nullable !== colonna.nullable)
        aggiungi({
          gravita: 'problema', tipo: 'nullabilita\' diversa', oggetto,
          atteso: colonna.nullable ? 'NULL' : 'NOT NULL', trovato: trovata.nullable ? 'NULL' : 'NOT NULL',
        });
    }
    for (const nome of colonne.keys()) {
      if (!(nome in definizione.colonne)) aggiungi({ gravita: 'informazione', tipo: 'colonna in piu\'', oggetto: `${tabella}.${nome}` });
    }

    const indici = new Map((indiciDb.get(tabella) ?? []).map(r => [r.nome, r.definizione] as const));
    for (const indice of definizione.indici) {
      const trovato = indici.get(indice.nome);
      if (trovato === undefined) {
        aggiungi({ gravita: 'problema', tipo: 'indice mancante', oggetto: `${tabella}.${indice.nome}`, atteso: indice.colonne.join(', ') });
        continue;
      }
      const unico = /^CREATE UNIQUE INDEX/i.test(trovato);
      if (unico !== indice.unico)
        aggiungi({
          gravita: 'problema', tipo: 'unicita\' dell\'indice diversa', oggetto: `${tabella}.${indice.nome}`,
          atteso: indice.unico ? 'UNIQUE' : 'non UNIQUE', trovato: unico ? 'UNIQUE' : 'non UNIQUE',
        });
    }
    const nomiAttesi = new Set(definizione.indici.map(i => i.nome));
    for (const nome of indici.keys()) {
      if (!nomiAttesi.has(nome) && !eIndiceDiVincolo(nome))
        aggiungi({ gravita: 'informazione', tipo: 'indice in piu\'', oggetto: `${tabella}.${nome}` });
    }
  }

  for (const tabella of [...tabelleDb].sort()) {
    if (!(tabella in atteso.tabelle) && !eTabellaDiServizio(tabella))
      aggiungi({ gravita: 'informazione', tipo: 'tabella in piu\'', oggetto: tabella });
  }

  const valoriDb = new Map([...raggruppa(catalogo.enum, r => r.nome)].map(([nome, righe]) => [nome, righe.map(r => r.valore)] as const));
  for (const nome of Object.keys(atteso.enum).sort()) {
    const valori = atteso.enum[nome];
    const trovati = valoriDb.get(nome);
    if (!trovati) {
      aggiungi({ gravita: 'problema', tipo: 'enum mancante', oggetto: nome, atteso: valori.join(', ') });
      continue;
    }
    for (const valore of valori) {
      if (!trovati.includes(valore)) aggiungi({ gravita: 'problema', tipo: 'valore enum mancante', oggetto: `${nome}.${valore}` });
    }
    for (const valore of trovati) {
      if (!valori.includes(valore)) aggiungi({ gravita: 'informazione', tipo: 'valore enum in piu\'', oggetto: `${nome}.${valore}` });
    }
  }

  return differenze;
};

/** Quattro letture del catalogo, senza scansioni delle tabelle. */
export const leggiCatalogo = async (): Promise<Catalogo> => {
  const tabelle = await sequelize.query<{ tabella: string }>(
    `SELECT c.relname AS tabella
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
    { type: QueryTypes.SELECT }
  );
  const colonne = await sequelize.query<{ tabella: string; colonna: string; tipo: string; nullable: boolean }>(
    `SELECT c.relname AS tabella, a.attname AS colonna, format_type(a.atttypid, a.atttypmod) AS tipo, NOT a.attnotnull AS nullable
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped`,
    { type: QueryTypes.SELECT }
  );
  const indici = await sequelize.query<{ tabella: string; nome: string; definizione: string }>(
    `SELECT tablename AS tabella, indexname AS nome, indexdef AS definizione FROM pg_indexes WHERE schemaname = 'public'`,
    { type: QueryTypes.SELECT }
  );
  const enumerazioni = await sequelize.query<{ nome: string; valore: string }>(
    `SELECT t.typname AS nome, e.enumlabel AS valore
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
     ORDER BY t.typname, e.enumsortorder`,
    { type: QueryTypes.SELECT }
  );
  return {
    tabelle: tabelle.map(r => r.tabella),
    colonne: colonne.map(r => ({ ...r, nullable: Boolean(r.nullable) })),
    indici,
    enum: enumerazioni,
  };
};

export const leggiSchemaAtteso = (file: string = FILE_SCHEMA): DescrizioneSchema => JSON.parse(readFileSync(file, 'utf8'));

export const verificaSchema = async (atteso: DescrizioneSchema = leggiSchemaAtteso()): Promise<Differenza[]> =>
  confrontaSchema(atteso, await leggiCatalogo());

export const descriviDifferenza = (d: Differenza): string =>
  `${d.tipo}: ${d.oggetto}${d.atteso !== undefined ? ` (atteso ${d.atteso}${d.trovato !== undefined ? `, trovato ${d.trovato}` : ''})` : ''}`;

/** All'avvio, dopo le migrazioni: solo un avviso, non ferma niente. */
export const segnalaDifferenzeSchema = async (): Promise<void> => {
  try {
    const differenze = await verificaSchema();
    const problemi = differenze.filter(d => d.gravita === 'problema');
    const informazioni = differenze.length - problemi.length;
    if (problemi.length > 0) {
      log.warn(`Schema del database diverso dai modelli in ${problemi.length} punti: dettaglio con yarn migrazioni:verifica`, {
        differenze: problemi.slice(0, 50).map(descriviDifferenza),
      });
    } else {
      log.info(`Schema del database conforme ai modelli${informazioni > 0 ? ` (${informazioni} oggetti in piu', non usati dai modelli)` : ''}`);
    }
  } catch (errore) {
    log.warn('Verifica dello schema non riuscita', { errore: errore instanceof Error ? errore.message : String(errore) });
  }
};
