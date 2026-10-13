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
