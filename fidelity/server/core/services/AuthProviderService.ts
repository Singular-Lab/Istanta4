import { X509Certificate } from 'node:crypto';
import { BadRequestError, BusinessError, ExternalApiError } from '../../../lib/errors';
import type {
  AuthProviderAdminDTO,
  AuthProviderDTO,
  AuthProviderInput,
  EsitoMigrazioneSegreti,
  EsitoVerificaProvider,
} from '../../../lib/types';
import type { IAuthProviderService, DiscoveryOidc } from '../interfaces/IAuthProviderService';
import type { ISamlService, MetadatiIdpSaml } from '../interfaces/ISamlService';
import type { IAuthProviderRepository } from '../repositories/AuthProviderRepository';
import type { AuthProvider } from '../models/auth_provider';
import { log } from '../logger';
import { cifraSegreto, decifraSegreto, eSegretoCifrato } from '../utils/segretiProvider';
import {
  CODICE_EMAIL_PASSWORD,
  campiSegreti,
  configServerInChiaro,
  preparaProvider,
  toAdminDTO,
} from './authProviders/configurazioneProvider';

const TIMEOUT_RETE_MS = 10_000;

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

function verificaUrlRemoto(url: unknown): string {
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.toString();
  } catch { /* gestito sotto */ }
  throw new BadRequestError({ message: 'Indirizzo http(s) non valido' });
}

async function scarica(url: string, servizio: string): Promise<Response> {
  try {
    const risposta = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_RETE_MS), redirect: 'follow' });
    if (!risposta.ok) {
      throw new ExternalApiError({ message: `${url} ha risposto ${risposta.status}`, service: servizio, endpoint: url, statusCode: risposta.status });
    }
    return risposta;
  } catch (error) {
    if (error instanceof ExternalApiError) throw error;
    throw new ExternalApiError({ message: `${url} non raggiungibile: ${error instanceof Error ? error.message : String(error)}`, service: servizio, endpoint: url });
  }
}

export class AuthProviderService implements IAuthProviderService {
  constructor(
    private repository: IAuthProviderRepository,
    private samlService?: ISamlService,
  ) {}

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

  // ─── Gestione del Superadmin ────────────────────────────

  async getAllProvidersAdmin(): Promise<AuthProviderAdminDTO[]> {
    const providers = await this.repository.findAll();
    return providers.map(toAdminDTO);
  }

  /** Un metodo senza riga (installazione mai inizializzata) resta utilizzabile. */
  async isMetodoAttivo(codice: string): Promise<boolean> {
    const provider = await this.repository.findByCode(codice);
    return !provider || provider.attivo;
  }

  async createProvider(input: AuthProviderInput): Promise<AuthProviderAdminDTO> {
    const dati = preparaProvider(input);
    if (await this.repository.findByCode(dati.codice)) {
      throw new BadRequestError({ message: `Esiste gia' un metodo di accesso con codice "${dati.codice}"` });
    }
    const provider = await this.repository.create(dati);
    return toAdminDTO(provider);
  }

  async updateProvider(id: string, input: AuthProviderInput): Promise<AuthProviderAdminDTO | null> {
    const esistente = await this.repository.findById(id);
    if (!esistente) return null;
    const dati = preparaProvider(input, esistente);
    if (esistente.attivo && !dati.attivo) await this.verificaNonUltimoAttivo(esistente);
    const provider = await this.repository.update(id, dati);
    return provider ? toAdminDTO(provider) : null;
  }

  async deleteProvider(id: string): Promise<boolean> {
    const esistente = await this.repository.findById(id);
    if (!esistente) return false;
    if (esistente.codice === CODICE_EMAIL_PASSWORD) {
      throw new BusinessError({
        message: 'Il metodo con email e password non si puo\' eliminare: disattivalo',
        rule: 'metodo_interno_non_eliminabile',
      });
    }
    if (esistente.attivo) await this.verificaNonUltimoAttivo(esistente);
    return this.repository.delete(id);
  }

  async riordinaProviders(ids: string[]): Promise<AuthProviderAdminDTO[]> {
    const providers = await this.repository.findAll();
    const noti = new Set(providers.map((p) => p.id));
    if (!Array.isArray(ids) || ids.length !== noti.size || ids.some((id) => !noti.has(id)) || new Set(ids).size !== ids.length) {
      throw new BadRequestError({ message: 'L\'ordine deve elencare una sola volta tutti i metodi di accesso' });
    }
    for (const [indice, id] of ids.entries()) {
      await this.repository.update(id, { ordine: indice });
    }
    return this.getAllProvidersAdmin();
  }

  private async verificaNonUltimoAttivo(provider: AuthProvider): Promise<void> {
    const attivi = await this.repository.findAllActive();
    if (attivi.length <= 1 && attivi.every((p) => p.id === provider.id)) {
      throw new BusinessError({
        message: 'E\' l\'ultimo metodo di accesso attivo: attivane un altro prima di disattivarlo o eliminarlo',
        rule: 'ultimo_metodo_attivo',
      });
    }
  }

  // ─── Segreti ────────────────────────────────────────────

  /**
   * Cifra i segreti ancora in chiaro, oppure li riporta in chiaro (rollback).
   * Idempotente: un segreto gia' nello stato richiesto non viene toccato.
   */
  async migraSegreti(modalita: 'cifra' | 'decifra', simulazione: boolean): Promise<EsitoMigrazioneSegreti> {
    const esito: EsitoMigrazioneSegreti = { modalita, simulazione, provider: [], totaleCampi: 0 };
    for (const provider of await this.repository.findAll()) {
      const config = { ...(provider.config_server ?? {}) };
      const campi: string[] = [];
      for (const nome of campiSegreti(provider.tipo)) {
        const valore = config[nome];
        if (typeof valore !== 'string' || !valore) continue;
        if (modalita === 'cifra' && !eSegretoCifrato(valore)) {
          config[nome] = cifraSegreto(valore);
          campi.push(nome);
        } else if (modalita === 'decifra' && eSegretoCifrato(valore)) {
          config[nome] = decifraSegreto(valore);
          campi.push(nome);
        }
      }
      if (campi.length === 0) continue;
      esito.provider.push({ codice: provider.codice, campi });
      esito.totaleCampi += campi.length;
      if (!simulazione) await this.repository.update(provider.id, { config_server: config });
    }
    return esito;
  }

  // ─── Importazioni e verifica ────────────────────────────

  async importaDiscoveryOidc(url: string): Promise<DiscoveryOidc> {
    let indirizzo = verificaUrlRemoto(url);
    if (!indirizzo.includes('/.well-known/')) indirizzo = `${indirizzo.replace(/\/+$/, '')}/.well-known/openid-configuration`;
    const documento = await (await scarica(indirizzo, 'OIDC_DISCOVERY')).json() as Record<string, unknown>;
    const { authorization_endpoint, token_endpoint, jwks_uri, issuer } = documento;
    if (typeof authorization_endpoint !== 'string' || typeof token_endpoint !== 'string' || typeof jwks_uri !== 'string') {
      throw new BadRequestError({ message: 'Il documento di discovery non contiene authorization_endpoint, token_endpoint e jwks_uri' });
    }
    return {
      discovery_url: indirizzo,
      authorize_url: authorization_endpoint,
      token_url: token_endpoint,
      jwks_uri,
      expected_issuer: typeof issuer === 'string' ? issuer : undefined,
    };
  }

  async importaMetadatiSaml(origine: { xml?: string; url?: string }): Promise<MetadatiIdpSaml & { metadata_url?: string }> {
    if (!this.samlService) throw new BadRequestError({ message: 'SAML non disponibile' });
    if (origine.url) {
      const url = verificaUrlRemoto(origine.url);
      const xml = await (await scarica(url, 'SAML_METADATA')).text();
      return { ...this.samlService.leggiMetadatiIdp(xml), metadata_url: url };
    }
    if (!origine.xml?.trim()) throw new BadRequestError({ message: 'Indicare i metadati XML o il loro indirizzo' });
    return this.samlService.leggiMetadatiIdp(origine.xml);
  }

  /** Prova la configurazione salvata senza modificarla: raggiungibilita', certificati, segreti. */
  async verificaProvider(id: string): Promise<EsitoVerificaProvider[] | null> {
    const provider = await this.repository.findById(id);
    if (!provider) return null;
    const esiti: EsitoVerificaProvider[] = [];
    const aggiungi = (controllo: string, esito: EsitoVerificaProvider['esito'], dettaglio: string) =>
      esiti.push({ controllo, esito, dettaglio });

    let config: Record<string, unknown> = {};
    try {
      config = configServerInChiaro(provider);
      for (const nome of campiSegreti(provider.tipo)) {
        const valore = provider.config_server?.[nome];
        if (typeof valore === 'string' && valore) {
          aggiungi(`Segreto ${nome}`, eSegretoCifrato(valore) ? 'ok' : 'avviso',
            eSegretoCifrato(valore) ? 'Cifrato e leggibile' : 'Salvato in chiaro: usare "Cifra segreti in chiaro"');
        }
      }
    } catch (error) {
      aggiungi('Segreti', 'errore', error instanceof Error ? error.message : String(error));
    }

    const raggiungibile = async (controllo: string, url: unknown, metodo: 'GET' | 'POST' = 'GET') => {
      if (typeof url !== 'string' || !url) return aggiungi(controllo, 'errore', 'Indirizzo non configurato');
      try {
        const risposta = await fetch(url, { method: metodo, signal: AbortSignal.timeout(TIMEOUT_RETE_MS), redirect: 'manual' });
        aggiungi(controllo, risposta.status >= 500 ? 'errore' : 'ok', `Risposta ${risposta.status}`);
      } catch (error) {
        aggiungi(controllo, 'errore', `Non raggiungibile: ${error instanceof Error ? error.message : String(error)}`);
      }
    };

    if (provider.tipo === 'oidc') {
      await raggiungibile('Indirizzo di autorizzazione', provider.config_client?.authorize_url);
      await raggiungibile('Indirizzo dei token', config.token_url, 'POST');
      try {
        const jwks = await (await scarica(String(config.jwks_uri ?? ''), 'OIDC_JWKS')).json() as { keys?: unknown[] };
        const chiavi = Array.isArray(jwks.keys) ? jwks.keys.length : 0;
        aggiungi('Chiavi di firma (JWKS)', chiavi > 0 ? 'ok' : 'errore', `${chiavi} chiavi pubblicate`);
      } catch (error) {
        aggiungi('Chiavi di firma (JWKS)', 'errore', error instanceof Error ? error.message : String(error));
      }
      if (!config.expected_issuer) aggiungi('Issuer', 'avviso', 'Issuer atteso non configurato: l\'emittente del token non viene verificato');
    }

    if (provider.tipo === 'saml') {
      await raggiungibile('Indirizzo di accesso dell\'IdP', config.entry_point);
      for (const [indice, pem] of ((config.idp_certs as string[] | undefined) ?? []).entries()) {
        try {
          const certificato = new X509Certificate(pem);
          const scadenza = new Date(certificato.validTo);
          const giorni = Math.floor((scadenza.getTime() - Date.now()) / 86_400_000);
          aggiungi(`Certificato IdP ${indice + 1}`, giorni < 0 ? 'errore' : giorni < 30 ? 'avviso' : 'ok',
            `${certificato.subject.replace(/\n/g, ', ')} - scade il ${scadenza.toISOString().slice(0, 10)}`);
        } catch {
          aggiungi(`Certificato IdP ${indice + 1}`, 'errore', 'Certificato non leggibile');
        }
      }
      if (this.samlService) {
        try {
          this.samlService.generaMetadati(provider);
          aggiungi('Metadati del service provider', 'ok', 'Generati correttamente');
        } catch (error) {
          aggiungi('Metadati del service provider', 'errore', error instanceof Error ? error.message : String(error));
        }
      }
    }

    if (provider.tipo === 'custom') await raggiungibile('Indirizzo di destinazione', provider.config_client?.redirect_uri);
    if (provider.tipo === 'internal') aggiungi('Email e password', 'ok', 'Metodo interno: nessuna configurazione esterna');
    return esiti;
  }
}
