import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

const passa = vi.hoisted(() => (_req: unknown, _res: unknown, next: () => void) => next());

vi.mock('../../logger', () => ({ log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

// Il limite delle creazioni ha i suoi test (rateLimiter.creazioneUtenti): qui contano tipi e GDO
vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: passa,
  authEmailRateLimiter: passa,
  registrationRateLimiter: passa,
}));
vi.mock('../../middleware/authMiddleware', () => ({ authMiddleware: passa }));
vi.mock('../../middleware/permissionGuard', () => ({ permissionGuard: () => passa }));
vi.mock('../../http/cachePassaporti', () => ({ invalidaPassaporto: vi.fn() }));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ userCreated: vi.fn(), userUpdated: vi.fn() }) },
}));

// L'anagrafica lega l'amministratore della sessione alla GDO "gdo-sessione"
vi.mock('../../models', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  UtentiGDO: { findOne: vi.fn(async () => ({ id_gdo_utentegdo: 'gdo-sessione', id_ruolo_utente_gdo: null })) },
}));

import { UserController } from '../UserController';

// Generata a ogni esecuzione: nessuna credenziale fissa nel codice, anche se finta
const PASSWORD_DI_PROVA = `Pw-${randomUUID()}`;

/** Solo i dati essenziali: niente data di nascita, residenza, telefono. */
const NUOVO_UTENTE = {
  email: 'anna.rossi@esempio.it',
  nome: 'Anna',
  cognome: 'Rossi',
  password: PASSWORD_DI_PROVA,
  stato: STATO_UTENTI.ATTIVO,
};

function creaApp(tipoChiamante: TIPO_UTENTI) {
  const userService = {
    registerUserWithTransaction: vi.fn(async () => ({ id_utenti: 'u-nuovo' })),
    getUserByEmail: vi.fn(async () => null as unknown),
    updateUser: vi.fn(async () => ({ id: 'u1' })),
    refreshMaterializedView: vi.fn(async () => undefined),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: object }).session = { id_utente: 'admin-1', tipo_utente: tipoChiamante };
    next();
  });
  new UserController(userService as never, {} as never, {} as never, {} as never).registerRoutes(app);
  return { app, userService };
}

const datiRegistrati = (userService: ReturnType<typeof creaApp>['userService']) =>
  (userService.registerUserWithTransaction.mock.calls[0] as unknown[])[0] as Record<string, unknown>;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('POST /api/register-user: dati essenziali', () => {
  it('crea l\'utente senza data di nascita, residenza e telefono', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).post('/api/register-user')
      .send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.MARKETING, gdoScelta: 'gdo-2', dataDiNascita: '', residenza: '' });

    expect(res.status).toBe(200);
    expect(datiRegistrati(userService)).toMatchObject({ email: NUOVO_UTENTE.email, residenza: undefined, dataDiNascita: undefined });
  });

  it('senza password non crea l\'utente', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);
    const { password: _password, ...senzaPassword } = NUOVO_UTENTE;

    const res = await request(app).post('/api/register-user').send({ ...senzaPassword, tipo: TIPO_UTENTI.MARKETING });

    expect(res.status).toBe(400);
    expect(userService.registerUserWithTransaction).not.toHaveBeenCalled();
  });
});

describe('POST /api/register-user: tipo e GDO del nuovo utente', () => {
  it('l\'Agenzia non crea un Superadmin', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.AGENZIA);

    const res = await request(app).post('/api/register-user').send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.SUPERADMIN });

    expect(res.status).toBe(403);
    expect(userService.registerUserWithTransaction).not.toHaveBeenCalled();
  });

  it('un utente GDO non crea un altro utente GDO', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.GDO);

    const res = await request(app).post('/api/register-user').send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.GDO });

    expect(res.status).toBe(403);
    expect(userService.registerUserWithTransaction).not.toHaveBeenCalled();
  });

  it('un utente GDO crea nella propria GDO, anche se la richiesta ne indica un\'altra', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.GDO);

    const res = await request(app).post('/api/register-user')
      .send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.CATEGORY, gdoScelta: 'altra-gdo' });

    expect(res.status).toBe(200);
    expect(datiRegistrati(userService)).toMatchObject({ tipo: TIPO_UTENTI.CATEGORY, gdoScelta: 'gdo-sessione' });
  });

  it.each([TIPO_UTENTI.SUPERADMIN, TIPO_UTENTI.AGENZIA])('%s sceglie la GDO del nuovo utente', async (tipoChiamante) => {
    const { app, userService } = creaApp(tipoChiamante);

    const res = await request(app).post('/api/register-user')
      .send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.CATEGORY, gdoScelta: 'gdo-2' });

    expect(res.status).toBe(200);
    expect(datiRegistrati(userService)).toMatchObject({ gdoScelta: 'gdo-2' });
  });

  it('solo il Superadmin crea un Superadmin', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).post('/api/register-user').send({ ...NUOVO_UTENTE, tipo: TIPO_UTENTI.SUPERADMIN });

    expect(res.status).toBe(200);
    expect(datiRegistrati(userService)).toMatchObject({ tipo: TIPO_UTENTI.SUPERADMIN });
  });
});

describe('GET /api/utenti/email-registrata', () => {
  it('riconosce un\'email gia\' registrata senza badare a maiuscole e spazi', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);
    userService.getUserByEmail.mockResolvedValueOnce({ id: 'u1' });

    const res = await request(app).get('/api/utenti/email-registrata').query({ email: ' Anna.Rossi@Esempio.it ' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ registrata: true });
    expect(userService.getUserByEmail).toHaveBeenCalledWith('anna.rossi@esempio.it');
  });

  it('un\'email libera non e\' registrata', async () => {
    const { app } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).get('/api/utenti/email-registrata').query({ email: 'nuova@esempio.it' });

    expect(res.body).toEqual({ registrata: false });
  });

  it('senza email risponde 400', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).get('/api/utenti/email-registrata');

    expect(res.status).toBe(400);
    expect(userService.getUserByEmail).not.toHaveBeenCalled();
  });
});

describe('PUT /api/updateUser: dati facoltativi', () => {
  it('data di nascita e residenza vuote si salvano come assenti, non come data non valida', async () => {
    const { app, userService } = creaApp(TIPO_UTENTI.SUPERADMIN);

    const res = await request(app).put('/api/updateUser')
      .send({ id: 'u1', nome: 'Anna', cognome: 'Bianchi', dataDiNascita: '', residenza: '', telefono: '' });

    expect(res.status).toBe(200);
    expect(userService.updateUser).toHaveBeenCalledWith('u1', expect.objectContaining({
      cognome: 'Bianchi', datadinascita: null, residenza: null, telefono: null,
    }));
  });
});
