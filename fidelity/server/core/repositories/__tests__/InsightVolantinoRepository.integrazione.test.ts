import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { kitNellAmbito, pdfDelKit, righeDelKit } from '../InsightVolantinoRepository';

// Le letture degli insight del volantino su PostgreSQL: il kit solo nella GDO della richiesta (un
// kit di un'altra GDO e' come uno che non esiste), il PDF del volantino in Olimpo e le referenze
// nell'ordine che fa della prima riga di un box la pilota.
describeConDatabase('InsightVolantinoRepository', () => {
  usaDatabase();

  beforeEach(async () => {
    await svuotaTabelle('referenze', 'files_runtime', 'gdo', 'promo', 'formati', 'tipi_export');
  });

  const giorno = (data: string) => new Date(`${data}T10:00:00Z`);

  async function creaRiga(kit: KitDiProva, dati: { pag: number | null; x?: number | null; y?: number | null; creataIl?: Date; data?: Record<string, unknown> }): Promise<string> {
    const id = randomUUID();
    const creataIl = dati.creataIl ?? new Date('2026-01-01T10:00:00Z');
    await sequelize.query(
      `INSERT INTO referenze (id, codice_box, compiled_fields, data_fields, id_runtime_kit, id_promo,
         pag, x, y, w, h, w_page, h_page, perc_ingombro, "createdAt", "updatedAt")
       VALUES (:id, :id, '[]'::jsonb, CAST(:dati AS jsonb), :kit, :promo, :pag, :x, :y, 50, 50, 210, 287, 4.15, :creataIl, :creataIl)`,
      {
        replacements: {
          id, dati: JSON.stringify(dati.data ?? {}), kit: kit.idRuntime, promo: kit.idPromo,
          pag: dati.pag, x: dati.x === undefined ? 10 : dati.x, y: dati.y === undefined ? 10 : dati.y, creataIl,
        },
      }
    );
    return id;
  }

  it('il kit con promo, area, canale, date e GDO, solo nell\'ambito della richiesta', async () => {
    const kit = await creaKitRuntime({ titolo: 'SS TO VOL', nomePromo: 'Promo di marzo', validitaDal: giorno('2026-03-05'), validitaAl: giorno('2026-03-18') });

    const letto = await kitNellAmbito(kit.idRuntime, { idGdo: kit.idGdo });

    expect(letto).toEqual({
      id: kit.idRuntime,
      titolo: 'SS TO VOL',
      idPromo: kit.idPromo,
      nomePromo: 'Promo di marzo',
      idArea: kit.idArea,
      idCanale: kit.idCanale,
      area: 'Toscana',
      canale: 'Superstore',
      validitaDal: '2026-03-05',
      validitaAl: '2026-03-18',
      data: '2026-03-05',
      storico: false,
      importStorico: null,
      gdo: kit.idGdo,
    });
    expect(await kitNellAmbito(kit.idRuntime, 'tutte')).toMatchObject({ id: kit.idRuntime });
  });

  it('un kit di un\'altra GDO, nessuna GDO, un kit inesistente o un id che non e\' un UUID: null', async () => {
    const kit = await creaKitRuntime();
    const altra = await creaKitRuntime();

    expect(await kitNellAmbito(kit.idRuntime, { idGdo: altra.idGdo })).toBeNull();
    expect(await kitNellAmbito(kit.idRuntime, 'nessuna')).toBeNull();
    expect(await kitNellAmbito(randomUUID(), 'tutte')).toBeNull();
    expect(await kitNellAmbito('non-un-uuid', 'tutte')).toBeNull();
  });

  it('i kit non pubblicati si leggono lo stesso: gli insight si aprono anche dalla Dashboard', async () => {
    const kit = await creaKitRuntime({ statoLavorazione: 'IN_LAVORAZIONE' });

    expect(await kitNellAmbito(kit.idRuntime, { idGdo: kit.idGdo })).toMatchObject({ id: kit.idRuntime });
  });

  it('kit dello storico: import_storico come oggetto', async () => {
    const storico = await creaKitRuntime();
    const importStorico = { importatoIl: '2026-01-01', fuoriListino: [{ codiceBox: '7' }], nonImpaginate: [], lasciapassareNonImpaginate: false, fuoriListinoIgnorati: 0 };
    await sequelize.query('UPDATE runtime_kit SET import_storico = CAST(:importStorico AS jsonb) WHERE id = :id', {
      replacements: { id: storico.idRuntime, importStorico: JSON.stringify(importStorico) },
    });

    expect(await kitNellAmbito(storico.idRuntime, 'tutte')).toMatchObject({ storico: true, importStorico });
  });

  it('PDF del volantino: il file VOL su Olimpo, meglio se PDF, con le sue pagine; senza file null', async () => {
    const kit = await creaKitRuntime();
    const senzaPdf = await creaKitRuntime({ stessaCombinazioneDi: kit });
    const vol = await creaTipoExport('VOL');
    await creaFile({ nome: 'a-anteprima.jpg', idRuntime: kit.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-jpg', mime: 'image/jpeg' });
    const idPdf = await creaFile({ nome: 'b-volantino.pdf', idRuntime: kit.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-pdf', mime: 'application/pdf' });
    await creaFile({ nome: 'non-su-olimpo.pdf', idRuntime: senzaPdf.idRuntime, tipoExport: vol, mime: 'application/pdf' });
    await sequelize.query('UPDATE files_runtime SET pages = 12 WHERE id = :id', { replacements: { id: idPdf } });

    expect(await pdfDelKit(kit.idRuntime)).toEqual({ idOlimpoCloud: 'olimpo-pdf', pagine: 12 });
    expect(await pdfDelKit(senzaPdf.idRuntime)).toBeNull();
    expect(await pdfDelKit('non-un-uuid')).toBeNull();
  });

  it('PDF senza il numero di pagine: pagine 0, chi lo usa ripiega sulle pagine del volantino', async () => {
    const kit = await creaKitRuntime();
    const vol = await creaTipoExport('VOL');
    await creaFile({ nome: 'volantino.pdf', idRuntime: kit.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-pdf', mime: 'application/pdf' });

    expect(await pdfDelKit(kit.idRuntime)).toEqual({ idOlimpoCloud: 'olimpo-pdf', pagine: 0 });
  });

  it('referenze per pagina, dall\'alto e da sinistra, poi per creazione; senza pagina in fondo; tutte le colonne', async () => {
    const kit = await creaKitRuntime();
    const altro = await creaKitRuntime({ stessaCombinazioneDi: kit });
    const seconda = await creaRiga(kit, { pag: 2, y: 50 });
    const prima = await creaRiga(kit, { pag: 1, y: 10, data: { codice_referenza: '42' } });
    const secondaADestra = await creaRiga(kit, { pag: 2, y: 10, x: 100 });
    const secondaASinistra = await creaRiga(kit, { pag: 2, y: 10, x: 10, creataIl: new Date('2026-01-02T10:00:00Z') });
    const secondaASinistraPrima = await creaRiga(kit, { pag: 2, y: 10, x: 10, creataIl: new Date('2026-01-01T09:00:00Z') });
    const senzaPagina = await creaRiga(kit, { pag: null });
    await creaRiga(altro, { pag: 1 });

    const righe = await righeDelKit(kit.idRuntime);

    expect(righe.map(riga => riga.id)).toEqual([prima, secondaASinistraPrima, secondaASinistra, secondaADestra, seconda, senzaPagina]);
    expect(righe.find(riga => riga.id === prima)).toMatchObject({
      pag: 1, w_page: 210, h_page: 287, compiled_fields: [], data_fields: { codice_referenza: '42' }, id_runtime_kit: kit.idRuntime,
    });
    expect(await righeDelKit(randomUUID())).toEqual([]);
    expect(await righeDelKit('non-un-uuid')).toEqual([]);
  });
});
