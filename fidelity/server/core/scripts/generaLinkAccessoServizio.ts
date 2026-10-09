/**
 * Stampa un link dell'accesso di servizio OIDC (fake-callback), valido 5 minuti.
 *
 * Uso: yarn auth:link-servizio <email> [oid]
 * Richiede OIDC_FAKE_CALLBACK_SECRET nell'ambiente del server.
 */
import config from '../config';
import { createAccessoServizioParams } from '../utils/accessoServizioLink';

const [email, oid = ''] = process.argv.slice(2);

if (!email) {
  console.error('Uso: yarn auth:link-servizio <email> [oid]');
  process.exit(1);
}

if (!config.OIDC_FAKE_CALLBACK_SECRET) {
  console.error('OIDC_FAKE_CALLBACK_SECRET non configurato: l\'accesso di servizio e\' disattivato.');
  process.exit(1);
}

const params = new URLSearchParams({ ...createAccessoServizioParams(email, oid, config.OIDC_FAKE_CALLBACK_SECRET) });
console.log(`${config.CLIENT_URL}/api/auth/oidc/fake-callback?${params}`);
