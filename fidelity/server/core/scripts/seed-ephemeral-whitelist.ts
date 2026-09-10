import { EphemeralOriginsWhitelist } from '../models/ephemeral/ephemeral_origins_whitelist';
import { log } from '../logger';
import { sequelize } from '../db/SequelizeConnector';

/**
 * Script per popolare la tabella ephemeral_origins_whitelist
 * con origini iniziali permesse
 */
async function seedWhitelist() {
    try {
        await sequelize.authenticate();
        log.info('[Seed] Connesso al database');

        // Sincronizza modelli
        await EphemeralOriginsWhitelist.sync();

        // Origini da aggiungere
        const origins = [
            {
                origin_ephemeral_origins_whitelist: 'http://localhost:3009',
                description_ephemeral_origins_whitelist: 'Sviluppo locale - porta 3009',
                active_ephemeral_origins_whitelist: true,
                rate_limit_per_minute_ephemeral_origins_whitelist: 100,
                allowed_scopes_ephemeral_origins_whitelist: 'promo:read,refs:read'
            },
            {
                origin_ephemeral_origins_whitelist: 'http://localhost:3000',
                description_ephemeral_origins_whitelist: 'Sviluppo locale - porta 3000',
                active_ephemeral_origins_whitelist: true,
                rate_limit_per_minute_ephemeral_origins_whitelist: 100,
                allowed_scopes_ephemeral_origins_whitelist: 'promo:read,refs:read'
            },
            {
                origin_ephemeral_origins_whitelist: 'https://istn.it',
                description_ephemeral_origins_whitelist: 'Produzione - ISTN',
                active_ephemeral_origins_whitelist: true,
                rate_limit_per_minute_ephemeral_origins_whitelist: 50,
                allowed_scopes_ephemeral_origins_whitelist: 'promo:read,refs:read'
            },
            {
                origin_ephemeral_origins_whitelist: 'https://cdn.istn.it',
                description_ephemeral_origins_whitelist: 'CDN ISTN',
                active_ephemeral_origins_whitelist: true,
                rate_limit_per_minute_ephemeral_origins_whitelist: 50,
                allowed_scopes_ephemeral_origins_whitelist: 'promo:read,refs:read'
            }
        ];

        // Inserisci origini (o aggiorna se già esistono)
        for (const origin of origins) {
            const [entry, created] = await EphemeralOriginsWhitelist.findOrCreate({
                where: { origin_ephemeral_origins_whitelist: origin.origin_ephemeral_origins_whitelist },
                defaults: origin
            });

            if (created) {
                log.info(`[Seed] ✓ Aggiunto origin: ${origin.origin_ephemeral_origins_whitelist}`);
            } else {
                log.info(`[Seed] → Origin già esistente: ${origin.origin_ephemeral_origins_whitelist}`);
            }
        }

        log.info('[Seed] Whitelist popolata con successo');
        process.exit(0);

    } catch (error: any) {
        log.error('[Seed] Errore durante seed whitelist', {
            error: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Esegui seed
seedWhitelist();
