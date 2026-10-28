import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { DataTypes } from 'sequelize';
import { MODELLI_SEQUELIZE } from '../../models';
import { configuraRelazioni } from '../../models/relazioni';
import { sequelize } from '../SequelizeConnector';
import { FILE_SCHEMA } from './fileMigrazioni';

/**
 * Descrizione deterministica dello schema che i modelli Sequelize si aspettano, calcolata senza
 * database: tabelle, colonne, chiavi esterne, indici ed enum. Il suo sha256 sta nell'intestazione
 * schema-dopo di ogni migrazione: all'avvio e in CI si confronta con l'ultima, cosi' un modello
 * cambiato senza migrazione non arriva in produzione.
 *
 * Attenzione: cambiare il formato cambia l'hash di tutti i modelli. Per questo e' versionato.
 */

export const FORMATO_SCHEMA = 1;

// PostgreSQL tronca gli identificatori a 63 byte: nel database l'indice ha il nome troncato
const LUNGHEZZA_MASSIMA_NOME = 63;

export interface RiferimentoSchema {
  tabella: string;
  colonna: string;
  onDelete: string | null;
  onUpdate: string | null;
}

export interface ColonnaSchema {
  /** Tipo come lo scrive format_type() di PostgreSQL, minuscolo (enum: nome del tipo). */
  tipo: string;
  nullable: boolean;
  /** Espressione SQL del default, null se non c'e' o se lo calcola l'applicazione (NOW, UUIDV4). */
  default: string | null;
  chiavePrimaria: boolean;
  autoIncremento: boolean;
  unico: boolean;
  riferimento: RiferimentoSchema | null;
}

export interface IndiceSchema {
  nome: string;
  colonne: string[];
  unico: boolean;
  metodo: string;
  condizione: string | null;
}

export interface VincoloUnicoSchema {
  nome: string;
  colonne: string[];
}

export interface TabellaSchema {
  colonne: Record<string, ColonnaSchema>;
  indici: IndiceSchema[];
  vincoliUnici: VincoloUnicoSchema[];
}

export interface DescrizioneSchema {
  formato: number;
  tabelle: Record<string, TabellaSchema>;
  enum: Record<string, string[]>;
}

// Le API di Sequelize usate qui (queryGenerator, _indexes, uniqueKeys) non sono tipizzate
type Modello = any;

export const generatoreQuery = (): any => sequelize.getQueryInterface().queryGenerator;

export const nomeTabella = (modello: Modello): string => {
  const tabella = modello.getTableName();
  return typeof tabella === 'string' ? tabella : tabella.tableName;
};

/** Come Sequelize (Utils.generateEnumName): enum_<tabella>_<colonna>. */
export const nomeEnum = (tabella: string, colonna: string): string => `enum_${tabella}_${colonna}`;

export const troncaNome = (nome: string): string => nome.slice(0, LUNGHEZZA_MASSIMA_NOME);

/**
 * I modelli del registro nell'ordine di creazione delle tabelle: prima quelle puntate dalle chiavi
 * esterne. Le tabelle ponte di belongsToMany non sono nel registro e restano fuori, come da sempre.
 */
export const modelliInOrdineDiCreazione = (): Modello[] => {
  configuraRelazioni();
  const registro = new Set<unknown>(Object.values(MODELLI_SEQUELIZE).map(voce => voce.model));
  const ordinati = sequelize.modelManager.getModelsTopoSortedByForeignKey();
  if (ordinati == null)
    throw new Error('Dipendenze cicliche fra le chiavi esterne dei modelli: impossibile ordinare le tabelle');
  // getModelsTopoSortedByForeignKey mette prima chi dipende: l'ordine di creazione e' l'inverso
  const risultato = [...ordinati].reverse().filter(modello => registro.has(modello));
  if (risultato.length !== registro.size)
    throw new Error(`Ordinamento dei modelli incompleto: ${risultato.length} su ${registro.size}`);
  return risultato;
};

// Stessi casi di Utils.defaultValueSchemable; in piu' null, che non e' un default reale
const defaultNelloSchema = (valore: unknown): boolean => {
  if (valore === undefined || valore === null) return false;
  const tipi = DataTypes as any;
  if (valore instanceof tipi.NOW || valore instanceof tipi.UUIDV1 || valore instanceof tipi.UUIDV4) return false;
  return typeof valore !== 'function';
};

// Dal tipo scritto da Sequelize a quello che restituisce format_type()
const SINONIMI: Array<[RegExp, string]> = [
  [/^VARCHAR(\(\d+\))?$/i, 'character varying$1'],
  [/^CHAR$/i, 'character(1)'],
  [/^CHAR(\(\d+\))$/i, 'character$1'],
  [/^(?:DECIMAL|NUMERIC)(\(\s*\d+\s*(?:,\s*\d+\s*)?\))?$/i, 'numeric$1'],
  [/^FLOAT(\(\d+\))?$/i, 'double precision'],
  [/^TIME$/i, 'time without time zone'],
  [/^TIMESTAMP$/i, 'timestamp without time zone'],
  [/^BLOB$/i, 'bytea'],
];

export const normalizzaTipo = (tipo: string): string => {
  let risultato = tipo.trim();
  for (const [modello, sostituto] of SINONIMI) {
    if (modello.test(risultato)) {
      risultato = risultato.replace(modello, sostituto);
      break;
    }
  }
  return risultato.toLowerCase().replace(/"/g, '').replace(/\s*,\s*/g, ',');
};

const tipoColonna = (tabella: string, colonna: string, tipo: any): string => {
  if (tipo?.key === 'ENUM') return troncaNome(nomeEnum(tabella, colonna));
  if (tipo?.key === 'ARRAY') return `${tipoColonna(tabella, colonna, tipo.type)}[]`;
  return normalizzaTipo(String(tipo.toSql ? tipo.toSql() : tipo));
};

const tabellaRiferita = (modello: unknown): string => {
  if (typeof modello === 'string') return modello;
  const voce = modello as { tableName?: string; getTableName?: () => unknown };
  return typeof voce.getTableName === 'function' ? nomeTabella(voce) : String(voce.tableName);
};

const descriviColonna = (tabella: string, colonna: string, attributo: any): ColonnaSchema => {
  const riferimento = attributo.references;
  return {
    tipo: tipoColonna(tabella, colonna, attributo.type),
    nullable: !(attributo.allowNull === false || attributo.primaryKey || attributo.autoIncrement),
    default: defaultNelloSchema(attributo.defaultValue) ? String(generatoreQuery().escape(attributo.defaultValue, attributo)) : null,
    chiavePrimaria: Boolean(attributo.primaryKey),
    autoIncremento: Boolean(attributo.autoIncrement),
    unico: attributo.unique === true,
    riferimento: riferimento
      ? {
        tabella: tabellaRiferita(riferimento.model),
        colonna: riferimento.key ?? 'id',
        onDelete: attributo.onDelete ? String(attributo.onDelete).toUpperCase() : null,
        onUpdate: attributo.onUpdate ? String(attributo.onUpdate).toUpperCase() : null,
      }
      : null,
  };
};

const campoIndice = (campo: any): string => {
  if (typeof campo === 'string') return campo;
  const nome = campo?.name ?? campo?.attribute;
  if (!nome) return String(generatoreQuery().handleSequelizeMethod(campo));
  return campo.order ? `${nome} ${String(campo.order).toUpperCase()}` : nome;
};

const descriviIndice = (indice: any): IndiceSchema => ({
  nome: troncaNome(indice.name),
  colonne: indice.fields.map(campoIndice),
  unico: Boolean(indice.unique),
  metodo: String(indice.using ?? 'btree').toLowerCase(),
  condizione: indice.where ? String(generatoreQuery().whereQuery(indice.where)) : null,
});

const valoriEnum = (attributo: any): string[] | null => {
  const tipo = attributo.type?.key === 'ENUM'
    ? attributo.type
    : attributo.type?.key === 'ARRAY' && attributo.type.type?.key === 'ENUM' ? attributo.type.type : null;
  if (!tipo) return null;
  // Come attributeToSQL: values sull'attributo, se ci sono, vincono su quelli del tipo
  return [...(attributo.values ?? tipo.values)];
};

// Confronto per codice, non per locale: l'ordine non deve dipendere dalla macchina
const perNome = (a: { nome: string }, b: { nome: string }): number => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0);

export const descriviSchemaModelli = (): DescrizioneSchema => {
  const tabelle: Record<string, TabellaSchema> = {};
  const enumerazioni: Record<string, string[]> = {};

  for (const modello of modelliInOrdineDiCreazione()) {
    const tabella = nomeTabella(modello);
    if (tabelle[tabella]) throw new Error(`Due modelli sulla stessa tabella ${tabella}`);

    const colonne: Record<string, ColonnaSchema> = {};
    for (const [chiave, attributo] of Object.entries<any>(modello.tableAttributes)) {
      const colonna = attributo.field ?? chiave;
      colonne[colonna] = descriviColonna(tabella, colonna, attributo);
      const valori = valoriEnum(attributo);
      // Anche i nomi dei tipi oltre 63 caratteri arrivano troncati nel database
      if (valori) enumerazioni[troncaNome(nomeEnum(tabella, colonna))] = valori;
    }

    tabelle[tabella] = {
      colonne,
      indici: (modello._indexes as any[]).map(descriviIndice).sort(perNome),
      vincoliUnici: Object.values<any>(modello.uniqueKeys ?? {})
        .filter(vincolo => vincolo.customIndex)
        .map(vincolo => ({ nome: String(vincolo.name), colonne: [...vincolo.fields] }))
        .sort(perNome),
    };
  }

  return { formato: FORMATO_SCHEMA, tabelle, enum: enumerazioni };
};

const ordinaChiavi = (valore: unknown): unknown => {
  if (Array.isArray(valore)) return valore.map(ordinaChiavi);
  if (valore && typeof valore === 'object')
    return Object.fromEntries(Object.keys(valore).sort().map(chiave => [chiave, ordinaChiavi((valore as Record<string, unknown>)[chiave])]));
  return valore;
};

/** JSON con le chiavi in ordine: la stessa descrizione da' sempre lo stesso testo. */
export const jsonCanonico = (valore: unknown, rientro?: number): string => JSON.stringify(ordinaChiavi(valore), null, rientro);

export const testoSchema = (descrizione: DescrizioneSchema): string => `${jsonCanonico(descrizione, 2)}\n`;

export const hashSchema = (descrizione: DescrizioneSchema): string =>
  createHash('sha256').update(jsonCanonico(descrizione), 'utf8').digest('hex');

export const hashSchemaModelli = (): string => hashSchema(descriviSchemaModelli());

export const leggiSchemaSalvato = (file: string = FILE_SCHEMA): DescrizioneSchema => JSON.parse(readFileSync(file, 'utf8'));

export const scriviSchema = (descrizione: DescrizioneSchema, file: string = FILE_SCHEMA): void =>
  writeFileSync(file, testoSchema(descrizione), 'utf8');
