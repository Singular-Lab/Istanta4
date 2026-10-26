import { describe, expect, it } from 'vitest';
import { EVENTI_WEBHOOK } from '../../../../lib/enums';
import { Webhook } from '../Webhook';

/**
 * eventi_webhook era un array di ENUM, che l'ALTER di models:sync non sa
 * gestire. Ora e' un array di stringhe: i valori ammessi li controlla il
 * modello, senza database.
 */
const valida = (eventi: unknown) =>
  Webhook.build({ eventi_webhook: eventi } as any).validate({ fields: ['eventi_webhook'] });

describe('Webhook.eventi_webhook', () => {
  it('accetta gli eventi di EVENTI_WEBHOOK', async () => {
    await expect(valida([EVENTI_WEBHOOK.UTENTE_CREATO, EVENTI_WEBHOOK.PROMO_CREATA])).resolves.toBeTruthy();
  });

  it('rifiuta un evento che non esiste', async () => {
    await expect(valida([EVENTI_WEBHOOK.UTENTE_CREATO, 'EVENTO_INVENTATO'])).rejects.toThrow('EVENTO_INVENTATO');
  });
});
