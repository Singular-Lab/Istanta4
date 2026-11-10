import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaGdo, creaKitRuntime, creaReferenza } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { ImpostazioniGdoRepository } from '../ImpostazioniGdoRepository';

// Le Impostazioni GDO su PostgreSQL (migrazione 0018): la riga di impostazioni_gdo di una GDO, che
// ogni salvataggio crea se manca cambiando solo le sue colonne, e i reparti nelle referenze dei
// volantini della GDO letti in SQL con i percorsi della config degli insight.
describeConDatabase('ImpostazioniGdoRepository', () => {
  usaDatabase();
  const repository = new ImpostazioniGdoRepository();
  /** Un ordine stabile per le righe raggruppate, che l'SQL restituisce in un ordine qualunque. */
  const perChiave = (a: { codice: string | null; descrizione: string | null }, b: { codice: string | null; descrizione: string | null }) =>
    `${a.codice}|${a.descrizione}`.localeCompare(`${b.codice}|${b.descrizione}`);

  beforeEach(async () => {
    await svuotaTabelle('impostazioni_gdo', 'referenze', 'runtime_kit', 'promo', 'formati', 'gdo');
  });

  it('reparti e configurazione degli insight si salvano ognuno senza toccare l\'altro', async () => {
    const idGdo = await creaGdo();
    expect(await repository.trova(idGdo)).toBeNull();

    await repository.salvaReparti(idGdo, [{ codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: 'Bellezza', colore: '#ec4899' }]);
    await repository.salvaInsightVolantino(idGdo, { dataMapping: { referenzaFields: {} } }, 'Mario Rossi');

    const salvate = await repository.trova(idGdo);
    expect(salvate).toMatchObject({
      idGdo,
      reparti: [{ codice: '09', nomeDati: 'PROFUMERIA', nomeMarketing: 'Bellezza', colore: '#ec4899' }],
      insightVolantino: { dataMapping: { referenzaFields: {} } },
      insightAggiornatoDa: 'Mario Rossi',
    });
    expect(salvate?.insightAggiornatoIl).toBeInstanceOf(Date);

    await repository.eliminaInsightVolantino(idGdo);
    await repository.salvaReparti(idGdo, [{ codice: '01', nomeDati: '', nomeMarketing: null, colore: null }]);

    expect(await repository.trova(idGdo)).toMatchObject({
      reparti: [{ codice: '01', nomeDati: '', nomeMarketing: null, colore: null }],
      insightVolantino: null,
      insightAggiornatoIl: null,
      insightAggiornatoDa: null,
    });
    expect(await repository.repartiSalvati(idGdo)).toEqual([{ codice: '01', nomeDati: '', nomeMarketing: null, colore: null }]);
  });

  it('la configurazione degli insight si salva anche per una GDO senza riga: i reparti restano vuoti', async () => {
    const idGdo = await creaGdo();

    await repository.salvaInsightVolantino(idGdo, { dataMapping: { referenzaFields: { reparto: 'data_fields.reparto' } } }, null);

    expect(await repository.trova(idGdo)).toMatchObject({ reparti: [], insightAggiornatoDa: null });
    expect(await repository.repartiSalvati('22222222-2222-4222-8222-222222222222')).toEqual([]);
  });

  it('eliminata la GDO se ne vanno le sue impostazioni', async () => {
    const idGdo = await creaGdo();
    await repository.salvaReparti(idGdo, [{ codice: '01', nomeDati: '', nomeMarketing: 'Dispensa', colore: null }]);

    await sequelize.query('DELETE FROM gdo WHERE id_gdo = :idGdo', { replacements: { idGdo } });

    expect(await repository.trova(idGdo)).toBeNull();
  });

  it('la GDO: nome e se ha l\'icona', async () => {
    const idGdo = await creaGdo('CONAD CNO');

    expect(await repository.gdo(idGdo)).toEqual({ id: idGdo, nome: 'CONAD CNO', haIcona: false });
    await sequelize.query(`UPDATE gdo SET icona_gdo = decode('3c7376672f3e', 'hex') WHERE id_gdo = :idGdo`, { replacements: { idGdo } });
    expect(await repository.gdo(idGdo)).toMatchObject({ haIcona: true });
    expect(await repository.gdo('22222222-2222-4222-8222-222222222222')).toBeNull();
  });

  it('i reparti nelle referenze dei volantini della GDO, per codice e descrizione, senza kit eliminati ne\' altre GDO', async () => {
    const kit = await creaKitRuntime();
    await creaReferenza(kit, { codice: 'A', dataFields: { reparto: '1' } });
    await creaReferenza(kit, { codice: 'B', dataFields: { reparto: '1' } });
    await creaReferenza(kit, { codice: 'C', dataFields: { reparto: '01', descrizione_reparto: 'DROGHERIA ALIMENTARE' } });
    await creaReferenza(kit, { codice: 'D', dataFields: { descrizione_reparto: ' PESCE ' } });
    await creaReferenza(kit, { codice: 'E', dataFields: { reparto: '   ' } });
    await creaReferenza(kit, { codice: 'F', dataFields: { reparto: 24 } });
    const eliminato = await creaKitRuntime({ promo: kit, statoLavorazione: 'ELIMINATO' });
    await creaReferenza(eliminato, { codice: 'G', dataFields: { reparto: '1' } });
    const altraGdo = await creaKitRuntime();
    await creaReferenza(altraGdo, { codice: 'H', dataFields: { reparto: '1' } });

    const reparti = await repository.repartiNelleReferenze(kit.idGdo, { codice: 'data_fields.reparto', descrizione: 'dataFields.descrizione_reparto' });

    expect([...reparti].sort(perChiave)).toEqual([
      { codice: '01', descrizione: 'DROGHERIA ALIMENTARE', referenze: 1 },
      { codice: '1', descrizione: null, referenze: 2 },
      { codice: '24', descrizione: null, referenze: 1 },
      { codice: null, descrizione: 'PESCE', referenze: 1 },
    ].sort(perChiave));
  });

  it('i percorsi della config: chiavi puntate intere o annidate, alternative in ordine; senza percorsi quelli predefiniti', async () => {
    const kit = await creaKitRuntime();
    await creaReferenza(kit, { codice: 'A', dataFields: { 'Referenza.Reparto': '05', Descrizioni: { Reparto: 'DROGHERIA CHIMICA' } } });
    await creaReferenza(kit, { codice: 'B', dataFields: { Referenza: { Reparto: '05' }, reparto: '99' } });
    await creaReferenza(kit, { codice: 'C', dataFields: { reparto: '33' } });

    const conPercorsi = await repository.repartiNelleReferenze(kit.idGdo, {
      codice: ['data_fields.Referenza.Reparto', 'data_fields.reparto'],
      descrizione: 'data_fields.Descrizioni.Reparto',
    });
    const predefiniti = await repository.repartiNelleReferenze(kit.idGdo, { codice: null, descrizione: null });

    expect([...conPercorsi].sort(perChiave)).toEqual([
      { codice: '05', descrizione: 'DROGHERIA CHIMICA', referenze: 1 },
      { codice: '05', descrizione: null, referenze: 1 },
      { codice: '33', descrizione: null, referenze: 1 },
    ].sort(perChiave));
    expect([...predefiniti].map(voce => voce.codice).sort()).toEqual(['33', '99']);
  });
});
