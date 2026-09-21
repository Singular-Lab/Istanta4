import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sequelize } from '../../db/SequelizeConnector';
import { MODELLI_SEQUELIZE, modelliManager } from '../index';
import { RuoloUtenteGDO } from '../ruolo_gdo';

/**
 * Il seed dei ruoli GDO girava dentro il ciclo dei mixin, prima che le tabelle
 * esistessero, e dentro un forEach con callback async: le promesse venivano
 * scartate, il try/catch non poteva intercettarle e il rigetto finiva a
 * process.on('unhandledRejection'), che spegne il processo.
 *
 * Questi test coprono le due condizioni osservabili: l'ordine e il fatto che un
 * errore del seed resti contenuto.
 */
describe('sincronizzaTuttiIModelli', () => {
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

    // Gli script SQL vengono letti davvero dal repository, ma non eseguiti.
    vi.spyOn(sequelize, 'query').mockImplementation(async () => {
      ordineChiamate.push('query:sql');
      return [[], {}] as never;
    });

    vi.spyOn(RuoloUtenteGDO, 'findAll').mockImplementation(async () => {
      ordineChiamate.push('seed:findAll');
      return [] as never;
    });

    vi.spyOn(RuoloUtenteGDO, 'bulkCreate').mockImplementation(async () => {
      ordineChiamate.push('seed:bulkCreate');
      return [] as never;
    });
  });

  it('esegue il seed dei ruoli GDO dopo aver sincronizzato tutti i modelli', async () => {
    await modelliManager.sincronizzaTuttiIModelli();

    const indiceSeed = ordineChiamate.indexOf('seed:findAll');
    const indiceUltimaSync = ordineChiamate.lastIndexOf(
      ordineChiamate.filter(voce => voce.startsWith('sync:')).at(-1)!
    );

    expect(indiceSeed).toBeGreaterThan(-1);
    expect(indiceUltimaSync).toBeGreaterThan(-1);
    //Il seed deve venire dopo l'ultima sync: e' cio' che garantisce che la
    //tabella ruolo_utente_gdo esista quando viene interrogata.
    expect(indiceSeed).toBeGreaterThan(indiceUltimaSync);
  });

  it('inserisce solo i ruoli mancanti e non chiama bulkCreate quando non ne manca nessuno', async () => {
    const tuttiPresenti = Object.values(
      await import('../../../../lib/enums').then(m => m.RUOLO_UTENTE_GDO)
    ).map(ruolo => ({ ruolo_ruolo_utente_gdo: ruolo }));

    vi.spyOn(RuoloUtenteGDO, 'findAll').mockImplementation(async () => {
      ordineChiamate.push('seed:findAll');
      return tuttiPresenti as never;
    });

    await modelliManager.sincronizzaTuttiIModelli();

    expect(ordineChiamate).toContain('seed:findAll');
    expect(ordineChiamate).not.toContain('seed:bulkCreate');
  });

  it('non propaga un errore del seed: il rigetto resta catturato', async () => {
    vi.spyOn(RuoloUtenteGDO, 'findAll').mockImplementation(async () => {
      ordineChiamate.push('seed:findAll');
      throw new Error('relation "ruolo_utente_gdo" does not exist');
    });

    //E' la regressione che spegneva il container: se il rigetto sfugge al
    //catch, arriva a process.on('unhandledRejection') e il processo termina.
    await expect(modelliManager.sincronizzaTuttiIModelli()).resolves.toBeDefined();
    expect(ordineChiamate).toContain('seed:findAll');
  });
});
