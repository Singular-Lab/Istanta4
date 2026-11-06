import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaReferenza, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { chiaveIndirizzo, chiaveTelefono } from '../../utils/puntoVenditaNormalization';
import { type NuovaRigaVolantino, PuntiVenditaVolantinoRepository } from '../PuntiVenditaVolantinoRepository';

// Le letture e scritture della storia dei punti vendita su PostgreSQL: righe dei volantini per kit,
// riabbinamento, chiavi esterne, kit e promo eliminati fuori dalla storia, PDF e referenze dei volantini.
describeConDatabase('PuntiVenditaVolantinoRepository', () => {
  usaDatabase();
  const repository = new PuntiVenditaVolantinoRepository();

  beforeEach(async () => {
    await svuotaTabelle('abbinamenti_manuali_pv_volantino', 'punti_vendita_volantino', 'gdo', 'promo', 'formati', 'tipi_export');
  });

  /** La combinazione canale/area del kit: da li' viene la GDO della lista. */
  async function creaCombinazione(kit: KitDiProva): Promise<string> {
    const id = randomUUID();
    await sequelize.query(
      `INSERT INTO combinazione_canale_area (id_combinazione_canale_area, id_gdo_combinazione_canale_area, id_canale_combinazione_canale_area,
         id_area_combinazione_canale_area, stato_combinazione_canale_area, createdat, updatedat)
       VALUES (:id, :idGdo, :idCanale, :idArea, 'ATTIVO', NOW(), NOW())`,
      { replacements: { id, idGdo: kit.idGdo, idCanale: kit.idCanale, idArea: kit.idArea } }
    );
    return id;
  }

  async function creaPuntoVendita(kit: KitDiProva, idCombinazione: string, dati: { citta: string; indirizzo: string; telefono?: string }): Promise<string> {
    const id = randomUUID();
    await sequelize.query(
      `INSERT INTO punti_vendita (id_puntivendita, nome_puntivendita, citta_puntivendita, cap_puntivendita, indirizzo_puntivendita,
         id_combinazione_canale_area_puntivendita, id_gdo_puntivendita, telefono_puntivendita, createdat, updatedat)
       VALUES (:id, :nome, :citta, '16100', :indirizzo, :idCombinazione, :idGdo, :telefono, NOW(), NOW())`,
      { replacements: { id, nome: `PV ${dati.citta}`, ...dati, telefono: dati.telefono ?? null, idCombinazione, idGdo: kit.idGdo } }
    );
    return id;
  }

  const riga = (kit: KitDiProva, posizione: number, dati: { localita: string; indirizzo: string; telefono?: string }): NuovaRigaVolantino => ({
    id_gdo: kit.idGdo,
    id_kit_runtime: kit.idRuntime,
    id_promo: kit.idPromo,
    id_canale: kit.idCanale,
    id_area: kit.idArea,
    nome_file: 'VOL.pdf',
    posizione,
    riga: `${dati.localita} - ${dati.indirizzo}`,
    regione: 'LIGURIA',
    provincia: 'GENOVA',
    gruppo: null,
    localita: dati.localita,
    indirizzo: dati.indirizzo,
    telefono: dati.telefono ?? null,
    chiave_indirizzo: chiaveIndirizzo(dati.indirizzo),
    chiave_telefono: chiaveTelefono(dati.telefono),
  });

  const giorno = (data: string) => new Date(`${data}T00:00:00Z`);

  it('trovaKit: la GDO dalla combinazione canale/area, o dal canale se la combinazione non c\'e\'', async () => {
    const kit = await creaKitRuntime({ titolo: 'SS LI 45', nomePromo: 'Volantino 45', statoLavorazione: 'IN_LAVORAZIONE' });

    expect(await repository.trovaKit(kit.idRuntime)).toEqual({
      id: kit.idRuntime, titolo: 'SS LI 45', statoLavorazione: 'IN_LAVORAZIONE', idPromo: kit.idPromo, nomePromo: 'Volantino 45',
      idCanale: kit.idCanale, idArea: kit.idArea, idGdo: kit.idGdo,
    });
    await creaCombinazione(kit);
    expect((await repository.trovaKit(kit.idRuntime))?.idGdo).toBe(kit.idGdo);
    expect(await repository.trovaKit(randomUUID())).toBeNull();
  });

  it('sostituisciRigheKit: le righe nuove prendono il posto di quelle del kit, gli altri kit restano', async () => {
    const kit = await creaKitRuntime();
    const altro = await creaKitRuntime({ stessaCombinazioneDi: kit });
    await repository.sostituisciRigheKit(altro.idRuntime, [riga(altro, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14' })]);

    await repository.sostituisciRigheKit(kit.idRuntime, [
      riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14' }),
      riga(kit, 2, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F' }),
    ]);
    await repository.sostituisciRigheKit(kit.idRuntime, [riga(kit, 1, { localita: 'SANREMO', indirizzo: 'C.so Nazario Sauro 44' })]);

    expect(await repository.contaRigheKit(kit.idRuntime)).toEqual({ righe: 1, abbinate: 0 });
    expect(await repository.contaRigheKit(altro.idRuntime)).toEqual({ righe: 1, abbinate: 0 });
  });

  it('riabbinamento: solo le righe senza PV; quelle collegate restano finche\' il PV non si elimina', async () => {
    const kit = await creaKitRuntime();
    const combinazione = await creaCombinazione(kit);
    const pra = await creaPuntoVendita(kit, combinazione, { citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' });
    await repository.sostituisciRigheKit(kit.idRuntime, [
      riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }),
      riga(kit, 2, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F' }),
    ]);
    const [prima, seconda] = await repository.righeDaRiabbinare(kit.idGdo);

    await repository.aggiornaAbbinamenti([{ id: prima.id, idPuntoVendita: pra, abbinamento: 'telefono' }]);

    expect((await repository.righeDaRiabbinare(kit.idGdo)).map(r => r.id)).toEqual([seconda.id]);
    // Solo le righe dei kit indicati
    expect(await repository.righeDaRiabbinare(kit.idGdo, [randomUUID()])).toEqual([]);
    expect((await repository.righeDaRiabbinare(kit.idGdo, [kit.idRuntime])).map(r => r.id)).toEqual([seconda.id]);
    expect(await repository.contaRigheKit(kit.idRuntime)).toEqual({ righe: 2, abbinate: 1 });
    expect(await repository.puntiVenditaGdo(kit.idGdo)).toEqual([{ id: pra, citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }]);

    // Il PV cambia indirizzo e telefono: la riga resta sua
    await sequelize.query(
      `UPDATE punti_vendita SET indirizzo_puntivendita = 'Via Nuova 3', telefono_puntivendita = '010 0000000' WHERE id_puntivendita = :pra`,
      { replacements: { pra } }
    );
    expect((await repository.righeDaRiabbinare(kit.idGdo)).map(r => r.id)).toEqual([seconda.id]);
    expect(await repository.contaRigheKit(kit.idRuntime)).toEqual({ righe: 2, abbinate: 1 });

    // Eliminato il PV la riga torna senza abbinamento, pronta per il prossimo riabbinamento
    await sequelize.query('DELETE FROM punti_vendita WHERE id_puntivendita = :pra', { replacements: { pra } });
    expect(await repository.contaRigheKit(kit.idRuntime)).toEqual({ righe: 2, abbinate: 0 });
    expect((await repository.righeDaRiabbinare(kit.idGdo)).map(r => [r.id, r.id_punto_vendita, r.abbinamento])).toEqual([
      [prima.id, null, null],
      [seconda.id, null, null],
    ]);
  });

  it('collegamenti fatti a mano: si salvano, si elencano dal piu\' recente, si eliminano; eliminato il PV se ne vanno', async () => {
    const kit = await creaKitRuntime();
    const combinazione = await creaCombinazione(kit);
    const pra = await creaPuntoVendita(kit, combinazione, { citta: 'Genova', indirizzo: 'Via Novella 3', telefono: '010 0000001' });
    const sestri = await creaPuntoVendita(kit, combinazione, { citta: 'Genova', indirizzo: 'Via Sestri 5' });
    await repository.sostituisciRigheKit(kit.idRuntime, [
      riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }),
      riga(kit, 2, { localita: 'SESTRI', indirizzo: 'Via Sestri 5' }),
    ]);

    const primo = await repository.creaCollegamento({
      idGdo: kit.idGdo, idPuntoVendita: pra, chiavi: ['tel:0106197180', 'ind:PRA|VIA MURTOLA 12 14'], riga: 'PRA - Via Murtola 12/14', creatoDa: 'u1',
    });
    const secondo = await repository.creaCollegamento({
      idGdo: kit.idGdo, idPuntoVendita: sestri, chiavi: ['ind:SESTRI|VIA SESTRI 5'], riga: 'SESTRI - Via Sestri 5', creatoDa: null,
    });
    await sequelize.query(`UPDATE abbinamenti_manuali_pv_volantino SET creato_il = NOW() - INTERVAL '1 day' WHERE id = :id`, { replacements: { id: primo } });

    expect((await repository.regoleCollegamento(kit.idGdo)).map(r => [r.id, r.idPuntoVendita, r.chiavi]).sort()).toEqual([
      [primo, pra, ['tel:0106197180', 'ind:PRA|VIA MURTOLA 12 14']],
      [secondo, sestri, ['ind:SESTRI|VIA SESTRI 5']],
    ].sort());
    expect(await repository.regoleCollegamento(randomUUID())).toEqual([]);

    const pagina = await repository.paginaCollegamenti(kit.idGdo, 1, 0);
    expect(pagina.totale).toBe(2);
    expect(pagina.collegamenti).toEqual([expect.objectContaining({
      id: secondo, idGdo: kit.idGdo, idPuntoVendita: sestri, riga: 'SESTRI - Via Sestri 5',
      puntoVendita: { id: sestri, nome: 'PV Genova', indirizzo: 'Via Sestri 5', citta: 'Genova' },
    })]);
    expect((await repository.paginaCollegamenti(kit.idGdo, 1, 1)).collegamenti.map(c => c.id)).toEqual([primo]);
    expect(await repository.trovaCollegamento(primo)).toMatchObject({ id: primo, idGdo: kit.idGdo, idPuntoVendita: pra });

    // Le chiavi imparate si aggiungono senza doppioni
    await repository.aggiungiChiaviCollegamento(primo, ['ind:PRA|VIA NOVELLA 3', 'tel:0106197180']);
    await repository.aggiungiChiaviCollegamento(primo, []);
    expect((await repository.trovaCollegamento(primo))?.chiavi).toEqual(['ind:PRA|VIA MURTOLA 12 14', 'ind:PRA|VIA NOVELLA 3', 'tel:0106197180']);

    // Le righe collegate a mano, di tutta la GDO o di un PV
    const [rigaPra, rigaSestri] = await repository.righeDaRiabbinare(kit.idGdo);
    await repository.aggiornaAbbinamenti([
      { id: rigaPra.id, idPuntoVendita: pra, abbinamento: 'manuale' },
      { id: rigaSestri.id, idPuntoVendita: sestri, abbinamento: 'indirizzo' },
    ]);
    expect(await repository.righeCollegateAMano(kit.idGdo)).toEqual([{
      id: rigaPra.id, idPuntoVendita: pra, riga: 'PRA - Via Murtola 12/14', localita: 'PRA',
      chiaveIndirizzo: chiaveIndirizzo('Via Murtola 12/14'), chiaveTelefono: chiaveTelefono('010 6197180'),
    }]);
    expect(await repository.righeCollegateAMano(kit.idGdo, sestri)).toEqual([]);

    await repository.eliminaCollegamento(secondo);
    expect(await repository.trovaCollegamento(secondo)).toBeNull();

    // Eliminato il PV, il suo collegamento se ne va e la riga resta senza PV
    await sequelize.query('DELETE FROM punti_vendita WHERE id_puntivendita = :pra', { replacements: { pra } });
    expect(await repository.regoleCollegamento(kit.idGdo)).toEqual([]);
    expect((await repository.righeDaRiabbinare(kit.idGdo)).map(r => [r.riga, r.id_punto_vendita])).toEqual([['PRA - Via Murtola 12/14', null]]);
  });

  it('eliminato il kit, le sue righe se ne vanno', async () => {
    const kit = await creaKitRuntime();
    await repository.sostituisciRigheKit(kit.idRuntime, [riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14' })]);

    await sequelize.query('DELETE FROM runtime_kit WHERE id = :id', { replacements: { id: kit.idRuntime } });

    expect(await repository.contaRigheKit(kit.idRuntime)).toEqual({ righe: 0, abbinate: 0 });
  });

  it('storia: apparizioni dalla piu\' vecchia, senza kit eliminati ne\' promo eliminate, coi giorni del calendario italiano', async () => {
    const primo = await creaKitRuntime({ validitaDal: giorno('2022-01-06'), validitaAl: giorno('2022-01-12'), titolo: 'SS LI 1' });
    const secondo = await creaKitRuntime({ stessaCombinazioneDi: primo, validitaDal: giorno('2022-01-13'), validitaAl: giorno('2022-01-19'), titolo: 'SS LI 2' });
    const altraArea = await creaKitRuntime({ promo: { idGdo: primo.idGdo, idPromo: primo.idPromo }, titolo: 'SS altra area' });
    const altroCanale = await creaKitRuntime({ promo: { idGdo: primo.idGdo, idPromo: primo.idPromo }, titolo: 'Altro canale TO' });
    await sequelize.query('UPDATE runtime_kit SET id_canale = :idCanale WHERE id = :idKit', {
      replacements: { idCanale: primo.idCanale, idKit: altraArea.idRuntime },
    });
    await sequelize.query('UPDATE runtime_kit SET id_area = :idArea WHERE id = :idKit', {
      replacements: { idArea: primo.idArea, idKit: altroCanale.idRuntime },
    });
    const eliminato = await creaKitRuntime({ stessaCombinazioneDi: primo, validitaDal: giorno('2022-01-20'), statoLavorazione: 'ELIMINATO' });
    const promoEliminata = await creaKitRuntime({ stessaCombinazioneDi: primo, validitaDal: giorno('2022-01-27'), statoPromo: 'ELIMINATA' });
    const combinazione = await creaCombinazione(primo);
    const pra = await creaPuntoVendita(primo, combinazione, { citta: 'Genova', indirizzo: 'Via Murtola 12/14' });
    for (const kit of [secondo, primo, altraArea, altroCanale, eliminato, promoEliminata]) {
      await repository.sostituisciRigheKit(kit.idRuntime, [riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14' })]);
    }
    const righe = await repository.righeDaRiabbinare(primo.idGdo);
    await repository.aggiornaAbbinamenti(righe.map(r => ({ id: r.id, idPuntoVendita: pra, abbinamento: 'probabile' as const })));

    const apparizioni = await repository.apparizioni(pra);

    expect(apparizioni.map(a => [a.idKit, a.data])).toEqual([[primo.idRuntime, '2022-01-06'], [secondo.idRuntime, '2022-01-13']]);
    expect(apparizioni[0]).toMatchObject({
      titoloKit: 'SS LI 1',
      promo: { id: primo.idPromo, nome: 'Promo di prova', stato: 'VALIDA', validitaDal: '2022-01-06', validitaAl: '2022-01-12' },
      canale: { id: primo.idCanale, nome: 'Superstore' },
      area: { id: primo.idArea, nome: 'Toscana' },
      rigaStampata: 'PRA - Via Murtola 12/14',
      chiaveIndirizzo: 'VIA MURTOLA 12 14',
      abbinamento: 'probabile',
    });
    expect(await repository.trovaPuntoVendita(pra)).toEqual({ id: pra, idGdo: primo.idGdo, citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: null });
  });

  it('volantini successivi della stessa insegna e area con la lista registrata, senza il PV', async () => {
    const primo = await creaKitRuntime({ validitaDal: giorno('2022-01-06') });
    const senzaPv = await creaKitRuntime({ stessaCombinazioneDi: primo, validitaDal: giorno('2022-01-13') });
    await creaKitRuntime({ stessaCombinazioneDi: primo, validitaDal: giorno('2022-01-20') }); // lista non registrata: non conta
    const altraInsegna = await creaKitRuntime({ validitaDal: giorno('2022-01-27'), promo: { idGdo: primo.idGdo, idPromo: senzaPv.idPromo } });
    const combinazione = await creaCombinazione(primo);
    const pra = await creaPuntoVendita(primo, combinazione, { citta: 'Genova', indirizzo: 'Via Murtola 12/14' });
    await repository.sostituisciRigheKit(senzaPv.idRuntime, [riga(senzaPv, 1, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F' })]);
    await repository.sostituisciRigheKit(altraInsegna.idRuntime, [riga(altraInsegna, 1, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F' })]);

    const senza = await repository.volantiniSenzaPuntoVendita({
      idPuntoVendita: pra, idGdo: primo.idGdo, idCanale: primo.idCanale, idArea: primo.idArea, dopo: '2022-01-06',
    });

    expect(senza).toEqual([{ idKit: senzaPv.idRuntime, data: '2022-01-13' }]);
  });

  it('volantini del PV dal piu\' recente, a pagine, solo nella combinazione corrente, col PDF e le referenze', async () => {
    const vecchio = await creaKitRuntime({ validitaDal: giorno('2022-01-06'), titolo: 'SS LI vecchio' });
    const recente = await creaKitRuntime({ stessaCombinazioneDi: vecchio, validitaDal: giorno('2023-05-04'), titolo: 'SS LI recente' });
    const altraArea = await creaKitRuntime({ promo: { idGdo: vecchio.idGdo, idPromo: vecchio.idPromo }, titolo: 'SS altra area' });
    const altroCanale = await creaKitRuntime({ promo: { idGdo: vecchio.idGdo, idPromo: vecchio.idPromo }, titolo: 'Altro canale TO' });
    await sequelize.query('UPDATE runtime_kit SET id_canale = :idCanale WHERE id = :idKit', {
      replacements: { idCanale: vecchio.idCanale, idKit: altraArea.idRuntime },
    });
    await sequelize.query('UPDATE runtime_kit SET id_area = :idArea WHERE id = :idKit', {
      replacements: { idArea: vecchio.idArea, idKit: altroCanale.idRuntime },
    });
    const combinazione = await creaCombinazione(vecchio);
    const pra = await creaPuntoVendita(vecchio, combinazione, { citta: 'Genova', indirizzo: 'Via Murtola 12/14' });
    const vol = await creaTipoExport('VOL');
    const idPdf = await creaFile({ nome: 'SS LI recente.pdf', idRuntime: recente.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-recente', mime: 'application/pdf' });
    await creaFile({ nome: 'senza-olimpo.pdf', idRuntime: vecchio.idRuntime, tipoExport: vol });
    await creaReferenza(recente, { codice: '4969665' });
    await creaReferenza(recente, { codice: '1404871' });
    for (const kit of [vecchio, recente, altraArea, altroCanale]) {
      // Il PV due volte nella stessa lista conta una volta
      await repository.sostituisciRigheKit(kit.idRuntime, [
        riga(kit, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14' }),
        riga(kit, 2, { localita: 'PRA', indirizzo: 'Via Murtola 12-14' }),
      ]);
    }
    const righe = await repository.righeDaRiabbinare(vecchio.idGdo);
    await repository.aggiornaAbbinamenti(righe.map(r => ({ id: r.id, idPuntoVendita: pra, abbinamento: 'indirizzo' as const })));

    const prima = await repository.paginaVolantini(pra, 1, 0);
    const seconda = await repository.paginaVolantini(pra, 1, 1);

    expect(prima.totale).toBe(2);
    expect(prima.volantini).toEqual([expect.objectContaining({
      idKit: recente.idRuntime,
      titoloKit: 'SS LI recente',
      rigaStampata: 'PRA - Via Murtola 12/14',
      abbinamento: 'indirizzo',
      numeroReferenze: 2,
      pdf: { idFile: idPdf, idOlimpoCloud: 'olimpo-recente', nome: 'SS LI recente.pdf', pagine: null },
    })]);
    expect(seconda.volantini).toEqual([expect.objectContaining({ idKit: vecchio.idRuntime, numeroReferenze: 0, pdf: null })]);
  });
});
