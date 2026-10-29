import dayjs from 'dayjs';
import express from 'express';
import crypto from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import config from '../../config';
import { apiKeyAuthMiddleware, hashApiKey } from '../apiKeyAuth';

// Ruolo GDO simulato: nessun database, solo la ricerca per impronta della chiave
const { findOne } = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock('../../models/ruolo_gdo', () => ({ RuoloUtenteGDO: { findOne } }));

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/*
 * Spec proposta "Durata della chiave API": la chiave e' il cifrato AES-256-CBC (chiave e IV da
 * sha256(FICO_SECRET)) di "<dati casuali>-<timestamp ms di emissione>" e vale un anno.
 */

/** Chiave emessa all'istante indicato, con la stessa logica di ExternalApiService.generateApiKey. */
function chiaveEmessaIl(istante: number, segreto: string = config.FICO_SECRET): string {
  const chiave = crypto.createHash('sha256').update(segreto).digest();
  const cipher = crypto.createCipheriv('aes-256-cbc', chiave, chiave.subarray(0, 16));
  const dati = `${crypto.randomBytes(32).toString('hex')}-${istante}`;
  return cipher.update(dati, 'utf8', 'hex') + cipher.final('hex');
}

const ruolo = { id_ruolo_utente_gdo: 'r1', ruolo_ruolo_utente_gdo: 'Integrazione' };

/** Rotta esterna protetta dalla sola chiave API: risponde 200 solo se il middleware chiama next(). */
function app() {
  const applicazione = express();
  applicazione.get('/api/external/prova', apiKeyAuthMiddleware, (req, res) => {
    res.status(200).json({ passato: true, ruoloId: req.apiKeyInfo?.ruoloId });
  });
  return applicazione;
}

describe('apiKeyAuthMiddleware: durata della chiave API', () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  it('una chiave emessa 11 mesi fa con un ruolo associato passa (next chiamato)', async () => {
    const chiave = chiaveEmessaIl(dayjs().subtract(11, 'month').valueOf());
    findOne.mockResolvedValue(ruolo);

    const res = await request(app()).get('/api/external/prova').set('x-api-key', chiave);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ passato: true, ruoloId: 'r1' });
    expect(findOne).toHaveBeenCalledWith({ where: { api_key_ruolo_utente_gdo: hashApiKey(chiave) } });
  });

  it('una chiave emessa 13 mesi fa e\' scaduta: 401 senza interrogare il database', async () => {
    const chiave = chiaveEmessaIl(dayjs().subtract(13, 'month').valueOf());
    findOne.mockResolvedValue(ruolo);

    const res = await request(app()).get('/api/external/prova').set('x-api-key', chiave);

    expect(res.status).toBe(401);
    expect(res.body.details).toEqual({ error: 'INVALID_OR_EXPIRED_API_KEY' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it.each([
    { caso: 'testo non esadecimale', chiave: () => 'questa-non-e-una-chiave-api' },
    { caso: 'cifrata con un altro segreto', chiave: () => chiaveEmessaIl(Date.now(), `${config.FICO_SECRET}-altro`) },
  ])('una stringa non decifrabile ($caso) risponde 401', async ({ chiave }) => {
    findOne.mockResolvedValue(ruolo);

    const res = await request(app()).get('/api/external/prova').set('x-api-key', chiave());

    expect(res.status).toBe(401);
    expect(res.body.details).toEqual({ error: 'INVALID_OR_EXPIRED_API_KEY' });
    expect(findOne).not.toHaveBeenCalled();
  });

  it('una chiave valida senza ruolo associato risponde 401', async () => {
    const chiave = chiaveEmessaIl(Date.now());
    findOne.mockResolvedValue(null);

    const res = await request(app()).get('/api/external/prova').set('x-api-key', chiave);

    expect(res.status).toBe(401);
    expect(res.body.details).toEqual({ error: 'INVALID_API_KEY' });
    expect(findOne).toHaveBeenCalledOnce();
  });

  it('un errore del database nella ricerca del ruolo risponde 500 senza dettagli interni', async () => {
    const chiave = chiaveEmessaIl(Date.now());
    findOne.mockRejectedValue(new Error('connessione al database persa'));

    const res = await request(app()).get('/api/external/prova').set('x-api-key', chiave);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, error: 'INTERNAL_SERVER_ERROR' });
    expect(JSON.stringify(res.body)).not.toContain('connessione al database persa');
  });
});
