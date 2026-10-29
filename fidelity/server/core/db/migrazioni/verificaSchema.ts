import { readFileSync } from 'node:fs';
import { QueryTypes, Transaction } from 'sequelize';
import { log } from '../../logger';
import { sequelize } from '../SequelizeConnector';
import { FILE_SCHEMA, TABELLA_STORICO } from './fileMigrazioni';
import type { DescrizioneSchema } from './schemaModelli';

/**
 * Confronto in sola lettura fra il database e schema.json: tabelle, colonne (tipo e nullabilita'),
 * chiavi primarie, indici ed enum. Non corregge nulla: serve a vedere un'installazione che si e'
 * allontanata dai modelli (adozione senza allineamento, interventi a mano). `yarn
 * migrazioni:verifica`, e all'avvio dopo le migrazioni solo come avviso.
 *
 * Gravita': "problema" e' cio' che i modelli si aspettano e manca o e' diverso; "informazione" e'
 * cio' che c'e' in piu' (colonne, indici, valori enum di versioni precedenti, enum che nessuna
 * colonna usa), di solito innocuo.
 *
 * Gli indici si confrontano per nome e unicita', non per colonne: cosi' l'indice univoco con
 * COALESCE che 0001 crea al posto di quello del modello permessi_ruolo (stesso nome) e' conforme.
 *
 * Gli oggetti attesi che i modelli non descrivono (tabelle di servizio, indici univoci con COALESCE
 * delle migrazioni) non si segnalano affatto: non sono differenze.
 */

// Tabelle che non vengono dai modelli ma sono attese nel database (script_dati_eseguiti: registro
// degli script di dati, migrazione 0010)
export const TABELLE_DI_SERVIZIO = [
  TABELLA_STORICO, 'oggetti_derivati_schema', 'accessi_stato', 'sessions', 'spatial_ref_sys', 'script_dati_eseguiti',
];
// Copie di sicurezza delle migrazioni (0002: tracciati_orfani_20261028, _2, ...)
const PREFISSI_DI_SERVIZIO = ['tracciati_orfani_'];

const eTabellaDiServizio = (tabella: string): boolean =>
  TABELLE_DI_SERVIZIO.includes(tabella) || PREFISSI_DI_SERVIZIO.some(prefisso => tabella.startsWith(prefisso));

// Indici univoci con COALESCE creati da 0001 senza un indice del modello con lo stesso nome
// (permessi_ruolo_gdo_unique_override): Sequelize non sa descrivere l'espressione
export const INDICI_DI_SERVIZIO = [/^permessi_ruolo\w*_unique_\w+$/];

const eIndiceDiServizio = (nome: string): boolean => INDICI_DI_SERVIZIO.some(modello => modello.test(nome));

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
  /** Colonne delle chiavi primarie, nell'ordine della chiave. */
  chiaviPrimarie: Array<{ tabella: string; colonna: string }>;
  /** In ordine di enumsortorder. */
  enum: Array<{ nome: string; valore: string }>;
  /** Enum usati da almeno una colonna, anche come array. */
  enumUsati: string[];
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
  const chiaviDb = raggruppa(catalogo.chiaviPrimarie, r => r.tabella);

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

    // Le installazioni vecchie possono non avere la chiave primaria (0011 la aggiunge dove i dati lo permettono)
    const chiaveAttesa = Object.entries(definizione.colonne).filter(([, c]) => c.chiavePrimaria).map(([nome]) => nome);
    if (chiaveAttesa.length > 0) {
      const chiaveTrovata = (chiaviDb.get(tabella) ?? []).map(r => r.colonna);
      if (chiaveTrovata.length === 0)
        aggiungi({ gravita: 'problema', tipo: 'chiave primaria mancante', oggetto: tabella, atteso: chiaveAttesa.join(', ') });
      else if ([...chiaveTrovata].sort().join(',') !== [...chiaveAttesa].sort().join(','))
        aggiungi({
          gravita: 'problema', tipo: 'chiave primaria diversa', oggetto: tabella,
          atteso: chiaveAttesa.join(', '), trovato: chiaveTrovata.join(', '),
        });
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
      if (!nomiAttesi.has(nome) && !eIndiceDiVincolo(nome) && !eIndiceDiServizio(nome))
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

  // Un enum in piu' usato da una colonna si vede gia' da lei (tipo diverso, colonna o tabella in
  // piu'); quello che nessuna colonna usa e' un avanzo delle versioni precedenti (0012 li elimina)
  const enumUsati = new Set(catalogo.enumUsati);
  for (const nome of [...valoriDb.keys()].sort()) {
    if (!(nome in atteso.enum) && !enumUsati.has(nome))
      aggiungi({ gravita: 'informazione', tipo: 'enum in piu\' non usato', oggetto: nome });
  }

  return differenze;
};

/**
 * Sei letture del catalogo, senza scansioni delle tabelle. Con una transazione le letture la usano:
 * vedono lo schema che ha cambiato e non ancora confermato (test d'integrazione delle migrazioni).
 */
export const leggiCatalogo = async (transaction?: Transaction): Promise<Catalogo> => {
  const opzioni = { type: QueryTypes.SELECT, transaction } as const;
  const tabelle = await sequelize.query<{ tabella: string }>(
    `SELECT c.relname AS tabella
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`,
    opzioni
  );
  const colonne = await sequelize.query<{ tabella: string; colonna: string; tipo: string; nullable: boolean }>(
    `SELECT c.relname AS tabella, a.attname AS colonna, format_type(a.atttypid, a.atttypmod) AS tipo, NOT a.attnotnull AS nullable
     FROM pg_attribute a
     JOIN pg_class c ON c.oid = a.attrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped`,
    opzioni
  );
  const indici = await sequelize.query<{ tabella: string; nome: string; definizione: string }>(
    `SELECT tablename AS tabella, indexname AS nome, indexdef AS definizione FROM pg_indexes WHERE schemaname = 'public'`,
    opzioni
  );
  const chiaviPrimarie = await sequelize.query<{ tabella: string; colonna: string }>(
    `SELECT c.relname AS tabella, a.attname AS colonna
     FROM pg_constraint k
     JOIN pg_class c ON c.oid = k.conrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
     WHERE n.nspname = 'public' AND k.contype = 'p'
     ORDER BY c.relname, array_position(k.conkey, a.attnum)`,
    opzioni
  );
  const enumerazioni = await sequelize.query<{ nome: string; valore: string }>(
    `SELECT t.typname AS nome, e.enumlabel AS valore
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public'
     ORDER BY t.typname, e.enumsortorder`,
    opzioni
  );
  // Colonne di qualunque tabella, vista o tipo composto, in qualunque schema
  const enumUsati = await sequelize.query<{ nome: string }>(
    `SELECT t.typname AS nome
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e'
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
         WHERE a.atttypid IN (t.oid, t.typarray) AND a.attnum > 0 AND NOT a.attisdropped
       )`,
    opzioni
  );
  return {
    tabelle: tabelle.map(r => r.tabella),
    colonne: colonne.map(r => ({ ...r, nullable: Boolean(r.nullable) })),
    indici,
    chiaviPrimarie,
    enum: enumerazioni,
    enumUsati: enumUsati.map(r => r.nome),
  };
};

export const leggiSchemaAtteso = (file: string = FILE_SCHEMA): DescrizioneSchema => JSON.parse(readFileSync(file, 'utf8'));

export const verificaSchema = async (atteso: DescrizioneSchema = leggiSchemaAtteso(), transaction?: Transaction): Promise<Differenza[]> =>
  confrontaSchema(atteso, await leggiCatalogo(transaction));

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
