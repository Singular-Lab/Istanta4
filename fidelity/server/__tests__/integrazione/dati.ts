import { randomUUID } from 'node:crypto';
import { sequelize } from '../../core/db/SequelizeConnector';

/**
 * Dati minimi per i test d'integrazione, scritti con INSERT espliciti: solo le colonne obbligatorie
 * dello schema delle migrazioni, cosi' un test dice chiaramente da quali dati parte.
 */

type Valore = string | number | boolean | Date | null | Record<string, unknown>;

/** Gli oggetti vanno nelle colonne JSONB come testo JSON. */
function comeSostituzione(valore: Valore): string | number | boolean | Date | null {
  if (valore === null || valore === undefined) return null;
  if (valore instanceof Date) return valore;
  if (typeof valore === 'object') return JSON.stringify(valore);
  return valore;
}

async function inserisci(tabella: string, valori: Record<string, Valore>): Promise<void> {
  const colonne = Object.keys(valori);
  const sostituzioni: Record<string, string | number | boolean | Date | null> = {};
  colonne.forEach((colonna, i) => {
    sostituzioni[`v${i}`] = comeSostituzione(valori[colonna]);
  });
  await sequelize.query(
    `INSERT INTO "${tabella}" (${colonne.map(c => `"${c}"`).join(', ')}) VALUES (${colonne.map((_, i) => `:v${i}`).join(', ')})`,
    { replacements: sostituzioni }
  );
}

const adesso = () => new Date();

export async function creaGdo(nome = 'GDO di prova'): Promise<string> {
  const id = randomUUID();
  await inserisci('gdo', { id_gdo: id, nome_gdo: nome, createdat: adesso(), updatedat: adesso() });
  return id;
}

export interface KitDiProva {
  idGdo: string;
  idPromo: string;
  idRuntime: string;
  idArea: string;
  idCanale: string;
  idFormato: string;
  idDesign: string;
}

/**
 * Promo con un kit runtime, e tutto cio' che il kit richiede: area, canale, formato, raccoglitore,
 * design. Con `promo` il kit va in una promo gia' creata (e nella sua GDO) invece che in una nuova.
 */
export async function creaKitRuntime(opzioni: {
  statoLavorazione?: 'IN_LAVORAZIONE' | 'IN_LAVORAZIONE_CON_ERRORI' | 'IN_REVISIONE' | 'PUBBLICATO' | 'ELIMINATO';
  validitaDal?: Date;
  validitaAl?: Date;
  promo?: Pick<KitDiProva, 'idGdo' | 'idPromo'>;
  statoPromo?: string;
  nomePromo?: string;
  /** tipo_lavorazione_formati del formato del kit: 1 volantino (predefinito), 2 POP. */
  tipoLavorazione?: number;
  nomeFormato?: string;
  tipo?: 'AUTOMATICO' | 'SEMI_AUTOMATICO' | 'MANUALE';
  titolo?: string;
} = {}): Promise<KitDiProva> {
  const idGdo = opzioni.promo?.idGdo ?? await creaGdo();
  const idArea = randomUUID();
  const idCanale = randomUUID();
  const idFormato = randomUUID();
  const idRaccoglitore = randomUUID();
  const idDesign = randomUUID();
  const idPromo = opzioni.promo?.idPromo ?? randomUUID();
  const idRuntime = randomUUID();
  const tipo = opzioni.tipo ?? 'AUTOMATICO';
  const titolo = opzioni.titolo ?? 'SS TO VOL';
  const oggi = adesso();

  await inserisci('aree', { id_aree: idArea, codice_aree: 'TO', nome_aree: 'Toscana', id_gdo_aree: idGdo, createdat: oggi, updatedat: oggi });
  await inserisci('canali', { id_canali: idCanale, codice_canali: 'SS', nome_canali: 'Superstore', id_gdo_canali: idGdo, createdat: oggi, updatedat: oggi });
  const nomeFormato = opzioni.nomeFormato ?? 'Volantino';
  await inserisci('formati', {
    id_formati: idFormato, nome_formati: nomeFormato, codice_formati: nomeFormato.slice(0, 3).toUpperCase(), descrizione_formati: nomeFormato,
    tipo_lavorazione_formati: opzioni.tipoLavorazione ?? 1, createdat: oggi, updatedat: oggi,
  });
  await inserisci('raccoglitore_kit', {
    id: idRaccoglitore, id_formato: idFormato, titolo: 'Raccoglitore di prova', tipo, createdAt: oggi, updatedAt: oggi,
  });
  await inserisci('design_kit', {
    id: idDesign, id_area: idArea, id_canale: idCanale, id_formato: idFormato, titolo, id_raccoglitore: idRaccoglitore,
    stato: 'ATTIVO', tipo, createdAt: oggi, updatedAt: oggi,
  });
  if (!opzioni.promo) {
    await inserisci('promo', {
      id_promo: idPromo, nome_promo: opzioni.nomePromo ?? 'Promo di prova', data_registrazione: oggi,
      validita_dal: opzioni.validitaDal ?? new Date(oggi.getTime() - 86_400_000),
      validita_al: opzioni.validitaAl ?? new Date(oggi.getTime() + 7 * 86_400_000),
      offset_visibilita: 0, stato: opzioni.statoPromo ?? 'VALIDA', gdo: idGdo, createdat: oggi, updatedat: oggi,
    });
  }
  await inserisci('runtime_kit', {
    id: idRuntime, id_area: idArea, id_design: idDesign, id_canale: idCanale, id_formato: idFormato, titolo,
    id_raccoglitore: idRaccoglitore, stato: 'ATTIVO', id_promo: idPromo, tipo,
    stato_lavorazione: opzioni.statoLavorazione ?? 'PUBBLICATO', createdAt: oggi, updatedAt: oggi,
  });
  return { idGdo, idPromo, idRuntime, idArea, idCanale, idFormato, idDesign };
}

export async function creaTipoExport(codice: string): Promise<string> {
  const id = randomUUID();
  await inserisci('tipi_export', {
    id_tipiexport: id, nome_tipiexport: codice, codice_tipiexport: codice, modalita_tipiexport: 'ESPORTA_TUTTO_INSIEME',
    createdat: adesso(), updatedat: adesso(),
  });
  return id;
}

/** File runtime: `tipoExport` e' l'id del tipo, come lo salva Fidelity; `tipoExportCodice` il suo codice. */
export async function creaFile(opzioni: {
  nome: string;
  tipoExport?: string;
  tipoExportCodice?: string;
  meta?: Record<string, unknown>;
  errore?: string;
  idRuntime?: string;
  idOlimpoCloud?: string;
  mime?: string;
  creatoIl?: Date;
}): Promise<string> {
  const id = randomUUID();
  const creatoIl = opzioni.creatoIl ?? adesso();
  await inserisci('files_runtime', {
    id, nome: opzioni.nome, tipo_export: opzioni.tipoExport ?? null, tipo_export_codice: opzioni.tipoExportCodice ?? null,
    meta_olimpo_cloud: opzioni.meta ?? null, error: opzioni.errore ?? null, id_runtime: opzioni.idRuntime ?? null,
    id_olimpo_cloud: opzioni.idOlimpoCloud ?? null, mime: opzioni.mime ?? null, createdAt: creatoIl, updatedAt: creatoIl,
  });
  return id;
}

export async function creaLogFile(opzioni: {
  idKitRuntime: string;
  nomeFile: string;
  versione: number;
  stato?: string;
}): Promise<string> {
  const id = randomUUID();
  await inserisci('files_runtime_log', {
    id, id_kit_runtime: opzioni.idKitRuntime, nome_file: opzioni.nomeFile, data_registrazione: adesso(),
    versione: opzioni.versione, stato: opzioni.stato ?? 'IN_ATTESA', createdAt: adesso(), updatedAt: adesso(),
  });
  return id;
}

/** Utente legato a una GDO con uno dei ruoli creati dalle migrazioni (seed dei ruoli GDO). */
export async function creaUtenteConRuolo(ruolo: string): Promise<{ idUtente: string; idRuolo: string }> {
  const [righe] = await sequelize.query(
    'SELECT id_ruolo_utente_gdo FROM ruolo_utente_gdo WHERE ruolo_ruolo_utente_gdo = :ruolo',
    { replacements: { ruolo } }
  );
  const idRuolo = (righe as { id_ruolo_utente_gdo: string }[])[0]?.id_ruolo_utente_gdo;
  if (!idRuolo) throw new Error(`Ruolo GDO "${ruolo}" assente: le migrazioni dovrebbero averlo creato`);

  const idGdo = await creaGdo();
  const idUtente = randomUUID();
  await inserisci('utenti', {
    id_utenti: idUtente, nome_utenti: 'Mario', cognome_utenti: 'Rossi', email_utenti: `${idUtente}@esempio.it`,
    tipo_utenti: 'GDO', createdat: adesso(), updatedat: adesso(),
  });
  await inserisci('utenti_gdo', {
    id_utente_utentegdo: idUtente, id_gdo_utentegdo: idGdo, id_ruolo_utente_gdo: idRuolo, createdat: adesso(), updatedat: adesso(),
  });
  return { idUtente, idRuolo };
}
