import type { HubNewsAdminDTO, HubNewsDTO } from '../../../lib/types';
import type { IHubNewsService } from '../interfaces/IHubNewsService';
import type { IHubNewsRepository } from '../repositories/HubNewsRepository';
import type { HubNews } from '../models/hub_news';
import { log } from '../logger';
import { normalizeHubTargetRoles, type HubUserContext } from './hubRoleUtils';

function toDTO(news: HubNews): HubNewsDTO {
  return {
    id: news.id,
    titolo: news.titolo,
    contenuto: news.contenuto,
    tipo: news.tipo,
    icona: news.icona ?? undefined,
    url: news.url ?? undefined,
    in_evidenza: news.in_evidenza,
    data_pubblicazione: news.data_pubblicazione.toISOString(),
    data_scadenza: news.data_scadenza?.toISOString() ?? undefined,
    autore_nome: news.autore_nome ?? undefined,
    meta: (news.meta as Record<string, unknown>) ?? undefined,
  };
}

function toAdminDTO(news: HubNews): HubNewsAdminDTO {
  return {
    ...toDTO(news),
    attivo: news.attivo,
    ruoli_destinatari: Array.isArray(news.ruoli_destinatari) ? news.ruoli_destinatari : [],
  };
}

function normalizeNewsInput<T extends Partial<HubNewsAdminDTO>>(data: T): T {
  const normalized = { ...data };

  if (Object.prototype.hasOwnProperty.call(normalized, 'ruoli_destinatari')) {
    normalized.ruoli_destinatari = normalizeHubTargetRoles(normalized.ruoli_destinatari);
  }

  return normalized;
}

export class HubNewsService implements IHubNewsService {
  constructor(private repository: IHubNewsRepository) {}

  async getNewsForRole(context: HubUserContext): Promise<HubNewsDTO[]> {
    try {
      const news = await this.repository.findActiveForRole(context);
      return news.map(toDTO);
    } catch (error) {
      log.error('HubNewsService.getNewsForRole error:', error);
      throw error;
    }
  }

  async getAllNews(): Promise<HubNewsAdminDTO[]> {
    try {
      const news = await this.repository.findAll();
      return news.map(toAdminDTO);
    } catch (error) {
      log.error('HubNewsService.getAllNews error:', error);
      throw error;
    }
  }

  async createNews(data: Partial<HubNewsAdminDTO> & { titolo: string; contenuto: string }): Promise<HubNewsAdminDTO> {
    try {
      const news = await this.repository.create(normalizeNewsInput(data) as any);
      return toAdminDTO(news);
    } catch (error) {
      log.error('HubNewsService.createNews error:', error);
      throw error;
    }
  }

  async updateNews(id: string, data: Partial<HubNewsAdminDTO>): Promise<HubNewsAdminDTO | null> {
    try {
      const news = await this.repository.update(id, normalizeNewsInput(data) as any);
      return news ? toAdminDTO(news) : null;
    } catch (error) {
      log.error('HubNewsService.updateNews error:', error);
      throw error;
    }
  }

  async deleteNews(id: string): Promise<boolean> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      log.error('HubNewsService.deleteNews error:', error);
      throw error;
    }
  }
}
