import { describe, expect, it, vi } from 'vitest';
import { STATO_PROMO } from '../../../../lib/enums';
import type { KitInsight } from '../../repositories/InsightVolantinoRepository';
import type { RigaReferenza } from '../../utils/referenzaStampata';
import type { CacheConsultazione } from '../cacheConsultazione';
import { ConsultazioneService } from '../ConsultazioneService';
import type { LettureKitInsight } from '../InsightConfrontiService';

vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

/**
 * Il dettaglio della promozione legge i kit una volta per tutti e rilegge le referenze solo dei kit
 * il cui risultato non e' gia' in cache con la stessa versione. Qui il servizio ha letture finte:
 * conta le query, non guarda il database.
 */

const ID_PROMO = '11111111-1111-4111-8111-111111111111';
const KIT = ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'];
const AMBITO = { idGdo: '22222222-2222-4222-8222-222222222222' };

const rigaKit = (id: string, indice: number) => ({
  id,
  id_promo: ID_PROMO,
  titolo: `Volantino ${indice}`,
  id_area: `area-${indice}`,
  nome_area: `Area ${indice}`,
  id_canale: `canale-${indice}`,
  nome_canale: `Insegna ${indice}`,
  numero_file: 1,
  numero_punti_vendita: 0,
  copertina_id_file: null,
  copertina_id_olimpo: null,
  copertina_nome: null,
  copertina_mime: null,
  copertina_pagine: null,
});

const kitInsight = (id: string, indice: number): KitInsight => ({
  id,
  titolo: `Volantino ${indice}`,
  idPromo: ID_PROMO,
  nomePromo: 'Promo di prova',
  idArea: `area-${indice}`,
  idCanale: `canale-${indice}`,
  area: `Area ${indice}`,
  canale: `Insegna ${indice}`,
  validitaDal: '2026-11-01',
  validitaAl: '2026-11-30',
  data: '2026-11-01',
  storico: false,
  importStorico: null,
  gdo: AMBITO.idGdo,
});

function creaServizio(opzioni: { versione?: () => string; cache?: CacheConsultazione | null; batch?: boolean }) {
  const righe = vi.fn(async (_id: string): Promise<RigaReferenza[]> => []);
  const lettureBatch = {
    kitNeiAmbito: vi.fn(async (ids: readonly string[]) => new Map(ids.map(id => [id, kitInsight(id, KIT.indexOf(id) + 1)]))),
    pdfDeiKit: vi.fn(async () => new Map()),
    versioniRigheDeiKit: vi.fn(async (ids: readonly string[]) => new Map(ids.map(id => [id, opzioni.versione?.() ?? '0']))),
  };
  const lettureSingole = {
    kitNellAmbito: vi.fn(async (id: string) => kitInsight(id, KIT.indexOf(id) + 1)),
    pdfDelKit: vi.fn(async () => null),
  };
  const letture: LettureKitInsight = {
    ...lettureSingole,
    righeDelKit: righe,
    ...(opzioni.batch === false ? {} : lettureBatch),
  };
  const materiali = {
    elencaVariantiVolantini: vi.fn(async () => KIT.map(rigaKit)),
    elencaPuntiVenditaVolantini: vi.fn(async () => []),
  };
  const repository = {
    trovaPromo: vi.fn(async () => ({
      id_promo: ID_PROMO,
      nome_promo: 'Promo di prova',
      stato_promo: STATO_PROMO.VALIDA,
      validita_dal: '2026-11-01',
      validita_al: '2026-11-30',
    })),
  };
  const servizio = new ConsultazioneService(
    materiali as never,
    repository as never,
    { scriviZipDaOlimpo: vi.fn() },
    vi.fn(),
    async () => [],
    undefined,
    letture,
    undefined,
    async () => [],
    undefined,
    opzioni.cache === undefined ? null : opzioni.cache
  );
  return { servizio, righe, lettureBatch, lettureSingole };
}

/** Una cache in memoria, come Redis ma senza Redis. */
function cacheInMemoria(): CacheConsultazione & { valori: Map<string, unknown> } {
  const valori = new Map<string, unknown>();
  return {
    valori,
    async leggi<T>(chiave: string) {
      return (valori.get(chiave) as T | undefined) ?? null;
    },
    async scrivi(chiave, valore) {
      valori.set(chiave, JSON.parse(JSON.stringify(valore)));
    },
  };
}

describe('ConsultazioneService: insight dei kit del dettaglio della promozione', () => {
  it('legge kit, PDF e versioni una volta per tutti i kit, non una per kit', async () => {
    const { servizio, righe, lettureBatch, lettureSingole } = creaServizio({});

    await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);

    expect(lettureBatch.kitNeiAmbito).toHaveBeenCalledTimes(1);
    expect(lettureBatch.pdfDeiKit).toHaveBeenCalledTimes(1);
    expect(lettureBatch.versioniRigheDeiKit).toHaveBeenCalledTimes(1);
    expect(lettureBatch.kitNeiAmbito.mock.calls[0][0]).toEqual(KIT);
    expect(lettureSingole.kitNellAmbito).not.toHaveBeenCalled();
    expect(lettureSingole.pdfDelKit).not.toHaveBeenCalled();
    // Senza cache le referenze si leggono per ogni kit, come prima
    expect(righe).toHaveBeenCalledTimes(KIT.length);
  });

  it('senza le letture a gruppi (letture del solo kit) il risultato e\' lo stesso', async () => {
    const conBatch = await creaServizio({}).servizio.getPromozioneVolantini(ID_PROMO, AMBITO);
    const { servizio, lettureSingole } = creaServizio({ batch: false });

    const senzaBatch = await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);

    expect(lettureSingole.kitNellAmbito).toHaveBeenCalledTimes(KIT.length);
    expect(senzaBatch).toEqual(conBatch);
  });

  it('con la cache, alla seconda richiesta non rilegge le referenze e risponde uguale', async () => {
    const cache = cacheInMemoria();
    const { servizio, righe } = creaServizio({ cache });

    const prima = await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);
    // La scrittura in cache parte senza essere attesa
    await new Promise(risolvi => setImmediate(risolvi));
    expect(cache.valori.size).toBe(KIT.length);
    righe.mockClear();

    const seconda = await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);

    expect(righe).not.toHaveBeenCalled();
    expect(seconda).toEqual(prima);
  });

  it('cambiando la versione delle referenze di un kit, quel kit si ricalcola', async () => {
    const cache = cacheInMemoria();
    let versione = '3@2026-11-20T10:00:00.000000';
    const { servizio, righe } = creaServizio({ cache, versione: () => versione });
    await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);
    await new Promise(risolvi => setImmediate(risolvi));
    righe.mockClear();

    versione = '4@2026-11-23T09:30:00.000000';
    await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);

    // La versione e' quella di tutti i kit della prova: tutti cambiano
    expect(righe).toHaveBeenCalledTimes(KIT.length);
  });

  it('una cache che fallisce non rompe la risposta: si calcola come senza cache', async () => {
    const cacheRotta: CacheConsultazione = {
      leggi: () => Promise.reject(new Error('Redis non risponde')),
      scrivi: () => Promise.reject(new Error('Redis non risponde')),
    };
    const { servizio, righe } = creaServizio({ cache: cacheRotta });

    const dettaglio = await servizio.getPromozioneVolantini(ID_PROMO, AMBITO);

    expect(dettaglio.kit).toHaveLength(KIT.length);
    expect(righe).toHaveBeenCalledTimes(KIT.length);
  });
});
