import { randomUUID } from 'node:crypto';
import { QueryTypes } from 'sequelize';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { TIPO_LAVORO_IMPORT_PV } from '../../services/ImportPuntiVenditaJob';
import { AGGREGATI_VUOTI, type MarcaCompatta, type ProdottoCompatto, type RiepilogoKit } from '../../utils/analisiKit';
import { chiaveIndirizzo, chiaveTelefono } from '../../utils/puntoVenditaNormalization';
import { AnalisiPuntiVenditaRepository } from '../AnalisiPuntiVenditaRepository';
import { ConsultazionePuntiVenditaRepository } from '../ConsultazionePuntiVenditaRepository';
import { type NuovaRigaVolantino, PuntiVenditaVolantinoRepository } from '../PuntiVenditaVolantinoRepository';

// Le letture delle pagine del PV sulla timeline dei volantini su PostgreSQL: riepiloghi dei kit in
// analisi_kit (validita' e chiave esterna), referenze e kit del volantino, liste dei PV per la rete
// e le righe non abbinate, qualita' dell'anagrafica, storia nell'elenco della consultazione.
describeConDatabase('AnalisiPuntiVenditaRepository', () => {
  usaDatabase();
  const repository = new AnalisiPuntiVenditaRepository();
  const storia = new PuntiVenditaVolantinoRepository();

  beforeEach(async () => {
    await svuotaTabelle(
      'analisi_kit', 'referenze', 'punti_vendita_volantino', 'dispositivi_punto_vendita', 'lavori_in_background',
      'punti_vendita', 'gdo', 'promo', 'formati', 'tipi_export',
    );
  });

  const giorno = (data: string) => new Date(`${data}T00:00:00Z`);

  async function creaReferenza(kit: KitDiProva, dati: {
    pag?: number | null; y?: number | null; data?: Record<string, unknown>; aggiornataIl?: Date;
  }): Promise<string> {
    const id = randomUUID();
    const aggiornataIl = dati.aggiornataIl ?? new Date('2026-01-01T10:00:00Z');
    await sequelize.query(
      `INSERT INTO referenze (id, codice_box, compiled_fields, data_fields, id_runtime_kit, id_promo,
         pag, x, y, w, h, w_page, h_page, perc_ingombro, "createdAt", "updatedAt")
       VALUES (:id, :id, '[]'::jsonb, CAST(:dati AS jsonb), :kit, :promo, :pag, 10, :y, 50, 50, 210, 287, 4.15, :aggiornataIl, :aggiornataIl)`,
      { replacements: { id, dati: JSON.stringify(dati.data ?? {}), kit: kit.idRuntime, promo: kit.idPromo, pag: dati.pag ?? null, y: dati.y ?? null, aggiornataIl } }
    );
    return id;
  }

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

  async function creaPuntoVendita(kit: KitDiProva, idCombinazione: string, dati: {
    citta: string; indirizzo: string; telefono?: string; coordinate?: boolean; meta?: Record<string, unknown> | null;
  }): Promise<string> {
    const id = randomUUID();
    await sequelize.query(
      `INSERT INTO punti_vendita (id_puntivendita, nome_puntivendita, citta_puntivendita, cap_puntivendita, indirizzo_puntivendita,
         id_combinazione_canale_area_puntivendita, id_gdo_puntivendita, telefono_puntivendita, lat_puntivendita, lon_puntivendita,
         meta_puntivendita, createdat, updatedat)
       VALUES (:id, :nome, :citta, '16100', :indirizzo, :idCombinazione, :idGdo, :telefono, :lat, :lon, CAST(:meta AS jsonb), NOW(), NOW())`,
      {
        replacements: {
          id, nome: `PV ${dati.citta}`, citta: dati.citta, indirizzo: dati.indirizzo, idCombinazione, idGdo: kit.idGdo,
          telefono: dati.telefono ?? null, lat: dati.coordinate ? 44.4 : null, lon: dati.coordinate ? 8.9 : null,
          meta: dati.meta === null || dati.meta === undefined ? null : JSON.stringify(dati.meta),
        },
      }
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
    riga: `${dati.localita} - ${dati.indirizzo}${dati.telefono ? ` - tel. ${dati.telefono}` : ''}`,
    regione: 'LIGURIA',
    provincia: 'GENOVA',
    gruppo: null,
    localita: dati.localita,
    indirizzo: dati.indirizzo,
    telefono: dati.telefono ?? null,
    chiave_indirizzo: chiaveIndirizzo(dati.indirizzo),
    chiave_telefono: chiaveTelefono(dati.telefono),
  });

  const riepilogo = (referenze: number, dati: { prodotti?: ProdottoCompatto[]; marche?: MarcaCompatta[]; descrizioni?: RiepilogoKit['descrizioni'] } = {}): RiepilogoKit => ({
    dati: { ...AGGREGATI_VUOTI, referenze, marche: dati.marche ?? [], prodotti: dati.prodotti ?? [] },
    descrizioni: dati.descrizioni ?? {},
  });

  it('riepiloghi: validi con la stessa versione finche\' nessuna referenza del kit cambia; si sostituiscono; se ne vanno col kit', async () => {
    const kit = await creaKitRuntime();
    const idReferenza = await creaReferenza(kit, { pag: 1, aggiornataIl: new Date('2026-01-01T10:00:00Z') });
    await repository.salvaRiepiloghi([{
      idKit: kit.idRuntime, versione: 1, referenzeAl: new Date('2026-01-01T10:00:00Z'),
      riepilogo: riepilogo(1, { prodotti: [['c-1', 1, null, 0, 5, 1, 5, 0]], marche: [['conad', 'CONAD', 1]], descrizioni: { 'c-1': ['Pasta', null, null, null] } }),
    }]);

    // Solo gli aggregati: marche e prodotti restano nel database
    const aggregati = (await repository.aggregatiKit([kit.idRuntime], 1)).get(kit.idRuntime);
    expect(aggregati).toEqual({ ...AGGREGATI_VUOTI, referenze: 1 });
    expect((await repository.aggregatiKit([kit.idRuntime], 2)).size).toBe(0);
    expect((await repository.aggregatiKit([], 1)).size).toBe(0);

    // Una referenza modificata dopo il calcolo (Referenze.update aggiorna updatedAt) lo rende vecchio
    await sequelize.query(`UPDATE referenze SET "updatedAt" = '2026-01-02T10:00:00Z' WHERE id = :id`, { replacements: { id: idReferenza } });
    expect((await repository.aggregatiKit([kit.idRuntime], 1)).size).toBe(0);

    await repository.salvaRiepiloghi([{ idKit: kit.idRuntime, versione: 1, riepilogo: riepilogo(7), referenzeAl: new Date('2026-01-02T10:00:00Z') }]);
    expect((await repository.aggregatiKit([kit.idRuntime], 1)).get(kit.idRuntime)).toMatchObject({ referenze: 7 });
    expect(await repository.descrizioniProdotti([{ idKit: kit.idRuntime, chiave: 'c-1' }])).toEqual(new Map());

    // Un kit senza referenze: valido finche' non ne arriva una
    const vuoto = await creaKitRuntime({ stessaCombinazioneDi: kit });
    await repository.salvaRiepiloghi([{ idKit: vuoto.idRuntime, versione: 1, riepilogo: riepilogo(0), referenzeAl: null }]);
    expect((await repository.aggregatiKit([vuoto.idRuntime], 1)).size).toBe(1);
    await creaReferenza(vuoto, { pag: 1 });
    expect((await repository.aggregatiKit([vuoto.idRuntime], 1)).size).toBe(0);

    // Il riepilogo di un kit che non c'e' (eliminato mentre si calcolava) si salta, gli altri si salvano
    const altro = await creaKitRuntime({ stessaCombinazioneDi: kit });
    await repository.salvaRiepiloghi([
      { idKit: randomUUID(), versione: 1, riepilogo: riepilogo(3), referenzeAl: null },
      { idKit: altro.idRuntime, versione: 1, riepilogo: riepilogo(4), referenzeAl: null },
    ]);
    expect((await repository.aggregatiKit([altro.idRuntime], 1)).get(altro.idRuntime)).toMatchObject({ referenze: 4 });

    await sequelize.query('DELETE FROM referenze WHERE id_runtime_kit = :id', { replacements: { id: kit.idRuntime } });
    await sequelize.query('DELETE FROM runtime_kit WHERE id = :id', { replacements: { id: kit.idRuntime } });
    const [{ righe }] = await sequelize.query<{ righe: number }>(
      'SELECT COUNT(*)::int AS righe FROM analisi_kit WHERE id_kit_runtime = :id',
      { replacements: { id: kit.idRuntime }, type: QueryTypes.SELECT }
    );
    expect(Number(righe)).toBe(0);
  });

  it('statistiche di prodotti e marche in SQL, descrizioni dei prodotti indicati, presenze di un prodotto', async () => {
    const k1 = await creaKitRuntime();
    const k2 = await creaKitRuntime({ stessaCombinazioneDi: k1 });
    const k3 = await creaKitRuntime({ stessaCombinazioneDi: k1 });
    await repository.salvaRiepiloghi([
      {
        idKit: k1.idRuntime, versione: 1, referenzeAl: null, riepilogo: riepilogo(2, {
          prodotti: [['c-A', 1.5, null, 0, 5, 1, 5, 0], ['c-B', 2, null, 0, 5, 1, 5, 1]],
          marche: [['conad', 'CONAD', 3], ['barilla', 'Barilla', 1]],
          descrizioni: { 'c-A': ['Pasta', 'Barilla', '500 g', null], 'c-B': ['Biscotti', null, null, 'foto-b'] },
        }),
      },
      {
        idKit: k2.idRuntime, versione: 1, referenzeAl: null, riepilogo: riepilogo(1, {
          prodotti: [['c-A', 1.2, 2, 1, 0, 2, 7, 1]],
          marche: [['conad', 'Conad', 1]],
          descrizioni: { 'c-A': ['Pasta di semola', 'Barilla', '500 g', 'foto-a'] },
        }),
      },
      {
        idKit: k3.idRuntime, versione: 1, referenzeAl: null, riepilogo: riepilogo(2, {
          prodotti: [['c-A', 1.9, null, 0, 5, 1, 5, 0], ['c-C', null, null, 0, null, null, null, 0]],
          marche: [['barilla', 'Barilla', 2]],
        }),
      },
    ]);
    const edizioni = [
      { idKit: k1.idRuntime, data: '2021-03-04' },
      { idKit: k2.idRuntime, data: '2022-01-06' },
      { idKit: k3.idRuntime, data: '2022-02-03' },
    ];

    expect(await repository.statisticheProdotti(edizioni, { soglia: 1, ricorrenti: 2, marche: 1 })).toEqual({
      prodotti: 3,
      frequenti: 1,
      ricorrenti: [
        { chiave: 'c-A', volantini: 3, perAnno: { 2021: 1, 2022: 2 }, prezzoMinimo: 1.2, prezzoMassimo: 1.9, ultimoKit: k3.idRuntime, ultimoKitConFoto: k2.idRuntime },
        // A parita' di volantini il piu' recente
        { chiave: 'c-C', volantini: 1, perAnno: { 2022: 1 }, prezzoMinimo: null, prezzoMassimo: null, ultimoKit: k3.idRuntime, ultimoKitConFoto: null },
      ],
      // "CONAD" e "Conad" sono la stessa marca: vale il nome stampato piu' spesso
      marche: [{ marca: 'CONAD', referenze: 4 }],
      referenzeConMarca: 7,
    });
    // A parita' di volantini e di data, per chiave
    expect((await repository.statisticheProdotti([edizioni[0]], { soglia: 10, ricorrenti: 10, marche: 8 })).ricorrenti.map(voce => voce.chiave)).toEqual(['c-A', 'c-B']);
    expect(await repository.statisticheProdotti([], { soglia: 10, ricorrenti: 10, marche: 8 })).toEqual({ prodotti: 0, frequenti: 0, ricorrenti: [], marche: [], referenzeConMarca: 0 });

    const descrizioni = await repository.descrizioniProdotti([
      { idKit: k2.idRuntime, chiave: 'c-A' },
      { idKit: k1.idRuntime, chiave: 'c-B' },
      { idKit: k1.idRuntime, chiave: 'c-Z' },
    ]);
    expect([...descrizioni.entries()].sort()).toEqual([
      [`${k1.idRuntime}|c-B`, { nome: 'Biscotti', marca: null, formato: null, foto: 'foto-b' }],
      [`${k2.idRuntime}|c-A`, { nome: 'Pasta di semola', marca: 'Barilla', formato: '500 g', foto: 'foto-a' }],
    ].sort());

    const presenze = await repository.presenzeProdotto([k1.idRuntime, k2.idRuntime, k3.idRuntime], 'c-A');
    expect(presenze.size).toBe(3);
    expect(presenze.get(k2.idRuntime)).toEqual({ chiave: 'c-A', prezzo: 1.2, barrato: 2, sottocosto: true, meccanica: 'sconto', pagina: 2, spazio: 7, conFoto: true });
    expect((await repository.presenzeProdotto([k1.idRuntime, k2.idRuntime], 'c-C')).size).toBe(0);
    expect((await repository.presenzeProdotto([], 'c-A')).size).toBe(0);
  });

  it('referenze del kit per pagina e posizione, con l\'origine dello storico; il kit con i conteggi dell\'import', async () => {
    const storico = await creaKitRuntime({ titolo: 'SS LI storico' });
    const istanta = await creaKitRuntime({ stessaCombinazioneDi: storico });
    await sequelize.query(
      `UPDATE runtime_kit SET import_storico = CAST(:importStorico AS jsonb) WHERE id = :id`,
      { replacements: { id: storico.idRuntime, importStorico: JSON.stringify({ importatoIl: '2026-01-01', referenzeDaListino: 5, fuoriListino: [{ codiceBox: '1' }, { codiceBox: '2' }], nonImpaginate: [], lasciapassareNonImpaginate: false, fuoriListinoIgnorati: 0 }) } }
    );
    const seconda = await creaReferenza(storico, { pag: 2, y: 50 });
    const prima = await creaReferenza(storico, { pag: 1, y: 10 });
    const secondaInAlto = await creaReferenza(storico, { pag: 2, y: 10 });
    const senzaPagina = await creaReferenza(storico, { pag: null });
    const diIstanta = await creaReferenza(istanta, { pag: 1, data: { codice_referenza: '42' } });

    const righe = await repository.referenzeDeiKit([storico.idRuntime, istanta.idRuntime]);

    expect(righe.filter(r => r.id_runtime_kit === storico.idRuntime).map(r => r.id)).toEqual([prima, secondaInAlto, seconda, senzaPagina]);
    expect(righe.find(r => r.id === prima)).toMatchObject({ storico: true, pag: 1, w_page: 210, compiled_fields: [], data_fields: {} });
    expect(righe.find(r => r.id === diIstanta)).toMatchObject({ storico: false, data_fields: { codice_referenza: '42' } });
    expect(await repository.referenzeDeiKit([])).toEqual([]);

    expect(await repository.kitDelVolantino(storico.idRuntime)).toEqual({
      id: storico.idRuntime, titolo: 'SS LI storico', storico: true, daListino: 5, manuali: 2, pdf: null,
    });
    expect(await repository.kitDelVolantino(istanta.idRuntime)).toMatchObject({ storico: false, daListino: null, manuali: null });
    expect(await repository.kitDelVolantino(randomUUID())).toBeNull();
  });

  it('liste: PV diversi per canale e anno, righe senza PV, edizioni con la lista, riga del volantino, storia nell\'elenco', async () => {
    const del2021 = await creaKitRuntime({ validitaDal: giorno('2021-03-04') });
    const gennaio = await creaKitRuntime({ stessaCombinazioneDi: del2021, validitaDal: giorno('2022-01-06') });
    const febbraio = await creaKitRuntime({ stessaCombinazioneDi: del2021, validitaDal: giorno('2022-02-03') });
    const combinazione = await creaCombinazione(del2021);
    const pra = await creaPuntoVendita(del2021, combinazione, { citta: 'Genova', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' });

    await storia.sostituisciRigheKit(del2021.idRuntime, [
      riga(del2021, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }),
      riga(del2021, 2, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F', telefono: '010 8000001' }),
    ]);
    await storia.sostituisciRigheKit(gennaio.idRuntime, [
      riga(gennaio, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }),
      riga(gennaio, 2, { localita: 'STRUPPA', indirizzo: 'Via Trossarelli 1/F', telefono: '010 8000001' }),
      riga(gennaio, 3, { localita: 'SESTRI', indirizzo: 'Via Sestri 5' }),
    ]);
    await storia.sostituisciRigheKit(febbraio.idRuntime, [
      riga(febbraio, 1, { localita: 'PRA', indirizzo: 'Via Murtola 12/14', telefono: '010 6197180' }),
      // Stesso telefono, indirizzo nuovo: lo stesso PV stampato
      riga(febbraio, 2, { localita: 'STRUPPA', indirizzo: 'Via Struppa 9', telefono: '010 8000001' }),
    ]);
    const daAbbinare = await storia.righeDaRiabbinare(del2021.idGdo);
    await storia.aggiornaAbbinamenti(daAbbinare
      .filter(r => r.chiave_telefono === chiaveTelefono('010 6197180'))
      .map(r => ({ id: r.id, idPuntoVendita: pra, abbinamento: 'telefono' as const })));

    expect(await repository.canaliConPuntiVendita(del2021.idGdo)).toEqual([{ id: del2021.idCanale, nome: 'Superstore', puntiVendita: 1 }]);
    const liste = await repository.puntiVenditaNelleListe(del2021.idGdo);
    expect([...liste].sort((a, b) => a.anno - b.anno)).toEqual([
      { idCanale: del2021.idCanale, nomeCanale: 'Superstore', anno: 2021, puntiVendita: 2 },
      { idCanale: del2021.idCanale, nomeCanale: 'Superstore', anno: 2022, puntiVendita: 3 },
    ]);

    const senza = await repository.righeSenzaPuntoVendita(del2021.idGdo);
    expect(senza.map(r => [r.data, r.posizione, r.localita])).toEqual([
      ['2021-03-04', 2, 'STRUPPA'],
      ['2022-01-06', 2, 'STRUPPA'],
      ['2022-01-06', 3, 'SESTRI'],
      ['2022-02-03', 2, 'STRUPPA'],
    ]);
    expect(senza[0]).toMatchObject({ idKit: del2021.idRuntime, idCanale: del2021.idCanale, nomeCanale: 'Superstore', idArea: del2021.idArea, chiaveTelefono: '0108000001' });

    const edizioni = await repository.edizioniConLista(del2021.idGdo);
    expect(edizioni.map(e => e.data).sort()).toEqual(['2021-03-04', '2022-01-06', '2022-02-03']);
    expect(edizioni[0]).toMatchObject({ idCanale: del2021.idCanale, idArea: del2021.idArea });

    expect(await repository.listaDelVolantino(gennaio.idRuntime)).toEqual([
      { posizione: 1, riga: 'PRA - Via Murtola 12/14 - tel. 010 6197180', regione: 'LIGURIA', provincia: 'GENOVA', idPuntoVendita: pra, abbinamento: 'telefono' },
      { posizione: 2, riga: 'STRUPPA - Via Trossarelli 1/F - tel. 010 8000001', regione: 'LIGURIA', provincia: 'GENOVA', idPuntoVendita: null, abbinamento: null },
      { posizione: 3, riga: 'SESTRI - Via Sestri 5', regione: 'LIGURIA', provincia: 'GENOVA', idPuntoVendita: null, abbinamento: null },
    ]);
    expect(await repository.puntiVenditaConTelefono(del2021.idGdo)).toEqual([{ id: pra, nome: 'PV Genova', telefono: '010 6197180' }]);

    const storie = await new ConsultazionePuntiVenditaRepository().storiaInElenco(del2021.idGdo);
    expect([...storie].sort((a, b) => a.anno - b.anno)).toEqual([
      { id_punto_vendita: pra, anno: 2021, id_canale: del2021.idCanale, nome_canale: 'Superstore', volantini: 1 },
      { id_punto_vendita: pra, anno: 2022, id_canale: del2021.idCanale, nome_canale: 'Superstore', volantini: 2 },
    ]);
  });

  it('qualita\': coordinate, codice nei meta, PV con una storia, dispositivi offline, ultimo import Excel della GDO', async () => {
    const kit = await creaKitRuntime();
    const combinazione = await creaCombinazione(kit);
    const completo = await creaPuntoVendita(kit, combinazione, { citta: 'Genova', indirizzo: 'Via Roma 1', coordinate: true, meta: { id_anacan: '004512' } });
    const incompleto = await creaPuntoVendita(kit, combinazione, { citta: 'Savona', indirizzo: 'Via Paleocapa 2', meta: {} });
    await storia.sostituisciRigheKit(kit.idRuntime, [riga(kit, 1, { localita: 'GENOVA', indirizzo: 'Via Roma 1' })]);
    const [rigaDelPv] = await storia.righeDaRiabbinare(kit.idGdo);
    await storia.aggiornaAbbinamenti([{ id: rigaDelPv.id, idPuntoVendita: completo, abbinamento: 'indirizzo' }]);

    const dispositivo = (idPuntoVendita: string, attivo: boolean, vistoIl: Date | null) => sequelize.query(
      `INSERT INTO dispositivi_punto_vendita (id_dispositivo, id_puntivendita, nome_dispositivo, secret_dispositivo, token_display_dispositivo,
         is_active_dispositivo, last_seen_at_dispositivo, createdat, updatedat)
       VALUES (:id, :idPuntoVendita, 'Display cassa', :segreto, :gettone, :attivo, :vistoIl, NOW(), NOW())`,
      { replacements: { id: randomUUID(), idPuntoVendita, segreto: randomUUID(), gettone: randomUUID(), attivo, vistoIl } }
    );
    await dispositivo(completo, true, new Date());
    await dispositivo(completo, true, new Date(Date.now() - 60 * 60 * 1000));
    await dispositivo(incompleto, true, null);
    await dispositivo(incompleto, false, new Date(Date.now() - 24 * 60 * 60 * 1000));

    const lavoro = (avanzamento: Record<string, unknown>, creatoIl: Date) => sequelize.query(
      `INSERT INTO lavori_in_background (id, tipo, chiave, id_gdo, stato, avanzamento, annullamento_richiesto, heartbeat_at, createdat, updatedat)
       VALUES (:id, :tipo, :chiave, :chiave, 'COMPLETATO', CAST(:avanzamento AS jsonb), FALSE, :creatoIl, :creatoIl, :creatoIl)`,
      { replacements: { id: randomUUID(), tipo: TIPO_LAVORO_IMPORT_PV, chiave: kit.idGdo, avanzamento: JSON.stringify(avanzamento), creatoIl } }
    );
    await lavoro({ errori: [{ row: 9, error: 'vecchio' }] }, new Date('2026-01-01T10:00:00Z'));
    await lavoro({ errori: [{ row: 2, error: 'CAP mancante' }] }, new Date('2026-02-01T10:00:00Z'));

    expect(await repository.qualita(kit.idGdo, 'id_anacan', 15)).toEqual({
      totale: 2,
      senzaCoordinate: 1,
      senzaCodice: 1,
      conStoria: 1,
      dispositiviOffline: 2,
      ultimoImport: { errori: [{ row: 2, error: 'CAP mancante' }] },
    });
    // Senza una chiave dichiarata dalla GDO: senza codice e' chi ha i meta vuoti
    expect((await repository.qualita(kit.idGdo, null, 15)).senzaCodice).toBe(1);
    expect(await repository.qualita(randomUUID(), 'id_anacan', 15)).toMatchObject({ totale: 0, dispositiviOffline: 0, ultimoImport: null });
  });
});
