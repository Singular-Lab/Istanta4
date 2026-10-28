import { describe, expect, it } from 'vitest';
import { Config } from '../config';

/**
 * Il validatore di modello di Config controlla webpliant anche quando si aggiornano altre
 * colonne: un update parziale (id_gdo_config, funzionalita) senza validate:false fallisce
 * sempre. Per questo migraConfig aggiorna con validate:false (vedi migrazioneConfig.test.ts).
 */
describe('Config: validatore di modello', () => {
  it('rifiuta un\'istanza con le sole colonne di un update parziale', async () => {
    const parziale = Config.build({ funzionalita: { momenti: true, menabo: false } } as any);

    await expect(parziale.validate()).rejects.toThrow('Il campo webpliant è obbligatorio e deve essere un oggetto');
  });

  it('accetta una configurazione con webpliant', async () => {
    const completa = Config.build({ webpliant: {}, funzionalita: { momenti: true, menabo: false } } as any);

    await expect(completa.validate({ fields: ['webpliant', 'funzionalita'] })).resolves.toBeTruthy();
  });
});
