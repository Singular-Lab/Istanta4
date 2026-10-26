import {
  cloneHubServiceMetaWithoutManagedContent,
  normalizeHubServiceDocuments,
  normalizeHubServiceVideos,
} from '../../../lib/hubServiceContent';
import {
  extractHubServiceRedirectPage,
  normalizeHubServiceRedirectPage,
  readHubServiceRedirectPage,
} from '../../../lib/hubServiceRedirect';
import { Op } from 'sequelize';
import { sequelize } from '../db';
import { log } from '../logger';
import { HubService, HubServiceAttributes } from '../models/hub_service';
import { getHubServiceRoleCandidates, type HubUserContext } from '../services/hubRoleUtils';

export type HubServiceMutationInput = Partial<HubServiceAttributes> & {
  redirect_page?: string | null;
  documents?: unknown;
  videos?: unknown;
};

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function buildPersistedData(existingService: HubService | null, data: HubServiceMutationInput): Partial<HubServiceAttributes> {
  const nextTipoUrl = typeof data.tipo_url === 'string' ? data.tipo_url : existingService?.tipo_url;
  const forcedInternalUrl = nextTipoUrl === 'internal' ? '/hub' : undefined;
  const nextUrl = forcedInternalUrl ?? (typeof data.url === 'string' ? data.url : existingService?.url);
  const persistedData: Record<string, unknown> = { ...data };
  delete persistedData.redirect_page;
  delete persistedData.meta;
  delete persistedData.documents;
  delete persistedData.videos;

  if (forcedInternalUrl) {
    persistedData.url = forcedInternalUrl;
  }

  const mergedMeta: Record<string, unknown> = {
    ...cloneHubServiceMetaWithoutManagedContent((existingService?.meta as Record<string, unknown>) ?? null),
    ...(hasOwn(data, 'meta')
      ? cloneHubServiceMetaWithoutManagedContent((data.meta as Record<string, unknown> | null) ?? null)
      : {}),
  };

  const redirectUpdate = hasOwn(data, 'redirect_page')
    ? {
        present: true,
        value: normalizeHubServiceRedirectPage(data.redirect_page ?? undefined, nextUrl),
      }
    : hasOwn(data, 'meta')
      ? extractHubServiceRedirectPage((data.meta as Record<string, unknown> | null) ?? null, nextUrl)
      : { present: false, value: undefined };

  if (redirectUpdate.present) {
    if (redirectUpdate.value) {
      mergedMeta.route = redirectUpdate.value;
    }
  } else {
    const currentRedirectPage = readHubServiceRedirectPage(
      (existingService?.meta as Record<string, unknown>) ?? null,
      nextUrl
    );

    if (currentRedirectPage) {
      mergedMeta.route = currentRedirectPage;
    }
  }

  if (hasOwn(data, 'documents')) {
    const documents = normalizeHubServiceDocuments(data.documents);
    if (documents.length > 0) {
      mergedMeta.documents = documents;
    } else {
      delete mergedMeta.documents;
    }
  }

  if (hasOwn(data, 'videos')) {
    const videos = normalizeHubServiceVideos(data.videos);
    if (videos.length > 0) {
      mergedMeta.videos = videos;
    } else {
      delete mergedMeta.videos;
    }
  }

  return {
    ...(persistedData as Partial<HubServiceAttributes>),
    meta: Object.keys(mergedMeta).length > 0 ? mergedMeta : null,
  };
}

export interface IHubServiceRepository {
  findActiveForRole(context: HubUserContext): Promise<HubService[]>;
  findByCodeAndType(codice: string, tipoUtente: string, ruoloGdo?: string | null): Promise<HubService | null>;
  findAllByCode(codice: string): Promise<HubService[]>;
  findAll(): Promise<HubService[]>;
  findById(id: string): Promise<HubService | null>;
  create(data: HubServiceMutationInput): Promise<HubService>;
  bulkCreateForService(
    baseData: Omit<HubServiceMutationInput, 'tipo_utente' | 'ruolo_gdo'>,
    targets: Array<{ tipo_utente: string; ruolo_gdo?: string | null }>
  ): Promise<HubService[]>;
  update(id: string, data: HubServiceMutationInput): Promise<HubService | null>;
  bulkUpdate(ids: string[], data: HubServiceMutationInput): Promise<HubService[]>;
  delete(id: string): Promise<boolean>;
  deleteByCode(codice: string): Promise<number>;
}

export class HubServiceRepository implements IHubServiceRepository {
  async findActiveForRole(context: HubUserContext): Promise<HubService[]> {
    try {
      if (context.ruoloGdoKey) {
        const roleCandidates = getHubServiceRoleCandidates(context.ruoloGdoKey);

        // Per utenti con ruolo (GDO, IT, MARKETING, ecc.): prende sia record generici
        // (ruolo_gdo IS NULL) che specifici per ruolo, poi dedup per codice.
        // I servizi inattivi restano visibili per poter essere mostrati in stato disattivo.
        const services = await HubService.findAll({
          where: {
            tipo_utente: context.userType,
            [Op.or]: [
              { ruolo_gdo: null },
              { ruolo_gdo: { [Op.in]: roleCandidates } },
            ],
          },
          order: [['ordine', 'ASC']],
        });

        // Dedup per codice: il record con ruolo_gdo specifico ha priorità su quello generico (NULL)
        const byCode = new Map<string, HubService>();
        for (const service of services) {
          const existing = byCode.get(service.codice);
          if (!existing || (service.ruolo_gdo && !existing.ruolo_gdo)) {
            byCode.set(service.codice, service);
          }
        }
        return Array.from(byCode.values());
      }

      // Per utenti senza ruolo: solo i servizi generici del tipo.
      // Dedup per codice: PostgreSQL consente più NULL nello stesso indice univoco,
      // quindi potrebbero esistere più righe con ruolo_gdo = NULL per lo stesso codice.
      const noRoleServices = await HubService.findAll({
        where: {
          tipo_utente: context.userType,
          ruolo_gdo: null,
        },
        order: [['ordine', 'ASC']],
      });
      const byCodeNoRole = new Map<string, HubService>();
      for (const service of noRoleServices) {
        if (!byCodeNoRole.has(service.codice)) {
          byCodeNoRole.set(service.codice, service);
        }
      }
      return Array.from(byCodeNoRole.values());
    } catch (error) {
      log.error('HubServiceRepository.findActiveForRole error:', error);
      throw error;
    }
  }

  async findByCodeAndType(codice: string, tipoUtente: string, ruoloGdo?: string | null): Promise<HubService | null> {
    try {
      return await HubService.findOne({
        where: {
          codice,
          tipo_utente: tipoUtente,
          ruolo_gdo: ruoloGdo ?? null,
        },
      });
    } catch (error) {
      log.error('HubServiceRepository.findByCodeAndType error:', error);
      throw error;
    }
  }

  async findAllByCode(codice: string): Promise<HubService[]> {
    try {
      return await HubService.findAll({
        where: { codice },
        order: [['ordine', 'ASC'], ['tipo_utente', 'ASC'], ['ruolo_gdo', 'ASC']],
      });
    } catch (error) {
      log.error('HubServiceRepository.findAllByCode error:', error);
      throw error;
    }
  }

  async findAll(): Promise<HubService[]> {
    try {
      return await HubService.findAll({
        order: [['codice', 'ASC'], ['ordine', 'ASC'], ['tipo_utente', 'ASC'], ['ruolo_gdo', 'ASC']],
      });
    } catch (error) {
      log.error('HubServiceRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<HubService | null> {
    try {
      return await HubService.findByPk(id);
    } catch (error) {
      log.error('HubServiceRepository.findById error:', error);
      throw error;
    }
  }

  async create(data: HubServiceMutationInput): Promise<HubService> {
    try {
      return await HubService.create(buildPersistedData(null, data) as any);
    } catch (error) {
      log.error('HubServiceRepository.create error:', error);
      throw error;
    }
  }

  async bulkCreateForService(
    baseData: Omit<HubServiceMutationInput, 'tipo_utente' | 'ruolo_gdo'>,
    targets: Array<{ tipo_utente: string; ruolo_gdo?: string | null }>
  ): Promise<HubService[]> {
    const transaction = await sequelize.transaction();
    try {
      const created: HubService[] = [];
      for (const target of targets) {
        const service = await HubService.create(
          buildPersistedData(null, {
            ...baseData,
            tipo_utente: target.tipo_utente,
            ruolo_gdo: target.ruolo_gdo ?? null,
          }) as any,
          { transaction }
        );
        created.push(service);
      }
      await transaction.commit();
      return created;
    } catch (error) {
      await transaction.rollback();
      log.error('HubServiceRepository.bulkCreateForService error:', error);
      throw error;
    }
  }

  async bulkUpdate(ids: string[], data: HubServiceMutationInput): Promise<HubService[]> {
    const transaction = await sequelize.transaction();
    try {
      const services = await HubService.findAll({
        where: { id: { [Op.in]: ids } },
        transaction,
      });

      for (const service of services) {
        await service.update(buildPersistedData(service, data), { transaction });
      }

      await transaction.commit();
      return services;
    } catch (error) {
      await transaction.rollback();
      log.error('HubServiceRepository.bulkUpdate error:', error);
      throw error;
    }
  }

  async update(id: string, data: HubServiceMutationInput): Promise<HubService | null> {
    try {
      const service = await HubService.findByPk(id);
      if (!service) return null;
      await service.update(buildPersistedData(service, data));
      return service;
    } catch (error) {
      log.error('HubServiceRepository.update error:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await HubService.destroy({ where: { id } });
      return deleted > 0;
    } catch (error) {
      log.error('HubServiceRepository.delete error:', error);
      throw error;
    }
  }

  async deleteByCode(codice: string): Promise<number> {
    try {
      return await HubService.destroy({ where: { codice } });
    } catch (error) {
      log.error('HubServiceRepository.deleteByCode error:', error);
      throw error;
    }
  }
}
