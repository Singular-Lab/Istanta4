import { afterEach, describe, expect, it, vi } from 'vitest';
import { STATO_UTENTI, TIPO_UTENTI } from '../../../../lib/enums';

const mocks = vi.hoisted(() => ({ contesto: '', axiosGet: vi.fn() }));

vi.mock('../../../../lib/encryption', () => ({ decryptString: () => mocks.contesto }));
vi.mock('axios', () => ({ default: { get: mocks.axiosGet } }));

import config from '../../config';
import { ServerUtils } from '../../utils/ServerUtils';
import { UserService } from '../UserService';

function sessioneFinta() {
  return {
    cookie: {},
    regenerate: vi.fn((cb: (err?: unknown) => void) => cb()),
    save: vi.fn((cb: (err?: unknown) => void) => cb()),
    destroy: vi.fn((cb: () => void) => cb()),
  } as Record<string, any>;
}

const utente = {
  id_utenti: 'u1',
  email_utenti: 'mario@esempio.it',
  tipo_utenti: TIPO_UTENTI.GDO,
  stato_utenti: STATO_UTENTI.ATTIVO,
  privatekey_utenti: 'chiave-privata',
  meta_utenti: { need_ad: true },
  update: vi.fn(),
};

describe('accesso tramite il collegamento AD generato da Istanta', () => {
  const tenantOriginale = config.AD_TENANT_ID;
  afterEach(() => {
    (config as any).AD_TENANT_ID = tenantOriginale;
  });

  function avvia(esitoIstanta: { esito: boolean; error?: string }) {
    (config as any).AD_TENANT_ID = 'tenant-1';
    mocks.contesto = JSON.stringify({ tenantId: 'tenant-1', tokenAD: 'token', queryParams: { email: 'mario@esempio.it' } });
    vi.spyOn(ServerUtils, 'sendToFICOApi').mockResolvedValue({ status: 200, data: esitoIstanta } as any);
    const repository = { findOneByOptions: vi.fn().mockResolvedValue(utente) };
    const session = sessioneFinta();
    const req = { query: { context: 'ctx' }, session } as any;
    return { service: new UserService(repository as any), req, session };
  }

  it('se Istanta conferma il collegamento la sessione viene salvata', async () => {
    const { service, req, session } = avvia({ esito: true });

    await expect(service.autenticaUtenteAD(req)).resolves.toEqual({ route: '/', queryParams: {} });

    expect(session.regenerate).toHaveBeenCalled();
    expect(session.save).toHaveBeenCalled();
    expect(session.destroy).not.toHaveBeenCalled();
  });

  it('un collegamento gia\' usato non lascia alcuna sessione attiva', async () => {
    const { service, req, session } = avvia({ esito: false, error: 'token_expired' });

    await expect(service.autenticaUtenteAD(req)).resolves.toEqual({ isError: true, errorCode: 'token_expired' });

    expect(session.save).not.toHaveBeenCalled();
    expect(session.destroy).toHaveBeenCalled();
  });
});

describe('accesso tramite il collegamento FICO generato da Istanta', () => {
  it('una chiave che Olympus non riconosce non crea utenti ne\' sessioni', async () => {
    mocks.contesto = JSON.stringify({ publicKey: 'chiave-falsa', route: '/', queryParams: {} });
    mocks.axiosGet.mockResolvedValue({ data: { username: '', tipoUtente: '', autorizzato: false } });
    const repository = { findOneByOptions: vi.fn(), create: vi.fn() };
    const session = sessioneFinta();

    await expect(new UserService(repository as any).autenticaUtenteFico({ query: { context: 'ctx' }, session } as any))
      .rejects.toThrow();

    expect(repository.create).not.toHaveBeenCalled();
    expect(session.regenerate).not.toHaveBeenCalled();
    expect(session.save).not.toHaveBeenCalled();
  });
});
