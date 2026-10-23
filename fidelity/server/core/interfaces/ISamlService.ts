import type { AuthProviderAttributes } from '../models/auth_provider';

/** Utente riconosciuto da una risposta SAML, nella forma dei claims OIDC usata da AgenziaLib. */
export interface SamlUserClaims {
  sub: string;
  email?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  issuer?: string;
}

export interface MetadatiIdpSaml {
  entry_point: string;
  idp_issuer?: string;
  idp_certs: string[];
}

export interface ISamlService {
  /** URL dell'identity provider con la AuthnRequest; registra la richiesta in attesa di risposta. */
  getAuthorizeUrl(provider: AuthProviderAttributes): Promise<string>;
  /** Verifica firma, destinatario, scadenza e InResponseTo della risposta POST dell'IdP. */
  validaRisposta(provider: AuthProviderAttributes, body: Record<string, string>): Promise<SamlUserClaims>;
  /** Metadati del service provider da registrare presso l'identity provider. */
  generaMetadati(provider: AuthProviderAttributes): string;
  /** Estrae entry point, entityID e certificati dai metadati XML di un identity provider. */
  leggiMetadatiIdp(xml: string): MetadatiIdpSaml;
}
