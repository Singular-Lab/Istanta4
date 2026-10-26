import { inflateRawSync } from 'node:zlib';
import { SignedXml } from 'xml-crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { creaCertificatoProva } from '../../../__tests__/certificatoProva';
import type { AuthProviderAttributes } from '../../models/auth_provider';
import { preparaProvider } from '../authProviders/configurazioneProvider';
import { SamlService } from '../SamlService';

const IDP = creaCertificatoProva('idp-di-prova');
const ALTRO_IDP = creaCertificatoProva('idp-estraneo');
const SP_ENTITY = 'https://fidelity.example.test/api/auth/saml/metadata/adfs';
const ACS = 'https://fidelity.example.test/api/auth/saml/acs/adfs';
const IDP_ENTITY = 'https://idp.example.test/adfs';

function providerSaml(extra: Record<string, unknown> = {}): AuthProviderAttributes {
  const dati = preparaProvider({
    codice: 'adfs',
    nome: 'ADFS',
    tipo: 'saml',
    attivo: true,
    config_server: {
      entry_point: 'https://idp.example.test/adfs/ls',
      sp_entity_id: SP_ENTITY,
      callback_url: ACS,
      idp_certs: [IDP.certificato],
      idp_issuer: IDP_ENTITY,
      ...extra,
    },
  });
  return { ...dati, id: 'p-saml', createdAt: new Date(), updatedAt: new Date() };
}

/** ID della AuthnRequest contenuta nell'URL di redirect verso l'IdP. */
function idRichiesta(url: string): string {
  const richiesta = inflateRawSync(Buffer.from(new URL(url).searchParams.get('SAMLRequest')!, 'base64')).toString('utf8');
  return /ID="([^"]+)"/.exec(richiesta)![1];
}

function firma(xml: string, chiave: string, elemento: 'Assertion' | 'Response'): string {
  const sig = new SignedXml({
    privateKey: chiave,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: 'http://www.w3.org/2001/10/xml-exc-c14n#',
  });
  sig.addReference({
    xpath: `//*[local-name(.)='${elemento}']`,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/2001/10/xml-exc-c14n#'],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
  });
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${elemento}']/*[local-name(.)='Issuer']`, action: 'after' },
  });
  return sig.getSignedXml();
}

function rispostaFirmata(opzioni: { inResponseTo: string; email?: string; chiave?: string; scadenzaMs?: number }) {
  const adesso = Date.now();
  const iso = (ms: number) => new Date(adesso + ms).toISOString();
  const scadenza = opzioni.scadenzaMs ?? 5 * 60_000;
  const xml =
    `<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ` +
    `ID="_r${adesso}" Version="2.0" IssueInstant="${iso(0)}" Destination="${ACS}" InResponseTo="${opzioni.inResponseTo}">` +
    `<saml:Issuer>${IDP_ENTITY}</saml:Issuer>` +
    `<samlp:Status><samlp:StatusCode Value="urn:oasis:names:tc:SAML:2.0:status:Success"/></samlp:Status>` +
    `<saml:Assertion ID="_a${adesso}" Version="2.0" IssueInstant="${iso(0)}">` +
    `<saml:Issuer>${IDP_ENTITY}</saml:Issuer>` +
    `<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">utente-42</saml:NameID>` +
    `<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">` +
    `<saml:SubjectConfirmationData InResponseTo="${opzioni.inResponseTo}" NotOnOrAfter="${iso(scadenza)}" Recipient="${ACS}"/>` +
    `</saml:SubjectConfirmation></saml:Subject>` +
    `<saml:Conditions NotBefore="${iso(-60_000)}" NotOnOrAfter="${iso(scadenza)}">` +
    `<saml:AudienceRestriction><saml:Audience>${SP_ENTITY}</saml:Audience></saml:AudienceRestriction></saml:Conditions>` +
    `<saml:AuthnStatement AuthnInstant="${iso(0)}" SessionIndex="_s1"><saml:AuthnContext>` +
    `<saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>` +
    `</saml:AuthnContext></saml:AuthnStatement>` +
    `<saml:AttributeStatement>` +
    `<saml:Attribute Name="email"><saml:AttributeValue>${opzioni.email ?? 'Mario.Rossi@Esempio.it'}</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="givenName"><saml:AttributeValue>Mario</saml:AttributeValue></saml:Attribute>` +
    `<saml:Attribute Name="sn"><saml:AttributeValue>Rossi</saml:AttributeValue></saml:Attribute>` +
    `</saml:AttributeStatement></saml:Assertion></samlp:Response>`;
  const chiave = opzioni.chiave ?? IDP.chiavePrivata;
  const firmata = firma(firma(xml, chiave, 'Assertion'), chiave, 'Response');
  return { SAMLResponse: Buffer.from(firmata, 'utf8').toString('base64') };
}

describe('SamlService', () => {
  it('avvia l\'accesso verso l\'indirizzo SSO dell\'IdP con una AuthnRequest', async () => {
    const url = await new SamlService().getAuthorizeUrl(providerSaml());

    expect(url.startsWith('https://idp.example.test/adfs/ls?')).toBe(true);
    expect(new URL(url).searchParams.get('RelayState')).toBe('adfs');
    expect(idRichiesta(url)).toMatch(/^_/);
  });

  it('riconosce l\'utente da una risposta firmata dall\'IdP configurato', async () => {
    const service = new SamlService();
    const provider = providerSaml();
    const richiesta = idRichiesta(await service.getAuthorizeUrl(provider));

    const claims = await service.validaRisposta(provider, rispostaFirmata({ inResponseTo: richiesta }));

    expect(claims).toMatchObject({
      sub: 'utente-42',
      email: 'mario.rossi@esempio.it',
      given_name: 'Mario',
      family_name: 'Rossi',
      name: 'Mario Rossi',
      issuer: IDP_ENTITY,
    });
  });

  it('legge l\'email dall\'attributo configurato', async () => {
    const service = new SamlService();
    const provider = providerSaml({ attributo_email: 'sn' });
    const richiesta = idRichiesta(await service.getAuthorizeUrl(provider));

    const claims = await service.validaRisposta(provider, rispostaFirmata({ inResponseTo: richiesta }));

    expect(claims.email).toBe('rossi');
  });

  it('rifiuta una risposta firmata con un certificato diverso', async () => {
    const service = new SamlService();
    const provider = providerSaml();
    const richiesta = idRichiesta(await service.getAuthorizeUrl(provider));

    await expect(service.validaRisposta(provider, rispostaFirmata({ inResponseTo: richiesta, chiave: ALTRO_IDP.chiavePrivata })))
      .rejects.toThrow(/Risposta SAML non valida/);
  });

  it('rifiuta una risposta che non corrisponde a una richiesta di Fidelity', async () => {
    await expect(new SamlService().validaRisposta(providerSaml(), rispostaFirmata({ inResponseTo: '_mai_richiesta' })))
      .rejects.toThrow(/Risposta SAML non valida/);
  });

  it('rifiuta la stessa risposta usata una seconda volta', async () => {
    const service = new SamlService();
    const provider = providerSaml();
    const richiesta = idRichiesta(await service.getAuthorizeUrl(provider));
    const risposta = rispostaFirmata({ inResponseTo: richiesta });

    await service.validaRisposta(provider, risposta);

    await expect(service.validaRisposta(provider, risposta)).rejects.toThrow(/Risposta SAML non valida/);
  });

  it('rifiuta un\'asserzione scaduta', async () => {
    const service = new SamlService();
    const provider = providerSaml({ clock_skew_ms: 0 });
    const richiesta = idRichiesta(await service.getAuthorizeUrl(provider));

    await expect(service.validaRisposta(provider, rispostaFirmata({ inResponseTo: richiesta, scadenzaMs: -30_000 })))
      .rejects.toThrow(/Risposta SAML non valida/);
  });

  it('genera i metadati del service provider con entityID e indirizzo di ritorno', () => {
    const xml = new SamlService().generaMetadati(providerSaml());

    expect(xml).toContain(`entityID="${SP_ENTITY}"`);
    expect(xml).toContain(`Location="${ACS}"`);
  });

  it('legge indirizzo SSO, entityID e certificato dai metadati dell\'IdP', () => {
    const corpo = IDP.certificato.replace(/-----[A-Z ]+-----|\s/g, '');
    const metadati =
      `<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" entityID="${IDP_ENTITY}">` +
      `<md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">` +
      `<md:KeyDescriptor use="encryption"><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${ALTRO_IDP.certificato.replace(/-----[A-Z ]+-----|\s/g, '')}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>` +
      `<md:KeyDescriptor use="signing"><ds:KeyInfo><ds:X509Data><ds:X509Certificate>${corpo}</ds:X509Certificate></ds:X509Data></ds:KeyInfo></md:KeyDescriptor>` +
      `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="https://idp.example.test/post"/>` +
      `<md:SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.test/redirect"/>` +
      `</md:IDPSSODescriptor></md:EntityDescriptor>`;

    const esito = new SamlService().leggiMetadatiIdp(metadati);

    expect(esito.entry_point).toBe('https://idp.example.test/redirect');
    expect(esito.idp_issuer).toBe(IDP_ENTITY);
    expect(esito.idp_certs).toHaveLength(1);
    expect(esito.idp_certs[0].replace(/-----[A-Z ]+-----|\s/g, '')).toBe(corpo);
  });

  it('rifiuta metadati che non sono di un identity provider', () => {
    expect(() => new SamlService().leggiMetadatiIdp('<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="x"/>'))
      .toThrow(/IDPSSODescriptor/);
  });
});
