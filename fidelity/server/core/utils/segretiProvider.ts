import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';
import config from '../config';

/**
 * Cifratura dei segreti dei metodi di accesso (client_secret OIDC, chiave privata SAML).
 *
 * AES-256-GCM con chiave derivata da FICO_SECRET tramite HKDF: l'info dedicata separa
 * questa chiave da quella 3DES dei context FICO, che usa lo stesso segreto.
 * Formato salvato: enc:v1:<iv>:<tag>:<ciphertext>, in base64url.
 *
 * Un valore senza prefisso e' un segreto ancora in chiaro, salvato prima della
 * cifratura: si legge com'e' finche' non viene migrato.
 */

const PREFISSO = 'enc:v1:';
const INFO_HKDF = 'fidelity:auth-provider-secrets:v1';

function chiave(segreto: string): Buffer {
  if (!segreto) throw new Error('FICO_SECRET mancante: impossibile cifrare i segreti dei metodi di accesso');
  return Buffer.from(hkdfSync('sha256', segreto, Buffer.alloc(0), INFO_HKDF, 32));
}

export function eSegretoCifrato(valore: unknown): boolean {
  return typeof valore === 'string' && valore.startsWith(PREFISSO);
}

export function cifraSegreto(valore: string, segreto: string = config.FICO_SECRET as string): string {
  if (eSegretoCifrato(valore)) return valore;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chiave(segreto), iv);
  const testo = Buffer.concat([cipher.update(valore, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFISSO}${iv.toString('base64url')}:${tag.toString('base64url')}:${testo.toString('base64url')}`;
}

/** Restituisce il segreto in chiaro; un valore non cifrato torna invariato. */
export function decifraSegreto(valore: string, segreto: string = config.FICO_SECRET as string): string {
  if (!eSegretoCifrato(valore)) return valore;
  const parti = valore.slice(PREFISSO.length).split(':');
  if (parti.length !== 3) throw new Error('Segreto cifrato in formato non valido');
  const [iv, tag, testo] = parti.map((p) => Buffer.from(p, 'base64url'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', chiave(segreto), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(testo), decipher.final()]).toString('utf8');
  } catch {
    // Tag non valido: FICO_SECRET cambiato dopo la cifratura o valore alterato.
    throw new Error('Impossibile decifrare il segreto: FICO_SECRET diverso da quello usato per cifrarlo, reinserire il segreto');
  }
}
