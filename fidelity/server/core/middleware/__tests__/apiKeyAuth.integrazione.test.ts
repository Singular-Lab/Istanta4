import * as crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, expect, it, vi } from 'vitest';
import { RUOLO_UTENTE_GDO } from '../../../../lib/enums';
import { describeConDatabase, svuotaTabelle, usaDatabase } from '../../../__tests__/integrazione/database';
import { creaUtenteConRuolo } from '../../../__tests__/integrazione/dati';
import config from '../../config';
import { sequelize } from '../../db/SequelizeConnector';
import { ExternalApiService } from '../../services/ExternalApiService';
import { apiKeyAuthMiddleware, hashApiKey } from '../apiKeyAuth';

// Spec chiavi-api: nel database c'e' solo l'impronta della chiave, e la chiave si riconosce da li'.
describeConDatabase('chiave API sul database', () => {
  usaDatabase();
  const service = new ExternalApiService();

  beforeEach(async () => {
    await svuotaTabelle('utenti', 'gdo');
  });

  const chiama = async (chiave: string) => {
    const req = { headers: { 'x-api-key': chiave }, ip: '127.0.0.1', path: '/api/external/refs', method: 'POST', get: () => undefined } as unknown as Request;
    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    await apiKeyAuthMiddleware(req, res, next);
    return { req, res, next };
  };

  const impronteSalvate = async (idRuolo: string) => {
    const [righe] = await sequelize.query(
      'SELECT api_key_ruolo_utente_gdo FROM ruolo_utente_gdo WHERE id_ruolo_utente_gdo = :idRuolo',
      { replacements: { idRuolo } }
    );
    return (righe as { api_key_ruolo_utente_gdo: string | null }[])[0]?.api_key_ruolo_utente_gdo;
  };

  it('la chiave generata viene accettata e nel database resta solo la sua impronta', async () => {
    const { idUtente, idRuolo } = await creaUtenteConRuolo(Object.values(RUOLO_UTENTE_GDO)[0]);

    const { apiKey } = await service.generateApiKey(idUtente);
    const { req, next } = await chiama(apiKey);

    expect(await impronteSalvate(idRuolo)).toBe(hashApiKey(apiKey));
    expect(next).toHaveBeenCalledOnce();
    expect(req.apiKeyInfo?.ruoloId).toBe(idRuolo);
  });

  it('copia del database: il valore salvato non funziona come chiave', async () => {
    const { idUtente, idRuolo } = await creaUtenteConRuolo(Object.values(RUOLO_UTENTE_GDO)[0]);
    await service.generateApiKey(idUtente);

    const { res, next } = await chiama(String(await impronteSalvate(idRuolo)));

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('una chiave generata da piu di un anno viene rifiutata anche se e registrata', async () => {
    const { idRuolo } = await creaUtenteConRuolo(Object.values(RUOLO_UTENTE_GDO)[0]);
    // Stessa costruzione di generateApiKey, con la data di tredici mesi fa
    const tredici = Date.now() - 395 * 86_400_000;
    const segreto = crypto.createHash('sha256').update(config.FICO_SECRET).digest();
    const cifra = crypto.createCipheriv('aes-256-cbc', segreto, segreto.subarray(0, 16));
    const vecchia = cifra.update(`${crypto.randomBytes(32).toString('hex')}-${tredici}`, 'utf8', 'hex') + cifra.final('hex');
    await sequelize.query(
      'UPDATE ruolo_utente_gdo SET api_key_ruolo_utente_gdo = :impronta WHERE id_ruolo_utente_gdo = :idRuolo',
      { replacements: { impronta: hashApiKey(vecchia), idRuolo } }
    );

    const { res, next } = await chiama(vecchia);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
