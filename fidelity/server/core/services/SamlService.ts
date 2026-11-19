import { SAML, ValidateInResponseTo, type CacheItem, type CacheProvider, type Profile } from '@node-saml/node-saml';
import { DOMParser } from '@xmldom/xmldom';
import { Op, QueryTypes } from 'sequelize';
import { BadRequestError, ErrorCodes, UnauthorizedError } from '../../../lib/errors';
import type { AuthProviderAttributes } from '../models/auth_provider';
import type { ISamlService, MetadatiIdpSaml, SamlUserClaims } from '../interfaces/ISamlService';
import { log } from '../logger';
import { sequelize } from '../db/SequelizeConnector';
import { RichiestaSamlInAttesa } from '../models/saml_richiesta_in_attesa';
import { configServerInChiaro, normalizzaCertificato } from './authProviders/configurazioneProvider';

/** Validita' di una richiesta di accesso SAML in attesa di risposta. */
const SCADENZA_RICHIESTA_MS = 10 * 60 * 1000;

const ATTRIBUTI_EMAIL_PREDEFINITI = [
  'email',
  'mail',
  'urn:oid:0.9.2342.19200300.100.1.3',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
];
const ATTRIBUTI_NOME_PREDEFINITI = ['givenName', 'urn:oid:2.5.4.42', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'];
const ATTRIBUTI_COGNOME_PREDEFINITI = ['sn', 'surname', 'urn:oid:2.5.4.4', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname'];

const NS_METADATA = 'urn:oasis:names:tc:SAML:2.0:metadata';
const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';
const BINDING_REDIRECT = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect';

/**
 * Dove stanno le richieste di accesso in attesa della risposta dell'IdP. In produzione il database
 * (models/saml_richiesta_in_attesa): la risposta arriva su una richiesta HTTP diversa da quella che
 * ha avviato l'accesso, e con piu' worker spesso a un altro processo.
 */
export interface DepositoRichiesteSaml {
  /** Inserisce la richiesta; false se ce n'e' gia' una con la stessa chiave. */
  inserisciSeManca(chiave: string, valore: string, creataIl: Date): Promise<boolean>;
  /** Il valore della richiesta, se e' stata creata non prima di `nonPrimaDi`. */
  leggi(chiave: string, nonPrimaDi: Date): Promise<string | null>;
  /** Toglie la richiesta e ne restituisce il valore. */
  togli(chiave: string): Promise<string | null>;
  togliScadute(primaDi: Date): Promise<void>;
}

export const depositoRichiesteSamlNelDatabase: DepositoRichiesteSaml = {
  async inserisciSeManca(chiave, valore, creataIl) {
    const righe = await sequelize.query<{ chiave: string }>(
      `INSERT INTO saml_richieste_in_attesa (chiave, valore, creata_il)
       VALUES (:chiave, :valore, :creataIl)
       ON CONFLICT (chiave) DO NOTHING
       RETURNING chiave`,
      { replacements: { chiave, valore, creataIl }, type: QueryTypes.SELECT },
    );
    return righe.length > 0;
  },
  async leggi(chiave, nonPrimaDi) {
    const riga = await RichiestaSamlInAttesa.findOne({
      attributes: ['valore'],
      where: { chiave, creata_il: { [Op.gte]: nonPrimaDi } },
    });
    return riga?.valore ?? null;
  },
  async togli(chiave) {
    const righe = await sequelize.query<{ valore: string }>(
      'DELETE FROM saml_richieste_in_attesa WHERE chiave = :chiave RETURNING valore',
      { replacements: { chiave }, type: QueryTypes.SELECT },
    );
    return righe[0]?.valore ?? null;
  },
  async togliScadute(primaDi) {
    await RichiestaSamlInAttesa.destroy({ where: { creata_il: { [Op.lt]: primaDi } } });
  },
};

/**
 * Richieste di accesso in attesa, condivise da tutte le istanze SAML e da tutti i worker. Una
 * richiesta viene tolta alla prima risposta, cosi' la stessa risposta non apre una seconda sessione;
 * quelle scadute si tolgono alla richiesta successiva.
 */
export class CacheRichiesteSaml implements CacheProvider {
  constructor(
    private deposito: DepositoRichiesteSaml = depositoRichiesteSamlNelDatabase,
    private scadenzaMs = SCADENZA_RICHIESTA_MS,
    private adesso: () => number = Date.now,
  ) {}

  private limite(): Date {
    return new Date(this.adesso() - this.scadenzaMs);
  }

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    await this.deposito.togliScadute(this.limite());
    const creataIl = new Date(this.adesso());
    if (!(await this.deposito.inserisciSeManca(key, value, creataIl))) return null;
    return { value, createdAt: creataIl.getTime() };
  }

  async getAsync(key: string): Promise<string | null> {
    return this.deposito.leggi(key, this.limite());
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) return null;
    return this.deposito.togli(key);
  }
}

function testo(valore: unknown): string | undefined {
  if (typeof valore === 'string') return valore.trim() || undefined;
  if (Array.isArray(valore)) return testo(valore[0]);
  return undefined;
}

function primoAttributo(profile: Profile, configurato: unknown, predefiniti: string[]): string | undefined {
  const nomi = typeof configurato === 'string' && configurato ? [configurato] : predefiniti;
  for (const nome of nomi) {
    const valore = testo(profile[nome]);
    if (valore) return valore;
  }
  return undefined;
}

export class SamlService implements ISamlService {
  constructor(private cache: CacheProvider = new CacheRichiesteSaml()) {}

  private creaSaml(provider: AuthProviderAttributes): SAML {
    const config = configServerInChiaro(provider);
    const idpCert = config.idp_certs as string[] | undefined;
    if (!config.entry_point || !config.sp_entity_id || !config.callback_url || !idpCert?.length) {
      throw new BadRequestError({
        message: `Provider "${provider.codice}" manca di config_server richieste (entry_point, sp_entity_id, callback_url, idp_certs)`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_PROVIDER_ERROR },
      });
    }

    return new SAML({
      entryPoint: config.entry_point as string,
      issuer: config.sp_entity_id as string,
      callbackUrl: config.callback_url as string,
      audience: config.sp_entity_id as string,
      idpCert,
      idpIssuer: (config.idp_issuer as string | undefined) || undefined,
      wantAssertionsSigned: config.want_assertions_signed !== false,
      wantAuthnResponseSigned: config.want_response_signed !== false,
      signatureAlgorithm: (config.signature_algorithm as 'sha1' | 'sha256' | 'sha512' | undefined) ?? 'sha256',
      identifierFormat: (config.identifier_format as string | undefined) ?? null,
      acceptedClockSkewMs: typeof config.clock_skew_ms === 'number' ? config.clock_skew_ms : 60_000,
      forceAuthn: config.force_authn === true,
      disableRequestedAuthnContext: config.disable_requested_authn_context !== false,
      privateKey: (config.sp_private_key as string | undefined) || undefined,
      publicCert: (config.sp_certificate as string[] | undefined)?.[0],
      validateInResponseTo: ValidateInResponseTo.always,
      requestIdExpirationPeriodMs: SCADENZA_RICHIESTA_MS,
      cacheProvider: this.cache,
    });
  }

  async getAuthorizeUrl(provider: AuthProviderAttributes): Promise<string> {
    return this.creaSaml(provider).getAuthorizeUrlAsync(provider.codice, undefined, {});
  }

  async validaRisposta(provider: AuthProviderAttributes, body: Record<string, string>): Promise<SamlUserClaims> {
    let profile: Profile | null;
    try {
      ({ profile } = await this.creaSaml(provider).validatePostResponseAsync(body));
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      const motivo = error instanceof Error ? error.message : String(error);
      log.warn(`[SamlService] Risposta SAML rifiutata per "${provider.codice}": ${motivo}`);
      throw new UnauthorizedError({
        message: `Risposta SAML non valida: ${motivo}`,
        details: { provider: provider.codice, errorCode: ErrorCodes.OIDC_CALLBACK_FAILED },
      });
    }
    if (!profile) {
      throw new UnauthorizedError({ message: 'Risposta SAML senza utente', details: { provider: provider.codice } });
    }

    const config = provider.config_server ?? {};
    const emailDaNameId = profile.nameID?.includes('@') ? profile.nameID : undefined;
    const email = primoAttributo(profile, config.attributo_email, ATTRIBUTI_EMAIL_PREDEFINITI) ?? emailDaNameId;
    const given_name = primoAttributo(profile, config.attributo_nome, ATTRIBUTI_NOME_PREDEFINITI);
    const family_name = primoAttributo(profile, config.attributo_cognome, ATTRIBUTI_COGNOME_PREDEFINITI);

    return {
      sub: profile.nameID,
      email: email?.toLowerCase(),
      given_name,
      family_name,
      name: [given_name, family_name].filter(Boolean).join(' ') || undefined,
      issuer: profile.issuer,
    };
  }

  generaMetadati(provider: AuthProviderAttributes): string {
    const config = provider.config_server ?? {};
    const certificati = (config.sp_certificate as string[] | undefined) ?? null;
    return this.creaSaml(provider).generateServiceProviderMetadata(null, certificati);
  }

  /** Legge dai metadati di un identity provider indirizzo di accesso, entityID e certificati di firma. */
  leggiMetadatiIdp(xml: string): MetadatiIdpSaml {
    const errori: string[] = [];
    const documento = new DOMParser({
      errorHandler: { error: (m: string) => errori.push(m), fatalError: (m: string) => errori.push(m) },
    }).parseFromString(xml, 'text/xml');
    const radice = documento?.documentElement;
    if (!radice || errori.length > 0) {
      throw new BadRequestError({ message: 'Metadati SAML non leggibili: XML non valido' });
    }

    const descrittore = radice.localName === 'EntityDescriptor'
      ? radice
      : radice.getElementsByTagNameNS(NS_METADATA, 'EntityDescriptor').item(0);
    const idp = descrittore?.getElementsByTagNameNS(NS_METADATA, 'IDPSSODescriptor').item(0);
    if (!descrittore || !idp) {
      throw new BadRequestError({ message: 'Metadati SAML senza IDPSSODescriptor: non sono i metadati di un identity provider' });
    }

    const servizi = Array.from({ length: idp.getElementsByTagNameNS(NS_METADATA, 'SingleSignOnService').length }, (_, i) =>
      idp.getElementsByTagNameNS(NS_METADATA, 'SingleSignOnService').item(i)!);
    const sso = servizi.find((s) => s.getAttribute('Binding') === BINDING_REDIRECT) ?? servizi[0];

    const certificati: string[] = [];
    const chiavi = idp.getElementsByTagNameNS(NS_METADATA, 'KeyDescriptor');
    for (let i = 0; i < chiavi.length; i++) {
      const chiave = chiavi.item(i)!;
      const uso = chiave.getAttribute('use');
      if (uso && uso !== 'signing') continue;
      const nodi = chiave.getElementsByTagNameNS(NS_DSIG, 'X509Certificate');
      for (let j = 0; j < nodi.length; j++) {
        const valore = nodi.item(j)?.textContent?.trim();
        if (!valore) continue;
        try {
          const pem = normalizzaCertificato(valore);
          if (!certificati.includes(pem)) certificati.push(pem);
        } catch {
          log.warn('[SamlService] Certificato non valido nei metadati IdP, ignorato');
        }
      }
    }

    if (!sso?.getAttribute('Location')) {
      throw new BadRequestError({ message: 'Metadati SAML senza SingleSignOnService' });
    }

    return {
      entry_point: sso.getAttribute('Location')!,
      idp_issuer: descrittore.getAttribute('entityID') || undefined,
      idp_certs: certificati,
    };
  }
}
