import type { HubNewsAdminDTO, HubNewsDTO } from '../../../lib/types';
import type { HubUserContext } from '../services/hubRoleUtils';

export interface IHubNewsService {
  getNewsForRole(context: HubUserContext): Promise<HubNewsDTO[]>;
  getAllNews(): Promise<HubNewsAdminDTO[]>;
  createNews(data: Partial<HubNewsAdminDTO> & { titolo: string; contenuto: string }): Promise<HubNewsAdminDTO>;
  updateNews(id: string, data: Partial<HubNewsAdminDTO>): Promise<HubNewsAdminDTO | null>;
  deleteNews(id: string): Promise<boolean>;
}
