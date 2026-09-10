import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Carica le variabili d'ambiente dal file .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// Schema di validazione con Zod
const envSchema = z.object({
    // Configurazione dell'ambiente
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    NODE_PORT: z.string().regex(/^\d+$/).transform(Number).default('3001'),
    PORTA_VITE: z.string().regex(/^\d+$/).transform(Number).default('3000'),
    CLIENT_URL: z.string().url(),

    // Configurazione MongoDB (opzionale — non usato nel setup Docker PostgreSQL-only)
    MONGO_URL: z.string().url().optional(),
    MONGO_DB_NAME: z.string().optional(),

    // Configurazione OpenAI
    OPENAI_API_KEY: z.string(),
    ASSISTANT_ID: z.string(),
    API_KEY_AI: z.string(),
    OPEN_AI_ASSISTANT_ID: z.string(),
    OPEN_AI_ASSISTANT_ID_TRANSLATION: z.string(),
    OPENAI_PROJECT_ID: z.string(),

    // Configurazione PostgreSQL
    DB_POSTGRESQL_NAME: z.string(),
    DB_POSTGRESQL_USER: z.string(),
    DB_POSTGRESQL_PORT: z.string().regex(/^\d+$/).transform(Number),
    DB_POSTGRESQL_PASSWORD: z.string(),
    DB_POSTGRESQL_HOST: z.string(),

    // Configurazione sicurezza
    FICO_SECRET: z.string(),
    AD_TENANT_ID: z.string().optional(),
    SALT_ROUNDS: z.string().regex(/^\d+$/).transform(Number),
    INTERNAL_REQUEST_SECRET: z.string().optional(),
    INTERNAL_REQUEST_WINDOW_MS: z.string().regex(/^\d+$/).transform(Number).default('60000'),

    // Configurazione token effimeri
    EPHEMERAL_TOKEN_SECRET: z.string(),
    ALLOWED_ORIGINS: z.string().optional(), // Comma-separated list (opzionale, usato per whitelist iniziale)

    // Configurazione servizi esterni
    ISTANTA_IP_ADDRESS: z.string().url(),
    CORREGGO_IP_ADDRESS: z.string().url().optional(),
    PROXY_URL: z.string().url(),
    VITE_API_URL: z.string().url(),
    OLYMPUS_IP_ADDRESS: z.string().url(),
    VITE_OLYMPUS_IP_ADDRESS: z.string().url(),
    OLYMPUS_IP_ADDRESS_CORS: z.string().url(),
    VITE_OLYMPUS_IP_ADDRESS_CORS: z.string().url(),
    SESSION_SECRET: z.string(),
    WS_PORT: z.string().regex(/^\d+$/).transform(Number).default('3400'),
    // Configurazione percorsi
    ICONE_INSEGNA_DIR: z.string(),

    //SMTP EMAIL CONFIG
    SMTP_HOST: z.string(),
    SMTP_PORT: z.string().regex(/^\d+$/).transform(Number),
    SMTP_USER: z.string(),
    SMTP_PASSWORD: z.string(),
    SMTP_FROM: z.string().email().optional(),

    // Plugin Analytics
    PLUGIN_ANALYTICS_RETENTION_DAYS: z.string().regex(/^\d+$/).transform(Number).default('90'),

    //Configurazione url DB1
    DBUNO_URL: z.string().url().optional(),

    // Identificativo cliente (agenzia_lib) — determina le logiche custom per GDO
    CLIENT_ID: z.string().default('default'),
    CLIENT_API_URL: z.string().url().optional(),

    // URL base del sistema FICO (gateway d'ingresso) — se configurato, viene usato
    // come destinazione per external_fico al posto di service.url; service.url viene
    // passato come parametro ?route=
    FICO_BASE_URL: z.string().url().optional(),

    //AD

});

// Funzione di validazione della configurazione
function validateConfig() {
    try {
        return envSchema.parse(process.env);
    } catch (error) {
        if (error instanceof z.ZodError) {
            console.error('Errore di validazione della configurazione:');
            error.errors.forEach(err => {
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
