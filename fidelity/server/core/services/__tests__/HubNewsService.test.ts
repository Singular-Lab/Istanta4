import { describe, expect, it, vi } from 'vitest';
import { HubNewsService } from '../HubNewsService';
import { buildHubUserContext } from '../hubRoleUtils';
import { TIPO_UTENTI } from '../../../../lib/enums';

function makeMockNews(overrides: Record<string, any> = {}) {
  return {
    id: 'news-1',
    titolo: 'Titolo news',
    contenuto: '<p>Contenuto</p>',
    tipo: 'info',
    icona: 'Info',
    url: 'https://example.com',
    in_evidenza: false,
    ruoli_destinatari: ['GDO_ADMIN'],
    attivo: true,
    data_pubblicazione: new Date('2026-03-20T10:00:00.000Z'),
    data_scadenza: new Date('2026-04-20T10:00:00.000Z'),
    autore_nome: 'Sistema',
    meta: null,
    ...overrides,
  };
}

function makeRepository(overrides: Record<string, any> = {}) {
  return {
    findActiveForRole: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    ...overrides,
  } as any;
}

describe('HubNewsService', () => {
  it('returns public DTOs for role-filtered news', async () => {
    const repository = makeRepository({
      findActiveForRole: vi.fn().mockResolvedValue([makeMockNews()]),
    });

    const service = new HubNewsService(repository);
    const result = await service.getNewsForRole(buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN'));

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('attivo');
    expect(result[0]).not.toHaveProperty('ruoli_destinatari');
    expect(result[0].titolo).toBe('Titolo news');
  });

  it('returns admin DTOs with attivo and ruoli_destinatari for archive management', async () => {
    const repository = makeRepository({
      findAll: vi.fn().mockResolvedValue([makeMockNews({ attivo: false, ruoli_destinatari: ['Agenzia', 'GDO_ADMIN'] })]),
    });

    const service = new HubNewsService(repository);
    const result = await service.getAllNews();

    expect(result).toHaveLength(1);
    expect(result[0].attivo).toBe(false);
    expect(result[0].ruoli_destinatari).toEqual(['Agenzia', 'GDO_ADMIN']);
    expect(result[0].contenuto).toContain('<p>');
  });

  it('normalizes target roles when creating admin news', async () => {
    const repository = makeRepository({
      create: vi.fn().mockResolvedValue(makeMockNews({ ruoli_destinatari: ['Agenzia', 'GDO_ADMIN', 'GDO'] })),
    });

    const service = new HubNewsService(repository);
    await service.createNews({
      titolo: 'News',
      contenuto: '<p>Contenuto</p>',
      ruoli_destinatari: ['agenzia', 'gdo_admin', 'gdo'],
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ruoli_destinatari: ['Agenzia', 'GDO_ADMIN', 'GDO'],
      })
    );
  });
});
