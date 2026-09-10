import type session from 'express-session';
import { TIPO_UTENTI } from '../lib/enums';

declare namespace NodeJS {
    interface ProcessEnv {
        NODE_ENV: 'development' | 'production' | 'test';
        PORT: string;
        DB_HOST: string;
        DB_PORT: string;
        DB_NAME: string;
        DB_USER: string;
        DB_PASSWORD: string;
        JWT_SECRET: string;
        JWT_EXPIRES_IN: string;
        ISTANTA_IP_ADDRESS: string;
        OLYMPUS_IP_ADDRESS: string;
        MONGODB_URI: string;
        INTERNAL_REQUEST_SECRET?: string;
        INTERNAL_REQUEST_WINDOW_MS?: string;
    }
}
declare module 'express-session' {
    interface SessionData {
        id_utente?: string;
        id_gdo?: string;
        private_key?: string;
        codice_posizione?: string;
        email?: string;
        tipo_utente?: TIPO_UTENTI;
        requestCookieJar?: string;
        isExternalAuth?: boolean;
        lastIP?: string;
        lastUserAgent?: string;
        lastActivity?: Date;
        permessi_cache?: string[];
        // OIDC flow state
        oidc_state?: string;
        oidc_nonce?: string;
        oidc_code_verifier?: string;
        oidc_provider_code?: string;
    }

    interface Session {
        isNew?: boolean;
    }
}

declare namespace Express {
    interface Request {
        session: session.Session & Partial<session.SessionData>;
    }
}

declare module 'socket.io' {
    interface Socket {
        user?: any;
    }
}

declare module '*.json' {
    const value: any;
    export default value;
}
