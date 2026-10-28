import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Carica le variabili d'ambiente dal file .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Schema di validazione con Zod
const envSchema = z.object({
    // Configurazione dell'ambiente
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    NODE_PORT: z.string().regex(/^\d+$/).transform(Number).default(3001),
    PORTA_VITE: z.string().regex(/^\d+$/).transform(Number).default(3000),
    CLIENT_URL: z.url(),

    // Servizio AI delle ricette e dei vini (GPTService): la chiave resta obbligatoria
    API_KEY_AI: z.string(),
    AI_RICETTE_API_URL: z.url().default('https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php'),
    // Una generazione puo' durare a lungo, ma senza limite una chiamata appesa blocca la richiesta
    AI_RICETTE_TIMEOUT_MS: z.string().regex(/^\d+$/).transform(Number).default(120000),

    // OpenAI diretto: nessun codice le legge piu'. Facoltative, cosi' i .env esistenti restano validi
    OPENAI_API_KEY: z.string().optional(),
    ASSISTANT_ID: z.string().optional(),
    OPEN_AI_ASSISTANT_ID: z.string().optional(),
    OPEN_AI_ASSISTANT_ID_TRANSLATION: z.string().optional(),
    OPENAI_PROJECT_ID: z.string().optional(),

    // Versione della Graph API di Meta usata dai messaggi e dai modelli WhatsApp
    META_GRAPH_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default('v24.0'),

    // Configurazione PostgreSQL
    DB_POSTGRESQL_NAME: z.string(),
    DB_POSTGRESQL_USER: z.string(),
    DB_POSTGRESQL_PORT: z.string().regex(/^\d+$/).transform(Number),
    DB_POSTGRESQL_PASSWORD: z.string(),
    DB_POSTGRESQL_HOST: z.string(),

    // Configurazione sicurezza
    FICO_SECRET: z.string().min(1), // firma i token di reset e cifra i contesti FICO: vuoto li renderebbe forgiabili
    AD_TENANT_ID: z.string().optional(),
    SALT_ROUNDS: z.string().regex(/^\d+$/).transform(Number),
    INTERNAL_REQUEST_SECRET: z.string().optional(),
    INTERNAL_REQUEST_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default(60000),
    // Firma i link dell'accesso di servizio OIDC (fake-callback): senza, l'accesso non esiste
    OIDC_FAKE_CALLBACK_SECRET: z.string().min(32).optional(),

    // Configurazione token effimeri
    EPHEMERAL_TOKEN_SECRET: z.string(),
    ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list (opzionale, usato per whitelist iniziale)

    // Configurazione servizi esterni
    ISTANTA_IP_ADDRESS: z.url(),
    CORREGGO_IP_ADDRESS: z.url().optional(),
    PROXY_URL: z.url(),
    VITE_API_URL: z.url(),
    OLYMPUS_IP_ADDRESS: z.url(),
    VITE_OLYMPUS_IP_ADDRESS: z.url(),
    OLYMPUS_IP_ADDRESS_CORS: z.url(),
    VITE_OLYMPUS_IP_ADDRESS_CORS: z.url(),
    SESSION_SECRET: z.string().min(1),
    WS_PORT: z.string().regex(/^\d+$/).transform(Number).default(3400),

    //SMTP EMAIL CONFIG
    SMTP_HOST: z.string(),
    SMTP_PORT: z.string().regex(/^\d+$/).transform(Number),
    SMTP_USER: z.string(),
    SMTP_PASSWORD: z.string(),
    SMTP_FROM: z.string().email().optional(),

    // Plugin Analytics
    PLUGIN_ANALYTICS_RETENTION_DAYS: z.string().regex(/^\d+$/).transform(Number).default(90),

    //Configurazione url DB1
    DBUNO_URL: z.url().optional(),

    // Identificativo cliente (agenzia_lib) — determina le logiche custom per GDO
    CLIENT_ID: z.string().default('default'),
    CLIENT_API_URL: z.url().optional(),

    // URL base del sistema FICO (gateway d'ingresso) — se configurato, viene usato
    // come destinazione per external_fico al posto di service.url; service.url viene
    // passato come parametro ?route=
    FICO_BASE_URL: z.url().optional(),

    // Lette direttamente da process.env (SequelizeConnector, server.ts, redis.client):
    // dichiarate qui perche' l'unico .env caricato e' quello della cartella di avvio
    DB_POOL_MAX: z.string().optional(),
    DB_SLOW_QUERY_THRESHOLD: z.string().optional(),
    REDIS_URL: z.string().optional(),

    //AD

});

// Funzione di validazione della configurazione
function validateConfig() {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Errore di validazione della configurazione:');
            error.issues.forEach(err => {
                console.error(`- ${err.path.join('.')}: ${err.message}`);
            });
            process.exit(1);
        }
        throw error;
    }
}

// Configurazione validata esportata per l'uso nell'applicazione
const config = validateConfig();

export default config;
