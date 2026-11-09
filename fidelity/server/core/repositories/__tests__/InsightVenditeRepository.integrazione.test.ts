import { randomUUID } from 'node:crypto';
import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaFile, creaKitRuntime, creaTipoExport, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { type AmbitoVendite, InsightVenditeRepository } from '../InsightVenditeRepository';
import type { KitInsight } from '../InsightVolantinoRepository';

// Le vendite importate lette per gli insight del volantino, su PostgreSQL: solo i codici cercati,
// della GDO del volantino, nei punti vendita della sua area e del suo canale, nel periodo di
// validita' della promo (le righe a cavallo in proporzione ai giorni); e le edizioni precedenti
// della stessa GDO, area e canale per lo storico della previsione.
describeConDatabase('InsightVenditeRepository', () => {
  usaDatabase();
  const repository = new InsightVenditeRepository();

  beforeEach(async () => {
    await svuotaTabelle(
      'vendite_prodotti', 'punti_vendita', 'combinazione_canale_area', 'referenze', 'files_runtime',
      'runtime_kit', 'promo', 'formati', 'gdo', 'tipi_export',
    );
  });

  /** Mezzogiorno UTC: lo stesso giorno anche nel calendario di Roma. */
  const giorno = (data: string) => new Date(`${data}T12:00:00Z`);

  const ambitoDi = (kit: KitDiProva): AmbitoVendite => ({ idGdo: kit.idGdo, idArea: kit.idArea, idCanale: kit.idCanale });

  /** La combinazione di area e canale del kit, nella sua GDO. */
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

  async function creaPuntoVendita(kit: KitDiProva, idCombinazione: string, citta: string): Promise<string> {
    const id = randomUUID();
    await sequelize.query(
      `INSERT INTO punti_vendita (id_puntivendita, nome_puntivendita, citta_puntivendita, cap_puntivendita, indirizzo_puntivendita,
         id_combinazione_canale_area_puntivendita, id_gdo_puntivendita, createdat, updatedat)
       VALUES (:id, :nome, :citta, '16100', 'Via Roma 1', :idCombinazione, :idGdo, NOW(), NOW())`,
      { replacements: { id, nome: `PV ${citta}`, citta, idCombinazione, idGdo: kit.idGdo } }
    );
    return id;
  }

  async function creaVendita(idGdo: string, idPuntoVendita: string, vendita: { codice: string; dal: string; al: string; pezzi: number; valore?: number | null }): Promise<void> {
    await sequelize.query(
      `INSERT INTO vendite_prodotti (id, id_gdo, codice_prodotto, id_punto_vendita, dal, al, pezzi, valore, aggiornato_il)
       VALUES (:id, :idGdo, :codice, :idPuntoVendita, :dal, :al, :pezzi, :valore, NOW())`,
      { replacements: { id: randomUUID(), idGdo, idPuntoVendita, codice: vendita.codice, dal: vendita.dal, al: vendita.al, pezzi: vendita.pezzi, valore: vendita.valore ?? null } }
    );
  }

  /** Un punto vendita nell'area e nel canale del kit. */
  async function puntoVenditaDelKit(kit: KitDiProva, citta = 'Genova'): Promise<string> {
    return creaPuntoVendita(kit, await creaCombinazione(kit), citta);
  }

  it('periodo: le righe dentro la validita\' per intero, quelle a cavallo in proporzione ai giorni, le altre no', async () => {
    const kit = await creaKitRuntime();
    const pv = await puntoVenditaDelKit(kit);
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-10', al: '2026-03-16', pezzi: 70, valore: 140 });
    // Dal 14 al 20: 3 giorni su 7 dentro la promo
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-14', al: '2026-03-20', pezzi: 70, valore: 70 });
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-03', al: '2026-03-09', pezzi: 999, valore: 999 });
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-17', al: '2026-03-23', pezzi: 999, valore: 999 });

    const vendite = await repository.venditeNeiPeriodi(ambitoDi(kit), [{ idKit: kit.idRuntime, dal: '2026-03-10', al: '2026-03-16' }], ['123']);

    const delKit = vendite.get(kit.idRuntime);
    expect(delKit).toMatchObject({ periodo: { dal: '2026-03-10', al: '2026-03-16' }, puntiVendita: 1, conValore: true });
    expect(delKit?.perCodice.get('123')?.pezzi).toBeCloseTo(100, 6);
    expect(delKit?.perCodice.get('123')?.valore).toBeCloseTo(170, 6);
  });

  it('solo GDO, area e canale del volantino e i codici cercati; punti vendita distinti; il valore se tutte le righe lo hanno', async () => {
    const kit = await creaKitRuntime();
    const combinazione = await creaCombinazione(kit);
    const genova = await creaPuntoVendita(kit, combinazione, 'Genova');
    const savona = await creaPuntoVendita(kit, combinazione, 'Savona');
    // Stessa GDO, altra area e altro canale
    const altraArea = await creaKitRuntime({ idGdo: kit.idGdo });
    const pisa = await puntoVenditaDelKit(altraArea, 'Pisa');
    // Un'altra GDO
    const altraGdo = await creaKitRuntime();
    const firenze = await puntoVenditaDelKit(altraGdo, 'Firenze');
    const settimana = { dal: '2026-03-10', al: '2026-03-16' };
    await creaVendita(kit.idGdo, genova, { codice: '123', ...settimana, pezzi: 10, valore: 20 });
    await creaVendita(kit.idGdo, savona, { codice: '123', ...settimana, pezzi: 5, valore: 10 });
    await creaVendita(kit.idGdo, genova, { codice: 'B7', ...settimana, pezzi: 4, valore: null });
    await creaVendita(kit.idGdo, genova, { codice: '999', ...settimana, pezzi: 1, valore: 1 });
    await creaVendita(kit.idGdo, pisa, { codice: '123', ...settimana, pezzi: 500, valore: 500 });
    await creaVendita(altraGdo.idGdo, firenze, { codice: '123', ...settimana, pezzi: 700, valore: 700 });

    const vendite = await repository.venditeNeiPeriodi(ambitoDi(kit), [{ idKit: kit.idRuntime, ...settimana }], ['123', 'B7']);

    const delKit = vendite.get(kit.idRuntime);
    expect(delKit?.puntiVendita).toBe(2);
    expect(delKit?.conValore).toBe(false);
    expect([...(delKit?.perCodice.keys() ?? [])].sort()).toEqual(['123', 'B7']);
    expect(delKit?.perCodice.get('123')?.pezzi).toBeCloseTo(15, 6);
    expect(delKit?.perCodice.get('123')?.valore).toBeCloseTo(30, 6);
    expect(delKit?.perCodice.get('B7')).toEqual({ pezzi: 4, valore: null });
  });

  it('piu\' periodi in una lettura: ogni kit le sue vendite; un periodo senza vendite manca', async () => {
    const kit = await creaKitRuntime();
    const pv = await puntoVenditaDelKit(kit);
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-03', al: '2026-03-09', pezzi: 8 });
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-10', al: '2026-03-16', pezzi: 10 });

    const vendite = await repository.venditeNeiPeriodi(ambitoDi(kit), [
      { idKit: 'marzo', dal: '2026-03-10', al: '2026-03-16' },
      { idKit: 'inizio-marzo', dal: '2026-03-03', al: '2026-03-09' },
      { idKit: 'gennaio-2025', dal: '2025-01-01', al: '2025-01-07' },
    ], ['123']);

    expect([...vendite.keys()].sort()).toEqual(['inizio-marzo', 'marzo']);
    expect(vendite.get('marzo')?.perCodice.get('123')?.pezzi).toBeCloseTo(10, 6);
    expect(vendite.get('inizio-marzo')?.perCodice.get('123')?.pezzi).toBeCloseTo(8, 6);
    // Senza valore nel file: la misura saranno i pezzi
    expect(vendite.get('marzo')?.conValore).toBe(false);
  });

  it('senza codici o senza periodi nessuna vendita', async () => {
    const kit = await creaKitRuntime();
    const pv = await puntoVenditaDelKit(kit);
    await creaVendita(kit.idGdo, pv, { codice: '123', dal: '2026-03-10', al: '2026-03-16', pezzi: 10 });

    expect((await repository.venditeNeiPeriodi(ambitoDi(kit), [{ idKit: kit.idRuntime, dal: '2026-03-10', al: '2026-03-16' }], [])).size).toBe(0);
    expect((await repository.venditeNeiPeriodi(ambitoDi(kit), [], ['123'])).size).toBe(0);
  });

  /** Il kit come lo legge kitNellAmbito: qui contano id, promo, area, canale, data e GDO. */
  const kitInsight = (kit: KitDiProva, data: string, dati: Partial<KitInsight> = {}): KitInsight => ({
    id: kit.idRuntime,
    titolo: 'Marzo',
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

  it('edizioni precedenti: le ultime della stessa GDO, area e canale prima del volantino, dalla piu\' recente, con il PDF', async () => {
    const base = await creaKitRuntime({ validitaDal: giorno('2026-03-10'), validitaAl: giorno('2026-03-20'), titolo: 'Marzo' });
    const febbraio = await edizione(base, '2026-02-10', { titolo: 'Febbraio' });
    const gennaio = await edizione(base, '2026-01-10', { titolo: 'Gennaio' });
    await edizione(base, '2025-12-10', { titolo: 'Dicembre' });
    // Non contano: eliminati, POP, di un'altra area e canale, successivi
    await edizione(base, '2026-02-15', { statoLavorazione: 'ELIMINATO' });
    await edizione(base, '2026-02-16', { statoPromo: 'ELIMINATA' });
    await comePop(await edizione(base, '2026-02-17'), base);
    await creaKitRuntime({ idGdo: base.idGdo, validitaDal: giorno('2026-02-18') });
    await edizione(base, '2026-04-01');
    const vol = await creaTipoExport('VOL');
    const idPdf = await creaFile({ nome: 'gennaio.pdf', idRuntime: gennaio.idRuntime, tipoExport: vol, idOlimpoCloud: 'olimpo-gennaio', mime: 'application/pdf' });
    await sequelize.query('UPDATE files_runtime SET pages = 8 WHERE id = :id', { replacements: { id: idPdf } });

    const edizioni = await repository.edizioniPrecedenti(kitInsight(base, '2026-03-10'), 2);

    expect(edizioni.map(voce => [voce.kit.id, voce.kit.titolo, voce.kit.data, voce.kit.validitaDal, voce.pdf])).toEqual([
      [febbraio.idRuntime, 'Febbraio', '2026-02-10', '2026-02-10', null],
      [gennaio.idRuntime, 'Gennaio', '2026-01-10', '2026-01-10', { idOlimpoCloud: 'olimpo-gennaio', pagine: 8 }],
    ]);
    expect(edizioni[0].kit).toMatchObject({
      idPromo: febbraio.idPromo, idArea: base.idArea, idCanale: base.idCanale, area: 'Toscana', canale: 'Superstore',
      gdo: base.idGdo, storico: false, importStorico: null,
    });
    // La stessa promo non e' un'edizione precedente
    expect(await repository.edizioniPrecedenti(kitInsight(base, '2026-03-10', { idPromo: febbraio.idPromo }), 5))
      .not.toContainEqual(expect.objectContaining({ kit: expect.objectContaining({ id: febbraio.idRuntime }) }));
  });

  it('senza GDO del kit o senza edizioni da guardare nessuna edizione', async () => {
    const base = await creaKitRuntime({ validitaDal: giorno('2026-03-10') });
    await edizione(base, '2026-02-10');

    expect(await repository.edizioniPrecedenti(kitInsight(base, '2026-03-10', { gdo: null }), 5)).toEqual([]);
    expect(await repository.edizioniPrecedenti(kitInsight(base, '2026-03-10'), 0)).toEqual([]);
    expect(await repository.edizioniPrecedenti(kitInsight(base, '2026-03-10'), 5)).toHaveLength(1);
  });
});
