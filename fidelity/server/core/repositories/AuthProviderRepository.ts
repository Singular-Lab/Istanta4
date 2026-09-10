import { Op, WhereOptions } from 'sequelize';
import { AuthProvider, AuthProviderAttributes } from '../models/auth_provider';
import { log } from '../logger';

export interface IAuthProviderRepository {
  findAllActive(userType?: string): Promise<AuthProvider[]>;
  findByCode(codice: string): Promise<AuthProvider | null>;
  findAll(): Promise<AuthProvider[]>;
  findById(id: string): Promise<AuthProvider | null>;
  create(data: Partial<AuthProviderAttributes>): Promise<AuthProvider>;
  update(id: string, data: Partial<AuthProviderAttributes>): Promise<AuthProvider | null>;
  delete(id: string): Promise<boolean>;
}

export class AuthProviderRepository implements IAuthProviderRepository {
  async findAllActive(userType?: string): Promise<AuthProvider[]> {
    try {
      const providers = await AuthProvider.findAll({
        where: { attivo: true },
        order: [['ordine', 'ASC']],
      });

      if (userType) {
        return providers.filter(p => {
          const ruoli = p.ruoli_ammessi;
          return !ruoli || ruoli.length === 0 || ruoli.includes(userType);
        });
      }

      return providers;
    } catch (error) {
      log.error('AuthProviderRepository.findAllActive error:', error);
      throw error;
    }
  }

  async findByCode(codice: string): Promise<AuthProvider | null> {
    try {
      return await AuthProvider.findOne({ where: { codice } });
    } catch (error) {
      log.error('AuthProviderRepository.findByCode error:', error);
      throw error;
    }
  }

  async findAll(): Promise<AuthProvider[]> {
    try {
      return await AuthProvider.findAll({ order: [['ordine', 'ASC']] });
    } catch (error) {
      log.error('AuthProviderRepository.findAll error:', error);
      throw error;
    }
  }

  async findById(id: string): Promise<AuthProvider | null> {
    try {
      return await AuthProvider.findByPk(id);
    } catch (error) {
      log.error('AuthProviderRepository.findById error:', error);
      throw error;
    }
  }

  async create(data: Partial<AuthProviderAttributes>): Promise<AuthProvider> {
    try {
      return await AuthProvider.create(data as any);
    } catch (error) {
      log.error('AuthProviderRepository.create error:', error);
      throw error;
    }
  }

  async update(id: string, data: Partial<AuthProviderAttributes>): Promise<AuthProvider | null> {
    try {
      const provider = await AuthProvider.findByPk(id);
      if (!provider) return null;
      await provider.update(data);
      return provider;
    } catch (error) {
      log.error('AuthProviderRepository.update error:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deleted = await AuthProvider.destroy({ where: { id } });
      return deleted > 0;
    } catch (error) {
      log.error('AuthProviderRepository.delete error:', error);
      throw error;
    }
  }
}
