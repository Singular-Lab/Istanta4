import { Op } from 'sequelize';
import { HubNews, HubNewsAttributes } from '../models/hub_news';
import { log } from '../logger';
import type { HubUserContext } from '../services/hubRoleUtils';
import { matchesHubRoles } from '../services/hubRoleUtils';

export interface IHubNewsRepository {
  findActiveForRole(context: HubUserContext): Promise<HubNews[]>;
  findAll(): Promise<HubNews[]>;
  findById(id: string): Promise<HubNews | null>;
  create(data: Partial<HubNewsAttributes>): Promise<HubNews>;
  update(id: string, data: Partial<HubNewsAttributes>): Promise<HubNews | null>;
  delete(id: string): Promise<boolean>;
}

export class HubNewsRepository implements IHubNewsRepository {
  async findActiveForRole(context: HubUserContext): Promise<HubNews[]> {
    try {
      const now = new Date();
      const news = await HubNews.findAll({
        where: {
          attivo: true,
          data_pubblicazione: { [Op.lte]: now },
          [Op.or]: [
            { data_scadenza: null },
            { data_scadenza: { [Op.gt]: now } },
          ],
        },
        order: [
          ['in_evidenza', 'DESC'],
          ['data_pubblicazione', 'DESC'],
        ],
      });

      return news.filter((item) => matchesHubRoles(item.ruoli_destinatari, context));
    } catch (error) {
      log.error('HubNewsRepository.findActiveForRole error:', error);
      throw error;
    }
  }

  async findAll(): Promise<HubNews[]> {
    try {
      return await HubNews.findAll({ order: [['data_pubblicazione', 'DESC']] });
    } catch (error) {
      log.error('HubNewsRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<HubNews | null> {
    try {
      return await HubNews.findByPk(id);
    } catch (error) {
      log.error('HubNewsRepository.findById error:', error);
      throw error;
    }
  }

  async create(data: Partial<HubNewsAttributes>): Promise<HubNews> {
    try {
      return await HubNews.create(data as any);
    } catch (error) {
      log.error('HubNewsRepository.create error:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<HubNewsAttributes>): Promise<HubNews | null> {
    try {
      const news = await HubNews.findByPk(id);
      if (!news) return null;
      await news.update(data);
      return news;
    } catch (error) {
      log.error('HubNewsRepository.update error:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await HubNews.destroy({ where: { id } });
      return deleted > 0;
    } catch (error) {
      log.error('HubNewsRepository.delete error:', error);
      throw error;
    }
  }
}
