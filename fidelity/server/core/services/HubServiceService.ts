import { TIPO_UTENTI } from '../../../lib/enums';
import { readHubServiceDocuments, readHubServiceVideos, sanitizeMetaHubService } from '../../../lib/hubServiceContent';
import { readHubServiceRedirectPage } from '../../../lib/hubServiceRedirect';
import type { BulkUpdateHubServicePatch, HubServiceDTO } from '../../../lib/types';
import type { BulkCreateHubServiceInput, CreateHubServiceInput, IHubServiceService } from '../interfaces/IHubServiceService';
import { log } from '../logger';
import type { HubService } from '../models/hub_service';
import type { IHubServiceRepository } from '../repositories/HubServiceRepository';
import { normalizeHubServiceRoleValue, type HubUserContext } from './hubRoleUtils';

function toDTO(service: HubService): HubServiceDTO {
  const meta = (service.meta as Record<string, unknown>) ?? undefined;

  return {
    id: service.id,
    codice: service.codice,
    nome: service.nome,
    descrizione: service.descrizione ?? '',
    icona: service.icona,
    colore: service.colore,
    url: service.url,
    tipo_url: service.tipo_url,
    attivo: service.attivo,
    in_manutenzione: service.in_manutenzione,
    in_evidenza: service.in_evidenza,
    ordine: service.ordine,
    tipo_utente: service.tipo_utente,
    ruolo_gdo: service.ruolo_gdo,
    redirect_page: readHubServiceRedirectPage(meta, service.url),
    documents: readHubServiceDocuments(meta),
    videos: readHubServiceVideos(meta),
    meta: sanitizeMetaHubService(meta),
  };
}

function normalizeServiceInput<T extends Partial<CreateHubServiceInput> & Partial<HubServiceDTO>>(data: T): T {
  const normalized = { ...data };

  if (Object.prototype.hasOwnProperty.call(normalized, 'ruolo_gdo')) {
    normalized.ruolo_gdo = normalizeHubServiceRoleValue(normalized.ruolo_gdo);
  }

  return normalized;
}

function compareServiceVariants(left: HubService, right: HubService): number {
  return (
    left.ordine - right.ordine ||
    left.tipo_utente.localeCompare(right.tipo_utente) ||
    (left.ruolo_gdo || '').localeCompare(right.ruolo_gdo || '') ||
    left.codice.localeCompare(right.codice)
  );
}

function getSuperadminVariantPriority(service: HubService): number {
  const availabilityPenalty = !service.attivo
    ? 200
    : service.in_manutenzione
      ? 100
      : 0;
  const audiencePenalty = service.tipo_utente === TIPO_UTENTI.SUPERADMIN
    ? 0
    : service.ruolo_gdo
      ? 20
      : 10;

  return availabilityPenalty + audiencePenalty;
}

function selectServicesForSuperadmin(services: HubService[]): HubService[] {
  const groupedByCode = new Map<string, HubService[]>();

  for (const service of services) {
    const current = groupedByCode.get(service.codice) ?? [];
    current.push(service);
    groupedByCode.set(service.codice, current);
  }

  return Array.from(groupedByCode.values())
    .map((variants) => {
      return [...variants].sort((left, right) => {
        return (
          getSuperadminVariantPriority(left) - getSuperadminVariantPriority(right) ||
          compareServiceVariants(left, right)
        );
      })[0];
    })
    .sort(compareServiceVariants);
}

export class HubServiceService implements IHubServiceService {
  constructor(private repository: IHubServiceRepository) { }

  async getServicesForRole(context: HubUserContext): Promise<HubServiceDTO[]> {
    try {
      const services = context.userType === TIPO_UTENTI.SUPERADMIN
        ? selectServicesForSuperadmin(await this.repository.findAll())
        : await this.repository.findActiveForRole(context);
      return services.map((service) => toDTO(service));
    } catch (error) {
      log.error('HubServiceService.getServicesForRole error:', error);
      throw error;
    }
  }

  async getAllServices(): Promise<HubServiceDTO[]> {
    try {
      const services = await this.repository.findAll();
      return services.map((service) => toDTO(service));
    } catch (error) {
      log.error('HubServiceService.getAllServices error:', error);
      throw error;
    }
  }

  async getAllServicesGrouped(): Promise<Record<string, HubServiceDTO[]>> {
    try {
      const services = await this.repository.findAll();
      const grouped: Record<string, HubServiceDTO[]> = {};
      for (const service of services) {
        const dto = toDTO(service);
        if (!grouped[dto.codice]) {
          grouped[dto.codice] = [];
        }
        grouped[dto.codice].push(dto);
      }

      for (const codice of Object.keys(grouped)) {
        grouped[codice].sort((left, right) => {
          return (
            left.ordine - right.ordine ||
            left.tipo_utente.localeCompare(right.tipo_utente) ||
            (left.ruolo_gdo || '').localeCompare(right.ruolo_gdo || '')
          );
        });
      }

      return grouped;
    } catch (error) {
      log.error('HubServiceService.getAllServicesGrouped error:', error);
      throw error;
    }
  }

  async createService(data: CreateHubServiceInput): Promise<HubServiceDTO> {
    try {
      const service = await this.repository.create(normalizeServiceInput(data) as any);

      if (data.tipo_utente !== TIPO_UTENTI.SUPERADMIN) {
        const existingSuperadmin = await this.repository.findByCodeAndType(data.codice, TIPO_UTENTI.SUPERADMIN);
        if (!existingSuperadmin) {
          await this.repository.create(
            normalizeServiceInput({ ...data, tipo_utente: TIPO_UTENTI.SUPERADMIN, ruolo_gdo: null }) as any
          );
        }
      }

      return toDTO(service);
    } catch (error) {
      log.error('HubServiceService.createService error:', error);
      throw error;
    }
  }

  async bulkCreateService(data: BulkCreateHubServiceInput): Promise<HubServiceDTO[]> {
    try {
      const { tipi_utente, ...baseData } = data;

      const hasSuperadmin = tipi_utente.some((t) => t.tipo_utente === TIPO_UTENTI.SUPERADMIN);
      let targets = tipi_utente;
      if (!hasSuperadmin) {
        const existingSuperadmin = await this.repository.findByCodeAndType(data.codice, TIPO_UTENTI.SUPERADMIN);
        if (!existingSuperadmin) {
          targets = [...tipi_utente, { tipo_utente: TIPO_UTENTI.SUPERADMIN, ruolo_gdo: null }];
        }
      }

      const normalizedTargets = targets.map((target) => normalizeServiceInput(target));
      const services = await this.repository.bulkCreateForService(baseData, normalizedTargets);
      return services.map((service) => toDTO(service));
    } catch (error) {
      log.error('HubServiceService.bulkCreateService error:', error);
      throw error;
    }
  }

  async updateService(id: string, data: Partial<HubServiceDTO>): Promise<HubServiceDTO | null> {
    try {
      const service = await this.repository.update(id, normalizeServiceInput(data) as any);
      return service ? toDTO(service) : null;
    } catch (error) {
      log.error('HubServiceService.updateService error:', error);
      throw error;
    }
  }

  async bulkUpdateServices(ids: string[], patch: BulkUpdateHubServicePatch): Promise<HubServiceDTO[]> {
    try {
      const services = await this.repository.bulkUpdate(ids, patch as any);

      // Propaga le modifiche anche alle varianti Superadmin per ogni codice aggiornato,
      // a meno che la variante Superadmin non fosse già inclusa esplicitamente negli ids.
      const idSet = new Set(ids);
      const updatedCodes = [...new Set(services.map((s) => s.codice))];
      for (const codice of updatedCodes) {
        const superadminVariant = await this.repository.findByCodeAndType(codice, TIPO_UTENTI.SUPERADMIN);
        if (superadminVariant && !idSet.has(superadminVariant.id)) {
          await this.repository.update(superadminVariant.id, patch as any);
        }
      }

      return services.map((service) => toDTO(service));
    } catch (error) {
      log.error('HubServiceService.bulkUpdateServices error:', error);
      throw error;
    }
  }

  async deleteService(id: string): Promise<boolean> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      log.error('HubServiceService.deleteService error:', error);
      throw error;
    }
  }

  async deleteServiceByCode(codice: string): Promise<number> {
    try {
      return await this.repository.deleteByCode(codice);
    } catch (error) {
      log.error('HubServiceService.deleteServiceByCode error:', error);
      throw error;
    }
  }
}
