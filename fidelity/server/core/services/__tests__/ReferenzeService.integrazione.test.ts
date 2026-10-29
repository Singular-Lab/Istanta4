import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { beforeEach, expect, it, vi } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, creaReferenza, creaWorkspace, type KitDiProva } from '../../../__tests__/integrazione/dati';
import type { FilterCondition, FilterConditionContesto, PageLayoutItem, ReferenzeIstanta } from '../../../../lib/types';
import type { IWebPliantService } from '../../interfaces/IWebPliantService';
import { PromoRepository } from '../../repositories/PromoRepository';
import { FUSO_WEBPLIANT } from '../../utils/visibilitaWebpliant';
import { ReferenzeService } from '../ReferenzeService';

dayjs.extend(utc);
dayjs.extend(timezone);

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Spec referenze-webpliant sul PostgreSQL vero: visibilita a giorni di Roma con l'ultimo giorno
// incluso, solo kit PUBBLICATI per il pubblico, una referenza per codice (vince la promo iniziata
// piu di recente), filtri di contesto senza maiuscole e codici confrontati come testo.

/** Le 00:00 di Roma di un giorno, come Istanta scrive le date delle promo. */
const mezzanotteRoma = (giorno: string) => dayjs.tz(giorno, FUSO_WEBPLIANT).toDate();

const nessunFiltro = { content: {} } as unknown as PageLayoutItem;
const conContesto = (filtriContesto: FilterConditionContesto[]) => ({ content: { filtriContesto } }) as unknown as PageLayoutItem;
const conFiltri = (filtersNew: FilterCondition[][]) => ({ content: { filtersNew } }) as unknown as PageLayoutItem;

const codici = (referenze: ReferenzeIstanta[]) => referenze.map((r) => String(r.dataFields?.codice_referenza)).sort();

describeConDatabase('ReferenzeService.getFilteredReferenze sul database', () => {
  usaDatabase();
  // Come nel container: il repository delle promo legge il DB. WebPliantService non serve a questa
  // lettura e resta finto.
  const service = new ReferenzeService(new PromoRepository(), {} as unknown as IWebPliantService);

  beforeEach(async () => {
    await svuotaTabelle('gdo', 'promo', 'runtime_kit', 'referenze', 'workspace_webpliant');
  });

  async function consulta(kit: KitDiProva, giorno: string, opzioni: { isEditor?: boolean; item?: PageLayoutItem } = {}) {
    const idWorkspace = await creaWorkspace({ idGdo: kit.idGdo });
    return service.getFilteredReferenze(
      idWorkspace, giorno, kit.idArea, kit.idCanale, undefined, opzioni.item ?? nessunFiltro, opzioni.isEditor ?? false
    );
  }

  it('l\'ultimo giorno di validita e\' incluso anche se la fine e\' salvata alle 00:00 di Roma', async () => {
    // Promo dal 25 al 31 ottobre: validita_al = 31/10 00:00 di Roma = 2026-10-30T23:00:00Z
    const kit = await creaKitRuntime({ validitaDal: mezzanotteRoma('2026-10-25'), validitaAl: new Date('2026-10-30T23:00:00Z') });
    await creaReferenza(kit, { codice: '8001234' });

    expect(codici(await consulta(kit, '2026-10-31'))).toEqual(['8001234']);
    expect(codici(await consulta(kit, '2026-10-31', { isEditor: true }))).toEqual(['8001234']);
    expect(await consulta(kit, '2026-11-01')).toEqual([]);
  });

  it('il kit IN_REVISIONE e\' escluso dal pubblico e incluso nell\'editor', async () => {
    const date = { validitaDal: mezzanotteRoma('2026-10-25'), validitaAl: mezzanotteRoma('2026-11-05') };
    const pubblicato = await creaKitRuntime(date);
    const inRevisione = await creaKitRuntime({ ...date, statoLavorazione: 'IN_REVISIONE', stessaCombinazioneDi: pubblicato });
    await creaReferenza(pubblicato, { codice: 'PUBBLICATA' });
    await creaReferenza(inRevisione, { codice: 'IN-REVISIONE' });

    expect(codici(await consulta(pubblicato, '2026-10-28'))).toEqual(['PUBBLICATA']);
    expect(codici(await consulta(pubblicato, '2026-10-28', { isEditor: true }))).toEqual(['IN-REVISIONE', 'PUBBLICATA']);
  });

  it('stessa referenza in due promo visibili: compare una volta, con i dati della promo iniziata piu di recente', async () => {
    // Promo A dal 1 al 15 ottobre, promo B dal 10 al 20 ottobre; A e' inserita per prima
    const promoA = await creaKitRuntime({ validitaDal: mezzanotteRoma('2026-10-01'), validitaAl: mezzanotteRoma('2026-10-15') });
    const promoB = await creaKitRuntime({
      validitaDal: mezzanotteRoma('2026-10-10'), validitaAl: mezzanotteRoma('2026-10-20'), stessaCombinazioneDi: promoA,
    });
    await creaReferenza(promoA, { codice: '8001234', dataFields: { prezzo: '2,99' } });
    await creaReferenza(promoB, { codice: '8001234', dataFields: { prezzo: '2,49' } });

    const referenze = await consulta(promoA, '2026-10-12');

    expect(referenze).toHaveLength(1);
    expect(referenze[0].idPromo).toBe(promoB.idPromo);
    expect(referenze[0].dataFields.prezzo).toBe('2,49');
  });

  it('il filtro di contesto non distingue le maiuscole', async () => {
    const kit = await creaKitRuntime({ validitaDal: mezzanotteRoma('2026-10-25'), validitaAl: mezzanotteRoma('2026-11-05') });
    await creaReferenza(kit, { codice: 'SC-1', dataFields: { context_promo: [{ nome_field: 'Canale', user_value: 'SC' }] } });
    await creaReferenza(kit, { codice: 'TR-1', dataFields: { context_tracciato: [{ nome_field: 'canale', user_value: 'sc ' }] } });
    await creaReferenza(kit, { codice: 'IP-1', dataFields: { context_promo: [{ nome_field: 'canale', user_value: 'IP' }] } });

    const referenze = await consulta(kit, '2026-10-28', {
      item: conContesto([{ nome_field: 'canale', operator: 'equals', user_value: 'SC' }]),
    });

    expect(codici(referenze)).toEqual(['SC-1', 'TR-1']);
  });

  it('il codice "00123" salvato come testo si trova con "00123" e non con "123"', async () => {
    const kit = await creaKitRuntime({ validitaDal: mezzanotteRoma('2026-10-25'), validitaAl: mezzanotteRoma('2026-11-05') });
    await creaReferenza(kit, { codice: '00123' });
    await creaReferenza(kit, { codice: '123' });

    const filtroCodice = (valore: string) => conFiltri([[{ field: 'codice_referenza', operator: 'equals', value: valore }]]);

    expect(codici(await consulta(kit, '2026-10-28', { item: filtroCodice('00123') }))).toEqual(['00123']);
    expect(codici(await consulta(kit, '2026-10-28', { item: filtroCodice('123') }))).toEqual(['123']);
  });
});
