import { beforeEach, expect, it } from 'vitest';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaKitRuntime, creaLogFile } from '../../../__tests__/integrazione/dati';
import type { IIstantaService } from '../../interfaces/IIstantaService';
import type { IWebhookService } from '../../interfaces/IWebhookService';
import { KitRuntimeService } from '../KitRuntimeService';

// Un file del kit ha un log per versione. Chi aggiorna lo stato (invio a Correggo4, sync dal Plugin,
// nuovo caricamento) deve partire dall'ultima: prima la lettura non era ordinata e il risultato
// dipendeva dal piano di PostgreSQL. Con l'indice (id_kit_runtime, nome_file, versione DESC) usciva
// l'ultima per caso; con una scansione sequenziale (PGOPTIONS='-c enable_indexscan=off
// -c enable_bitmapscan=off') usciva la prima e questo test falliva.
describeConDatabase('KitRuntimeService: log del file', () => {
  usaDatabase();
  const service = new KitRuntimeService({} as unknown as IIstantaService, {} as unknown as IWebhookService);

  beforeEach(async () => {
    await svuotaTabelle('gdo');
  });

  it('restituisce l\'ultima versione, qualunque sia l\'ordine di inserimento', async () => {
    const { idRuntime } = await creaKitRuntime();
    await creaLogFile({ idKitRuntime: idRuntime, nomeFile: 'volantino.pdf', versione: 0 });
    await creaLogFile({ idKitRuntime: idRuntime, nomeFile: 'volantino.pdf', versione: 2, stato: 'IN_ATTESA_DI_CORREGGO' });
    await creaLogFile({ idKitRuntime: idRuntime, nomeFile: 'volantino.pdf', versione: 1 });

    const log = await service.getFileRunTimeLogByNomeFileEIdKitRuntime('volantino.pdf', idRuntime);

    expect(log).toMatchObject({ versione: 2, stato: 'IN_ATTESA_DI_CORREGGO' });
  });

  it('considera solo il file e il kit indicati', async () => {
    const kit = await creaKitRuntime();
    const altroKit = await creaKitRuntime();
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: 'volantino.pdf', versione: 1 });
    await creaLogFile({ idKitRuntime: altroKit.idRuntime, nomeFile: 'volantino.pdf', versione: 5 });
    await creaLogFile({ idKitRuntime: kit.idRuntime, nomeFile: 'altro.pdf', versione: 7 });

    expect(await service.getFileRunTimeLogByNomeFileEIdKitRuntime('volantino.pdf', kit.idRuntime)).toMatchObject({ versione: 1 });
  });

  it('senza log restituisce null', async () => {
    const { idRuntime } = await creaKitRuntime();

    expect(await service.getFileRunTimeLogByNomeFileEIdKitRuntime('volantino.pdf', idRuntime)).toBeNull();
  });
});
