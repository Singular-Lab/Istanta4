import type { AuthProviderDTO } from '../../../lib/types';
import type { IAuthProviderService } from '../interfaces/IAuthProviderService';
import type { IAuthProviderRepository } from '../repositories/AuthProviderRepository';
import type { AuthProvider } from '../models/auth_provider';
import { log } from '../logger';

function toDTO(provider: AuthProvider): AuthProviderDTO {
  return {
    id: provider.id,
    codice: provider.codice,
    nome: provider.nome,
    descrizione: provider.descrizione ?? undefined,
    icona: provider.icona,
    tipo: provider.tipo,
    ordine: provider.ordine,
    attivo: provider.attivo,
    config_client: (provider.config_client as AuthProviderDTO['config_client']) ?? undefined,
    // config_server is NEVER exposed
  };
}

export class AuthProviderService implements IAuthProviderService {
  constructor(private repository: IAuthProviderRepository) {}

  async getActiveProviders(userType?: string): Promise<AuthProviderDTO[]> {
    try {
      const providers = await this.repository.findAllActive(userType);
      return providers.map(toDTO);
    } catch (error) {
      log.error('AuthProviderService.getActiveProviders error:', error);
      throw error;
    }
  }

  async getProviderByCode(codice: string): Promise<AuthProviderDTO | null> {
    try {
      const provider = await this.repository.findByCode(codice);
      return provider ? toDTO(provider) : null;
    } catch (error) {
      log.error('AuthProviderService.getProviderByCode error:', error);
      throw error;
    }
  }

  async getAllProviders(): Promise<AuthProviderDTO[]> {
    try {
      const providers = await this.repository.findAll();
      return providers.map(toDTO);
    } catch (error) {
      log.error('AuthProviderService.getAllProviders error:', error);
      throw error;
    }
  }

  async createProvider(data: Partial<AuthProviderDTO> & { codice: string; nome: string; tipo: string }): Promise<AuthProviderDTO> {
    try {
      const provider = await this.repository.create(data as any);
      return toDTO(provider);
    } catch (error) {
      log.error('AuthProviderService.createProvider error:', error);
      throw error;
    }
  }

  async updateProvider(id: string, data: Partial<AuthProviderDTO>): Promise<AuthProviderDTO | null> {
    try {
      const provider = await this.repository.update(id, data as any);
      return provider ? toDTO(provider) : null;
    } catch (error) {
      log.error('AuthProviderService.updateProvider error:', error);
      throw error;
    }
  }

  async deleteProvider(id: string): Promise<boolean> {
    try {
      return await this.repository.delete(id);
    } catch (error) {
      log.error('AuthProviderService.deleteProvider error:', error);
      throw error;
    }
  }
}
