import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { chiamaHttp, destinazioneDi, type OpzioniHttp } from './clienteHttp';

/**
 * Controlli sugli indirizzi che gli utenti configurano e che il server poi contatta
 * (webhook, discovery OIDC, metadati SAML, JWKS): senza, un URL potrebbe far leggere al
 * server se stesso o i metadati del cloud (SSRF).
 *
 * Sono vietati loopback, link-local (metadati cloud compresi) e l'indirizzo non
 * specificato, anche nelle forme IPv6 che incorporano un IPv4. Le reti private
 * (10/8, 172.16/12, 192.168/16, fc00::/7) restano ammesse: nelle installazioni on-premise
 * webhook e provider possono stare sulla rete interna.
 */

export type MotivoIndirizzoNonSicuro = 'protocollo' | 'dns' | 'vietato' | 'redirect';

export class IndirizzoNonSicuroError extends Error {
  constructor(
    /** "dns" e' un errore temporaneo (host non risolto), gli altri dipendono dall'indirizzo. */
    readonly motivo: MotivoIndirizzoNonSicuro,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'IndirizzoNonSicuroError';
  }
}

export class CorpoTroppoGrandeError extends Error {
  constructor(readonly maxByte: number) {
    super(`Risposta oltre ${maxByte} byte`);
    this.name = 'CorpoTroppoGrandeError';
  }
}

export const MASSIMO_REDIRECT = 5;
const STATI_REDIRECT = new Set([301, 302, 303, 307, 308]);

const ipv4ComeNumero = (ip: string): number =>
  ip.split('.').reduce((totale, parte) => totale * 256 + Number(parte), 0);

const reteIpv4 = (base: string, bit: number) => ({ base: ipv4ComeNumero(base), dimensione: 2 ** (32 - bit) });

const RETI_IPV4_VIETATE = [
  // 0.0.0.0/8: su Linux 0.x raggiunge l'host stesso
  { ...reteIpv4('0.0.0.0', 8), motivo: 'indirizzo non specificato' },
  { ...reteIpv4('127.0.0.0', 8), motivo: 'loopback' },
  // Comprende 169.254.169.254, i metadati di AWS, Azure e GCP
  { ...reteIpv4('169.254.0.0', 16), motivo: 'link-local o metadati cloud' },
];

function motivoIpv4Vietato(ip: number): string | null {
  const rete = RETI_IPV4_VIETATE.find(r => ip >= r.base && ip < r.base + r.dimensione);
  return rete?.motivo ?? null;
}

/** Gli 8 gruppi da 16 bit di un IPv6 valido; un IPv4 finale (::ffff:1.2.3.4) diventa due gruppi. */
function gruppiIpv6(ip: string): number[] | null {
  let testo = ip.toLowerCase();
  const ultimiDuePunti = testo.lastIndexOf(':');
  const coda = testo.slice(ultimiDuePunti + 1);
  if (coda.includes('.')) {
    if (isIP(coda) !== 4) return null;
    const n = ipv4ComeNumero(coda);
    testo = `${testo.slice(0, ultimiDuePunti + 1)}${Math.floor(n / 65536).toString(16)}:${(n % 65536).toString(16)}`;
  }
  const parti = testo.split('::');
  if (parti.length > 2) return null;
  const gruppi = (parte: string) => (parte ? parte.split(':') : []);
  const sinistra = gruppi(parti[0]);
  const destra = parti.length === 2 ? gruppi(parti[1]) : [];
  const mancanti = 8 - sinistra.length - destra.length;
  if (parti.length === 1 ? mancanti !== 0 : mancanti < 0) return null;
  const valori = [...sinistra, ...Array<string>(mancanti).fill('0'), ...destra].map(g => Number.parseInt(g, 16));
  return valori.every(v => Number.isInteger(v) && v >= 0 && v <= 0xffff) ? valori : null;
}

function motivoIpv6Vietato(g: number[]): string | null {
  const zeri = (da: number, a: number) => g.slice(da, a).every(v => v === 0);
  if (zeri(0, 8)) return 'indirizzo non specificato';
  if (zeri(0, 7) && g[7] === 1) return 'loopback';
  if ((g[0] & 0xffc0) === 0xfe80) return 'link-local';
  // Metadati AWS su IPv6: sta in fc00::/7, che per il resto resta ammessa
  if (g[0] === 0xfd00 && g[1] === 0x0ec2 && zeri(2, 7) && g[7] === 0x254) return 'metadati cloud';
  // IPv4 incorporato: mapped ::ffff:a.b.c.d, compatibile ::a.b.c.d, NAT64 64:ff9b::a.b.c.d
  const ipv4Incorporato = (zeri(0, 5) && (g[5] === 0xffff || g[5] === 0))
    || (g[0] === 0x64 && g[1] === 0xff9b && zeri(2, 6));
  return ipv4Incorporato ? motivoIpv4Vietato(g[6] * 65536 + g[7]) : null;
}

/** Perche' il server non deve contattare questo IP, oppure null se e' ammesso. */
export function motivoIpVietato(ip: string): string | null {
  // Lo zone id (fe80::1%eth0) non cambia la rete
  const indirizzo = ip.split('%')[0];
  const versione = isIP(indirizzo);
  if (versione === 4) return motivoIpv4Vietato(ipv4ComeNumero(indirizzo));
  const gruppi = versione === 6 ? gruppiIpv6(indirizzo) : null;
  return gruppi ? motivoIpv6Vietato(gruppi) : 'indirizzo non valido';
}

async function risolvi(host: string): Promise<string[]> {
  let indirizzi: string[] = [];
  try {
    indirizzi = (await lookup(host, { all: true })).map(r => r.address);
  } catch (error) {
    throw new IndirizzoNonSicuroError('dns', `${host} non risolvibile`, { cause: error });
  }
  if (indirizzi.length === 0) throw new IndirizzoNonSicuroError('dns', `${host} non risolvibile`);
  return indirizzi;
}

/**
 * Controlla un URL prima di contattarlo: solo http(s) e nessun indirizzo risolto in una rete
 * vietata. Vanno controllati tutti gli indirizzi del nome: basta un record A verso 127.0.0.1.
 *
 * ponytail: il controllo precede la connessione, che risolve il nome di nuovo. Un DNS che
 * cambia risposta fra le due (rebinding) passa: per chiuderlo serve un dispatcher undici con
 * connect.lookup che rivaluti l'IP, se il rischio lo giustifica.
 */
export async function verificaUrlSicuro(indirizzo: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(indirizzo);
  } catch {
    throw new IndirizzoNonSicuroError('protocollo', 'Indirizzo non valido');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new IndirizzoNonSicuroError('protocollo', 'Sono ammessi solo indirizzi http o https');
  }
  // Gli IPv6 letterali arrivano tra parentesi quadre ([::1])
  const host = url.hostname.replace(/^\[(.*)\]$/, '$1');
  const indirizzi = isIP(host) ? [host] : await risolvi(host);
  for (const ip of indirizzi) {
    const motivo = motivoIpVietato(ip);
    if (motivo) throw new IndirizzoNonSicuroError('vietato', `${url.host} punta a un indirizzo non ammesso (${motivo})`);
  }
  return url;
}

/**
 * Lettura (GET) di un URL configurato da un utente: controlla l'indirizzo e segue a mano
 * fino a MASSIMO_REDIRECT redirect, ricontrollando ogni Location, perche' un redirect
 * automatico potrebbe portare verso la rete interna dopo il primo controllo.
 */
export async function chiamaUrlSicuro(indirizzo: string, opzioni: OpzioniHttp = {}): Promise<Response> {
  let url = (await verificaUrlSicuro(indirizzo)).toString();
  for (let salto = 0; ; salto++) {
    const risposta = await chiamaHttp(url, { ...opzioni, redirect: 'manual' });
    const location = risposta.headers.get('location');
    if (!STATI_REDIRECT.has(risposta.status) || !location) return risposta;
    await risposta.body?.cancel().catch(() => undefined);
    if (salto >= MASSIMO_REDIRECT) {
      throw new IndirizzoNonSicuroError('redirect', `Troppi redirect da ${destinazioneDi(indirizzo)}`);
    }
    try {
      url = (await verificaUrlSicuro(new URL(location, url).toString())).toString();
    } catch (error) {
      if (!(error instanceof IndirizzoNonSicuroError)) throw error;
      throw new IndirizzoNonSicuroError(error.motivo === 'dns' ? 'dns' : 'redirect', `Redirect non seguito: ${error.message}`, { cause: error });
    }
  }
}

/**
 * Corpo della risposta come testo, fermando lo scaricamento oltre maxByte: un server
 * remoto non puo' far riempire la memoria. Con tronca restituisce i primi maxByte invece
 * di lanciare CorpoTroppoGrandeError.
 */
export async function leggiCorpoLimitato(risposta: Response, maxByte: number, { tronca = false } = {}): Promise<string> {
  const dichiarata = Number(risposta.headers.get('content-length'));
  if (!tronca && Number.isFinite(dichiarata) && dichiarata > maxByte) {
    await risposta.body?.cancel().catch(() => undefined);
    throw new CorpoTroppoGrandeError(maxByte);
  }
  if (!risposta.body) return '';

  const lettore = risposta.body.getReader();
  const pezzi: Uint8Array[] = [];
  let letti = 0;
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      if (letti + value.byteLength > maxByte) {
        if (!tronca) throw new CorpoTroppoGrandeError(maxByte);
        pezzi.push(value.subarray(0, maxByte - letti));
        break;
      }
      pezzi.push(value);
      letti += value.byteLength;
    }
  } finally {
    // Il resto non serve: chiude il flusso invece di scaricarlo
    await lettore.cancel().catch(() => undefined);
  }
  return Buffer.concat(pezzi).toString('utf8');
}
