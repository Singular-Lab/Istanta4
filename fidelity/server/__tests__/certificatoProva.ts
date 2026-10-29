import { generateKeyPairSync, sign, X509Certificate } from 'node:crypto';

/**
 * Certificato X.509 autofirmato generato al volo per i test (SAML): nessuna chiave
 * privata nel repository e nessuno strumento esterno come openssl.
 */

function lunghezza(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const byte: number[] = [];
  for (let v = n; v > 0; v >>= 8) byte.unshift(v & 0xff);
  return Buffer.from([0x80 | byte.length, ...byte]);
}

const tlv = (tag: number, contenuto: Buffer) => Buffer.concat([Buffer.from([tag]), lunghezza(contenuto.length), contenuto]);
const sequenza = (...parti: Buffer[]) => tlv(0x30, Buffer.concat(parti));

function oid(valore: string): Buffer {
  const [a, b, ...resto] = valore.split('.').map(Number);
  const byte = [40 * a + b];
  for (const n of resto) {
    const gruppi = [n & 0x7f];
    for (let v = n >> 7; v > 0; v >>= 7) gruppi.unshift((v & 0x7f) | 0x80);
    byte.push(...gruppi);
  }
  return tlv(0x06, Buffer.from(byte));
}

const nome = (cn: string) => sequenza(tlv(0x31, sequenza(oid('2.5.4.3'), tlv(0x0c, Buffer.from(cn, 'utf8')))));

function utcTime(data: Date): Buffer {
  const t = `${data.toISOString().replace(/[-:T]/g, '').slice(2, 14)}Z`;
  return tlv(0x17, Buffer.from(t, 'ascii'));
}

export interface CertificatoProva {
  certificato: string;
  chiavePrivata: string;
}

export function creaCertificatoProva(cn = 'fidelity-test', giorni = 365): CertificatoProva {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const algoritmo = sequenza(oid('1.2.840.113549.1.1.11'), Buffer.from([0x05, 0x00]));
  const adesso = Date.now();
  const tbs = sequenza(
    tlv(0xa0, tlv(0x02, Buffer.from([0x02]))),
    tlv(0x02, Buffer.from([0x01, ...Array.from({ length: 7 }, () => Math.floor(Math.random() * 255))])),
    algoritmo,
    nome(cn),
    sequenza(utcTime(new Date(adesso - 86_400_000)), utcTime(new Date(adesso + giorni * 86_400_000))),
    nome(cn),
    publicKey.export({ type: 'spki', format: 'der' }) as Buffer,
  );
  const firma = sign('sha256', tbs, privateKey);
  const der = sequenza(tbs, algoritmo, tlv(0x03, Buffer.concat([Buffer.from([0x00]), firma])));
  const certificato = `-----BEGIN CERTIFICATE-----\n${der.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----`;
  new X509Certificate(certificato); // il certificato deve essere leggibile
  return { certificato, chiavePrivata: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string };
}
