import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { beforeEach, expect, it, vi } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { AnalisiKit } from '../../models/analisi_kit';
import { contaCampiNonTradotti, sincronizzaCampoNonTradotto } from '../ReferenzeService';

// Sync dei mapping WebPliant aggiunti dopo (TASK-09feff61), su PostgreSQL vero: conteggi, rinomina
// nei quattro posti in cui TraduttoreReferenze mette un campo, e transazione (tutte o nessuna).

interface Righe {
  data_fields?: Record<string, unknown>;
  group_elements?: unknown;
  compiled_fields?: unknown;
  deleted_fields?: string[];
}

async function creaReferenza(kit: KitDiProva, righe: Righe): Promise<string> {
  const id = randomUUID();
  await sequelize.query(
    `INSERT INTO "referenze" ("id", "codice_box", "data_fields", "group_elements", "compiled_fields", "deleted_fields",
       "id_runtime_kit", "id_promo", "createdAt", "updatedAt")
     VALUES (:id, :id, CAST(:dati AS jsonb), CAST(:gruppo AS jsonb), CAST(:testi AS jsonb), CAST(:eliminati AS varchar(255)[]), :kit, :promo, :prima, :prima)`,
    {
      replacements: {
        id, kit: kit.idRuntime, promo: kit.idPromo, prima: new Date('2026-01-01T00:00:00Z'),
        dati: JSON.stringify(righe.data_fields ?? {}),
        gruppo: JSON.stringify(righe.group_elements ?? []),
        testi: JSON.stringify(righe.compiled_fields ?? []),
        eliminati: `{${(righe.deleted_fields ?? []).map((d) => `"${d}"`).join(',')}}`,
      },
    }
  );
  return id;
}

async function leggi(id: string): Promise<Required<Righe> & { updatedAt: Date }> {
  const [riga] = await sequelize.query<Required<Righe> & { updatedAt: Date }>(
    `SELECT "data_fields", "group_elements", "compiled_fields", "deleted_fields", "updatedAt" FROM "referenze" WHERE "id" = :id`,
    { replacements: { id }, type: QueryTypes.SELECT }
  );
  return riga;
}

async function creaAnalisi(kit: KitDiProva): Promise<void> {
  await AnalisiKit.create({ id_kit_runtime: kit.idRuntime, versione: 1, dati: {}, descrizioni: {}, aggiornato_il: new Date(), referenze_al: new Date() } as never);
}

describeConDatabase('campi non tradotti delle referenze su PostgreSQL', () => {
  usaDatabase();

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'formati', 'referenze', 'analisi_kit');
    vi.restoreAllMocks();
  });

  it('conta una volta ogni referenza che ha il campo, in uno qualunque dei quattro posti', async () => {
    const kit = await creaKitRuntime();
    await creaReferenza(kit, { data_fields: { promo_db1: '2101P' }, group_elements: [{ promo_db1: '2101P' }] });
    await creaReferenza(kit, { group_elements: [{ codice: '1' }, { promo_db1: '2101P' }] });
    await creaReferenza(kit, { compiled_fields: [{ labelName: 'promo_db1', content: 'x' }] });
    await creaReferenza(kit, { compiled_fields: [{ label_name: 'promo_db1', content: 'x' }] });
    await creaReferenza(kit, { deleted_fields: ['promo_db1'] });
    await creaReferenza(kit, { data_fields: { codice_referenza: '1' }, group_elements: { non: 'un elenco' }, compiled_fields: ['testo'] });

    expect(await contaCampiNonTradotti(['promo_db1', 'codice_referenza', 'assente'])).toEqual({ promo_db1: 5, codice_referenza: 1 });
    expect(await contaCampiNonTradotti([])).toEqual({});
  });

  it('rinomina il campo ovunque, conserva il valore e lascia le altre referenze come sono', async () => {
    const kit = await creaKitRuntime();
    const altroKit = await creaKitRuntime();
    const id = await creaReferenza(kit, {
      data_fields: { codice_referenza: '1', promo_db1: '2101P' },
      group_elements: [{ codice_referenza: '1', promo_db1: '2101P' }, { codice_referenza: '2' }],
      compiled_fields: [{ labelName: 'promo_db1', label_name: 'promo_db1', content: '2101P' }, { labelName: 'descrizione', content: 'Pasta' }],
      deleted_fields: ['promo_db1', 'altro'],
    });
    const intatta = await creaReferenza(altroKit, { data_fields: { codice_referenza: '9' }, deleted_fields: ['altro'] });
    await creaAnalisi(kit);
    await creaAnalisi(altroKit);
    const primaIntatta = await leggi(intatta);

    const esito = await sincronizzaCampoNonTradotto('promo_db1', 'codice_promo');

    expect(esito).toEqual({ referenze: 1, kit: 1 });
    const dopo = await leggi(id);
    expect(dopo.data_fields).toEqual({ codice_referenza: '1', codice_promo: '2101P' });
    // Gli elementi del gruppo restano nell'ordine di prima
    expect(dopo.group_elements).toEqual([{ codice_referenza: '1', codice_promo: '2101P' }, { codice_referenza: '2' }]);
    expect(dopo.compiled_fields).toEqual([
      { labelName: 'codice_promo', label_name: 'codice_promo', content: '2101P' },
      { labelName: 'descrizione', content: 'Pasta' },
    ]);
    expect(dopo.deleted_fields).toEqual(['codice_promo', 'altro']);
    expect(dopo.updatedAt.getTime()).toBeGreaterThan(new Date('2026-01-01T00:00:00Z').getTime());
    expect(await leggi(intatta)).toEqual(primaIntatta);
    // Solo l'analisi salvata del kit toccato se ne va
    expect((await AnalisiKit.findAll({ raw: true })).map((a) => a.id_kit_runtime)).toEqual([altroKit.idRuntime]);
    expect(await contaCampiNonTradotti(['promo_db1'])).toEqual({});
  });

  it('se il campo tradotto c\'e\' gia\', vince il suo valore e il vecchio si toglie', async () => {
    const kit = await creaKitRuntime();
    const id = await creaReferenza(kit, {
      data_fields: { prezzo_offerta: 2.49, prezzo: 2.29 },
      group_elements: [{ prezzo_offerta: 2.49, prezzo: 2.29 }],
      deleted_fields: ['prezzo_offerta', 'prezzo'],
    });

    await sincronizzaCampoNonTradotto('prezzo_offerta', 'prezzo');

    const dopo = await leggi(id);
    expect(dopo.data_fields).toEqual({ prezzo: 2.29 });
    expect(dopo.group_elements).toEqual([{ prezzo: 2.29 }]);
    expect(dopo.deleted_fields).toEqual(['prezzo']);
  });

  it('un errore a meta\' annulla tutto: nessuna referenza cambia e le analisi restano', async () => {
    const kit = await creaKitRuntime();
    const prima = await creaReferenza(kit, { data_fields: { promo_db1: 'A' } });
    const seconda = await creaReferenza(kit, { data_fields: { promo_db1: 'B' } });
    await creaAnalisi(kit);
    const statoPrima = [await leggi(prima), await leggi(seconda)];
    // Dopo l'UPDATE delle referenze, nella stessa transazione
    vi.spyOn(AnalisiKit, 'destroy').mockRejectedValueOnce(new Error('guasto simulato'));

    await expect(sincronizzaCampoNonTradotto('promo_db1', 'codice_promo')).rejects.toThrow(/nessuna referenza/);

    expect([await leggi(prima), await leggi(seconda)]).toEqual(statoPrima);
    expect(await AnalisiKit.count()).toBe(1);
    expect(await contaCampiNonTradotti(['promo_db1'])).toEqual({ promo_db1: 2 });
  });

  it('senza referenze col campo non cambia nulla', async () => {
    const kit = await creaKitRuntime();
    const id = await creaReferenza(kit, { data_fields: { codice_referenza: '1' } });
    const prima = await leggi(id);

    expect(await sincronizzaCampoNonTradotto('promo_db1', 'codice_promo')).toEqual({ referenze: 0, kit: 0 });
    expect(await leggi(id)).toEqual(prima);
  });
});
