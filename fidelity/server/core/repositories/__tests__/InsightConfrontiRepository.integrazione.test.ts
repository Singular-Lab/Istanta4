import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { InsightConfrontiRepository } from '../InsightConfrontiRepository';
import type { KitInsight } from '../InsightVolantinoRepository';

// I volantini con cui gli insight confrontano un kit, su PostgreSQL: edizione precedente della stessa
// area e canale (report PDF) e volantini della GDO per il viaggio del prodotto. Le varianti della
// stessa promo non si leggono piu': la pagina degli insight non confronta il volantino con altri.
// Sempre volantini (non POP), con kit e promo non eliminati, della GDO del kit.
describeConDatabase('InsightConfrontiRepository', () => {
  usaDatabase();
  const repository = new InsightConfrontiRepository();

  beforeEach(async () => {
    await svuotaTabelle('referenze', 'runtime_kit', 'promo', 'formati', 'gdo');
  });

  /** Mezzogiorno UTC: lo stesso giorno anche nel calendario di Roma. */
  const giorno = (data: string) => new Date(`${data}T12:00:00Z`);

  /** Il kit come lo legge kitNellAmbito: qui contano id, promo, area, canale, data e GDO. */
  const kitInsight = (kit: KitDiProva, data: string, dati: Partial<KitInsight> = {}): KitInsight => ({
    id: kit.idRuntime,
    titolo: 'SS TO VOL',
    idPromo: kit.idPromo,
    nomePromo: null,
    idArea: kit.idArea,
    idCanale: kit.idCanale,
    area: 'Toscana',
    canale: 'Superstore',
    validitaDal: data,
    validitaAl: null,
    data,
    storico: false,
    importStorico: null,
    gdo: kit.idGdo,
    ...dati,
  });

  /** Un kit con la stessa GDO, area e canale di un altro, in una promo nuova. */
  const edizione = (base: KitDiProva, dal: string, dati: Parameters<typeof creaKitRuntime>[0] = {}) =>
    creaKitRuntime({ stessaCombinazioneDi: base, validitaDal: giorno(dal), validitaAl: giorno(dal), ...dati });

  /** Sposta il kit su un formato POP (quello di una locandina della promo di base, di un'altra area). */
  async function comePop(kit: KitDiProva, base: KitDiProva): Promise<void> {
    const pop = await creaKitRuntime({ promo: base, tipoLavorazione: 2 });
    await sequelize.query('UPDATE runtime_kit SET id_formato = :formato WHERE id = :id', { replacements: { formato: pop.idFormato, id: kit.idRuntime } });
  }

  async function daStorico(kit: KitDiProva): Promise<void> {
    await sequelize.query(
      `UPDATE runtime_kit SET import_storico = CAST(:storico AS jsonb) WHERE id = :id`,
      { replacements: { id: kit.idRuntime, storico: JSON.stringify({ importatoIl: '2026-01-02T09:00:00Z', nonImpaginate: [], lasciapassareNonImpaginate: false, fuoriListino: [{ codiceBox: 'B7' }], fuoriListinoIgnorati: 0 }) } }
    );
  }

  it('l\'edizione precedente: la piu\' recente della stessa area e canale prima di questa, di un\'altra promo', async () => {
    const base = await creaKitRuntime({ validitaDal: giorno('2026-01-15'), validitaAl: giorno('2026-01-25'), titolo: 'Gennaio' });
    const precedente = await edizione(base, '2026-01-01', { validitaAl: giorno('2026-01-10'), titolo: 'Capodanno' });
    await daStorico(precedente);
    await edizione(base, '2025-12-01');
    // Non contano: eliminati, POP, successivi, altra area e canale
    await edizione(base, '2026-01-10', { statoLavorazione: 'ELIMINATO' });
    await edizione(base, '2026-01-11', { statoPromo: 'ELIMINATA' });
    await comePop(await edizione(base, '2026-01-13'), base);
    await edizione(base, '2026-02-01');
    await creaKitRuntime({ idGdo: base.idGdo, validitaDal: giorno('2026-01-12') });

    const trovata = await repository.edizionePrecedente(kitInsight(base, '2026-01-15'));

    expect(trovata).toMatchObject({
      id: precedente.idRuntime,
      titolo: 'Capodanno',
      idPromo: precedente.idPromo,
      nomePromo: 'Promo di prova',
      idArea: base.idArea,
      idCanale: base.idCanale,
      area: 'Toscana',
      canale: 'Superstore',
      validitaDal: '2026-01-01',
      validitaAl: '2026-01-10',
      data: '2026-01-01',
      storico: true,
      gdo: base.idGdo,
    });
    expect(trovata?.importStorico?.fuoriListino).toEqual([{ codiceBox: 'B7' }]);
  });

  it('la prima edizione di un\'area e un canale non ha precedente; la stessa data non conta', async () => {
    const base = await creaKitRuntime({ validitaDal: giorno('2026-01-15') });
    await edizione(base, '2026-01-15');

    await expect(repository.edizionePrecedente(kitInsight(base, '2026-01-15'))).resolves.toBeNull();
  });

  it('i volantini della GDO per il viaggio, dal piu\' recente, senza l\'import dello storico', async () => {
    const base = await creaKitRuntime({ validitaDal: giorno('2026-02-01') });
    const vecchio = await edizione(base, '2025-11-01');
    await daStorico(vecchio);
    const recente = await creaKitRuntime({ idGdo: base.idGdo, validitaDal: giorno('2026-03-01') });
    await edizione(base, '2026-01-01', { statoLavorazione: 'ELIMINATO' });
    const altraGdo = await creaKitRuntime({ validitaDal: giorno('2026-04-01') });

    const volantini = await repository.kitDellaGdoPerViaggio(kitInsight(base, '2026-02-01'));

    expect(volantini.map(kit => [kit.id, kit.data])).toEqual([
      [recente.idRuntime, '2026-03-01'],
      [base.idRuntime, '2026-02-01'],
      [vecchio.idRuntime, '2025-11-01'],
    ]);
    expect(volantini[2]).toMatchObject({ storico: true, importStorico: null });

    // Un kit senza GDO (dati vecchi) cerca fra tutte
    const senzaGdo = await repository.kitDellaGdoPerViaggio(kitInsight(base, '2026-02-01', { gdo: null }));
    expect(senzaGdo.map(kit => kit.id)).toContain(altraGdo.idRuntime);
  });
});
