import { afterEach, vi } from 'vitest';

/**
 * server/core/config valida l'ambiente con Zod e, se la validazione fallisce,
 * chiama process.exit(1). Sotto Vitest questo abbatte l'intero file di test
 * prima che venga eseguita qualsiasi asserzione, e colpisce ogni test che
 * importi anche indirettamente la catena config/container.
 *
 * Qui popoliamo le variabili obbligatorie con valori fittizi e isolati, in modo
 * che la validazione passi. Nessun servizio reale viene contattato: gli host
 * puntano a 127.0.0.1 e i segreti sono palesemente finti. Le variabili gia'
 * presenti nell'ambiente non vengono sovrascritte, cosi' un'esecuzione locale
 * con configurazione propria continua a funzionare.
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',

  CLIENT_URL: 'http://127.0.0.1:3000',

  // Servizi esterni: chiavi finte, nessuna chiamata reale nei test
  OPENAI_API_KEY: 'test-openai-key',
  ASSISTANT_ID: 'test-assistant-id',
  API_KEY_AI: 'test-api-key-ai',
  OPEN_AI_ASSISTANT_ID: 'test-openai-assistant-id',
  OPEN_AI_ASSISTANT_ID_TRANSLATION: 'test-openai-assistant-id-translation',
  OPENAI_PROJECT_ID: 'test-openai-project-id',

  // PostgreSQL: coordinate locali inesistenti, i test non aprono connessioni
  DB_POSTGRESQL_NAME: 'fidelity_test',
  DB_POSTGRESQL_USER: 'fidelity_test',
  DB_POSTGRESQL_PORT: '5432',
  DB_POSTGRESQL_PASSWORD: 'test-password',
  DB_POSTGRESQL_HOST: '127.0.0.1',

  FICO_SECRET: 'test-fico-secret',
  SALT_ROUNDS: '10',
  EPHEMERAL_TOKEN_SECRET: 'test-ephemeral-token-secret',
  SESSION_SECRET: 'test-session-secret',

  ISTANTA_IP_ADDRESS: 'http://127.0.0.1:5000',
  PROXY_URL: 'http://127.0.0.1:5001',
  VITE_API_URL: 'http://127.0.0.1:3001',
  OLYMPUS_IP_ADDRESS: 'http://127.0.0.1:5002',
  VITE_OLYMPUS_IP_ADDRESS: 'http://127.0.0.1:5002',
  OLYMPUS_IP_ADDRESS_CORS: 'http://127.0.0.1:5002',
  VITE_OLYMPUS_IP_ADDRESS_CORS: 'http://127.0.0.1:5002',

  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: '1025',
  SMTP_USER: 'test-smtp-user',
  SMTP_PASSWORD: 'test-smtp-password',
};

for (const [chiave, valore] of Object.entries(TEST_ENV)) {
  if (process.env[chiave] === undefined || process.env[chiave] === '') {
    process.env[chiave] = valore;
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Da Node 25 `globalThis.localStorage` e' il Web Storage di Node: senza `--localstorage-file`
 * vale undefined e, essendo gia' definito, copre quello di jsdom nei test con
 * `@vitest-environment jsdom` (es. "Cannot read properties of undefined (reading 'clear')").
 * Qui, solo nei test con DOM, lo si sostituisce con uno Storage in memoria.
 */
// Il tsconfig del server non ha la lib DOM: niente `document` o `Storage` come tipi, si passa da globalThis.
const globale = globalThis as unknown as Record<string, unknown>;
if (typeof globale.document !== 'undefined' && !globale.localStorage) {
  type StorageInMemoria = {
    readonly length: number;
    key: (indice: number) => string | null;
    getItem: (chiave: string) => string | null;
    setItem: (chiave: string, valore: string) => void;
    removeItem: (chiave: string) => void;
    clear: () => void;
  };
  const creaStorage = (): StorageInMemoria => {
    const dati = new Map<string, string>();
    return {
      get length() { return dati.size; },
      key: (indice) => Array.from(dati.keys())[indice] ?? null,
      getItem: (chiave) => dati.get(chiave) ?? null,
      setItem: (chiave, valore) => { dati.set(chiave, String(valore)); },
      removeItem: (chiave) => { dati.delete(chiave); },
      clear: () => { dati.clear(); },
    };
  };
  for (const nome of ['localStorage', 'sessionStorage']) {
    if (!globale[nome]) {
      Object.defineProperty(globalThis, nome, { value: creaStorage(), configurable: true, writable: true });
    }
  }
}
