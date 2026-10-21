import { QueryTypes, Transaction } from 'sequelize';
import { CATEGORIA_PERMESSO, TIPO_UTENTI } from '../../../lib/enums';
import {
  accessoRichiestoDa,
  CodicePermesso,
  ePermessoDiSistema,
  esistePermesso,
  TUTTI_I_PERMESSI,
} from '../../../lib/accessi/catalogo';
import { paginaPer } from '../../../lib/accessi/pagine';
import { sequelize } from '../db/SequelizeConnector';
import { log } from '../logger';
import { PermessiRepository } from '../repositories/PermessiRepository';
import { PERMESSI_PREDEFINITI } from './predefiniti';
import {
  creaTabellaStatoAccessi,
  leggiSchemaAccessi,
  scriviSchemaAccessi,
} from './versionePermessi';

/**
 * Preparazione degli accessi all'avvio (una volta sola, prima dei worker).
 *
 * 1. Allinea la tabella `permessi` al catalogo di lib/accessi.
 * 2. Su un'installazione nuova scrive i permessi predefiniti.
 * 3. Su un'installazione esistente (schema 0) migra al modello per aree:
 *    concede l'accesso all'area dove oggi la pagina compare nel menu del ruolo,
 *    o dove il ruolo ha già un'azione dell'area; collega il menu ai sotto-ruoli
 *    per id; toglie i vecchi permessi pagina.* e permessi.gestisci.
 * Ogni passo è idempotente; la migrazione gira in una transazione con lock.
 */

export const SCHEMA_ACCESSI = 1;

export type Concessione = {
  tipo: TIPO_UTENTI;
  idRuoloGdo: string | null;
  idGdo: string | null;
  etichetta: string;
  codice: CodicePermesso;
  motivo: string;
};

export type PianoMigrazione = {
  concessioni: Concessione[];
  menuRuoli: Array<{ ruoloGdo: string; idRuoloGdo: string | null }>;
  codiciObsoleti: string[];
  perdonoGestioneAccessi: string[];
};

type RigaRuolo = { tipo_utente: TIPO_UTENTI; id_ruolo_utente_gdo: string | null; id_gdo?: string | null; codice: string; abilitato: boolean };

const normalizzaNomeRuolo = (nome: string): string => nome.trim().toUpperCase().replace(/^GDO_/, '');

const vociCatalogo = () => TUTTI_I_PERMESSI.map(p => ({
  codice: p.codice,
  nome: p.nome,
  descrizione: p.descrizione,
  categoria: p.accesso ? CATEGORIA_PERMESSO.PAGINA : CATEGORIA_PERMESSO.AZIONE,
  risorsa: p.area.id,
}));

/** Calcola cosa cambierebbe, senza scrivere nulla. */
export const calcolaPianoMigrazione = async (transaction?: Transaction): Promise<PianoMigrazione> => {
  const ruoliGdo = await sequelize.query<{ id_ruolo_utente_gdo: string; ruolo_ruolo_utente_gdo: string }>(
    `SELECT id_ruolo_utente_gdo, ruolo_ruolo_utente_gdo FROM ruolo_utente_gdo`,
    { type: QueryTypes.SELECT, transaction }
  );
  const idPerNome = new Map<string, string>();
  const nomePerId = new Map<string, string>();
  for (const r of ruoliGdo) {
    idPerNome.set(normalizzaNomeRuolo(r.ruolo_ruolo_utente_gdo), r.id_ruolo_utente_gdo);
    nomePerId.set(r.id_ruolo_utente_gdo, r.ruolo_ruolo_utente_gdo);
  }

  const voci = await sequelize.query<{ tipo_utente: TIPO_UTENTI; ruolo_gdo: string | null; pathname: string | null; disabilitato: boolean }>(
    `SELECT tipo_utente, ruolo_gdo, pathname, disabilitato FROM menu_items`,
    { type: QueryTypes.SELECT, transaction }
  );

  const righeRuolo = await sequelize.query<RigaRuolo>(
    `SELECT pr.tipo_utente, pr.id_ruolo_utente_gdo, p.codice, pr.abilitato
       FROM permessi_ruolo pr JOIN permessi p ON p.id_permesso = pr.id_permesso`,
    { type: QueryTypes.SELECT, transaction }
  );
  const righeOverride = await sequelize.query<RigaRuolo>(
    `SELECT prg.tipo_utente, prg.id_ruolo_utente_gdo, prg.id_gdo, p.codice, prg.abilitato
       FROM permessi_ruolo_gdo prg JOIN permessi p ON p.id_permesso = prg.id_permesso`,
    { type: QueryTypes.SELECT, transaction }
  );
  const codiciDb = await sequelize.query<{ codice: string }>(
    `SELECT codice FROM permessi`,
    { type: QueryTypes.SELECT, transaction }
  );

  const chiave = (tipo: string, idRuolo: string | null, idGdo: string | null) => `${tipo}|${idRuolo ?? ''}|${idGdo ?? ''}`;
  const etichetta = (tipo: string, idRuolo: string | null, idGdo: string | null) =>
    `${tipo}${idRuolo ? ` · ${nomePerId.get(idRuolo) ?? idRuolo}` : ''}${idGdo ? ` · GDO ${idGdo}` : ''}`;

  // Valori già abilitati per livello, per non concedere due volte.
  const abilitatiPerLivello = new Map<string, Set<string>>();
  const registra = (r: RigaRuolo) => {
    const k = chiave(r.tipo_utente, r.id_ruolo_utente_gdo ?? null, r.id_gdo ?? null);
    if (!abilitatiPerLivello.has(k)) abilitatiPerLivello.set(k, new Set());
    if (r.abilitato) abilitatiPerLivello.get(k)!.add(r.codice);
  };
  righeRuolo.forEach(registra);
  righeOverride.forEach(registra);

  const concessioni = new Map<string, Concessione>();
  const concedi = (tipo: TIPO_UTENTI, idRuolo: string | null, idGdo: string | null, codice: CodicePermesso, motivo: string) => {
    if (tipo === TIPO_UTENTI.SUPERADMIN || ePermessoDiSistema(codice)) return;
    const k = chiave(tipo, idRuolo, idGdo);
    if (abilitatiPerLivello.get(k)?.has(codice)) return;
    const kc = `${k}|${codice}`;
    if (concessioni.has(kc)) return;
    concessioni.set(kc, { tipo, idRuoloGdo: idRuolo, idGdo, etichetta: etichetta(tipo, idRuolo, idGdo), codice, motivo });
  };

  // 1. Pagine oggi presenti e attive nel menu di ciascun ruolo.
  const menuRuoli = new Map<string, string | null>();
  for (const voce of voci) {
    let idRuolo: string | null = null;
    if (voce.ruolo_gdo) {
      idRuolo = idPerNome.get(normalizzaNomeRuolo(voce.ruolo_gdo)) ?? null;
      menuRuoli.set(voce.ruolo_gdo, idRuolo);
      if (!idRuolo) continue;
    }
    if (!voce.pathname || voce.disabilitato) continue;
    const pagina = paginaPer(voce.pathname);
    if (!pagina || !pagina.permesso) continue;
    concedi(voce.tipo_utente, idRuolo, null, pagina.permesso, `pagina nel menu: ${voce.pathname}`);
    const accesso = accessoRichiestoDa(pagina.permesso);
    if (accesso) concedi(voce.tipo_utente, idRuolo, null, accesso, `pagina nel menu: ${voce.pathname}`);
  }

  // 2. Azioni già abilitate: l'accesso all'area serve perché continuino a valere.
  for (const r of [...righeRuolo, ...righeOverride]) {
    if (!r.abilitato || !esistePermesso(r.codice)) continue;
    const accesso = accessoRichiestoDa(r.codice);
    if (accesso) concedi(r.tipo_utente, r.id_ruolo_utente_gdo ?? null, r.id_gdo ?? null, accesso, `azione abilitata: ${r.codice}`);
  }

  const perdonoGestioneAccessi = Array.from(new Set(
    [...righeRuolo, ...righeOverride]
      .filter(r => r.abilitato && r.codice === 'permessi.gestisci' && r.tipo_utente !== TIPO_UTENTI.SUPERADMIN)
      .map(r => etichetta(r.tipo_utente, r.id_ruolo_utente_gdo ?? null, r.id_gdo ?? null))
  ));

  return {
    concessioni: Array.from(concessioni.values()),
    menuRuoli: Array.from(menuRuoli.entries()).map(([ruoloGdo, idRuoloGdo]) => ({ ruoloGdo, idRuoloGdo })),
    codiciObsoleti: codiciDb.map(c => c.codice).filter(c => !esistePermesso(c)),
    perdonoGestioneAccessi,
  };
};

export const descriviPiano = (piano: PianoMigrazione): string => {
  const righe: string[] = [];
  righe.push(`Accessi concessi per conservare la situazione attuale: ${piano.concessioni.length}`);
  const perRuolo = new Map<string, Concessione[]>();
  for (const c of piano.concessioni) {
    if (!perRuolo.has(c.etichetta)) perRuolo.set(c.etichetta, []);
    perRuolo.get(c.etichetta)!.push(c);
  }
  perRuolo.forEach((elenco, ruolo) => {
    righe.push(`  ${ruolo}`);
    for (const c of elenco) righe.push(`    + ${c.codice}  (${c.motivo})`);
  });
  const nonCollegati = piano.menuRuoli.filter(m => !m.idRuoloGdo);
  righe.push(`Menu di sotto-ruoli collegati per id: ${piano.menuRuoli.length - nonCollegati.length}`);
  for (const m of nonCollegati) righe.push(`  ! menu "${m.ruoloGdo}" senza sotto-ruolo corrispondente: resta senza collegamento`);
  righe.push(`Codici rimossi dal catalogo: ${piano.codiciObsoleti.length}${piano.codiciObsoleti.length ? ` (${piano.codiciObsoleti.join(', ')})` : ''}`);
  if (piano.perdonoGestioneAccessi.length) {
    righe.push('Ruoli che perdono la gestione degli accessi (ora riservata al Superadmin):');
    for (const r of piano.perdonoGestioneAccessi) righe.push(`  - ${r}`);
  }
  return righe.join('\n');
};

const scriviPredefiniti = async (repository: PermessiRepository, idPerCodice: Map<string, string>, transaction: Transaction) => {
  const ruoliGdo = await sequelize.query<{ id_ruolo_utente_gdo: string }>(
    `SELECT id_ruolo_utente_gdo FROM ruolo_utente_gdo`,
    { type: QueryTypes.SELECT, transaction }
  );
  const valoriPer = (codici: CodicePermesso[]) => {
    const valori = new Map<string, boolean | null>();
    for (const voce of TUTTI_I_PERMESSI) {
      if (voce.sistema) continue;
      const id = idPerCodice.get(voce.codice);
      if (id) valori.set(id, codici.indexOf(voce.codice) >= 0);
    }
    return valori;
  };
  for (const tipo of Object.keys(PERMESSI_PREDEFINITI) as TIPO_UTENTI[]) {
    await repository.scriviLivello({ tipo }, valoriPer(PERMESSI_PREDEFINITI[tipo] ?? []), transaction);
  }
  const gdo = PERMESSI_PREDEFINITI[TIPO_UTENTI.GDO] ?? [];
  for (const r of ruoliGdo) {
    await repository.scriviLivello({ tipo: TIPO_UTENTI.GDO, idRuoloGdo: r.id_ruolo_utente_gdo }, valoriPer(gdo), transaction);
  }
};

export const applicaPiano = async (
  piano: PianoMigrazione,
  repository: PermessiRepository,
  idPerCodice: Map<string, string>,
  transaction: Transaction
): Promise<void> => {
  const perLivello = new Map<string, { scope: { tipo: TIPO_UTENTI; idRuoloGdo: string | null; idGdo: string | null }; valori: Map<string, boolean | null> }>();
  for (const c of piano.concessioni) {
    const k = `${c.tipo}|${c.idRuoloGdo ?? ''}|${c.idGdo ?? ''}`;
    if (!perLivello.has(k)) perLivello.set(k, { scope: { tipo: c.tipo, idRuoloGdo: c.idRuoloGdo, idGdo: c.idGdo }, valori: new Map() });
    const id = idPerCodice.get(c.codice);
    if (id) perLivello.get(k)!.valori.set(id, true);
  }
  for (const { scope, valori } of perLivello.values()) {
    await repository.scriviLivello(scope, valori, transaction);
  }
  for (const m of piano.menuRuoli) {
    if (!m.idRuoloGdo) continue;
    await sequelize.query(
      `UPDATE menu_items SET id_ruolo_utente_gdo = :id WHERE ruolo_gdo = :ruolo AND id_ruolo_utente_gdo IS NULL`,
      { replacements: { id: m.idRuoloGdo, ruolo: m.ruoloGdo }, transaction }
    );
  }
  await repository.rimuoviCodici(piano.codiciObsoleti, transaction);
};

/** Da chiamare all'avvio, dopo il sync dello schema. Errori: bloccano l'avvio come il sync del DB. */
export const preparaAccessiAllAvvio = async (repository = new PermessiRepository()): Promise<void> => {
  await creaTabellaStatoAccessi();
  // Anche con DB_SYNC_ON_START=false la colonna serve alla migrazione e al menu.
  await sequelize.query(`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS id_ruolo_utente_gdo UUID`);
  // Vincoli univoci storici delle tabelle dei permessi (idempotente).
  await repository.migrateLegacyConstraint();
  await repository.migrateLegacyGdoConstraint();

  await sequelize.transaction(async (transaction) => {
    await sequelize.query(`SELECT pg_advisory_xact_lock(hashtext('preparazione_accessi'))`, { transaction });

    const catalogoVuoto = Number((await sequelize.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM permessi`, { type: QueryTypes.SELECT, transaction }
    ))[0]?.n ?? 0) === 0;
    const schema = await leggiSchemaAccessi(transaction);

    if (catalogoVuoto) {
      const idPerCodice = await repository.allineaCatalogo(vociCatalogo(), transaction);
      await scriviPredefiniti(repository, idPerCodice, transaction);
      await scriviSchemaAccessi(SCHEMA_ACCESSI, transaction);
      log.info('Accessi: installazione nuova, permessi predefiniti scritti');
      return;
    }

    if (schema < SCHEMA_ACCESSI) {
      // Il piano si calcola prima di allineare il catalogo: servono ancora i vecchi codici.
      const piano = await calcolaPianoMigrazione(transaction);
      const idPerCodice = await repository.allineaCatalogo(vociCatalogo(), transaction);
      await applicaPiano(piano, repository, idPerCodice, transaction);
      await scriviSchemaAccessi(SCHEMA_ACCESSI, transaction);
      log.info(`Accessi migrati al modello per aree (schema ${SCHEMA_ACCESSI})\n${descriviPiano(piano)}`);
      return;
    }

    await repository.allineaCatalogo(vociCatalogo(), transaction);
  });
};
