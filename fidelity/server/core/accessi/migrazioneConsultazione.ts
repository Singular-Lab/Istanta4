import { QueryTypes, Transaction } from 'sequelize';
import { CodicePermesso, PERMESSI as P } from '../../../lib/accessi/catalogo';
import { pulisciMenuAgenzia } from '../../../lib/accessi/menuAgenzia';
import { normalizzaPercorso } from '../../../lib/accessi/pagine';
import { PERMESSI_FUORI_DA_AGENZIA } from '../../../lib/accessi/preset';
import { TIPO_UTENTI } from '../../../lib/enums';
import { sequelize } from '../db/SequelizeConnector';
import { chiaveMenu, menuDb, nomeMenu, type RigaMenu } from '../inizializzazione/migrazioneMenuMateriali';
import type { PermessiRepository } from '../repositories/PermessiRepository';

/**
 * Schema 2 degli accessi (lotto L2 della separazione fra Produzione e Visualizzazione), applicato
 * una volta sola all'avvio da preparaAccessiAllAvvio:
 *
 * 1. ogni funzione con il suo permesso, conservando quello che ciascuno poteva fare:
 *    - chi poteva scaricare file ("file.download") riceve "materiali.scarica";
 *    - chi consultava le promozioni ("promo.visualizza") riceve "analisi.visualizza" (Report
 *      tracciati) e la gestione di momenti e schemi dei tracciati, che prima non chiedevano permessi;
 *    a ogni livello (tipo, sotto-ruolo, override di GDO); inoltre panoramica e storico dei volantini
 *    erano aperti a tutti: ogni tipo riceve "volantini.visualizza", e le dashboard Category e
 *    Marketing vanno al loro tipo e a chi le ha nel menu;
 * 2. Agenzia (D9): perde i permessi di Visualizzazione e Comunicazione, anche negli override, e
 *    i suoi menu salvati perdono le voci di quelle aree (lib/accessi/menuAgenzia.ts).
 *
 * Category e Marketing non cambiano (D2): il preset lo applica l'amministratore.
 */

export type RigaLivello = {
  tipo_utente: TIPO_UTENTI;
  id_ruolo_utente_gdo: string | null;
  id_gdo: string | null;
  codice: string;
  abilitato: boolean;
};

export type ModificaPermesso = {
  tipo: TIPO_UTENTI;
  idRuoloGdo: string | null;
  idGdo: string | null;
  codice: CodicePermesso;
  abilitato: boolean;
  motivo: string;
};

export type PulituraMenu = { nome: string; tolte: RigaMenu[]; aggiornate: RigaMenu[] };

export type PianoConsultazione = {
  modifiche: ModificaPermesso[];
  menu: PulituraMenu[];
};

/** Permesso di consultazione concesso a chi ha gia' quello di produzione con cui faceva la stessa cosa. */
const CONSULTAZIONE_DA: ReadonlyArray<{ da: CodicePermesso; a: CodicePermesso }> = [
  { da: P.FILE.DOWNLOAD, a: P.MATERIALI.SCARICA },
  { da: P.PROMO.VISUALIZZA, a: P.ANALISI.VISUALIZZA },
  { da: P.PROMO.VISUALIZZA, a: P.PROMO.GESTISCI_MOMENTI },
  { da: P.PROMO.VISUALIZZA, a: P.PROMO.GESTISCI_SCHEMI },
];

/** Tipi a cui la panoramica dei volantini era aperta e che la conservano: tutti, salvo l'Agenzia (D9). */
const TIPI_CON_PANORAMICA: readonly TIPO_UTENTI[] = (Object.keys(TIPO_UTENTI) as Array<keyof typeof TIPO_UTENTI>)
  .map(chiave => TIPO_UTENTI[chiave])
  .filter(tipo => tipo !== TIPO_UTENTI.SUPERADMIN && tipo !== TIPO_UTENTI.AGENZIA);

/** Dashboard aperte a tutti prima dell'aggiornamento: il loro permesso, il tipo a cui sono dedicate, la pagina. */
const DASHBOARD: ReadonlyArray<{ codice: CodicePermesso; tipo: TIPO_UTENTI; percorso: string }> = [
  { codice: P.ANALISI.DASHBOARD_CATEGORY, tipo: TIPO_UTENTI.CATEGORY, percorso: '/category/dashboard' },
  { codice: P.ANALISI.DASHBOARD_MARKETING, tipo: TIPO_UTENTI.MARKETING, percorso: '/marketing/dashboard' },
];

const chiaveLivello = (tipo: string, idRuolo: string | null, idGdo: string | null) => `${tipo}|${idRuolo ?? ''}|${idGdo ?? ''}`;

/** Cosa cambia, senza scrivere nulla: dalle righe dei permessi (ruoli e override) e dai menu salvati. */
export const calcolaPianoConsultazione = (righe: readonly RigaLivello[], menu: readonly RigaMenu[]): PianoConsultazione => {
  const impostati = new Set(righe.map(r => `${chiaveLivello(r.tipo_utente, r.id_ruolo_utente_gdo, r.id_gdo)}|${r.codice}`));
  const modifiche = new Map<string, ModificaPermesso>();
  const aggiungi = (riga: RigaLivello, codice: CodicePermesso, abilitato: boolean, motivo: string) => {
    const chiave = `${chiaveLivello(riga.tipo_utente, riga.id_ruolo_utente_gdo, riga.id_gdo)}|${codice}`;
    if (modifiche.has(chiave)) return;
    modifiche.set(chiave, {
      tipo: riga.tipo_utente, idRuoloGdo: riga.id_ruolo_utente_gdo, idGdo: riga.id_gdo, codice, abilitato, motivo,
    });
  };
  const eAgenzia = (riga: RigaLivello) => riga.tipo_utente === TIPO_UTENTI.AGENZIA;
  const fuoriDaAgenzia = (codice: string) => PERMESSI_FUORI_DA_AGENZIA.indexOf(codice as CodicePermesso) >= 0;

  for (const riga of righe) {
    if (!riga.abilitato || riga.tipo_utente === TIPO_UTENTI.SUPERADMIN) continue;
    for (const { da, a } of CONSULTAZIONE_DA) {
      if (riga.codice !== da) continue;
      if (eAgenzia(riga) && fuoriDaAgenzia(a)) continue;
      if (impostati.has(`${chiaveLivello(riga.tipo_utente, riga.id_ruolo_utente_gdo, riga.id_gdo)}|${a}`)) continue;
      aggiungi(riga, a, true, `aveva ${da}`);
    }
    if (eAgenzia(riga) && fuoriDaAgenzia(riga.codice)) {
      aggiungi(riga, riga.codice as CodicePermesso, false, "area che l'Agenzia non vede");
    }
  }

  // Pagine che erano aperte a ogni utente autenticato: il permesso a chi le poteva aprire
  const concediAlLivello = (tipo: TIPO_UTENTI, idRuolo: string | null, codice: CodicePermesso, motivo: string) => {
    if (tipo === TIPO_UTENTI.SUPERADMIN || (tipo === TIPO_UTENTI.AGENZIA && fuoriDaAgenzia(codice))) return;
    if (impostati.has(`${chiaveLivello(tipo, idRuolo, null)}|${codice}`)) return;
    aggiungi({ tipo_utente: tipo, id_ruolo_utente_gdo: idRuolo, id_gdo: null, codice, abilitato: true }, codice, true, motivo);
  };
  for (const tipo of TIPI_CON_PANORAMICA) {
    concediAlLivello(tipo, null, P.VOLANTINI.VISUALIZZA, 'panoramica e storico dei volantini aperti a tutti');
  }
  for (const { codice, tipo, percorso } of DASHBOARD) {
    const livelli = new Map<string, { tipo: TIPO_UTENTI; idRuolo: string | null }>([[chiaveLivello(tipo, null, null), { tipo, idRuolo: null }]]);
    for (const voce of menu) {
      if (!voce.pathname || voce.disabilitato || normalizzaPercorso(voce.pathname) !== percorso) continue;
      const tipoVoce = voce.tipo_utente as TIPO_UTENTI;
      livelli.set(chiaveLivello(tipoVoce, voce.id_ruolo_utente_gdo, null), { tipo: tipoVoce, idRuolo: voce.id_ruolo_utente_gdo });
    }
    for (const { tipo: tipoLivello, idRuolo } of livelli.values()) {
      const motivo = tipoLivello === tipo && !idRuolo ? `dashboard del tipo ${tipo}` : `${percorso} nel menu`;
      concediAlLivello(tipoLivello, idRuolo, codice, motivo);
      // L'azione vale solo con l'accesso all'area Report e analisi
      concediAlLivello(tipoLivello, idRuolo, P.ANALISI.VISUALIZZA, motivo);
    }
  }

  const menuAgenzia = new Map<string, RigaMenu[]>();
  for (const voce of menu) {
    if (voce.tipo_utente !== TIPO_UTENTI.AGENZIA) continue;
    const chiave = chiaveMenu(voce);
    menuAgenzia.set(chiave, [...(menuAgenzia.get(chiave) ?? []), voce]);
  }
  const puliture: PulituraMenu[] = [];
  for (const voci of menuAgenzia.values()) {
    const { tolte, aggiornate } = pulisciMenuAgenzia(voci);
    if (tolte.length > 0 || aggiornate.length > 0) puliture.push({ nome: nomeMenu(voci[0]), tolte, aggiornate });
  }

  return { modifiche: [...modifiche.values()], menu: puliture };
};

/** Le righe dei permessi e i menu salvati, nella transazione della preparazione degli accessi. */
export const leggiPianoConsultazione = async (transaction: Transaction): Promise<PianoConsultazione> => {
  const righe = await sequelize.query<RigaLivello>(
    // Le due tabelle hanno ciascuna il suo enum del tipo utente: nell'unione valgono come testo
    `SELECT pr.tipo_utente::text AS tipo_utente, pr.id_ruolo_utente_gdo::text AS id_ruolo_utente_gdo,
            NULL::text AS id_gdo, p.codice, pr.abilitato
       FROM permessi_ruolo pr JOIN permessi p ON p.id_permesso = pr.id_permesso
     UNION ALL
     SELECT prg.tipo_utente::text, prg.id_ruolo_utente_gdo::text, prg.id_gdo::text, p.codice, prg.abilitato
       FROM permessi_ruolo_gdo prg JOIN permessi p ON p.id_permesso = prg.id_permesso`,
    { type: QueryTypes.SELECT, transaction }
  );
  return calcolaPianoConsultazione(righe, await menuDb(transaction).leggiVoci());
};

export const applicaPianoConsultazione = async (
  piano: PianoConsultazione,
  repository: Pick<PermessiRepository, 'scriviLivello'>,
  idPerCodice: Map<string, string>,
  transaction: Transaction
): Promise<void> => {
  const perLivello = new Map<string, { scope: { tipo: TIPO_UTENTI; idRuoloGdo: string | null; idGdo: string | null }; valori: Map<string, boolean | null> }>();
  for (const m of piano.modifiche) {
    const id = idPerCodice.get(m.codice);
    if (!id) continue;
    const chiave = chiaveLivello(m.tipo, m.idRuoloGdo, m.idGdo);
    if (!perLivello.has(chiave)) perLivello.set(chiave, { scope: { tipo: m.tipo, idRuoloGdo: m.idRuoloGdo, idGdo: m.idGdo }, valori: new Map() });
    perLivello.get(chiave)!.valori.set(id, m.abilitato);
  }
  for (const { scope, valori } of perLivello.values()) await repository.scriviLivello(scope, valori, transaction);

  for (const { tolte, aggiornate } of piano.menu) {
    if (tolte.length > 0) {
      await sequelize.query(
        `DELETE FROM menu_items WHERE id_menu_item IN (:ids)`,
        { replacements: { ids: tolte.map(v => v.id_menu_item) }, transaction }
      );
    }
    for (const voce of aggiornate) {
      await sequelize.query(
        `UPDATE menu_items
            SET pathname = :pathname, codice_permesso = :codice_permesso, start_page = :start_page, updatedat = now()
          WHERE id_menu_item = :id_menu_item`,
        {
          replacements: {
            id_menu_item: voce.id_menu_item,
            pathname: voce.pathname ?? null,
            codice_permesso: voce.codice_permesso ?? null,
            start_page: voce.start_page,
          },
          transaction,
        }
      );
    }
  }
};

/** Il registro di cosa cambia, per il log dell'avvio. */
export const descriviPianoConsultazione = (
  piano: PianoConsultazione,
  etichetta: (tipo: string, idRuolo: string | null, idGdo: string | null) => string
): string => {
  const righe: string[] = [];
  const elenca = (titolo: string, modifiche: ModificaPermesso[], segno: string) => {
    righe.push(`${titolo}: ${modifiche.length}`);
    const perRuolo = new Map<string, ModificaPermesso[]>();
    for (const m of modifiche) {
      const nome = etichetta(m.tipo, m.idRuoloGdo, m.idGdo);
      perRuolo.set(nome, [...(perRuolo.get(nome) ?? []), m]);
    }
    perRuolo.forEach((elenco, ruolo) => {
      righe.push(`  ${ruolo}`);
      for (const m of elenco) righe.push(`    ${segno} ${m.codice}  (${m.motivo})`);
    });
  };
  elenca('Permessi di consultazione concessi per conservare la situazione attuale', piano.modifiche.filter(m => m.abilitato), '+');
  elenca("Permessi tolti all'Agenzia (Visualizzazione e Comunicazione)", piano.modifiche.filter(m => !m.abilitato), '-');
  righe.push(`Menu dell'Agenzia cambiati: ${piano.menu.length}`);
  for (const { nome, tolte, aggiornate } of piano.menu) {
    righe.push(`  ${nome}`);
    for (const voce of tolte) righe.push(`    - ${voce.titolo}${voce.pathname ? ` (${voce.pathname})` : ''}`);
    for (const voce of aggiornate.filter(v => v.start_page)) righe.push(`    pagina iniziale: ${voce.titolo} (${voce.pathname})`);
  }
  return righe.join('\n');
};
