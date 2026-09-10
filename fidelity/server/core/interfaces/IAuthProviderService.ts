import type { AuthProviderDTO } from '../../../lib/types';

export interface IAuthProviderService {
  getActiveProviders(userType?: string): Promise<AuthProviderDTO[]>;
  getProviderByCode(codice: string): Promise<AuthProviderDTO | null>;
  getAllProviders(): Promise<AuthProviderDTO[]>;
  createProvider(data: Partial<AuthProviderDTO> & { codice: string; nome: string; tipo: string }): Promise<AuthProviderDTO>;
  updateProvider(id: string, data: Partial<AuthProviderDTO>): Promise<AuthProviderDTO | null>;
  deleteProvider(id: string): Promise<boolean>;
}
