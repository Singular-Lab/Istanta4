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
import { chiamaHttp, ErroreHttp } from '../http/clienteHttp';
import {
  chiamaUrlSicuro,
  CorpoTroppoGrandeError,
  IndirizzoNonSicuroError,
  leggiCorpoLimitato,
  verificaUrlSicuro,
} from '../http/indirizziSicuri';
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
// Discovery, metadati SAML e JWKS pesano pochi KB: oltre questa soglia non si scarica
export const DIMENSIONE_MASSIMA_DOCUMENTO_BYTE = 2 * 1024 * 1024;

const messaggioDi = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Un indirizzo vietato o un redirect verso la rete interna e' un errore di configurazione, non del servizio. */
const indirizzoVietato = (error: unknown): error is IndirizzoNonSicuroError =>
  error instanceof IndirizzoNonSicuroError && error.motivo !== 'dns';

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

/**
 * Scarica un documento di configurazione (discovery, metadati, JWKS) indicato dal Superadmin:
 * niente indirizzi verso l'host stesso o i metadati cloud, redirect ricontrollati a ogni salto,
 * al massimo DIMENSIONE_MASSIMA_DOCUMENTO_BYTE.
 */
async function scarica(url: string, servizio: string): Promise<string> {
  let risposta: Response;
  try {
    risposta = await chiamaUrlSicuro(url, { method: 'GET', timeoutMs: TIMEOUT_RETE_MS });
  } catch (error) {
    if (indirizzoVietato(error)) throw new BadRequestError({ message: error.message });
    // ErroreHttp dice gia' chi non risponde
    const motivo = error instanceof ErroreHttp ? error.message : `${url} non raggiungibile: ${messaggioDi(error)}`;
    throw new ExternalApiError({ message: motivo, service: servizio, endpoint: url, cause: error instanceof Error ? error : undefined });
  }
  if (!risposta.ok) {
    await risposta.body?.cancel().catch(() => undefined);
    throw new ExternalApiError({ message: `${url} ha risposto ${risposta.status}`, service: servizio, endpoint: url, statusCode: risposta.status });
  }
  try {
    return await leggiCorpoLimitato(risposta, DIMENSIONE_MASSIMA_DOCUMENTO_BYTE);
  } catch (error) {
    if (error instanceof CorpoTroppoGrandeError) {
      throw new BadRequestError({ message: `${url} restituisce un documento oltre i ${DIMENSIONE_MASSIMA_DOCUMENTO_BYTE / 1024 / 1024} MB` });
    }
    throw new ExternalApiError({ message: `${url} non raggiungibile: ${messaggioDi(error)}`, service: servizio, endpoint: url });
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
    const documento = JSON.parse(await scarica(indirizzo, 'OIDC_DISCOVERY')) as Record<string, unknown>;
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
      const xml = await scarica(url, 'SAML_METADATA');
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
        await verificaUrlSicuro(url);
        // Il redirect non si segue: un 3xx dice gia' che il servizio risponde
        const risposta = await chiamaHttp(url, { method: metodo, timeoutMs: TIMEOUT_RETE_MS, redirect: 'manual' });
        await risposta.body?.cancel().catch(() => undefined);
        aggiungi(controllo, risposta.status >= 500 ? 'errore' : 'ok', `Risposta ${risposta.status}`);
      } catch (error) {
        aggiungi(controllo, 'errore', indirizzoVietato(error) ? error.message : `Non raggiungibile: ${messaggioDi(error)}`);
      }
    };

    if (provider.tipo === 'oidc') {
      await raggiungibile('Indirizzo di autorizzazione', provider.config_client?.authorize_url);
      await raggiungibile('Indirizzo dei token', config.token_url, 'POST');
      try {
        const jwks = JSON.parse(await scarica(String(config.jwks_uri ?? ''), 'OIDC_JWKS')) as { keys?: unknown[] };
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
