import { X509Certificate } from 'node:crypto';
import { TIPO_UTENTI } from '../../../../lib/enums';
import { BadRequestError } from '../../../../lib/errors';
import type { AuthProviderAdminDTO, AuthProviderInput, StatoSegretoProvider } from '../../../../lib/types';
import type { AuthProviderAttributes } from '../../models/auth_provider';
import { cifraSegreto, decifraSegreto, eSegretoCifrato } from '../../utils/segretiProvider';

/**
 * Schema delle opzioni dei metodi di accesso: quali campi esistono per ogni tipo,
 * quali sono obbligatori e quali sono segreti. I campi non elencati vengono scartati.
 */

export type TipoProvider = AuthProviderAttributes['tipo'];

type GenereCampo = 'testo' | 'url' | 'booleano' | 'intero' | 'lista' | 'certificati' | 'algoritmo';

interface DefinizioneCampo {
  genere: GenereCampo;
  obbligatorio?: boolean;
  segreto?: boolean;
}

type Schema = Record<string, DefinizioneCampo>;

/** Codice del metodo con email e password seminato all'installazione. */
export const CODICE_EMAIL_PASSWORD = 'email_password';

export const ALGORITMI_FIRMA_SAML = ['sha1', 'sha256', 'sha512'] as const;

const RESTRIZIONI: Schema = {
  domini_ammessi: { genere: 'lista' },
};

const SCHEMI_CLIENT: Record<TipoProvider, Schema> = {
  internal: {
    password_reset_url: { genere: 'url' },
  },
  oidc: {
    discovery_url: { genere: 'url' },
    authorize_url: { genere: 'url', obbligatorio: true },
    client_id: { genere: 'testo', obbligatorio: true },
    redirect_uri: { genere: 'url', obbligatorio: true },
    scope: { genere: 'testo' },
    password_reset_url: { genere: 'url' },
  },
  saml: {
    password_reset_url: { genere: 'url' },
  },
  custom: {
    redirect_uri: { genere: 'url', obbligatorio: true },
    password_reset_url: { genere: 'url' },
  },
};

const SCHEMI_SERVER: Record<TipoProvider, Schema> = {
  internal: {},
  oidc: {
    client_secret: { genere: 'testo', obbligatorio: true, segreto: true },
    token_url: { genere: 'url', obbligatorio: true },
    jwks_uri: { genere: 'url', obbligatorio: true },
    expected_issuer: { genere: 'testo' },
    ...RESTRIZIONI,
  },
  saml: {
    metadata_url: { genere: 'url' },
    entry_point: { genere: 'url', obbligatorio: true },
    sp_entity_id: { genere: 'testo', obbligatorio: true },
    callback_url: { genere: 'url', obbligatorio: true },
    idp_certs: { genere: 'certificati', obbligatorio: true },
    idp_issuer: { genere: 'testo' },
    want_assertions_signed: { genere: 'booleano' },
    want_response_signed: { genere: 'booleano' },
    signature_algorithm: { genere: 'algoritmo' },
    identifier_format: { genere: 'testo' },
    attributo_email: { genere: 'testo' },
    attributo_nome: { genere: 'testo' },
    attributo_cognome: { genere: 'testo' },
    clock_skew_ms: { genere: 'intero' },
    force_authn: { genere: 'booleano' },
    disable_requested_authn_context: { genere: 'booleano' },
    sp_private_key: { genere: 'testo', segreto: true },
    sp_certificate: { genere: 'certificati' },
    ...RESTRIZIONI,
  },
  custom: {},
};

const TIPI: TipoProvider[] = ['internal', 'oidc', 'saml', 'custom'];
const TIPI_UTENTE = Object.values(TIPO_UTENTI) as string[];
const CODICE_VALIDO = /^[a-z0-9_-]{2,50}$/;
const DOMINIO_VALIDO = /^(?=.{1,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/;
const CLOCK_SKEW_MASSIMO_MS = 10 * 60 * 1000;

export function campiSegreti(tipo: TipoProvider): string[] {
  return Object.entries(SCHEMI_SERVER[tipo] ?? {})
    .filter(([, def]) => def.segreto)
    .map(([nome]) => nome);
}

function eUrl(valore: string): boolean {
  try {
    const url = new URL(valore);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Porta un certificato X.509 in PEM, accettando anche il solo base64 dei metadati SAML. */
export function normalizzaCertificato(valore: string): string {
  const corpo = valore
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\s+/g, '');
  const righe = corpo.match(/.{1,64}/g) ?? [];
  const pem = `-----BEGIN CERTIFICATE-----\n${righe.join('\n')}\n-----END CERTIFICATE-----`;
  new X509Certificate(pem); // lancia se non e' un certificato
  return pem;
}

function normalizzaCampo(
  nome: string,
  def: DefinizioneCampo,
  valore: unknown,
  errori: string[],
): unknown {
  if (valore === undefined || valore === null || valore === '') return undefined;

  switch (def.genere) {
    case 'testo':
      if (typeof valore !== 'string') { errori.push(`${nome}: deve essere un testo`); return undefined; }
      return valore.trim() || undefined;
    case 'url':
      if (typeof valore !== 'string' || !eUrl(valore.trim())) { errori.push(`${nome}: indirizzo http(s) non valido`); return undefined; }
      return valore.trim();
    case 'booleano':
      if (typeof valore !== 'boolean') { errori.push(`${nome}: deve essere vero o falso`); return undefined; }
      return valore;
    case 'intero': {
      const numero = typeof valore === 'string' ? Number(valore) : valore;
      if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 0 || numero > CLOCK_SKEW_MASSIMO_MS) {
        errori.push(`${nome}: deve essere un intero fra 0 e ${CLOCK_SKEW_MASSIMO_MS}`);
        return undefined;
      }
      return numero;
    }
    case 'algoritmo':
      if (!(ALGORITMI_FIRMA_SAML as readonly unknown[]).includes(valore)) {
        errori.push(`${nome}: valori ammessi ${ALGORITMI_FIRMA_SAML.join(', ')}`);
        return undefined;
      }
      return valore;
    case 'lista': {
      const voci = Array.isArray(valore) ? valore : String(valore).split(/[\s,;]+/);
      const domini = voci.map((v) => String(v).trim().toLowerCase().replace(/^@/, '')).filter(Boolean);
      const nonValidi = domini.filter((d) => !DOMINIO_VALIDO.test(d));
      if (nonValidi.length > 0) errori.push(`${nome}: domini non validi ${nonValidi.join(', ')}`);
      return domini.length > 0 ? Array.from(new Set(domini)) : undefined;
    }
    case 'certificati': {
      const voci = Array.isArray(valore) ? valore : [valore];
      const pem: string[] = [];
      voci.forEach((v, i) => {
        if (typeof v !== 'string' || !v.trim()) return;
        try {
          pem.push(normalizzaCertificato(v));
        } catch {
          errori.push(`${nome}: il certificato ${i + 1} non e' un certificato X.509 valido`);
        }
      });
      return pem.length > 0 ? pem : undefined;
    }
  }
}

function normalizzaConfig(
  schema: Schema,
  valori: Record<string, unknown> | null | undefined,
  errori: string[],
  saltaSegreti: boolean,
): Record<string, unknown> {
  const risultato: Record<string, unknown> = {};
  for (const [nome, def] of Object.entries(schema)) {
    if (saltaSegreti && def.segreto) continue;
    const valore = normalizzaCampo(nome, def, valori?.[nome], errori);
    if (valore !== undefined) risultato[nome] = valore;
  }
  return risultato;
}

/**
 * Unisce i segreti: un valore nuovo viene cifrato, un valore assente o vuoto lascia
 * quello salvato, un segreto in `daRimuovere` viene tolto.
 */
function unisciSegreti(
  tipo: TipoProvider,
  esistente: Record<string, unknown> | null | undefined,
  inArrivo: Record<string, unknown> | null | undefined,
  daRimuovere: string[],
  errori: string[],
): Record<string, string> {
  const segreti: Record<string, string> = {};
  for (const nome of campiSegreti(tipo)) {
    const nuovo = inArrivo?.[nome];
    if (nuovo !== undefined && nuovo !== null && nuovo !== '') {
      if (typeof nuovo !== 'string') { errori.push(`${nome}: deve essere un testo`); continue; }
      segreti[nome] = cifraSegreto(nuovo.trim());
      continue;
    }
    if (daRimuovere.includes(nome)) continue;
    const salvato = esistente?.[nome];
    if (typeof salvato === 'string' && salvato) segreti[nome] = salvato;
  }
  return segreti;
}

function verificaObbligatori(schema: Schema, valori: Record<string, unknown>, sezione: string, errori: string[]): void {
  for (const [nome, def] of Object.entries(schema)) {
    if (def.obbligatorio && valori[nome] === undefined) errori.push(`${sezione}.${nome}: obbligatorio`);
  }
}

export interface ProviderNormalizzato {
  codice: string;
  nome: string;
  descrizione: string | null;
  icona: string;
  tipo: TipoProvider;
  ordine: number;
  attivo: boolean;
  config_client: Record<string, unknown> | null;
  config_server: Record<string, unknown> | null;
  ruoli_ammessi: string[] | null;
}

/**
 * Valida e normalizza i dati di un metodo di accesso. Con `esistente` e' una modifica:
 * i campi non inviati restano quelli salvati, i segreti non reinviati restano invariati.
 * Lancia BadRequestError con l'elenco completo dei problemi.
 */
export function preparaProvider(
  input: AuthProviderInput,
  esistente?: AuthProviderAttributes | null,
): ProviderNormalizzato {
  const errori: string[] = [];

  const tipo = (input.tipo ?? esistente?.tipo) as TipoProvider;
  if (!TIPI.includes(tipo)) errori.push(`tipo: valori ammessi ${TIPI.join(', ')}`);

  const codice = (esistente?.codice ?? String(input.codice ?? '').trim()).toLowerCase();
  if (esistente) {
    if (input.codice !== undefined && input.codice !== esistente.codice) errori.push('codice: non modificabile dopo la creazione');
    if (input.tipo !== undefined && input.tipo !== esistente.tipo) errori.push('tipo: non modificabile dopo la creazione');
  } else {
    if (!CODICE_VALIDO.test(codice)) errori.push('codice: da 2 a 50 caratteri fra minuscole, cifre, "_" e "-"');
    if (tipo === 'internal') errori.push('tipo: il metodo interno con email e password esiste gia\' e non se ne creano altri');
  }

  const nome = String(input.nome ?? esistente?.nome ?? '').trim();
  if (!nome) errori.push('nome: obbligatorio');
  if (nome.length > 100) errori.push('nome: al massimo 100 caratteri');

  const descrizioneGrezza = input.descrizione !== undefined ? input.descrizione : esistente?.descrizione ?? null;
  const descrizione = descrizioneGrezza ? String(descrizioneGrezza).trim() || null : null;
  const icona = String(input.icona ?? esistente?.icona ?? 'Key').trim() || 'Key';

  const ordineGrezzo = input.ordine ?? esistente?.ordine ?? 0;
  const ordine = Number(ordineGrezzo);
  if (!Number.isInteger(ordine) || ordine < 0) errori.push('ordine: deve essere un intero non negativo');

  const attivo = input.attivo ?? esistente?.attivo ?? true;
  if (typeof attivo !== 'boolean') errori.push('attivo: deve essere vero o falso');

  const ruoliGrezzi = input.ruoli_ammessi !== undefined ? input.ruoli_ammessi : esistente?.ruoli_ammessi ?? null;
  let ruoli_ammessi: string[] | null = null;
  if (ruoliGrezzi !== null) {
    if (!Array.isArray(ruoliGrezzi)) {
      errori.push('ruoli_ammessi: deve essere un elenco di tipi utente');
    } else {
      const sconosciuti = ruoliGrezzi.filter((r) => !TIPI_UTENTE.includes(r));
      if (sconosciuti.length > 0) errori.push(`ruoli_ammessi: tipi utente sconosciuti ${sconosciuti.join(', ')}`);
      ruoli_ammessi = ruoliGrezzi.length > 0 ? Array.from(new Set(ruoliGrezzi)) : null;
    }
  }

  let config_client: Record<string, unknown> | null = null;
  let config_server: Record<string, unknown> | null = null;
  if (TIPI.includes(tipo)) {
    const clientGrezzo = input.config_client !== undefined ? input.config_client : esistente?.config_client;
    const serverGrezzo = input.config_server !== undefined ? input.config_server : esistente?.config_server;
    const client = normalizzaConfig(SCHEMI_CLIENT[tipo], clientGrezzo, errori, false);
    const server = {
      ...normalizzaConfig(SCHEMI_SERVER[tipo], serverGrezzo, errori, true),
      ...unisciSegreti(tipo, esistente?.config_server, input.config_server, input.segreti_da_rimuovere ?? [], errori),
    };
    verificaObbligatori(SCHEMI_CLIENT[tipo], client, 'config_client', errori);
    verificaObbligatori(SCHEMI_SERVER[tipo], server, 'config_server', errori);
    if (tipo === 'saml' && server.sp_certificate && !server.sp_private_key) {
      errori.push('config_server.sp_private_key: obbligatoria quando e\' indicato il certificato del service provider');
    }
    config_client = Object.keys(client).length > 0 ? client : null;
    config_server = Object.keys(server).length > 0 ? server : null;
  }

  if (errori.length > 0) {
    throw new BadRequestError({
      message: `Configurazione del metodo di accesso non valida: ${errori.join('; ')}`,
      details: { errori },
    });
  }

  return { codice, nome, descrizione, icona, tipo, ordine, attivo: attivo as boolean, config_client, config_server, ruoli_ammessi };
}

export function statoSegreti(tipo: TipoProvider, configServer: Record<string, unknown> | null): Record<string, StatoSegretoProvider> {
  const stato: Record<string, StatoSegretoProvider> = {};
  for (const nome of campiSegreti(tipo)) {
    const valore = configServer?.[nome];
    stato[nome] = typeof valore !== 'string' || !valore ? 'assente' : eSegretoCifrato(valore) ? 'cifrato' : 'in_chiaro';
  }
  return stato;
}

/** Vista per la gestione: config_server senza segreti, al loro posto lo stato. */
export function toAdminDTO(provider: AuthProviderAttributes): AuthProviderAdminDTO {
  const segreti = campiSegreti(provider.tipo);
  const configServer = Object.fromEntries(
    Object.entries(provider.config_server ?? {}).filter(([nome]) => !segreti.includes(nome)),
  );
  return {
    id: provider.id,
    codice: provider.codice,
    nome: provider.nome,
    descrizione: provider.descrizione,
    icona: provider.icona,
    tipo: provider.tipo,
    ordine: provider.ordine,
    attivo: provider.attivo,
    config_client: provider.config_client ?? {},
    config_server: configServer,
    ruoli_ammessi: provider.ruoli_ammessi,
    segreti: statoSegreti(provider.tipo, provider.config_server),
    updatedAt: provider.updatedAt ? new Date(provider.updatedAt).toISOString() : undefined,
  };
}

/** config_server con i segreti in chiaro, solo per l'uso lato server (scambio token, firma SAML). */
export function configServerInChiaro(provider: Pick<AuthProviderAttributes, 'tipo' | 'config_server'>): Record<string, unknown> {
  const config = { ...(provider.config_server ?? {}) };
  for (const nome of campiSegreti(provider.tipo)) {
    const valore = config[nome];
    if (typeof valore === 'string' && valore) config[nome] = decifraSegreto(valore);
  }
  return config;
}

/**
 * Restrizioni del metodo di accesso sull'utente riconosciuto dal fornitore esterno.
 * Restituisce il motivo del rifiuto, oppure null se l'utente puo' entrare.
 */
export function motivoRifiutoAccesso(
  provider: Pick<AuthProviderAttributes, 'config_server' | 'ruoli_ammessi'>,
  email: string,
  tipoUtente: string | undefined,
): string | null {
  const domini = provider.config_server?.domini_ammessi;
  if (Array.isArray(domini) && domini.length > 0) {
    const dominio = email.split('@').pop()?.toLowerCase() ?? '';
    if (!domini.includes(dominio)) return `Il dominio email ${dominio || '(assente)'} non e' ammesso per questo metodo di accesso`;
  }
  const ruoli = provider.ruoli_ammessi;
  if (Array.isArray(ruoli) && ruoli.length > 0 && (!tipoUtente || !ruoli.includes(tipoUtente))) {
    return `Il tipo utente ${tipoUtente ?? '(assente)'} non e' ammesso per questo metodo di accesso`;
  }
  return null;
}
