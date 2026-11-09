import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import type { VenditaDaScrivere } from '../../vendite/preparaImportVendite';
import { MESSAGGIO_IMPORT_VENDITE_INTERROTTO } from '../../vendite/statoImport';
import { type AvvioImportVendite, type NuovoImportVendite, VenditeRepository } from '../VenditeRepository';

// Le vendite importate e i loro import su PostgreSQL (migrazione 0018): upsert che sostituisce,
// totali, un import in corso per GDO, annullamento, import interrotto, eliminazione del PV.
describeConDatabase('VenditeRepository', () => {
  usaDatabase();
  const repository = new VenditeRepository();

  beforeEach(async () => {
    await svuotaTabelle('importazioni_vendite', 'vendite_prodotti', 'punti_vendita', 'combinazione_canale_area', 'aree', 'canali', 'gdo');
  });

  /** Un PV della GDO, con la sua combinazione canale/area. */
  async function creaPuntoVendita(idGdo: string, nome: string, meta: Record<string, unknown> | null = null): Promise<string> {
    const idArea = randomUUID();
    const idCanale = randomUUID();
    const idCombinazione = randomUUID();
    const id = randomUUID();
    const replacements = { idArea, idCanale, idCombinazione, id, idGdo, nome, meta: meta ? JSON.stringify(meta) : null };
    await sequelize.query(
      `INSERT INTO aree (id_aree, codice_aree, nome_aree, id_gdo_aree, createdat, updatedat)
       VALUES (:idArea, 'TO', 'Toscana', :idGdo, NOW(), NOW())`,
      { replacements }
    );
    await sequelize.query(
      `INSERT INTO canali (id_canali, codice_canali, nome_canali, id_gdo_canali, createdat, updatedat)
       VALUES (:idCanale, 'SS', 'Superstore', :idGdo, NOW(), NOW())`,
      { replacements }
    );
    await sequelize.query(
      `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area, id_canale_combinazione_canale_area,
         id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
       VALUES (:idCombinazione, :idGdo, :idCanale, :idArea, 'ATTIVO', NOW(), NOW())`,
      { replacements }
    );
    await sequelize.query(
      `INSERT INTO punti_vendita (id_puntivendita, nome_puntivendita, citta_puntivendita, cap_puntivendita, indirizzo_puntivendita,
         id_combinazione_canale_area_puntivendita, id_gdo_puntivendita, meta_puntivendita, createdat, updatedat)
       VALUES (:id, :nome, 'Lucca', '55100', 'Via Roma 1', :idCombinazione, :idGdo, CAST(:meta AS jsonb), NOW(), NOW())`,
      { replacements }
    );
    return id;
  }

  const vendita = (idPuntoVendita: string, codice: string, campi: Partial<VenditaDaScrivere> = {}): VenditaDaScrivere => ({
    riga: 2, codiceProdotto: codice, idPuntoVendita, dal: '2026-01-05', al: '2026-01-11', pezzi: 10, valore: 25.5, ...campi,
  });

  const nuovoImport = (idGdo: string, campi: Partial<NuovoImportVendite> = {}): NuovoImportVendite => ({
    id: randomUUID(), idGdo, nomeFile: 'vendite.xlsx', righe: 10, scartate: 2, avviatoDa: randomUUID(), ...campi,
  });

  async function leggiVendite(idGdo: string) {
    return sequelize.query<{ codice_prodotto: string; id_punto_vendita: string; dal: string; al: string; pezzi: string; valore: string | null; id_import: string }>(
      `SELECT codice_prodotto, id_punto_vendita, to_char(dal, 'YYYY-MM-DD') AS dal, to_char(al, 'YYYY-MM-DD') AS al, pezzi, valore, id_import
       FROM vendite_prodotti WHERE id_gdo = :idGdo ORDER BY codice_prodotto, dal`,
      { replacements: { idGdo }, type: QueryTypes.SELECT }
    );
  }

  it('puntiVenditaGdo: id, nome e meta dei PV della sola GDO', async () => {
    const idGdo = await creaGdo();
    const altra = await creaGdo('Altra GDO');
    const lucca = await creaPuntoVendita(idGdo, 'Conad Lucca', { anacan: '123' });
    await creaPuntoVendita(altra, 'Conad Pisa');

    expect(await repository.puntiVenditaGdo(idGdo)).toEqual([{ id: lucca, nome: 'Conad Lucca', meta: { anacan: '123' } }]);
  });

  it('scriviVendite: reimportare la stessa vendita la sostituisce, non la somma; periodi diversi restano', async () => {
    const idGdo = await creaGdo();
    const lucca = await creaPuntoVendita(idGdo, 'Conad Lucca');
    const primo = randomUUID();
    const secondo = randomUUID();

    expect(await repository.scriviVendite(idGdo, primo, [
      vendita(lucca, '1'), vendita(lucca, '2', { valore: null }), vendita(lucca, '1', { dal: '2026-01-12', al: '2026-01-18', pezzi: 3 }),
    ])).toBe(3);
    expect(await repository.scriviVendite(idGdo, secondo, [vendita(lucca, '1', { pezzi: 7.125, valore: 14 })])).toBe(1);

    expect(await leggiVendite(idGdo)).toEqual([
      { codice_prodotto: '1', id_punto_vendita: lucca, dal: '2026-01-05', al: '2026-01-11', pezzi: '7.125', valore: '14.00', id_import: secondo },
      { codice_prodotto: '1', id_punto_vendita: lucca, dal: '2026-01-12', al: '2026-01-18', pezzi: '3.000', valore: '25.50', id_import: primo },
      { codice_prodotto: '2', id_punto_vendita: lucca, dal: '2026-01-05', al: '2026-01-11', pezzi: '10.000', valore: null, id_import: primo },
    ]);
  });

  it('scriviVendite: le vendite di un PV di un\'altra GDO si saltano', async () => {
    const idGdo = await creaGdo();
    const altra = await creaGdo('Altra GDO');
    const lucca = await creaPuntoVendita(idGdo, 'Conad Lucca');
    const pisaAltraGdo = await creaPuntoVendita(altra, 'Conad Pisa');

    expect(await repository.scriviVendite(idGdo, randomUUID(), [vendita(lucca, '1'), vendita(pisaAltraGdo, '2')])).toBe(1);
    expect(await leggiVendite(altra)).toEqual([]);
    expect(await repository.scriviVendite(idGdo, randomUUID(), [])).toBe(0);
  });

  it('totali: righe, prodotti, punti vendita e periodo della sola GDO', async () => {
    const idGdo = await creaGdo();
    const altra = await creaGdo('Altra GDO');
    const lucca = await creaPuntoVendita(idGdo, 'Conad Lucca');
    const pisa = await creaPuntoVendita(idGdo, 'Conad Pisa');
    const prato = await creaPuntoVendita(altra, 'Conad Prato');

    expect(await repository.totali(idGdo)).toEqual({ righe: 0, prodotti: 0, puntiVendita: 0, dal: null, al: null });
    await repository.scriviVendite(idGdo, randomUUID(), [
      vendita(lucca, '1', { dal: '2025-12-29', al: '2026-01-04' }), vendita(pisa, '1'), vendita(pisa, '2', { dal: '2026-01-12', al: '2026-01-18' }),
    ]);
    await repository.scriviVendite(altra, randomUUID(), [vendita(prato, '9', { dal: '2020-01-01', al: '2030-01-01' })]);

    expect(await repository.totali(idGdo)).toEqual({ righe: 3, prodotti: 2, puntiVendita: 2, dal: '2025-12-29', al: '2026-01-18' });
  });

  it('nome della GDO per il riepilogo; null per una GDO che non esiste', async () => {
    const idGdo = await creaGdo('CONAD CENTRALE');

    expect(await repository.nomeGdo(idGdo)).toBe('CONAD CENTRALE');
    expect(await repository.nomeGdo(randomUUID())).toBeNull();
  });

  it('eliminato il punto vendita, le sue vendite se ne vanno', async () => {
    const idGdo = await creaGdo();
    const lucca = await creaPuntoVendita(idGdo, 'Conad Lucca');
    await repository.scriviVendite(idGdo, randomUUID(), [vendita(lucca, '1')]);

    await sequelize.query('DELETE FROM punti_vendita WHERE id_puntivendita = :lucca', { replacements: { lucca } });

    expect(await leggiVendite(idGdo)).toEqual([]);
  });

  it('avviaImport: un solo import in corso per GDO, anche con due avvii contemporanei; le altre GDO sono libere', async () => {
    const idGdo = await creaGdo();
    const altra = await creaGdo('Altra GDO');

    const avvii = await Promise.all([repository.avviaImport(nuovoImport(idGdo)), repository.avviaImport(nuovoImport(idGdo))]);
    const avviato = avvii.find((a): a is Extract<AvvioImportVendite, { avviato: true }> => a.avviato === true);
    const rifiutato = avvii.find((a): a is Extract<AvvioImportVendite, { avviato: false }> => a.avviato === false);

    expect(avviato?.import).toMatchObject({
      id_gdo: idGdo, stato: 'in_corso', nome_file: 'vendite.xlsx', righe: 10, elaborate: 2, scritte: 0, scartate: 2,
      errore: null, terminato_il: null, annullato: false, senza_battito: false,
    });
    expect(rifiutato?.inCorso.id).toBe(avviato?.import.id);
    expect((await repository.avviaImport(nuovoImport(altra))).avviato).toBe(true);
  });

  it('avanzamento, annullamento e conclusione', async () => {
    const idGdo = await creaGdo();
    const avvio = await repository.avviaImport(nuovoImport(idGdo, { avviatoDa: null }));
    if (!avvio.avviato) throw new Error('import non avviato');
    const { id } = avvio.import;

    expect(await repository.avanzamento(id, { elaborate: 5, scritte: 3 })).toBe('continua');
    expect(await repository.richiediAnnullamento(idGdo)).toMatchObject({ id, stato: 'in_corso', annullato: true, elaborate: 5, scritte: 3 });
    expect(await repository.avanzamento(id, { elaborate: 6, scritte: 4 })).toBe('annullato');

    await repository.concludiImport(id, { stato: 'annullato', elaborate: 6, scritte: 4, errore: null });
    const concluso = await repository.ultimoImport(idGdo);
    expect(concluso).toMatchObject({ stato: 'annullato', elaborate: 6, scritte: 4, avviato_da: null });
    expect(concluso?.terminato_il).toBeInstanceOf(Date);

    // Finito, l'import non si tocca piu': il lavoro che arrivasse dopo si ferma
    expect(await repository.avanzamento(id, { elaborate: 9, scritte: 9 })).toBe('perso');
    await repository.concludiImport(id, { stato: 'completato', elaborate: 9, scritte: 9, errore: null });
    expect(await repository.ultimoImport(idGdo)).toMatchObject({ stato: 'annullato', elaborate: 6 });
    expect((await repository.avviaImport(nuovoImport(idGdo))).avviato).toBe(true);
  });

  it('un import in corso senza battito risulta interrotto e non blocca il successivo', async () => {
    const idGdo = await creaGdo();
    const vecchio = await repository.avviaImport(nuovoImport(idGdo));
    if (!vecchio.avviato) throw new Error('import non avviato');
    await sequelize.query(
      `UPDATE importazioni_vendite SET battito_il = NOW() - INTERVAL '10 minutes' WHERE id = :id`,
      { replacements: { id: vecchio.import.id } }
    );
    expect(await repository.ultimoImport(idGdo)).toMatchObject({ id: vecchio.import.id, stato: 'in_corso', senza_battito: true });

    const nuovo = await repository.avviaImport(nuovoImport(idGdo));

    expect(nuovo.avviato).toBe(true);
    const [interrotto] = await sequelize.query<{ stato: string; errore: string; chiuso_al_battito: boolean }>(
      `SELECT stato, errore, terminato_il = battito_il AS chiuso_al_battito FROM importazioni_vendite WHERE id = :id`,
      { replacements: { id: vecchio.import.id }, type: QueryTypes.SELECT }
    );
    expect(interrotto).toEqual({ stato: 'interrotto', errore: MESSAGGIO_IMPORT_VENDITE_INTERROTTO, chiuso_al_battito: true });
  });

  it('battito: rinnova solo l\'import ancora in corso', async () => {
    const idGdo = await creaGdo();
    const avvio = await repository.avviaImport(nuovoImport(idGdo));
    if (!avvio.avviato) throw new Error('import non avviato');
    await sequelize.query(`UPDATE importazioni_vendite SET battito_il = NOW() - INTERVAL '10 minutes' WHERE id = :id`, { replacements: { id: avvio.import.id } });

    await repository.battito(avvio.import.id);

    expect(await repository.ultimoImport(idGdo)).toMatchObject({ stato: 'in_corso', senza_battito: false });
  });
});
