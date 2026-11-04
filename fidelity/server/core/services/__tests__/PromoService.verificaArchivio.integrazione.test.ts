import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo } from '../../../__tests__/integrazione/dati';
import type { IAgenziaLib } from '../../agenzia_lib/types';
import { sequelize } from '../../db/SequelizeConnector';
import type { IConfigService } from '../../interfaces/IConfigService';
import type { IIstantaService } from '../../interfaces/IIstantaService';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { PromoRepository } from '../../repositories/PromoRepository';
import { PromoService } from '../PromoService';

// POST /api/promo/verifica-archivio (TASK-62411d6d): su PostgreSQL vero le promo si ritrovano per nome
// senza maiuscole e spazi ai lati, e l'MD5 dei tracciati calcolato dal database e' quello del file.

const giorno = (data: string) => new Date(`${data}T00:00:00Z`);
const md5 = (contenuto: Buffer) => createHash('md5').update(contenuto).digest('hex');
/** Un tracciato che non e' in coda per Istanta. */
const GIA_IN_ISTANTA = { stato: 'inviato', errore: null, tentativi: 0 };

async function creaPromo(idGdo: string, nome: string, stato: STATO_PROMO, dal = '2021-01-07', al = '2021-01-16'): Promise<string> {
  const id = randomUUID();
  await sequelize.query(
    `INSERT INTO "promo" ("id_promo", "nome_promo", "data_registrazione", "validita_dal", "validita_al", "data_scadenza",
       "offset_visibilita", "stato", "context", "gdo", "createdat", "updatedat")
     VALUES (:id, :nome, :adesso, :dal, :al, :scadenza, 0, :stato, '[]', :gdo, :adesso, :adesso)`,
    { replacements: { id, nome, adesso: new Date(), dal: giorno(dal), al: giorno(al), scadenza: giorno(dal), stato, gdo: idGdo } }
  );
  return id;
}

async function creaTracciato(idPromo: string, filename: string, contenuto: Buffer, nome: string | null = null): Promise<string> {
  const id = randomUUID();
  await sequelize.query(
    `INSERT INTO "tracciati" ("id_tracciati", "id_promo_tracciati", "context_tracciati", "filename_tracciati", "nome_tracciati", "blobfile_tracciati", "createdat", "updatedat")
     VALUES (:id, :idPromo, '[]', :filename, :nome, :blob, :adesso, :adesso)`,
    { replacements: { id, idPromo, filename, nome, blob: contenuto, adesso: new Date() } }
  );
  return id;
}

/** Righe di promo e tracciati, per verificare che la verifica non scriva nulla. */
async function istantanea(): Promise<unknown[]> {
  const [promo] = await sequelize.query(`SELECT "id_promo", "nome_promo", "stato", "updatedat" FROM "promo" ORDER BY "id_promo"`);
  const [tracciati] = await sequelize.query(`SELECT "id_tracciati", "filename_tracciati", "nome_tracciati", md5("blobfile_tracciati") AS md5, "updatedat" FROM "tracciati" ORDER BY "id_tracciati"`);
  return [promo, tracciati];
}

describeConDatabase('PromoService.verificaArchivio su PostgreSQL', () => {
  usaDatabase();
  const service = new PromoService(
    {} as IWebPliantService,
    {} as IIstantaService,
    new PromoRepository(),
    {} as IAgenziaLib,
    {} as IConfigService
  );

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'tracciati');
  });

  it('restituisce la promo con i tracciati e l MD5 del file, e nessuna promo per un nome assente', async () => {
    const idGdo = await creaGdo();
    const idPromo = await creaPromo(idGdo, 'P2101_VOL_07-01-21', STATO_PROMO.ARCHIVIATA);
    const lista = Buffer.from('contenuto della lista SSCN');
    const rinominata = Buffer.from('contenuto della lista CY');
    const idLista = await creaTracciato(idPromo, '01_SSCN_070121.xlsx', lista);
    const idRinominata = await creaTracciato(idPromo, '01_CY_070121.xlsx', rinominata, 'City gennaio');
    const prima = await istantanea();

    const risposta = await service.verificaArchivio(['P2101_VOL_07-01-21', 'P2102_VOL_21-01-21']);

    expect(risposta).toEqual([
      {
        nome: 'P2101_VOL_07-01-21',
        promo: [{
          id: idPromo,
          nome: 'P2101_VOL_07-01-21',
          stato: STATO_PROMO.ARCHIVIATA,
          validita_dal: giorno('2021-01-07'),
          validita_al: giorno('2021-01-16'),
          tracciati: expect.arrayContaining([
            { id: idLista, filename: '01_SSCN_070121.xlsx', nome: '01_SSCN_070121.xlsx', md5: md5(lista), istanta: GIA_IN_ISTANTA },
            { id: idRinominata, filename: '01_CY_070121.xlsx', nome: 'City gennaio', md5: md5(rinominata), istanta: GIA_IN_ISTANTA },
          ]),
        }],
      },
      { nome: 'P2102_VOL_21-01-21', promo: [] },
    ]);
    expect(risposta[0].promo[0].tracciati).toHaveLength(2);
    expect(await istantanea()).toEqual(prima);
  });

  it('ritrova la promo con maiuscole e spazi diversi nel nome', async () => {
    const idGdo = await creaGdo();
    const idPromo = await creaPromo(idGdo, 'P2101_VOL_07-01-21', STATO_PROMO.ARCHIVIATA);

    const [esito] = await service.verificaArchivio([' p2101_vol_07-01-21 ']);

    expect(esito.nome).toBe(' p2101_vol_07-01-21 ');
    expect(esito.promo.map(p => p.id)).toEqual([idPromo]);
  });

  it('una promo eliminata torna con il suo stato e senza tracciati', async () => {
    const idGdo = await creaGdo();
    const idPromo = await creaPromo(idGdo, 'P2103_VOL_04-02-21', STATO_PROMO.ELIMINATA);
    await creaTracciato(idPromo, '01_SSCN_040221.xlsx', Buffer.from('lista'));

    const [esito] = await service.verificaArchivio(['P2103_VOL_04-02-21']);

    expect(esito.promo).toEqual([expect.objectContaining({ id: idPromo, stato: STATO_PROMO.ELIMINATA, tracciati: [] })]);
  });

  it('con piu promo omonime le restituisce tutte, dalla prima per inizio di validita', async () => {
    const idGdo = await creaGdo();
    const seconda = await creaPromo(idGdo, 'A2619_SC_04-09-26', STATO_PROMO.ARCHIVIATA, '2026-09-11', '2026-09-20');
    const prima = await creaPromo(idGdo, 'A2619_SC_04-09-26', STATO_PROMO.ARCHIVIATA, '2026-09-04', '2026-09-13');
    await creaPromo(idGdo, 'Altra promo', STATO_PROMO.ARCHIVIATA);

    const [esito] = await service.verificaArchivio(['A2619_SC_04-09-26']);

    expect(esito.promo.map(p => p.id)).toEqual([prima, seconda]);
  });
});
