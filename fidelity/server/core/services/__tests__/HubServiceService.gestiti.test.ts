import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { HubServiceService } from '../HubServiceService';
import { buildHubUserContext } from '../hubRoleUtils';
import { urlServizioGestito } from '../serviziGestiti';

// Istanta configurato (FICO_BASE_URL), Correggo no: si vedono entrambi i casi.
vi.mock('../../config', () => ({
  default: {
    FICO_BASE_URL: 'http://192.168.1.240:81/',
    ISTANTA_IP_ADDRESS: 'http://istanta.interno:5076',
    CORREGGO_IP_ADDRESS: undefined,
  },
}));

const servizio = (o: Record<string, any> = {}) => ({
  id: 'id-1', codice: 'istanta', nome: 'Istanta', descrizione: '', icona: 'Layers', colore: 'primary',
  url: '/LoginController/oauth/landed', tipo_url: 'external_fico', attivo: true, in_manutenzione: false,
  in_evidenza: false, ordine: 10, tipo_utente: TIPO_UTENTI.AGENZIA, ruolo_gdo: null,
  meta: { gestito: 'istanta' }, ...o,
});

const repository = (o: Record<string, any> = {}) => ({
  findActiveForRole: vi.fn().mockResolvedValue([]),
  findAll: vi.fn().mockResolvedValue([]),
  findById: vi.fn(),
  findByCodeAndType: vi.fn(),
  findAllByCode: vi.fn().mockResolvedValue([]),
  create: vi.fn(),
  bulkCreateForService: vi.fn(),
  update: vi.fn(),
  bulkUpdate: vi.fn().mockResolvedValue([]),
  delete: vi.fn(),
  deleteByCode: vi.fn(),
  ...o,
}) as any;

describe('urlServizioGestito', () => {
  it('Istanta: FICO_BASE_URL, altrimenti ISTANTA_IP_ADDRESS, piu la pagina di accesso', () => {
    expect(urlServizioGestito('istanta', { FICO_BASE_URL: 'http://192.168.1.240:81', ISTANTA_IP_ADDRESS: 'http://x', CORREGGO_IP_ADDRESS: undefined }))
      .toBe('http://192.168.1.240:81/LoginController/oauth/landed');
    expect(urlServizioGestito('istanta', { FICO_BASE_URL: undefined, ISTANTA_IP_ADDRESS: 'http://istanta:5076/', CORREGGO_IP_ADDRESS: undefined }))
      .toBe('http://istanta:5076/LoginController/oauth/landed');
  });

  it('Correggo: CORREGGO_IP_ADDRESS piu OAuthLanded.ashx, null se manca', () => {
    expect(urlServizioGestito('correggo', { FICO_BASE_URL: undefined, ISTANTA_IP_ADDRESS: 'http://x', CORREGGO_IP_ADDRESS: 'https://corr.esempio.it/correggo' }))
      .toBe('https://corr.esempio.it/correggo/OAuthLanded.ashx');
    expect(urlServizioGestito('correggo', { FICO_BASE_URL: undefined, ISTANTA_IP_ADDRESS: 'http://x', CORREGGO_IP_ADDRESS: undefined }))
      .toBeNull();
  });
});

describe('HubServiceService con i servizi gestiti', () => {
  it('calcola indirizzo e tipo del servizio gestito, ignorando quelli salvati', async () => {
    const svc = new HubServiceService(repository({
      findActiveForRole: vi.fn().mockResolvedValue([servizio({ url: 'http://vecchio', tipo_url: 'external' })]),
    }));

    const [dto] = await svc.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));

    expect(dto.gestito).toBe('istanta');
    expect(dto.url).toBe('http://192.168.1.240:81/LoginController/oauth/landed');
    expect(dto.tipo_url).toBe('external_fico');
    expect(dto.url_non_configurato).toBe(false);
  });

  it('nasconde agli utenti un servizio gestito senza indirizzo configurato', async () => {
    const correggo = servizio({ id: 'id-2', codice: 'correggo', meta: { gestito: 'correggo' } });
    const svc = new HubServiceService(repository({
      findActiveForRole: vi.fn().mockResolvedValue([servizio(), correggo]),
      findAll: vi.fn().mockResolvedValue([correggo]),
    }));

    const perUtente = await svc.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));
    expect(perUtente.map(s => s.codice)).toEqual(['istanta']);

    // Nella gestione dell'hub resta visibile, con l'avviso.
    const gestione = await svc.getAllServicesGrouped();
    expect(gestione.correggo[0].url_non_configurato).toBe(true);
  });

  it('la modifica di un servizio gestito non cambia indirizzo, tipo, codice ne gestito', async () => {
    const repo = repository({
      findById: vi.fn().mockResolvedValue(servizio()),
      update: vi.fn().mockResolvedValue(servizio({ nome: 'Istanta 4' })),
    });

    await new HubServiceService(repo).updateService('id-1', {
      nome: 'Istanta 4', url: 'http://altrove', tipo_url: 'external', codice: 'altro', meta: { gestito: 'correggo', x: 1 },
    } as any);

    const dati = repo.update.mock.calls[0][1];
    expect(dati.nome).toBe('Istanta 4');
    expect(dati).not.toHaveProperty('url');
    expect(dati).not.toHaveProperty('tipo_url');
    expect(dati).not.toHaveProperty('codice');
    expect(dati.meta).toEqual({ x: 1 });
  });

  it('la modifica di gruppo di servizi gestiti non cambia indirizzo e tipo', async () => {
    const repo = repository({ findById: vi.fn().mockResolvedValue(servizio()) });

    await new HubServiceService(repo).bulkUpdateServices(['id-1'], { attivo: false, url: 'http://altrove', tipo_url: 'external' } as any);

    expect(repo.bulkUpdate).toHaveBeenCalledWith(['id-1'], { attivo: false });
  });

  it('un servizio normale non diventa gestito dalla gestione dell hub', async () => {
    const repo = repository({ create: vi.fn().mockResolvedValue(servizio({ meta: null, codice: 'mio' })) });

    await new HubServiceService(repo).createService({
      codice: 'mio', nome: 'Mio', url: 'https://x', tipo_url: 'external', tipo_utente: TIPO_UTENTI.SUPERADMIN,
      meta: { gestito: 'istanta' },
    } as any);

    expect(repo.create.mock.calls[0][0].meta).toEqual({});
  });

  it('riconosce i servizi gestiti per id e per codice', async () => {
    const svc = new HubServiceService(repository({
      findById: vi.fn().mockImplementation(async (id: string) => (id === 'id-1' ? servizio() : servizio({ meta: null }))),
      findAllByCode: vi.fn().mockImplementation(async (c: string) => (c === 'istanta' ? [servizio()] : [servizio({ meta: null })])),
    }));

    expect(await svc.isServizioGestito('id-1')).toBe(true);
    expect(await svc.isServizioGestito('id-x')).toBe(false);
    expect(await svc.isCodiceGestito('istanta')).toBe(true);
    expect(await svc.isCodiceGestito('altro')).toBe(false);
  });
});

describe('HubServiceService: il Superadmin modifica tutto dei servizi gestiti', () => {
  const MANUALE = 'https://istanta.cliente.it/LoginController/oauth/landed';

  it('con l indirizzo manuale valgono indirizzo e tipo salvati, e la gestione vede anche quello calcolato', async () => {
    const svc = new HubServiceService(repository({
      findAll: vi.fn().mockResolvedValue([
        servizio({ url: MANUALE, tipo_url: 'external', meta: { gestito: 'istanta', indirizzo_manuale: true } }),
      ]),
    }));

    const [dto] = (await svc.getAllServicesGrouped()).istanta;

    expect(dto.indirizzo_manuale).toBe(true);
    expect(dto.url).toBe(MANUALE);
    expect(dto.tipo_url).toBe('external');
    expect(dto.url_calcolato).toBe('http://192.168.1.240:81/LoginController/oauth/landed');
    expect(dto.url_non_configurato).toBe(false);
  });

  it('Correggo con l indirizzo manuale compare agli utenti anche senza CORREGGO_IP_ADDRESS', async () => {
    const correggo = servizio({
      codice: 'correggo', url: 'https://correggo.cliente.it/OAuthLanded.ashx',
      meta: { gestito: 'correggo', indirizzo_manuale: true },
    });
    const svc = new HubServiceService(repository({ findActiveForRole: vi.fn().mockResolvedValue([correggo]) }));

    const servizi = await svc.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));

    expect(servizi.map(s => s.url)).toEqual(['https://correggo.cliente.it/OAuthLanded.ashx']);
    expect(servizi[0].url_calcolato).toBeNull();
  });

  it('salva l indirizzo manuale scelto dal Superadmin, ma non cambia il codice', async () => {
    const repo = repository({ findById: vi.fn().mockResolvedValue(servizio()), update: vi.fn().mockResolvedValue(servizio()) });

    await new HubServiceService(repo).updateService('id-1', {
      url: MANUALE, tipo_url: 'external_fico', codice: 'altro', indirizzo_manuale: true,
    });

    const dati = repo.update.mock.calls[0][1];
    expect(dati.url).toBe(MANUALE);
    expect(dati.tipo_url).toBe('external_fico');
    expect(dati).not.toHaveProperty('codice');
    expect(dati).not.toHaveProperty('indirizzo_manuale');
    expect(dati.meta).toEqual({ indirizzo_manuale: true });
  });

  it('con l indirizzo gia manuale una modifica senza scelta salva indirizzo e tipo mandati', async () => {
    const repo = repository({
      findById: vi.fn().mockResolvedValue(servizio({ meta: { gestito: 'istanta', indirizzo_manuale: true } })),
      update: vi.fn().mockResolvedValue(servizio()),
    });

    await new HubServiceService(repo).updateService('id-1', { url: 'https://nuovo.it', tipo_url: 'external' });

    expect(repo.update.mock.calls[0][1]).toEqual({ url: 'https://nuovo.it', tipo_url: 'external' });
  });

  it('il ritorno all indirizzo calcolato rimette l ingresso e il tipo Esterno FICO', async () => {
    const repo = repository({
      findById: vi.fn().mockResolvedValue(servizio({ url: MANUALE, meta: { gestito: 'istanta', indirizzo_manuale: true } })),
      update: vi.fn().mockResolvedValue(servizio()),
    });

    await new HubServiceService(repo).updateService('id-1', {
      url: 'https://altrove.it', tipo_url: 'external', indirizzo_manuale: false,
    });

    const dati = repo.update.mock.calls[0][1];
    expect(dati.url).toBe('/LoginController/oauth/landed');
    expect(dati.tipo_url).toBe('external_fico');
    expect(dati.meta).toEqual({ indirizzo_manuale: false });
  });

  it('la modifica di gruppo applica l indirizzo manuale a tutte le varianti', async () => {
    const repo = repository({
      findById: vi.fn().mockImplementation(async (id: string) => servizio({ id })),
    });

    await new HubServiceService(repo).bulkUpdateServices(['id-1', 'id-2'], {
      attivo: true, url: MANUALE, tipo_url: 'external_fico', indirizzo_manuale: true,
    });

    expect(repo.bulkUpdate).toHaveBeenCalledWith(['id-1', 'id-2'], {
      attivo: true, url: MANUALE, tipo_url: 'external_fico', meta: { indirizzo_manuale: true },
    });
  });

  it('un destinatario aggiunto a un servizio gestito resta gestito, con l indirizzo calcolato', async () => {
    const repo = repository({
      findAllByCode: vi.fn().mockResolvedValue([servizio()]),
      findByCodeAndType: vi.fn().mockResolvedValue(servizio({ tipo_utente: TIPO_UTENTI.SUPERADMIN })),
      create: vi.fn().mockResolvedValue(servizio({ tipo_utente: TIPO_UTENTI.GDO })),
    });

    await new HubServiceService(repo).createService({
      codice: 'istanta', nome: 'Istanta', url: 'http://192.168.1.240:81/LoginController/oauth/landed',
      tipo_url: 'external_fico', tipo_utente: TIPO_UTENTI.GDO, indirizzo_manuale: false,
      meta: { gestito: 'correggo' },
    });

    expect(repo.create).toHaveBeenCalledTimes(1);
    const dati = repo.create.mock.calls[0][0];
    expect(dati.url).toBe('/LoginController/oauth/landed');
    expect(dati.tipo_url).toBe('external_fico');
    expect(dati.meta).toEqual({ gestito: 'istanta', indirizzo_manuale: false });
  });

  it('i destinatari aggiunti in blocco ereditano l indirizzo manuale del gruppo', async () => {
    const correggo = servizio({
      codice: 'correggo', url: 'https://correggo.cliente.it/OAuthLanded.ashx',
      meta: { gestito: 'correggo', indirizzo_manuale: true },
    });
    const repo = repository({
      findAllByCode: vi.fn().mockResolvedValue([correggo]),
      findByCodeAndType: vi.fn().mockResolvedValue(correggo),
      bulkCreateForService: vi.fn().mockResolvedValue([]),
    });

    await new HubServiceService(repo).bulkCreateService({
      codice: 'correggo', nome: 'Correggo', url: 'https://correggo.cliente.it/OAuthLanded.ashx',
      tipo_url: 'external_fico', tipi_utente: [{ tipo_utente: TIPO_UTENTI.GUEST }],
    });

    const [base, destinatari] = repo.bulkCreateForService.mock.calls[0];
    expect(base.url).toBe('https://correggo.cliente.it/OAuthLanded.ashx');
    expect(base.meta).toEqual({ gestito: 'correggo', indirizzo_manuale: true });
    expect(destinatari).toEqual([{ tipo_utente: TIPO_UTENTI.GUEST }]);
  });

  it('un servizio normale ignora la scelta dell indirizzo manuale', async () => {
    const repo = repository({ create: vi.fn().mockResolvedValue(servizio({ meta: null, codice: 'mio' })) });

    await new HubServiceService(repo).createService({
      codice: 'mio', nome: 'Mio', url: 'https://x', tipo_url: 'external', tipo_utente: TIPO_UTENTI.SUPERADMIN,
      indirizzo_manuale: true,
    });

    const dati = repo.create.mock.calls[0][0];
    expect(dati).not.toHaveProperty('indirizzo_manuale');
    expect(dati.url).toBe('https://x');
    expect(dati.meta).toBeUndefined();
  });

  it('di un servizio gestito si elimina ogni variante tranne l ultima', async () => {
    const varianti = (n: number) => Array.from({ length: n }, (_, i) => servizio({ id: `id-${i + 1}` }));
    const conVarianti = (gestito: boolean, n: number) => new HubServiceService(repository({
      findById: vi.fn().mockResolvedValue(gestito ? servizio() : servizio({ meta: null })),
      findAllByCode: vi.fn().mockResolvedValue(varianti(n)),
    }));

    expect(await conVarianti(true, 1).isUltimaVarianteGestita('id-1')).toBe(true);
    expect(await conVarianti(true, 2).isUltimaVarianteGestita('id-1')).toBe(false);
    expect(await conVarianti(false, 1).isUltimaVarianteGestita('id-1')).toBe(false);
  });
});
