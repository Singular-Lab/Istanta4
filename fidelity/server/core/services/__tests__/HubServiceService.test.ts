import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { HubServiceService } from '../HubServiceService';
import { buildHubUserContext } from '../hubRoleUtils';

function makeMockService(overrides: Record<string, any> = {}) {
  return {
    id: '1',
    codice: 'svc',
    nome: 'Servizio',
    descrizione: 'Descrizione base',
    icona: 'Box',
    colore: 'primary',
    url: '/x',
    tipo_url: 'internal',
    attivo: true,
    in_manutenzione: false,
    in_evidenza: false,
    ordine: 1,
    tipo_utente: 'Superadmin',
    ruolo_gdo: null,
    meta: null,
    ...overrides,
  };
}

function makeRepository(overrides: Record<string, any> = {}) {
  return {
    findActiveForRole: vi.fn().mockResolvedValue([]),
    findAll: vi.fn().mockResolvedValue([]),
    findById: vi.fn(),
    findByCodeAndType: vi.fn(),
    findAllByCode: vi.fn(),
    create: vi.fn(),
    bulkCreateForService: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteByCode: vi.fn(),
    ...overrides,
  } as any;
}

describe('HubServiceService', () => {
  it('returns services with their own description per tipo_utente', async () => {
    const repository = makeRepository({
      findActiveForRole: vi.fn().mockResolvedValue([
        makeMockService({ id: '1', descrizione: 'Descrizione admin GDO', tipo_utente: 'GDO', ruolo_gdo: 'GDO_ADMIN' }),
      ]),
    });

    const service = new HubServiceService(repository);
    const result = await service.getServicesForRole(buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN'));

    expect(result[0].descrizione).toBe('Descrizione admin GDO');
    expect(result[0].tipo_utente).toBe('GDO');
    expect(result[0].ruolo_gdo).toBe('GDO_ADMIN');
  });

  it('maps toDTO correctly with tipo_utente and ruolo_gdo', async () => {
    const repository = makeRepository({
      findActiveForRole: vi.fn().mockResolvedValue([
        makeMockService({ tipo_utente: 'Agenzia', ruolo_gdo: null, descrizione: 'Per agenzia' }),
      ]),
    });

    const service = new HubServiceService(repository);
    const result = await service.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));

    expect(result).toHaveLength(1);
    expect(result[0].tipo_utente).toBe('Agenzia');
    expect(result[0].ruolo_gdo).toBeNull();
    expect(result[0].descrizione).toBe('Per agenzia');
  });

  it('maps redirect_page from service meta for external FICO variants', async () => {
    const repository = makeRepository({
      findActiveForRole: vi.fn().mockResolvedValue([
        makeMockService({
          tipo_utente: TIPO_UTENTI.AGENZIA,
          tipo_url: 'external_fico',
          url: 'https://coopfiistanta.istn.it/istanta2/context',
          meta: {
            route: '/LoginController/oauth/landed',
          },
        }),
      ]),
    });

    const service = new HubServiceService(repository);
    const result = await service.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));

    expect(result[0].redirect_page).toBe('/LoginController/oauth/landed');
  });

  it('maps shared documents and videos from service meta', async () => {
    const repository = makeRepository({
      findActiveForRole: vi.fn().mockResolvedValue([
        makeMockService({
          tipo_utente: TIPO_UTENTI.AGENZIA,
          meta: {
            documents: [
              {
                id: 'doc-1',
                title: 'Manuale rapido',
                original_name: 'manuale-rapido.pdf',
                mime_type: 'application/pdf',
                size: 1024,
                extension: '.pdf',
                id_olimpo_cloud: 'olimpo-doc-1',
                download_url: 'https://olimpo.example/materiali/getMaterialePDF?id=olimpo-doc-1',
                preview_url: 'https://olimpo.example/materiali/getThumbnailMaterialePdfs?&id=olimpo-doc-1',
                pages: 4,
              },
            ],
            videos: [
              {
                id: 'video-1',
                title: 'Trailer onboarding',
                kind: 'trailer',
                original_name: 'trailer.mp4',
                mime_type: 'video/mp4',
                size: 4096,
                guid_id: 'olimpo-video-1',
                url: 'https://olimpo.example/materiali/getVideoOnDemand?guidId=olimpo-video-1',
              },
            ],
          },
        }),
      ]),
    });

    const service = new HubServiceService(repository);
    const result = await service.getServicesForRole(buildHubUserContext(TIPO_UTENTI.AGENZIA));

    expect(result[0].documents).toHaveLength(1);
    expect(result[0].documents[0]).toMatchObject({
      id: 'doc-1',
      title: 'Manuale rapido',
      id_olimpo_cloud: 'olimpo-doc-1',
    });
    expect(result[0].videos).toHaveLength(1);
    expect(result[0].videos[0]).toMatchObject({
      id: 'video-1',
      title: 'Trailer onboarding',
      kind: 'trailer',
    });
  });

  it('returns one representative card per service code for superadmin', async () => {
    const repository = makeRepository({
      findAll: vi.fn().mockResolvedValue([
        makeMockService({
          id: 'super-disabled',
          codice: 'svc_a',
          tipo_utente: TIPO_UTENTI.SUPERADMIN,
          attivo: false,
          descrizione: 'Variante superadmin disattiva',
        }),
        makeMockService({
          id: 'agency-active',
          codice: 'svc_a',
          tipo_utente: TIPO_UTENTI.AGENZIA,
          attivo: true,
          descrizione: 'Variante agenzia attiva',
        }),
        makeMockService({
          id: 'super-active',
          codice: 'svc_b',
          tipo_utente: TIPO_UTENTI.SUPERADMIN,
          attivo: true,
          descrizione: 'Variante superadmin attiva',
        }),
      ]),
    });

    const service = new HubServiceService(repository);
    const result = await service.getServicesForRole(buildHubUserContext(TIPO_UTENTI.SUPERADMIN));

    expect(result).toHaveLength(2);
    expect(result.find((item) => item.codice === 'svc_a')).toMatchObject({
      id: 'agency-active',
      descrizione: 'Variante agenzia attiva',
      attivo: true,
    });
    expect(result.find((item) => item.codice === 'svc_b')).toMatchObject({
      id: 'super-active',
      descrizione: 'Variante superadmin attiva',
      attivo: true,
    });
    expect(repository.findAll).toHaveBeenCalledTimes(1);
    expect(repository.findActiveForRole).not.toHaveBeenCalled();
  });

  it('getAllServicesGrouped groups by codice', async () => {
    const repository = makeRepository({
      findAll: vi.fn().mockResolvedValue([
        makeMockService({ codice: 'svc_a', tipo_utente: 'Superadmin' }),
        makeMockService({ codice: 'svc_a', tipo_utente: 'Agenzia', id: '2' }),
        makeMockService({ codice: 'svc_b', tipo_utente: 'Superadmin', id: '3' }),
      ]),
    });

    const service = new HubServiceService(repository);
    const grouped = await service.getAllServicesGrouped();

    expect(Object.keys(grouped)).toEqual(['svc_a', 'svc_b']);
    expect(grouped['svc_a']).toHaveLength(2);
    expect(grouped['svc_b']).toHaveLength(1);
  });

  it('bulkCreateService delegates to repository', async () => {
    const created = [
      makeMockService({ tipo_utente: 'Superadmin' }),
      makeMockService({ tipo_utente: 'Agenzia', id: '2' }),
    ];
    const repository = makeRepository({
      bulkCreateForService: vi.fn().mockResolvedValue(created),
    });

    const service = new HubServiceService(repository);
    const result = await service.bulkCreateService({
      codice: 'new_svc',
      nome: 'Nuovo',
      url: '/new',
      redirect_page: '/landed',
      tipi_utente: [
        { tipo_utente: 'Superadmin' },
        { tipo_utente: 'Agenzia' },
      ],
    });

    expect(result).toHaveLength(2);
    expect(repository.bulkCreateForService).toHaveBeenCalledWith(
      expect.objectContaining({
        codice: 'new_svc',
        nome: 'Nuovo',
        url: '/new',
        redirect_page: '/landed',
      }),
      expect.arrayContaining([
        expect.objectContaining({ tipo_utente: 'Superadmin' }),
        expect.objectContaining({ tipo_utente: 'Agenzia' }),
      ])
    );
  });

  it('normalizes ruolo_gdo when creating a GDO service variant', async () => {
    const repository = makeRepository({
      create: vi.fn().mockResolvedValue(
        makeMockService({ tipo_utente: TIPO_UTENTI.GDO, ruolo_gdo: 'GDO_AMMINISTRATORE_DELEGATO' })
      ),
    });

    const service = new HubServiceService(repository);
    await service.createService({
      codice: 'svc_gdo',
      nome: 'Servizio GDO',
      url: '/gdo',
      tipo_utente: TIPO_UTENTI.GDO,
      ruolo_gdo: 'amministratore_delegato',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo_utente: TIPO_UTENTI.GDO,
        ruolo_gdo: 'GDO_AMMINISTRATORE_DELEGATO',
      })
    );
  });
});
