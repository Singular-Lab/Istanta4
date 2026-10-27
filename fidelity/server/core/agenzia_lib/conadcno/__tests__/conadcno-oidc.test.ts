import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../../lib/enums.js';
import type { IUserService } from '../../../interfaces/IUserService.js';
import { GDO } from '../../../models/gdo.js';
import type { ExternalAuthContext } from '../../types.js';
import { ConadcnoAgenziaLib } from '../index.js';

function userService(overrides: Partial<IUserService> = {}): IUserService {
  return {
    getUserByEmail: vi.fn().mockResolvedValue(null),
    registerUserWithTransaction: vi.fn(),
    updateProfile: vi.fn(),
    verificaAccountAttivo: vi.fn().mockResolvedValue(undefined),
    getPrivateKey: vi.fn().mockResolvedValue('private-key'),
    ...overrides,
  } as unknown as IUserService;
}

const oidcContext = {
  source: 'oidc' as const,
  allowedEmailDomains: ['conad.test'],
  allowedUserTypes: [TIPO_UTENTI.GDO, TIPO_UTENTI.CATEGORY, TIPO_UTENTI.MARKETING, TIPO_UTENTI.IT],
};

const rejectedTokens: Array<{
  description: string;
  roles: string[];
  context: ExternalAuthContext;
  expectedError: RegExp;
}> = [
  { description: 'senza ruoli', roles: [], context: oidcContext, expectedError: /non ha restituito un ruolo Fidelity/ },
  { description: 'con ruoli Fidelity ambigui', roles: ['GDO', 'IT'], context: oidcContext, expectedError: /piu' ruoli Fidelity/ },
  { description: 'con Superadmin', roles: ['Superadmin'], context: oidcContext, expectedError: /Superadmin non puo'/ },
  {
    description: 'con un tipo escluso dal provider',
    roles: ['IT'],
    context: { ...oidcContext, allowedUserTypes: ['GDO'] },
    expectedError: /tipo utente IT non e' ammesso/,
  },
  {
    description: 'con un dominio escluso dal provider',
    roles: ['GDO'],
    context: { ...oidcContext, allowedEmailDomains: ['altro.test'] },
    expectedError: /dominio email conad\.test/,
  },
];

describe('ConadcnoAgenziaLib - accesso OIDC con Entra App Roles', () => {
  afterEach(() => vi.restoreAllMocks());

  it('crea al primo accesso un utente attivo del tipo indicato dalla App Role', async () => {
    vi.spyOn(GDO, 'findOne').mockResolvedValue({ id_gdo: 'gdo-1' } as any);
    const service = userService({
      registerUserWithTransaction: vi.fn().mockResolvedValue({ id_utenti: 'user-1' } as any),
    });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const parsed = await new ConadcnoAgenziaLib(service).parseUtenteOIDC(
      'Mario.Rossi@conad.test',
      {
        sub: 'subject-1',
        email: 'Mario.Rossi@conad.test',
        given_name: 'Mario',
        family_name: 'Rossi',
        roles: ['Category'],
      },
      oidcContext,
    );

    expect(service.registerUserWithTransaction).toHaveBeenCalledWith({
      email: 'mario.rossi@conad.test',
      nome: 'Mario',
      cognome: 'Rossi',
      tipo: TIPO_UTENTI.CATEGORY,
      stato: STATO_UTENTI.ATTIVO,
      residenza: 'Non specificata',
      dataDiNascita: '1970-01-01',
      gdoScelta: 'gdo-1',
    }, 'System');
    expect(parsed).toEqual({
      id: 'user-1',
      private_key: 'private-key',
      id_gdo: 'gdo-1',
      email: 'mario.rossi@conad.test',
      tipo_utente: TIPO_UTENTI.CATEGORY,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sincronizza il tipo di un account esistente prima di aprire la sessione', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'utente@conad.test',
      tipo: TIPO_UTENTI.GDO,
      stato: STATO_UTENTI.ATTIVO,
      id_gdo: 'gdo-1',
    } as any;
    const service = userService({
      getUserByEmail: vi.fn().mockResolvedValue(existingUser),
    });

    const parsed = await new ConadcnoAgenziaLib(service).parseUtenteOIDC(
      existingUser.email,
      { sub: 'subject-1', roles: ['Marketing'] },
      oidcContext,
    );

    expect(service.verificaAccountAttivo).toHaveBeenCalledWith('user-1');
    expect(service.updateProfile).toHaveBeenCalledWith('user-1', { tipo: TIPO_UTENTI.MARKETING });
    expect(service.registerUserWithTransaction).not.toHaveBeenCalled();
    expect(parsed.tipo_utente).toBe(TIPO_UTENTI.MARKETING);
  });

  it('non sincronizza il tipo se l\'account esistente non e\' attivo', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'utente@conad.test',
      tipo: TIPO_UTENTI.GDO,
      stato: STATO_UTENTI.DISATTIVO,
      id_gdo: 'gdo-1',
    } as any;
    const service = userService({
      getUserByEmail: vi.fn().mockResolvedValue(existingUser),
      verificaAccountAttivo: vi.fn().mockRejectedValue(new Error('Account non attivo')),
    });

    await expect(new ConadcnoAgenziaLib(service).parseUtenteOIDC(
      existingUser.email,
      { sub: 'subject-1', roles: ['Marketing'] },
      oidcContext,
    )).rejects.toThrow('Account non attivo');

    expect(service.updateProfile).not.toHaveBeenCalled();
    expect(service.registerUserWithTransaction).not.toHaveBeenCalled();
  });

  it.each(rejectedTokens)('rifiuta il token $description senza creare o modificare account', async ({ roles, context, expectedError }) => {
    const service = userService();
    const library = new ConadcnoAgenziaLib(service);

    await expect(library.parseUtenteOIDC(
      'utente@conad.test',
      { sub: 'subject-1', roles },
      context,
    )).rejects.toThrow(expectedError);

    expect(service.getUserByEmail).not.toHaveBeenCalled();
    expect(service.registerUserWithTransaction).not.toHaveBeenCalled();
    expect(service.updateProfile).not.toHaveBeenCalled();
  });

  it('mantiene il comportamento esistente per un accesso non OIDC', async () => {
    const existingUser = {
      id: 'user-1',
      email: 'utente@conad.test',
      tipo: TIPO_UTENTI.GDO,
      stato: STATO_UTENTI.ATTIVO,
      id_gdo: 'gdo-1',
    } as any;
    const service = userService({
      getUserByEmail: vi.fn().mockResolvedValue(existingUser),
    });

    const parsed = await new ConadcnoAgenziaLib(service).parseUtenteOIDC(
      existingUser.email,
      { sub: 'service-link' },
      { source: 'service' },
    );

    expect(parsed.tipo_utente).toBe(TIPO_UTENTI.GDO);
    expect(service.updateProfile).not.toHaveBeenCalled();
  });
});
