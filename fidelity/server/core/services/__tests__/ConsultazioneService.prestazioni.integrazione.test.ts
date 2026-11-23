import { expect, it, vi } from 'vitest';
import { describeConDatabase, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, creaReferenza, type KitDiProva } from '../../../__tests__/integrazione/dati';
import { sequelize } from '../../db/SequelizeConnector';
import { ConsultazioneRepository } from '../../repositories/ConsultazioneRepository';
import { MaterialiRepository } from '../../repositories/MaterialiRepository';
import type { CacheConsultazione } from '../cacheConsultazione';
import { ConsultazioneService } from '../ConsultazioneService';

// Il dettaglio della promozione su PostgreSQL con una promo carica (molti kit, centinaia di
// referenze l'uno): quante query fa e se la cache dei kit salta la lettura delle referenze senza
// cambiare la risposta.
const KIT_DELLA_PROMO = 8;
const REFERENZE_PER_KIT = 60;

describeConDatabase('ConsultazioneService: prestazioni del dettaglio della promozione', () => {
  usaDatabase();
  const scrittoreZip = { scriviZipDaOlimpo: vi.fn() };

  function cacheInMemoria(): CacheConsultazione {
    const valori = new Map<string, unknown>();
    return {
      async leggi<T>(chiave: string) {
        return (valori.get(chiave) as T | undefined) ?? null;
      },
      async scrivi(chiave, valore) {
        valori.set(chiave, JSON.parse(JSON.stringify(valore)));
      },
    };
  }

  const creaServizio = (cache: CacheConsultazione | null) =>
    new ConsultazioneService(
      new MaterialiRepository(),
      new ConsultazioneRepository(),
      scrittoreZip,
      vi.fn(),
      async () => [],
      undefined,
      undefined,
      undefined,
      async () => [],
      undefined,
      cache
    );

  /** Le query SQL eseguite mentre gira `lavoro`. */
  async function querySql(lavoro: () => Promise<unknown>): Promise<string[]> {
    const eseguite: string[] = [];
    // `options` non e' nei tipi pubblici di Sequelize: serve per sentire ogni query
    const opzioni = (sequelize as unknown as { options: { logging: unknown } }).options;
    const precedente = opzioni.logging;
    opzioni.logging = (sql: string) => {
      eseguite.push(sql);
    };
    try {
      await lavoro();
    } finally {
      opzioni.logging = precedente;
    }
    return eseguite;
  }

  const leggeLeReferenze = (sql: string) => /SELECT r\.\*\s+FROM referenze r/i.test(sql);

  async function promoCarica() {
    const primo = await creaKitRuntime({ nomePromo: 'Promo carica', titolo: 'Kit 1' });
    const promo = { idGdo: primo.idGdo, idPromo: primo.idPromo };
    const kit: KitDiProva[] = [primo];
    for (let i = 2; i <= KIT_DELLA_PROMO; i += 1) kit.push(await creaKitRuntime({ promo, titolo: `Kit ${i}` }));
    for (const k of kit) {
      for (let r = 0; r < REFERENZE_PER_KIT; r += 1) {
        await creaReferenza(k, { codice: `${k.idRuntime.slice(0, 4)}-${r}`, dataFields: { descrizione_uno: `Prodotto ${r}` } });
      }
    }
    return { ambito: { idGdo: primo.idGdo }, idPromo: primo.idPromo };
  }

  it('senza cache le referenze si leggono una volta per kit e kit, PDF e versioni una volta sola', async () => {
    const { ambito, idPromo } = await promoCarica();
    const servizio = creaServizio(null);

    const sql = await querySql(() => servizio.getPromozioneVolantini(idPromo, ambito));

    expect(sql.filter(leggeLeReferenze)).toHaveLength(KIT_DELLA_PROMO);
    // La versione delle referenze: una sola query per tutti i kit, senza portare le righe
    expect(sql.filter(s => /MAX\(r\."updatedAt"\)/i.test(s))).toHaveLength(1);
  });

  it('con la cache, la seconda richiesta non legge le referenze e la risposta e\' uguale', async () => {
    const { ambito, idPromo } = await promoCarica();
    const servizio = creaServizio(cacheInMemoria());

    const prima = await servizio.getPromozioneVolantini(idPromo, ambito);
    // La scrittura in cache non viene attesa
    await new Promise(risolvi => setImmediate(risolvi));
    const sql = await querySql(async () => {
      const seconda = await servizio.getPromozioneVolantini(idPromo, ambito);
      expect(seconda).toEqual(prima);
    });

    expect(sql.filter(leggeLeReferenze)).toHaveLength(0);
    expect(prima.kit).toHaveLength(KIT_DELLA_PROMO);
    expect(prima.kit.every(k => k.referenze === REFERENZE_PER_KIT)).toBe(true);
  });

  it('una referenza modificata invalida solo la cache di quel kit', async () => {
    const { ambito, idPromo } = await promoCarica();
    const servizio = creaServizio(cacheInMemoria());
    await servizio.getPromozioneVolantini(idPromo, ambito);
    await new Promise(risolvi => setImmediate(risolvi));
    await sequelize.query(
      `UPDATE referenze SET "updatedAt" = now() + interval '1 minute'
       WHERE id = (SELECT id FROM referenze WHERE id_promo = :idPromo LIMIT 1)`,
      { replacements: { idPromo } }
    );

    const sql = await querySql(() => servizio.getPromozioneVolantini(idPromo, ambito));

    expect(sql.filter(leggeLeReferenze)).toHaveLength(1);
  });
});
