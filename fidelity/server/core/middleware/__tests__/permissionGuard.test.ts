import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { ForbiddenError } from '../../../../lib/errors/application/ForbiddenError';
import { UnauthorizedError } from '../../../../lib/errors/application/UnauthorizedError';

const puo = vi.fn();
vi.mock('../../accessi/RisolutoreAccessi', () => ({ RisolutoreAccessi: { get: () => ({ puo }) } }));
vi.mock('../../accessi/contestoAccesso', () => ({
  leggiContestoAccesso: vi.fn(async (req: any) => req.session?.id_utente
    ? { idUtente: req.session.id_utente, tipo: req.session.tipo_utente, idGdo: null, idRuoloGdo: null, superadmin: req.session.tipo_utente === 'Superadmin' }
    : null),
}));
vi.mock('../../services/AuditLogService', () => ({ AuditLogService: { getInstance: () => ({ accessDenied: vi.fn() }) } }));
vi.mock('../../logger', () => ({ log: { warn: vi.fn(), error: vi.fn() } }));

import { permissionGuard } from '../permissionGuard';

const esegui = async (session: any, locals: any = {}) => {
  const next = vi.fn();
  await permissionGuard('promo.elimina')({ session, path: '/x' } as any, { locals } as any, next);
  return next.mock.calls[0]?.[0];
};

describe('permissionGuard', () => {
  beforeEach(() => puo.mockReset());

  it('lascia passare se il risolutore concede il permesso', async () => {
    puo.mockResolvedValue(true);
    expect(await esegui({ id_utente: 'u1', tipo_utente: TIPO_UTENTI.AGENZIA })).toBeUndefined();
    expect(puo).toHaveBeenCalledWith(expect.objectContaining({ idUtente: 'u1' }), 'promo.elimina');
  });

  it('rifiuta per permesso negato quando il risolutore nega', async () => {
    puo.mockResolvedValue(false);
    expect(await esegui({ id_utente: 'u1', tipo_utente: TIPO_UTENTI.PUNTOVENDITA })).toBeInstanceOf(ForbiddenError);
  });

  it('senza sessione risponde non autenticato', async () => {
    expect(await esegui({})).toBeInstanceOf(UnauthorizedError);
    expect(puo).not.toHaveBeenCalled();
  });

  it('con un elenco basta uno dei permessi; senza nessuno rifiuta nominandoli tutti', async () => {
    const guardia = permissionGuard(['file.download', 'materiali.scarica']);
    const prova = async () => {
      const next = vi.fn();
      await guardia({ session: { id_utente: 'u1', tipo_utente: TIPO_UTENTI.CATEGORY }, path: '/x' } as never, { locals: {} } as never, next);
      return next.mock.calls[0]?.[0];
    };

    puo.mockImplementation(async (_contesto: unknown, codice: string) => codice === 'materiali.scarica');
    expect(await prova()).toBeUndefined();
    expect(puo.mock.calls.map(([, codice]) => codice)).toEqual(['file.download', 'materiali.scarica']);

    puo.mockReset();
    puo.mockResolvedValue(false);
    const errore = await prova();
    expect(errore).toBeInstanceOf(ForbiddenError);
    expect(errore.details).toMatchObject({ codicePermesso: 'file.download o materiali.scarica' });
  });

  it('le chiamate di servizio già autenticate non passano dal risolutore', async () => {
    expect(await esegui({}, { authVia: 'bearer' })).toBeUndefined();
    expect(await esegui({}, { authVia: 'internal' })).toBeUndefined();
    expect(puo).not.toHaveBeenCalled();
  });
});
