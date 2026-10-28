import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sequelize } from '../../db/SequelizeConnector';
import { MODELLI_SEQUELIZE, modelliManager } from '../index';
import { RuoloUtenteGDO } from '../ruolo_gdo';

/**
 * L'ALTER di Sequelize resta solo per l'adozione della baseline su un database creato dalla
 * vecchia sincronizzazione (db/migrazioni/applicaMigrazioni.ts). Script SQL, view e seed dei ruoli
 * GDO non sono piu' affar suo: li gestisce il runner delle migrazioni.
 */
describe('allineamentoLegacyPerAdozione', () => {
  let ordineChiamate: string[];

  beforeEach(() => {
    vi.restoreAllMocks();
    ordineChiamate = [];

    for (const config of Object.values(MODELLI_SEQUELIZE)) {
      vi.spyOn(config.model, 'sync').mockImplementation(async () => {
        ordineChiamate.push(`sync:${config.nome}`);
        return config.model as never;
      });
    }

    vi.spyOn(sequelize, 'query').mockImplementation(async () => {
      ordineChiamate.push('query:sql');
      return [[], {}] as never;
    });
    vi.spyOn(RuoloUtenteGDO, 'findAll').mockImplementation(async () => {
      ordineChiamate.push('seed:findAll');
      return [] as never;
    });
  });

  it('allinea con alter, senza force', async () => {
    await modelliManager.allineamentoLegacyPerAdozione();

    const sync = vi.mocked(MODELLI_SEQUELIZE.GDO.model.sync);
    expect(sync).toHaveBeenCalledWith(expect.objectContaining({ alter: true, force: false }));
  });

  it('non esegue script SQL ne\' il seed dei ruoli GDO', async () => {
    // Gli script di db/scripts non esistono piu': view e correzioni stanno nelle migrazioni
    await modelliManager.allineamentoLegacyPerAdozione();

    expect(ordineChiamate).not.toContain('query:sql');
    expect(ordineChiamate).not.toContain('seed:findAll');
  });

  it('sincronizza gdo prima di aree, che ha una chiave esterna verso gdo', async () => {
    const risultati = await modelliManager.allineamentoLegacyPerAdozione();

    const indiceGdo = ordineChiamate.indexOf('sync:GDO');
    const indiceAree = ordineChiamate.indexOf('sync:Area');

    expect(indiceGdo).toBeGreaterThan(-1);
    expect(indiceAree).toBeGreaterThan(-1);
    //Nell'ordine di dichiarazione Area e' seconda e GDO decima: senza
    //ordinamento per dipendenze, su database vuoto Area fallisce con
    //"relation gdo does not exist".
    expect(indiceGdo).toBeLessThan(indiceAree);
    expect(risultati.every(r => r.successo)).toBe(true);
  });

  it('copre tutti i modelli del registro, una volta ciascuno', async () => {
    const risultati = await modelliManager.allineamentoLegacyPerAdozione();

    const attesi = Object.values(MODELLI_SEQUELIZE).map(c => c.nome).sort();
    const ottenuti = risultati.map(r => r.modello).sort();

    expect(ottenuti).toEqual(attesi);
    //Le tabelle ponte generate da belongsToMany restano fuori dal registro e
    //non vengono sincronizzate: lo schema di produzione non cambia.
    expect(risultati).toHaveLength(attesi.length);
  });

  it('con dipendenze cicliche ripiega sull ordine di dichiarazione senza perdere modelli', async () => {
    vi.spyOn(sequelize.modelManager, 'getModelsTopoSortedByForeignKey').mockReturnValue(null);

    const risultati = await modelliManager.allineamentoLegacyPerAdozione();

    const attesi = Object.values(MODELLI_SEQUELIZE).map(c => c.nome).sort();
    expect(risultati.map(r => r.modello).sort()).toEqual(attesi);
  });

  it('con soloModelli allinea solo quelli, nell\'ordine delle dipendenze', async () => {
    // Il secondo passaggio dell'adozione, dopo le correzioni delle migrazioni
    const risultati = await modelliManager.allineamentoLegacyPerAdozione({ soloModelli: ['Area', 'GDO'] });

    expect(risultati.map(r => r.modello)).toEqual(['GDO', 'Area']);
    expect(ordineChiamate).toEqual(['sync:GDO', 'sync:Area']);
  });

  it('un modello che fallisce resta nel risultato e non ferma gli altri', async () => {
    vi.spyOn(MODELLI_SEQUELIZE.Tracciati.model, 'sync').mockRejectedValue(new Error('violates foreign key constraint'));

    const risultati = await modelliManager.allineamentoLegacyPerAdozione();

    expect(risultati.find(r => r.modello === 'Tracciati')).toMatchObject({ successo: false, errore: 'violates foreign key constraint' });
    expect(risultati.filter(r => r.successo)).toHaveLength(Object.keys(MODELLI_SEQUELIZE).length - 1);
  });
});
