import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { beforeEach, expect, it } from 'vitest';
import { PERMESSI as P, TUTTI_I_PERMESSI } from '../../../../lib/accessi/catalogo';
import { CATEGORIA_PERMESSO, TIPO_UTENTI } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { sequelize } from '../../db/SequelizeConnector';
import { PermessiRepository } from '../../repositories/PermessiRepository';
import { preparaAccessiAllAvvio, SCHEMA_ACCESSI } from '../migrazioneAccessi';
import { creaTabellaStatoAccessi, leggiSchemaAccessi, scriviSchemaAccessi } from '../versionePermessi';

// Il passaggio allo schema 2 degli accessi su PostgreSQL, all'avvio di un'installazione come
// Edro21: permessi di consultazione conservati, Agenzia senza Visualizzazione, menu dell'Agenzia
// pulito, e niente di nuovo ai riavvii.
describeConDatabase('preparazione degli accessi: schema 2 (consultazione e Agenzia)', () => {
  usaDatabase();
  const repository = new PermessiRepository();

  const abilitati = async (tipo: TIPO_UTENTI) => (await sequelize.query<{ codice: string }>(
    `SELECT p.codice FROM permessi_ruolo pr JOIN permessi p USING (id_permesso)
      WHERE pr.tipo_utente = :tipo AND pr.id_ruolo_utente_gdo IS NULL AND pr.abilitato ORDER BY p.codice`,
    { type: QueryTypes.SELECT, replacements: { tipo } }
  )).map(r => r.codice).sort();

  const menuAgenzia = async () => sequelize.query<{ titolo: string; start_page: boolean }>(
    `SELECT titolo, start_page FROM menu_items WHERE tipo_utente = 'Agenzia' ORDER BY ordinamento`,
    { type: QueryTypes.SELECT }
  );

  const scriviPermessi = async (tipo: TIPO_UTENTI, codici: string[]) => {
    const idPerCodice = await repository.allineaCatalogo([]);
    await sequelize.transaction(async (transaction) => {
      await repository.scriviLivello({ tipo }, new Map(codici.map(c => [idPerCodice.get(c)!, true])), transaction);
    });
  };

  const voce = (titolo: string, pathname: string | null, ordinamento: number, startPage = false) => ({
    id_menu_item: randomUUID(), tipo_utente: 'Agenzia', tipo: pathname ? 'item' : 'separator', titolo, pathname,
    icona: pathname ? 'Circle' : null, disabilitato: false, start_page: startPage, ordinamento,
  });

  beforeEach(async () => {
    await svuotaTabelle('permessi_ruolo', 'permessi_ruolo_gdo', 'permessi', 'menu_items', 'script_dati_eseguiti');
    await creaTabellaStatoAccessi();
    // Installazione esistente, gia' al modello per aree
    await repository.allineaCatalogo(TUTTI_I_PERMESSI.map(p => ({
      codice: p.codice, nome: p.nome, descrizione: p.descrizione,
      categoria: p.accesso ? CATEGORIA_PERMESSO.PAGINA : CATEGORIA_PERMESSO.AZIONE, risorsa: p.area.id,
    })));
    await scriviSchemaAccessi(1);
    await scriviPermessi(TIPO_UTENTI.AGENZIA, [P.PROMO.VISUALIZZA, P.PROMO.CREA, P.FILE.DOWNLOAD, P.MATERIALI.VISUALIZZA, P.GDO.VISUALIZZA]);
    await scriviPermessi(TIPO_UTENTI.GDO, [P.PROMO.VISUALIZZA, P.FILE.DOWNLOAD, P.MATERIALI.VISUALIZZA]);
    await scriviPermessi(TIPO_UTENTI.CATEGORY, [P.PROMO.VISUALIZZA, P.PROMO.CREA, P.MATERIALI.VISUALIZZA]);
    for (const riga of [
      voce('VOLANTINI', null, 0),
      voce('Dashboard', '/gdo/dashboard', 1, true),
      voce('PROMOZIONI', null, 2),
      voce('Nuova promozione', '/promozioni/nuova', 3),
      voce('Avanzamento produzione', '/avanzamento-produzione', 4),
      voce('Promozioni in corso', '/promozioni/in-corso', 5),
      voce('MATERIALI VOLANTINO', null, 6),
      voce('Volantini attivi', '/volantini/attivi', 7),
    ]) {
      await sequelize.query(
        `INSERT INTO menu_items (id_menu_item, tipo_utente, tipo, titolo, pathname, icona, disabilitato, start_page, ordinamento, createdat, updatedat)
         VALUES (:id_menu_item, :tipo_utente, :tipo, :titolo, :pathname, :icona, :disabilitato, :start_page, :ordinamento, now(), now())`,
        { replacements: riga }
      );
    }
  });

  it('conserva i download e il report, toglie all\'Agenzia la Visualizzazione e ne pulisce il menu', async () => {
    await preparaAccessiAllAvvio();

    expect(await leggiSchemaAccessi()).toBe(SCHEMA_ACCESSI);
    expect(await abilitati(TIPO_UTENTI.GDO)).toEqual(expect.arrayContaining([P.MATERIALI.SCARICA, P.ANALISI.VISUALIZZA, P.VOLANTINI.VISUALIZZA]));
    // Category resta com'era (D2), con in piu' i permessi per quello che faceva gia': report,
    // panoramica, la sua dashboard, momenti e schemi dei tracciati
    expect(await abilitati(TIPO_UTENTI.CATEGORY)).toEqual([
      P.ANALISI.DASHBOARD_CATEGORY, P.ANALISI.VISUALIZZA, P.MATERIALI.VISUALIZZA, P.PROMO.CREA,
      P.PROMO.GESTISCI_MOMENTI, P.PROMO.GESTISCI_SCHEMI, P.PROMO.VISUALIZZA, P.VOLANTINI.VISUALIZZA,
    ].sort());
    // L'Agenzia perde la Visualizzazione e riceve solo i permessi nuovi della Produzione
    expect(await abilitati(TIPO_UTENTI.AGENZIA)).toEqual([
      P.FILE.DOWNLOAD, P.GDO.VISUALIZZA, P.PROMO.CREA, P.PROMO.GESTISCI_MOMENTI, P.PROMO.GESTISCI_SCHEMI, P.PROMO.VISUALIZZA,
    ].sort());
    expect(await menuAgenzia()).toEqual([
      { titolo: 'PROMOZIONI', start_page: false },
      { titolo: 'Nuova promozione', start_page: false },
      { titolo: 'Avanzamento produzione', start_page: true },
      { titolo: 'Promozioni in corso', start_page: false },
    ]);
  });

  it('una volta sola: ai riavvii un permesso o una voce ridati dall\'amministratore restano', async () => {
    await preparaAccessiAllAvvio();
    await scriviPermessi(TIPO_UTENTI.AGENZIA, [P.MATERIALI.VISUALIZZA]);
    await sequelize.query(
      `INSERT INTO menu_items (id_menu_item, tipo_utente, tipo, titolo, pathname, icona, disabilitato, start_page, ordinamento, createdat, updatedat)
       VALUES (:id, 'Agenzia', 'item', 'Volantini attivi', '/volantini/attivi', 'Circle', false, false, 9, now(), now())`,
      { replacements: { id: randomUUID() } }
    );

    await preparaAccessiAllAvvio();

    expect(await abilitati(TIPO_UTENTI.AGENZIA)).toContain(P.MATERIALI.VISUALIZZA);
    expect((await menuAgenzia()).map(v => v.titolo)).toContain('Volantini attivi');
  });
});
