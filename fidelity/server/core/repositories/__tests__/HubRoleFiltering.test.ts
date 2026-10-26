import { describe, expect, it, vi } from 'vitest';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { Op } from 'sequelize';
import { HubNews } from '../../models/hub_news';
import { HubService } from '../../models/hub_service';
import { HubNewsRepository } from '../HubNewsRepository';
import { HubServiceRepository } from '../HubServiceRepository';
import { buildHubUserContext } from '../../services/hubRoleUtils';

describe('Hub repositories role filtering', () => {
  describe('HubServiceRepository — findActiveForRole', () => {
    it('returns services matching the user tipo_utente for non-GDO users, including inactive ones', async () => {
      vi.spyOn(HubService, 'findAll').mockResolvedValue([
        { id: '1', codice: 'svc_a', tipo_utente: 'Agenzia', ruolo_gdo: null, attivo: true },
        { id: '2', codice: 'svc_b', tipo_utente: 'Agenzia', ruolo_gdo: null },
      ] as any);

      const repository = new HubServiceRepository();
      const context = buildHubUserContext(TIPO_UTENTI.AGENZIA);
      const result = await repository.findActiveForRole(context);

      expect(result.map((r) => r.id)).toEqual(['1', '2']);
      expect(HubService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipo_utente: 'Agenzia',
            ruolo_gdo: null,
          }),
        })
      );
    });

    it('returns GDO services with role-specific priority over generic', async () => {
      vi.spyOn(HubService, 'findAll').mockResolvedValue([
        { id: '1', codice: 'svc_a', tipo_utente: 'GDO', ruolo_gdo: null },
        { id: '2', codice: 'svc_a', tipo_utente: 'GDO', ruolo_gdo: 'GDO_ADMIN' },
        { id: '3', codice: 'svc_b', tipo_utente: 'GDO', ruolo_gdo: null },
      ] as any);

      const repository = new HubServiceRepository();
      const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN');
      const result = await repository.findActiveForRole(context);

      // svc_a: should pick id '2' (role-specific) over id '1' (generic)
      // svc_b: should pick id '3' (generic, no specific exists)
      expect(result.map((r) => r.id)).toEqual(['2', '3']);
      expect(HubService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tipo_utente: TIPO_UTENTI.GDO,
            [Op.or]: expect.arrayContaining([
              { ruolo_gdo: null },
              {
                ruolo_gdo: {
                  [Op.in]: expect.arrayContaining(['GDO_ADMIN', 'ADMIN']),
                },
              },
            ]),
          }),
        })
      );
    });

    it('returns only generic GDO services when no role-specific match', async () => {
      vi.spyOn(HubService, 'findAll').mockResolvedValue([
        { id: '1', codice: 'svc_a', tipo_utente: 'GDO', ruolo_gdo: null },
      ] as any);

      const repository = new HubServiceRepository();
      const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN');
      const result = await repository.findActiveForRole(context);

      expect(result.map((r) => r.id)).toEqual(['1']);
      expect(HubService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              {
                ruolo_gdo: {
                  [Op.in]: expect.arrayContaining(['GDO_ADMIN', 'ADMIN']),
                },
              },
            ]),
          }),
        })
      );
    });

    it('preserves specific roles with multiple underscores', async () => {
      vi.spyOn(HubService, 'findAll').mockResolvedValue([
        { id: '1', codice: 'svc_a', tipo_utente: 'GDO', ruolo_gdo: null },
        { id: '2', codice: 'svc_a', tipo_utente: 'GDO', ruolo_gdo: 'GDO_AMMINISTRATORE_DELEGATO' },
      ] as any);

      const repository = new HubServiceRepository();
      const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_AMMINISTRATORE_DELEGATO');
      const result = await repository.findActiveForRole(context);

      expect(result.map((r) => r.id)).toEqual(['2']);
      expect(HubService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            [Op.or]: expect.arrayContaining([
              {
                ruolo_gdo: {
                  [Op.in]: expect.arrayContaining([
                    'GDO_AMMINISTRATORE_DELEGATO',
                    'AMMINISTRATORE_DELEGATO',
                  ]),
                },
              },
            ]),
          }),
        })
      );
    });
  });

  describe('HubNewsRepository — findActiveForRole', () => {
    it('filters news using ruoli_destinatari array', async () => {
      vi.spyOn(HubNews, 'findAll').mockResolvedValue([
        { id: 'n1', ruoli_destinatari: ['GDO_ADMIN'] },
        { id: 'n2', ruoli_destinatari: ['GDO'] },
        { id: 'n3', ruoli_destinatari: ['Agenzia'] },
        { id: 'n4', ruoli_destinatari: [] },
      ] as any);

      const repository = new HubNewsRepository();
      const context = buildHubUserContext(TIPO_UTENTI.GDO, 'GDO_ADMIN');
      const result = await repository.findActiveForRole(context);

      expect(result.map((r) => r.id)).toEqual(['n1', 'n2', 'n4']);
    });
  });
});
