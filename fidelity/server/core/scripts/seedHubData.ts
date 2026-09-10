import { RUOLO_UTENTE_GDO, TIPO_UTENTI } from '../../../lib/enums';
import { sequelize } from '../db';
import { log } from '../logger';
import { AuthProvider } from '../models/auth_provider';
import { HubNews } from '../models/hub_news';
import { HubService } from '../models/hub_service';

const DEFAULT_PROVIDERS = [
  {
    codice: 'email_password',
    nome: 'Email e Password',
    descrizione: 'Accedi con le tue credenziali email e password',
    icona: 'Mail',
    tipo: 'internal' as const,
    ordine: 0,
    attivo: true,
  },
  // ─── Microsoft Entra ID (OIDC) ─────────────────────────
  // Per attivare: impostare attivo: true e sostituire i placeholder con i valori reali
  // dall'App Registration su Azure Portal (Entra ID → App registrations)
  {
    codice: 'entra_id',
    nome: 'Microsoft Entra ID',
    descrizione: 'Accedi con il tuo account aziendale Microsoft',
    icona: 'ShieldCheck',
    tipo: 'oidc' as const,
    ordine: 1,
    attivo: false, // Attivare quando configurato su Azure
    config_client: {
      authorize_url: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'TENANT_ID'}/oauth2/v2.0/authorize`,
      client_id: process.env.ENTRA_CLIENT_ID || 'CLIENT_ID',
      scope: 'openid profile email',
      redirect_uri: `${process.env.CLIENT_URL || 'https://tuodominio.com'}/api/auth/oidc/callback`,
    },
    config_server: {
      client_secret: process.env.ENTRA_CLIENT_SECRET || 'CLIENT_SECRET',
      token_url: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'TENANT_ID'}/oauth2/v2.0/token`,
      jwks_uri: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'TENANT_ID'}/discovery/v2.0/keys`,
      expected_issuer: `https://login.microsoftonline.com/${process.env.ENTRA_TENANT_ID || 'TENANT_ID'}/v2.0`,
    },
    ruoli_ammessi: null, // null = tutti i ruoli possono usarlo
  },
];

/** Dati base del servizio Istanta 2 GDO Suite, replicati per ogni tipo utente */
const FP_BASE = {
  codice: 'fidelity_promotion',
  nome: 'Istanta 2 GDO Suite',
  icona: 'Megaphone',
  colore: 'primary',
  url: '/gdo/dashboard',
  tipo_url: 'internal' as const,
  ordine: 0,
  in_evidenza: true,
};

/** Un record per ogni combinazione tipo_utente + ruolo_gdo */
const DEFAULT_SERVICES = [
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.SUPERADMIN,
    ruolo_gdo: null,
    descrizione: 'Pannello di amministrazione completo per la gestione della piattaforma',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.AGENZIA,
    ruolo_gdo: null,
    descrizione: 'Crea e gestisci promozioni e materiali marketing per i tuoi clienti',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.GDO,
    ruolo_gdo: RUOLO_UTENTE_GDO.AMMINISTRATORE_DELEGATO,
    descrizione: 'Gestisci volantini, promozioni e punti vendita della tua catena',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.GDO,
    ruolo_gdo: RUOLO_UTENTE_GDO.DEVELOPER,
    descrizione: 'Gestisci volantini, promozioni e punti vendita della tua catena',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.PUNTOVENDITA,
    ruolo_gdo: null,
    descrizione: 'Visualizza promozioni e materiali per il tuo punto vendita',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.GUEST,
    ruolo_gdo: null,
    descrizione: 'Consulta le promozioni disponibili',
  },
  {
    ...FP_BASE,
    tipo_utente: TIPO_UTENTI.CATEGORY,
    ruolo_gdo: null,
    descrizione: 'Gestione promozioni e volantini',
  },
];

const DEFAULT_NEWS = [];

/**
 * Inserisce i dati di default per auth_providers, hub_services e hub_news
 * Usa findOne + create per evitare duplicati (controlla codice + tipo_utente + ruolo_gdo)
 */
export async function seedHubData(): Promise<void> {
  try {
    // Rimuovi il vecchio indice unique su 'codice' da solo se esiste ancora
    // (il nuovo modello usa un indice composito su codice+tipo_utente+ruolo_gdo)
    try {
      const [indexes] = await sequelize.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = 'hub_services' AND indexname = 'hub_services_codice_key'`
      );
      if (Array.isArray(indexes) && indexes.length > 0) {
        await sequelize.query(`DROP INDEX IF EXISTS "hub_services_codice_key"`);
        // Droppa anche il vecchio indice nominato se esiste
        await sequelize.query(`DROP INDEX IF EXISTS "idx_hub_service_codice"`);
        log.info('[seedHubData] Rimosso vecchio indice unique hub_services_codice_key');
      }
    } catch (idxErr) {
      log.warn('[seedHubData] Errore rimozione vecchio indice (non critico):', idxErr);
    }

    // Elimina record legacy senza tipo_utente (vecchio formato con ruoli_ammessi)
    try {
      const [deleted] = await sequelize.query(
        `DELETE FROM hub_services WHERE tipo_utente IS NULL OR tipo_utente = '' RETURNING codice`
      );
      if (Array.isArray(deleted) && deleted.length > 0) {
        log.info(`[seedHubData] Rimossi ${deleted.length} record legacy senza tipo_utente`);
      }
    } catch (delErr) {
      log.warn('[seedHubData] Errore rimozione record legacy (non critico):', delErr);
    }

    // Seed provider di default
    for (const provider of DEFAULT_PROVIDERS) {
      const existing = await AuthProvider.findOne({ where: { codice: provider.codice } });
      if (!existing) {
        await AuthProvider.create(provider);
        log.info(`[seedHubData] Provider creato: ${provider.codice}`);
      }
    }

    // Seed servizi di default — un record per ogni tipo_utente + ruolo_gdo
    for (const service of DEFAULT_SERVICES) {
      const existing = await HubService.findOne({
        where: {
          codice: service.codice,
          tipo_utente: service.tipo_utente,
          ruolo_gdo: service.ruolo_gdo,
        },
      });
      if (!existing) {
        await HubService.create(service);
        log.info(`[seedHubData] Servizio creato: ${service.codice} per ${service.tipo_utente}${service.ruolo_gdo ? `/${service.ruolo_gdo}` : ''}`);
      }
    }

    // Seed news di default
    for (const news of DEFAULT_NEWS) {
      const existing = await HubNews.findOne({ where: { titolo: news.titolo } });
      if (!existing) {
        await HubNews.create(news);
        log.info(`[seedHubData] News creata: ${news.titolo}`);
      }
    }

    log.info('[seedHubData] Seed completato');
  } catch (error) {
    log.error('[seedHubData] Errore durante il seed:', error);
  }
}
