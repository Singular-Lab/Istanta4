import { beforeEach, expect, it } from 'vitest';
import { BadRequestError, NotFoundError } from '../../../../lib/errors';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, creaReferenza, creaWorkspace, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import type { IAreaService } from '../../interfaces/IAreaService';
import type { ICanaleService } from '../../interfaces/ICanaleService';
import type { IGdoService } from '../../interfaces/IGdoService';
import type { ITipoExportService } from '../../interfaces/ITipoExportService';
import { PromoRepository } from '../../repositories/PromoRepository';
import { WebPliantService } from '../WebPliantService';

// Spec referenze-webpliant, Visibilita temporale: il volantino pubblico mostra una promo dal giorno di
// inizio validita anticipato di offset_visibilita fino al giorno di fine validita incluso, a giorni di
// calendario di Roma. Solo i kit pubblicati, sempre di un'area e di un canale, e senza i dati interni
// del kit. L'editor vede tutto, senza filtro sulle date.

interface ReferenzaRisposta {
  id: string;
  id_promo: string;
  visibile: boolean;
  validoDal: string;
  validoAl: string;
  data_fields: Record<string, unknown>;
}

interface KitRisposta {
  id: string;
  visibile?: boolean;
  webpliant?: ReferenzaRisposta[];
  [campo: string]: unknown;
}

/** Il giorno di consultazione come lo passa il controller: new Date('AAAA-MM-GG'), mezzanotte UTC. */
const giorno = (aaaaMmGg: string) => new Date(aaaaMmGg);

/** 00:00 di Roma (ora solare, dopo il 25/10/2026) del giorno indicato. */
const mezzanotteDiRoma = (aaaaMmGg: string) => new Date(new Date(`${aaaaMmGg}T00:00:00Z`).getTime() - 3_600_000);

const CAMPI_PUBBLICI = ['id', 'id_promo', 'id_area', 'id_canale', 'id_design', 'titolo', 'tipo', 'stato_lavorazione', 'visibile', 'webpliant'];

/** Riempie i dati interni del kit, che il pubblico non deve ricevere. */
async function riempiDatiInterni(idRuntime: string): Promise<void> {
  await sequelize.query(
    `UPDATE "runtime_kit" SET
      "files_data" = :files, "import_storico" = :storico, "filtro" = :filtro, "filtro_contesto" = :filtro,
      "tipi_di_export_in_kit" = :export, "tags" = ARRAY['interno']::VARCHAR(255)[]
     WHERE "id" = :id`,
    {
      replacements: {
        id: idRuntime,
        files: JSON.stringify([{ id: 'f1', nome: 'volantino.pdf', direttive: '', is_optional: false }]),
        storico: JSON.stringify({ esito: 'OK', origine: 'storico' }),
        filtro: JSON.stringify([{ titolo_filtro: 'interno', condizioni: [] }]),
        export: JSON.stringify([{ tipo_di_export_guid_id: 'web', filtro: [], use_webhook: true, webhook_events: 'all' }]),
      },
    }
  );
}

describeConDatabase('WebPliantService: referenze del volantino pubblico', () => {
  usaDatabase();
  const service = new WebPliantService(
    new PromoRepository(),
    {} as unknown as IAreaService,
    {} as unknown as ICanaleService,
    {} as unknown as IGdoService,
    {} as unknown as ITipoExportService
  );

  let kit: KitDiProva;
  let idWorkspace: string;

  /** Kit pubblicato con validita dal 27/10 al 31/10 (00:00 di Roma, l'ultimo giorno incluso). */
  beforeEach(async () => {
    await svuotaTabelle('gdo', 'formati', 'promo', 'runtime_kit', 'referenze', 'workspace_webpliant');
    kit = await creaKitRuntime({ validitaDal: mezzanotteDiRoma('2026-10-27'), validitaAl: mezzanotteDiRoma('2026-10-31') });
    await creaReferenza(kit, { codice: 'R1' });
    idWorkspace = await creaWorkspace({ idGdo: kit.idGdo });
  });

  const pubblico = async (data: Date, idArea = kit.idArea, idCanale = kit.idCanale) =>
    (await service.getReferenzeWebPliant(idWorkspace, data, idArea, idCanale)) as KitRisposta[];
  const editor = async (data: Date, idArea?: string, idCanale?: string) =>
    (await service.getReferenzeWebPliant(idWorkspace, data, idArea, idCanale, true)) as KitRisposta[];
  const idDei = (kits: KitRisposta[]) => kits.map(k => k.id).sort();

  it('una validita_al alle 00:00 di Roma vale per tutto il suo ultimo giorno', async () => {
    expect(mezzanotteDiRoma('2026-10-31').toISOString()).toBe('2026-10-30T23:00:00.000Z');

    const kits = await pubblico(giorno('2026-10-31'));

    expect(idDei(kits)).toEqual([kit.idRuntime]);
    expect(kits[0].visibile).toBe(true);
  });

  it('il giorno dopo la fine della validita la promo non si vede piu', async () => {
    expect(await pubblico(giorno('2026-11-01'))).toEqual([]);
  });

  it('il primo giorno di validita la promo si vede, il giorno prima no', async () => {
    expect(idDei(await pubblico(giorno('2026-10-27')))).toEqual([kit.idRuntime]);
    expect(await pubblico(giorno('2026-10-26'))).toEqual([]);
  });

  it('offset_visibilita anticipa la visibilita di altrettanti giorni', async () => {
    const anticipato = await creaKitRuntime({
      validitaDal: mezzanotteDiRoma('2026-11-05'), validitaAl: mezzanotteDiRoma('2026-11-10'), offsetVisibilita: 3,
      stessaCombinazioneDi: kit,
    });

    expect(idDei(await pubblico(giorno('2026-11-02')))).toEqual([anticipato.idRuntime]);
    expect(await pubblico(giorno('2026-11-01'))).toEqual([]);
  });

  it('un kit in revisione non arriva al pubblico, ma all\'editor si', async () => {
    const inRevisione = await creaKitRuntime({
      statoLavorazione: 'IN_REVISIONE',
      validitaDal: mezzanotteDiRoma('2026-10-27'), validitaAl: mezzanotteDiRoma('2026-10-31'),
      stessaCombinazioneDi: kit,
    });

    expect(idDei(await pubblico(giorno('2026-10-29')))).toEqual([kit.idRuntime]);
    expect(idDei(await editor(giorno('2026-10-29'), kit.idArea, kit.idCanale))).toEqual([kit.idRuntime, inRevisione.idRuntime].sort());
  });

  it('l\'editor non filtra per data', async () => {
    const kits = await editor(giorno('2026-12-25'), kit.idArea, kit.idCanale);

    expect(idDei(kits)).toEqual([kit.idRuntime]);
    expect(kits[0].visibile).toBe(true);
  });

  it.each([
    ['senza area', undefined, 'canale'],
    ['senza canale', 'area', undefined],
    ['con area e canale vuoti, come li manda il frontend', '', ''],
    ['con il solo canale vuoto', 'area', ''],
  ])('richiesta pubblica %s: 400', async (_caso, idArea, idCanale) => {
    const richiesta = service.getReferenzeWebPliant(
      idWorkspace, giorno('2026-10-29'), idArea === 'area' ? kit.idArea : idArea, idCanale === 'canale' ? kit.idCanale : idCanale
    );

    await expect(richiesta).rejects.toBeInstanceOf(BadRequestError);
    await expect(richiesta).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('il 400 arriva prima di leggere il database: anche su un workspace inesistente', async () => {
    const richiesta = service.getReferenzeWebPliant('00000000-0000-0000-0000-000000000000', giorno('2026-10-29'), kit.idArea, '');

    await expect(richiesta).rejects.toBeInstanceOf(BadRequestError);
  });

  it('con area e canale, un workspace inesistente resta 404', async () => {
    const richiesta = service.getReferenzeWebPliant('00000000-0000-0000-0000-000000000000', giorno('2026-10-29'), kit.idArea, kit.idCanale);

    await expect(richiesta).rejects.toBeInstanceOf(NotFoundError);
    await expect(richiesta).rejects.toMatchObject({ httpStatus: 404 });
  });

  it('all\'editor area e canale non servono: riceve i kit di tutte le combinazioni', async () => {
    const altraCombinazione = await creaKitRuntime({ validitaDal: mezzanotteDiRoma('2026-10-27'), validitaAl: mezzanotteDiRoma('2026-10-31') });

    expect(idDei(await editor(giorno('2026-10-29')))).toEqual([kit.idRuntime, altraCombinazione.idRuntime].sort());
    expect(idDei(await editor(giorno('2026-10-29'), '', ''))).toEqual([kit.idRuntime, altraCombinazione.idRuntime].sort());
  });

  it('il pubblico riceve solo i campi pubblici del kit, con le referenze', async () => {
    await riempiDatiInterni(kit.idRuntime);

    const [kitPubblico] = await pubblico(giorno('2026-10-29'));

    expect(Object.keys(kitPubblico).sort()).toEqual([...CAMPI_PUBBLICI].sort());
    expect(kitPubblico).toMatchObject({
      id: kit.idRuntime, id_promo: kit.idPromo, id_area: kit.idArea, id_canale: kit.idCanale, id_design: kit.idDesign,
      stato_lavorazione: 'PUBBLICATO', visibile: true,
    });
    for (const interno of ['files_data', 'import_storico', 'filtro', 'filtro_contesto', 'tipi_di_export_in_kit', 'tags']) {
      expect(kitPubblico).not.toHaveProperty(interno);
    }
    expect(kitPubblico.webpliant).toHaveLength(1);
    expect(kitPubblico.webpliant?.[0]).toMatchObject({
      id_promo: kit.idPromo, visibile: true, data_fields: { codice_referenza: 'R1' },
      validoDal: expect.any(String), validoAl: expect.any(String),
    });
  });

  it('l\'editor riceve la riga completa del kit, dati interni compresi', async () => {
    await riempiDatiInterni(kit.idRuntime);

    const [kitEditor] = await editor(giorno('2026-10-29'), kit.idArea, kit.idCanale);

    expect(kitEditor).toMatchObject({
      id: kit.idRuntime,
      files_data: [{ id: 'f1', nome: 'volantino.pdf' }],
      import_storico: { esito: 'OK', origine: 'storico' },
      tags: ['interno'],
    });
    expect(kitEditor.webpliant).toHaveLength(1);
  });

  it('validoDal e validoAl della referenza: i suoi data_da/data_a, altrimenti le date della promo, con l\'anticipo', async () => {
    // Orari a meta giornata: toDateString usa il fuso del server e il giorno non deve dipenderne
    const conDate = await creaKitRuntime({
      validitaDal: new Date('2026-10-27T11:00:00Z'), validitaAl: new Date('2026-10-31T11:00:00Z'), offsetVisibilita: 2,
      stessaCombinazioneDi: kit,
    });
    await creaReferenza(conDate, { codice: 'PROPRIE', dataFields: { data_da: '2026-10-28T12:00:00Z', data_a: '2026-10-30T12:00:00Z' } });
    await creaReferenza(conDate, { codice: 'DELLA_PROMO' });

    const kits = await pubblico(giorno('2026-10-29'));
    const referenze = kits.find(k => k.id === conDate.idRuntime)?.webpliant ?? [];
    const perCodice = (codice: string) => referenze.find(r => r.data_fields.codice_referenza === codice);

    expect(perCodice('PROPRIE')).toMatchObject({ validoDal: 'Mon Oct 26 2026', validoAl: 'Fri Oct 30 2026', id_promo: conDate.idPromo });
    expect(perCodice('DELLA_PROMO')).toMatchObject({ validoDal: 'Sun Oct 25 2026', validoAl: 'Sat Oct 31 2026', id_promo: conDate.idPromo });
  });
});
