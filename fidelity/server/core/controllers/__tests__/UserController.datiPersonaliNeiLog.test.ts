import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

// vi.mock viene spostato in cima al file: le costanti devono esserlo anche loro
const passa = vi.hoisted(() => (_req: unknown, _res: unknown, next: () => void) => next());
const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));

vi.mock('../../logger', () => ({ log }));

vi.mock('../../middleware/rateLimiter', () => ({
  authRateLimiter: passa,
  authEmailRateLimiter: passa,
  registrationRateLimiter: passa,
}));

// Qui conta cosa finisce nei log, non chi puo' registrare: autenticazione e permesso passano
vi.mock('../../middleware/authMiddleware', () => ({ authMiddleware: passa }));
vi.mock('../../middleware/permissionGuard', () => ({ permissionGuard: () => passa }));

vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: () => ({ userCreated: vi.fn() }) },
}));

import { UserController } from '../UserController';

/** I dati personali del nuovo utente: nessuno deve comparire in un log. */
const DATI_PERSONALI = {
  email: 'mario.rossi@esempio.it',
  nome: 'Mariolino',
  cognome: 'Rossellini',
  residenza: 'Via dei Mille 42, Pisa',
  dataDiNascita: '1981-02-03',
  telefono: '+393331234567',
};

const METODI_CONSOLE = ['log', 'info', 'warn', 'error', 'debug'] as const;
let spieConsole: Array<{ mock: { calls: unknown[][] } }> = [];

/** Tutto cio' che e' stato scritto con il logger o con console, come testo. */
function testoScrittoNeiLog(): string {
  const chiamate = [
    ...Object.values(log).flatMap((spia) => spia.mock.calls),
    ...spieConsole.flatMap((spia) => spia.mock.calls),
  ];
  return JSON.stringify(chiamate);
}

function creaApp() {
  const userService = {
    registerUserWithTransaction: vi.fn(async () => ({ id_utenti: 'u-nuovo' })),
  };
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { session: object }).session = { id_utente: 'admin-1' };
    next();
  });
  new UserController(userService as never, {} as never, {} as never, {} as never).registerRoutes(app);
  return { app, userService };
}

beforeEach(() => {
  spieConsole = METODI_CONSOLE.map((metodo) => vi.spyOn(console, metodo).mockImplementation(() => undefined));
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const spia of Object.values(log)) {
    spia.mockReset();
  }
});

describe('POST /api/register-user: dati personali nei log', () => {
  it('registra l\'utente senza scrivere email, telefono, nome, residenza o data di nascita nei log', async () => {
    const { app, userService } = creaApp();

    const res = await request(app).post('/api/register-user').send({
      ...DATI_PERSONALI,
      password: 'Segreta!123',
      tipo: TIPO_UTENTI.GDO,
      stato: STATO_UTENTI.ATTIVO,
      gdoScelta: 'gdo-1',
      sesso: 'M',
    });

    expect(res.status).toBe(200);
    expect(userService.registerUserWithTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ email: DATI_PERSONALI.email, telefono: DATI_PERSONALI.telefono }),
      'admin-1',
    );
    // Il log c'e', con tipo e identificativi
    expect(log.debug).toHaveBeenCalledWith('registerUser - Dati ricevuti', expect.objectContaining({ tipo: TIPO_UTENTI.GDO, gdoScelta: 'gdo-1' }));
    const scritto = testoScrittoNeiLog();
    for (const valore of [...Object.values(DATI_PERSONALI), 'Segreta!123']) {
      expect(scritto).not.toContain(valore);
    }
  });

  it('con un campo obbligatorio mancante risponde 400 e i log dicono solo quali campi ci sono', async () => {
    const { app, userService } = creaApp();
    const { residenza: _residenza, ...senzaResidenza } = DATI_PERSONALI;

    const res = await request(app).post('/api/register-user').send({
      ...senzaResidenza,
      password: 'Segreta!123',
      tipo: TIPO_UTENTI.GDO,
      stato: STATO_UTENTI.ATTIVO,
    });

    expect(res.status).toBe(400);
    expect(userService.registerUserWithTransaction).not.toHaveBeenCalled();
    expect(log.debug).toHaveBeenCalledWith('registerUser - Campi obbligatori mancanti', expect.objectContaining({ hasEmail: true, hasResidenza: false }));
    const scritto = testoScrittoNeiLog();
    for (const valore of Object.values(senzaResidenza)) {
      expect(scritto).not.toContain(valore);
    }
  });
});
