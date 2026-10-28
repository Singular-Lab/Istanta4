import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// DNS finto: i nomi della tabella risolvono negli IP indicati, gli altri in un IP pubblico
const dns = vi.hoisted(() => ({ tabella: { 'interno.test': ['127.0.0.1'] } as Record<string, string[]> }));
vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => (dns.tabella[host] ?? ['93.184.216.34']).map(address => ({ address, family: 4 }))),
}));

import type { AuthProvider, AuthProviderAttributes } from '../../models/auth_provider';
import type { IAuthProviderRepository } from '../../repositories/AuthProviderRepository';
import { cifraSegreto, decifraSegreto, eSegretoCifrato } from '../../utils/segretiProvider';
import { AuthProviderService } from '../AuthProviderService';

/** Repository in memoria: nessun database. */
function repositoryInMemoria(iniziali: Array<Partial<AuthProviderAttributes>>) {
  const righe: AuthProviderAttributes[] = iniziali.map((r, i) => ({
    id: `p${i + 1}`,
    descrizione: null,
    icona: 'Key',
    ordine: i,
    attivo: true,
    config_client: null,
    config_server: null,
    ruoli_ammessi: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...r,
  }) as AuthProviderAttributes);
  const ordinate = () => [...righe].sort((a, b) => a.ordine - b.ordine) as unknown as AuthProvider[];
  const repository: IAuthProviderRepository = {
    findAllActive: async () => ordinate().filter((p) => p.attivo),
    findAll: async () => ordinate(),
    findByCode: async (codice) => (righe.find((r) => r.codice === codice) as unknown as AuthProvider) ?? null,
    findById: async (id) => (righe.find((r) => r.id === id) as unknown as AuthProvider) ?? null,
    create: async (dati) => {
      const riga = { ...dati, id: `p${righe.length + 1}`, createdAt: new Date(), updatedAt: new Date() } as AuthProviderAttributes;
      righe.push(riga);
      return riga as unknown as AuthProvider;
    },
    update: async (id, dati) => {
      const riga = righe.find((r) => r.id === id);
      if (!riga) return null;
      Object.assign(riga, dati);
      return riga as unknown as AuthProvider;
    },
    delete: async (id) => {
      const indice = righe.findIndex((r) => r.id === id);
      if (indice < 0) return false;
      righe.splice(indice, 1);
      return true;
    },
  };
  return { repository, righe };
}

const EMAIL_PASSWORD = { codice: 'email_password', nome: 'Email e Password', tipo: 'internal' as const };
const ENTRA = {
  codice: 'entra_id',
  nome: 'Entra ID',
  tipo: 'oidc' as const,
  config_client: { authorize_url: 'https://idp.test/a', client_id: 'c', redirect_uri: 'https://f.test/cb' },
  config_server: { client_secret: 'in-chiaro', token_url: 'https://idp.test/t', jwks_uri: 'https://idp.test/k' },
};

describe('AuthProviderService - gestione del Superadmin', () => {
  it('elenca anche i metodi disattivati, senza segreti', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD, { ...ENTRA, attivo: false }]);

    const elenco = await new AuthProviderService(repository).getAllProvidersAdmin();

    expect(elenco.map((p) => [p.codice, p.attivo])).toEqual([['email_password', true], ['entra_id', false]]);
    expect(JSON.stringify(elenco)).not.toContain('in-chiaro');
    expect(elenco[1].segreti).toEqual({ client_secret: 'in_chiaro' });
  });

  it('rifiuta un codice gia\' usato', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);

    await expect(new AuthProviderService(repository).createProvider({ ...ENTRA })).rejects.toThrow(/Esiste gia'/);
  });

  it('non disattiva l\'ultimo metodo attivo', async () => {
    const { repository, righe } = repositoryInMemoria([EMAIL_PASSWORD, { ...ENTRA, attivo: false }]);

    await expect(new AuthProviderService(repository).updateProvider('p1', { attivo: false })).rejects.toThrow(/ultimo metodo di accesso attivo/);
    expect(righe[0].attivo).toBe(true);
  });

  it('disattiva un metodo se ne resta un altro attivo', async () => {
    const { repository, righe } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);

    await new AuthProviderService(repository).updateProvider('p1', { attivo: false });

    expect(righe[0].attivo).toBe(false);
  });

  it('non elimina il metodo email e password', async () => {
    const { repository, righe } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);

    await expect(new AuthProviderService(repository).deleteProvider('p1')).rejects.toThrow(/non si puo' eliminare/);
    expect(righe).toHaveLength(2);
  });

  it('non elimina l\'ultimo metodo attivo', async () => {
    const { repository } = repositoryInMemoria([{ ...EMAIL_PASSWORD, attivo: false }, ENTRA]);

    await expect(new AuthProviderService(repository).deleteProvider('p2')).rejects.toThrow(/ultimo metodo/);
  });

  it('riordina secondo l\'elenco ricevuto e rifiuta un elenco incompleto', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);
    const service = new AuthProviderService(repository);

    const elenco = await service.riordinaProviders(['p2', 'p1']);
    expect(elenco.map((p) => p.codice)).toEqual(['entra_id', 'email_password']);

    await expect(service.riordinaProviders(['p2'])).rejects.toThrow(/tutti i metodi/);
  });

  it('considera attivo un metodo senza riga', async () => {
    const { repository } = repositoryInMemoria([{ ...EMAIL_PASSWORD, attivo: false }, ENTRA]);
    const service = new AuthProviderService(repository);

    expect(await service.isMetodoAttivo('email_password')).toBe(false);
    expect(await service.isMetodoAttivo('mai_creato')).toBe(true);
  });
});

describe('AuthProviderService - migrazione dei segreti', () => {
  it('in simulazione elenca i segreti in chiaro senza modificarli', async () => {
    const { repository, righe } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);

    const esito = await new AuthProviderService(repository).migraSegreti('cifra', true);

    expect(esito).toMatchObject({ simulazione: true, totaleCampi: 1, provider: [{ codice: 'entra_id', campi: ['client_secret'] }] });
    expect(righe[1].config_server?.client_secret).toBe('in-chiaro');
  });

  it('cifra i segreti in chiaro ed e\' idempotente', async () => {
    const { repository, righe } = repositoryInMemoria([EMAIL_PASSWORD, ENTRA]);
    const service = new AuthProviderService(repository);

    await service.migraSegreti('cifra', false);
    const cifrato = righe[1].config_server?.client_secret as string;
    expect(eSegretoCifrato(cifrato)).toBe(true);
    expect(decifraSegreto(cifrato)).toBe('in-chiaro');
    // gli altri campi restano
    expect(righe[1].config_server?.token_url).toBe('https://idp.test/t');

    const secondo = await service.migraSegreti('cifra', false);
    expect(secondo.totaleCampi).toBe(0);
    expect(righe[1].config_server?.client_secret).toBe(cifrato);
  });

  it('riporta in chiaro i segreti cifrati (rollback)', async () => {
    const { repository, righe } = repositoryInMemoria([
      EMAIL_PASSWORD,
      { ...ENTRA, config_server: { ...ENTRA.config_server, client_secret: cifraSegreto('ritorno') } },
    ]);

    const esito = await new AuthProviderService(repository).migraSegreti('decifra', false);

    expect(esito.totaleCampi).toBe(1);
    expect(righe[1].config_server?.client_secret).toBe('ritorno');
  });
});

describe('AuthProviderService - importazione OIDC', () => {
  it('ricava gli indirizzi dal documento di discovery', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);
    const fetchFinto = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      issuer: 'https://idp.test/v2.0',
      authorization_endpoint: 'https://idp.test/authorize',
      token_endpoint: 'https://idp.test/token',
      jwks_uri: 'https://idp.test/keys',
    }), { status: 200 }));

    const esito = await new AuthProviderService(repository).importaDiscoveryOidc('https://idp.test/v2.0');

    expect(fetchFinto).toHaveBeenCalledWith('https://idp.test/v2.0/.well-known/openid-configuration', expect.anything());
    expect(esito).toEqual({
      discovery_url: 'https://idp.test/v2.0/.well-known/openid-configuration',
      authorize_url: 'https://idp.test/authorize',
      token_url: 'https://idp.test/token',
      jwks_uri: 'https://idp.test/keys',
      expected_issuer: 'https://idp.test/v2.0',
    });
    fetchFinto.mockRestore();
  });

  it('rifiuta un indirizzo che non e\' http(s)', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);

    await expect(new AuthProviderService(repository).importaDiscoveryOidc('file:///etc/passwd')).rejects.toThrow(/http\(s\)/);
  });
});

describe('AuthProviderService - indirizzi remoti non sicuri', () => {
  it.each([
    ['http://169.254.169.254/latest/meta-data'],
    ['http://127.0.0.1:8080/realms/x'],
    ['http://[::ffff:127.0.0.1]/'],
    ['http://interno.test/realms/x'],
  ])('non scarica la discovery da %s', async (url) => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);
    const fetchFinto = vi.spyOn(globalThis, 'fetch');

    await expect(new AuthProviderService(repository).importaDiscoveryOidc(url)).rejects.toThrow(/non ammesso/);
    expect(fetchFinto).not.toHaveBeenCalled();
    fetchFinto.mockRestore();
  });

  it('non segue un redirect verso un host vietato', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);
    const fetchFinto = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 302, headers: { location: 'http://interno.test/.well-known/openid-configuration' } }),
    );

    await expect(new AuthProviderService(repository).importaDiscoveryOidc('https://idp.test/v2.0')).rejects.toThrow(/Redirect non seguito/);
    expect(fetchFinto).toHaveBeenCalledOnce();
    expect(fetchFinto.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    fetchFinto.mockRestore();
  });

  it('segue un redirect verso un host ammesso', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);
    const fetchFinto = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: 'https://login.idp.test/openid-configuration' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        authorization_endpoint: 'https://idp.test/authorize',
        token_endpoint: 'https://idp.test/token',
        jwks_uri: 'https://idp.test/keys',
      }), { status: 200 }));

    const esito = await new AuthProviderService(repository).importaDiscoveryOidc('https://idp.test/v2.0');

    expect(esito.token_url).toBe('https://idp.test/token');
    expect(fetchFinto.mock.calls[1][0]).toBe('https://login.idp.test/openid-configuration');
    fetchFinto.mockRestore();
  });

  it('non accetta metadati SAML oltre 2 MB', async () => {
    const { repository } = repositoryInMemoria([EMAIL_PASSWORD]);
    const leggiMetadatiIdp = vi.fn();
    const fetchFinto = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1), { status: 200 }));

    await expect(new AuthProviderService(repository, { leggiMetadatiIdp } as any).importaMetadatiSaml({ url: 'https://idp.test/metadata' }))
      .rejects.toThrow(/oltre i 2 MB/);
    expect(leggiMetadatiIdp).not.toHaveBeenCalled();
    fetchFinto.mockRestore();
  });

  it('nella verifica non contatta un indirizzo di autorizzazione vietato', async () => {
    const { repository } = repositoryInMemoria([
      EMAIL_PASSWORD,
      { ...ENTRA, config_client: { ...ENTRA.config_client, authorize_url: 'http://127.0.0.1:8080/authorize' } },
    ]);
    const fetchFinto = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"keys":[{}]}', { status: 200 }));

    const esiti = await new AuthProviderService(repository).verificaProvider('p2');

    expect(esiti).toContainEqual({ controllo: 'Indirizzo di autorizzazione', esito: 'errore', dettaglio: expect.stringMatching(/non ammesso/) });
    expect(fetchFinto.mock.calls.map((c) => String(c[0]))).not.toContain('http://127.0.0.1:8080/authorize');
    fetchFinto.mockRestore();
  });
});
