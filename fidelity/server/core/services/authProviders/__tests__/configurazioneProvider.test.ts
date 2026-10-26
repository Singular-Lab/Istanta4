import { describe, expect, it } from 'vitest';
import { creaCertificatoProva } from '../../../../__tests__/certificatoProva';
import type { AuthProviderAttributes } from '../../../models/auth_provider';
import { cifraSegreto, decifraSegreto, eSegretoCifrato } from '../../../utils/segretiProvider';
import {
  configServerInChiaro,
  motivoRifiutoAccesso,
  preparaProvider,
  statoSegreti,
  toAdminDTO,
} from '../configurazioneProvider';

const OIDC = {
  codice: 'entra_id',
  nome: 'Microsoft Entra ID',
  tipo: 'oidc' as const,
  config_client: {
    authorize_url: 'https://login.example.test/authorize',
    client_id: 'client-1',
    redirect_uri: 'https://fidelity.example.test/api/auth/oidc/callback',
  },
  config_server: {
    client_secret: 'segreto-oidc',
    token_url: 'https://login.example.test/token',
    jwks_uri: 'https://login.example.test/keys',
  },
};

function salvato(dati: ReturnType<typeof preparaProvider>): AuthProviderAttributes {
  return { ...dati, id: 'p1', createdAt: new Date(), updatedAt: new Date() };
}

describe('preparaProvider', () => {
  it('crea un fornitore OIDC con il segreto cifrato', () => {
    const dati = preparaProvider(OIDC);

    expect(dati.codice).toBe('entra_id');
    expect(eSegretoCifrato(dati.config_server?.client_secret)).toBe(true);
    expect(decifraSegreto(dati.config_server?.client_secret as string)).toBe('segreto-oidc');
  });

  it('elenca tutti i campi obbligatori mancanti', () => {
    expect(() => preparaProvider({ codice: 'x1', nome: 'X', tipo: 'oidc' })).toThrow(
      /config_client\.authorize_url: obbligatorio.*config_server\.client_secret: obbligatorio/,
    );
  });

  it('rifiuta indirizzi non http(s), codici non validi e tipi utente sconosciuti', () => {
    let messaggio = '';
    try {
      preparaProvider({
        ...OIDC,
        codice: 'Entra ID',
        config_client: { ...OIDC.config_client, authorize_url: 'javascript:alert(1)' },
        ruoli_ammessi: ['AdminGDO'],
      });
    } catch (error) {
      messaggio = (error as Error).message;
    }

    expect(messaggio).toContain('codice: da 2 a 50 caratteri');
    expect(messaggio).toContain('authorize_url: indirizzo http(s) non valido');
    expect(messaggio).toContain('tipi utente sconosciuti AdminGDO');
  });

  it('scarta i campi che lo schema non prevede', () => {
    const dati = preparaProvider({ ...OIDC, config_client: { ...OIDC.config_client, extra: 'x' } });

    expect(dati.config_client).not.toHaveProperty('extra');
  });

  it('non permette di creare un secondo metodo interno', () => {
    expect(() => preparaProvider({ codice: 'altro', nome: 'Altro', tipo: 'internal' })).toThrow(/metodo interno/);
  });

  it('in modifica conserva il segreto non reinviato', () => {
    const esistente = salvato(preparaProvider(OIDC));
    const segretoPrima = esistente.config_server?.client_secret;

    const dati = preparaProvider({ nome: 'Entra', config_server: { ...OIDC.config_server, client_secret: '' } }, esistente);

    expect(dati.nome).toBe('Entra');
    expect(dati.config_server?.client_secret).toBe(segretoPrima);
  });

  it('in modifica sostituisce il segreto reinviato e non accetta cambi di codice o tipo', () => {
    const esistente = salvato(preparaProvider(OIDC));

    const dati = preparaProvider({ config_server: { ...OIDC.config_server, client_secret: 'nuovo' } }, esistente);
    expect(decifraSegreto(dati.config_server?.client_secret as string)).toBe('nuovo');

    expect(() => preparaProvider({ codice: 'altro', tipo: 'saml' }, esistente)).toThrow(/codice: non modificabile.*tipo: non modificabile/);
  });

  it('rimuove un segreto facoltativo solo se richiesto', () => {
    const { certificato, chiavePrivata } = creaCertificatoProva();
    const saml = preparaProvider({
      codice: 'adfs',
      nome: 'ADFS',
      tipo: 'saml',
      config_server: {
        entry_point: 'https://idp.example.test/sso',
        sp_entity_id: 'https://fidelity.example.test/sp',
        callback_url: 'https://fidelity.example.test/api/auth/saml/acs/adfs',
        idp_certs: [certificato],
        sp_private_key: chiavePrivata,
      },
    });
    const esistente = salvato(saml);

    expect(preparaProvider({}, esistente).config_server?.sp_private_key).toBe(saml.config_server?.sp_private_key);
    expect(preparaProvider({ segreti_da_rimuovere: ['sp_private_key'] }, esistente).config_server).not.toHaveProperty('sp_private_key');
  });

  it('normalizza domini e certificati SAML e rifiuta un certificato non valido', () => {
    const { certificato } = creaCertificatoProva();
    const corpo = certificato.replace(/-----[A-Z ]+-----|\s/g, '');
    const base = {
      codice: 'shib',
      nome: 'Shibboleth',
      tipo: 'saml' as const,
      config_server: {
        entry_point: 'https://idp.example.test/sso',
        sp_entity_id: 'sp',
        callback_url: 'https://fidelity.example.test/api/auth/saml/acs/shib',
        idp_certs: [corpo],
        domini_ammessi: '@Esempio.it, esempio.it; gruppo.esempio.it',
      },
    };

    const dati = preparaProvider(base);
    expect(dati.config_server?.idp_certs).toEqual([expect.stringContaining('-----BEGIN CERTIFICATE-----')]);
    expect(dati.config_server?.domini_ammessi).toEqual(['esempio.it', 'gruppo.esempio.it']);

    expect(() => preparaProvider({ ...base, config_server: { ...base.config_server, idp_certs: ['non-un-certificato'] } }))
      .toThrow(/certificato 1 non e' un certificato X\.509 valido/);
  });
});

describe('vista per la gestione e lettura lato server', () => {
  it('non espone i segreti, solo il loro stato', () => {
    const provider = salvato(preparaProvider(OIDC));

    const dto = toAdminDTO(provider);

    expect(dto.config_server).not.toHaveProperty('client_secret');
    expect(JSON.stringify(dto)).not.toContain('segreto-oidc');
    expect(dto.segreti).toEqual({ client_secret: 'cifrato' });
    expect(dto.config_server.token_url).toBe(OIDC.config_server.token_url);
  });

  it('distingue segreti cifrati, in chiaro e assenti', () => {
    expect(statoSegreti('oidc', { client_secret: 'in-chiaro' })).toEqual({ client_secret: 'in_chiaro' });
    expect(statoSegreti('oidc', { client_secret: cifraSegreto('x') })).toEqual({ client_secret: 'cifrato' });
    expect(statoSegreti('oidc', null)).toEqual({ client_secret: 'assente' });
  });

  it('restituisce al server i segreti in chiaro, cifrati o no', () => {
    expect(configServerInChiaro({ tipo: 'oidc', config_server: { client_secret: cifraSegreto('a') } }).client_secret).toBe('a');
    expect(configServerInChiaro({ tipo: 'oidc', config_server: { client_secret: 'b' } }).client_secret).toBe('b');
  });
});

describe('motivoRifiutoAccesso', () => {
  const provider = { config_server: { domini_ammessi: ['esempio.it'] }, ruoli_ammessi: ['GDO', 'Marketing'] };

  it('ammette un utente del dominio e del tipo previsti', () => {
    expect(motivoRifiutoAccesso(provider, 'mario@Esempio.it', 'GDO')).toBeNull();
  });

  it('rifiuta un dominio non ammesso', () => {
    expect(motivoRifiutoAccesso(provider, 'mario@altro.it', 'GDO')).toMatch(/dominio email altro\.it/);
  });

  it('rifiuta un tipo utente non ammesso', () => {
    expect(motivoRifiutoAccesso(provider, 'mario@esempio.it', 'Agenzia')).toMatch(/tipo utente Agenzia/);
  });

  it('senza restrizioni ammette chiunque', () => {
    expect(motivoRifiutoAccesso({ config_server: null, ruoli_ammessi: null }, 'chiunque@ovunque.it', 'Guest')).toBeNull();
  });
});
