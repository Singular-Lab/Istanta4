import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';

const finto = vi.hoisted(() => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../logger', () => ({ log: finto.log }));

import { decryptString } from '../../../../lib/encryption';
import config from '../../config';
import { ServerUtils } from '../../utils/ServerUtils';
import { HubController } from '../HubController';

/**
 * Il context con cui l'hub apre i servizi Esterno FICO (Correggo, Istanta): senza il passaporto di
 * Olimpo non c'e' context, e il servizio non va aperto.
 */
function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    Object.assign(req, { session: { id_utente: 'user-1', tipo_utente: TIPO_UTENTI.AGENZIA, codice_posizione: 'P01' } });
    next();
  });
  new HubController({} as never, {} as never, {} as never).registerRoutes(app);
  return app;
}

afterEach(() => {
  vi.restoreAllMocks();
  finto.log.warn.mockClear();
});

describe('GET /api/hub-services/fico-context', () => {
  it('risponde 502 con un messaggio, senza context, se Olimpo non rilascia il passaporto', async () => {
    vi.spyOn(ServerUtils, 'getPassportFromOlympo').mockRejectedValue(new Error('Errore durante la richiesta del token'));

    const res = await request(createApp()).get('/api/hub-services/fico-context');

    expect(res.status).toBe(502);
    expect(res.body.message).toContain('Accesso automatico al servizio non riuscito');
    expect(res.body).not.toHaveProperty('context');
    expect(finto.log.warn).toHaveBeenCalledWith(
      expect.stringContaining('passaporto Olimpo non ottenuto'),
      expect.objectContaining({ motivo: 'Errore durante la richiesta del token' }),
    );
  });

  it('registra il motivo anche quando l errore e un oggetto con il messaggio', async () => {
    vi.spyOn(ServerUtils, 'getPassportFromOlympo').mockRejectedValue({ success: false, message: 'Utente non trovato', code: 400 });

    const res = await request(createApp()).get('/api/hub-services/fico-context');

    expect(res.status).toBe(502);
    expect(finto.log.warn).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ motivo: 'Utente non trovato' }));
  });

  it('con il passaporto restituisce il context cifrato con chiave pubblica, posizione e pagina di arrivo', async () => {
    vi.spyOn(ServerUtils, 'getPassportFromOlympo').mockResolvedValue('chiave-pubblica');

    const res = await request(createApp()).get('/api/hub-services/fico-context?route=/promo/in-corso');

    expect(res.status).toBe(200);
    expect(JSON.parse(decryptString(res.body.context, config.FICO_SECRET))).toEqual({
      publicKey: 'chiave-pubblica',
      codicePosizione: 'P01',
      route: '/promo/in-corso',
    });
  });
});
