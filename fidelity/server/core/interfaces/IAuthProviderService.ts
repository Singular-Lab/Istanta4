import type {
  AuthProviderAdminDTO,
  AuthProviderDTO,
  AuthProviderInput,
  EsitoMigrazioneSegreti,
  EsitoVerificaProvider,
} from '../../../lib/types';
import type { MetadatiIdpSaml } from './ISamlService';

export interface DiscoveryOidc {
  discovery_url: string;
  authorize_url: string;
  token_url: string;
  jwks_uri: string;
  expected_issuer?: string;
}

export interface IAuthProviderService {
  getActiveProviders(userType?: string): Promise<AuthProviderDTO[]>;
  getProviderByCode(codice: string): Promise<AuthProviderDTO | null>;
  getAllProviders(): Promise<AuthProviderDTO[]>;

  // Gestione del Superadmin
  getAllProvidersAdmin(): Promise<AuthProviderAdminDTO[]>;
  isMetodoAttivo(codice: string): Promise<boolean>;
  createProvider(input: AuthProviderInput): Promise<AuthProviderAdminDTO>;
  updateProvider(id: string, input: AuthProviderInput): Promise<AuthProviderAdminDTO | null>;
  deleteProvider(id: string): Promise<boolean>;
  riordinaProviders(ids: string[]): Promise<AuthProviderAdminDTO[]>;
  migraSegreti(modalita: 'cifra' | 'decifra', simulazione: boolean): Promise<EsitoMigrazioneSegreti>;
  importaDiscoveryOidc(url: string): Promise<DiscoveryOidc>;
  importaMetadatiSaml(origine: { xml?: string; url?: string }): Promise<MetadatiIdpSaml & { metadata_url?: string }>;
  verificaProvider(id: string): Promise<EsitoVerificaProvider[] | null>;
}
