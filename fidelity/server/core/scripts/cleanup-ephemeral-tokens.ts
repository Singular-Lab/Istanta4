import { CronJob } from 'cron';
import ephemeralTokenService from '../services/EphemeralTokenService';
import { log } from '../logger';

/**
 * Script per cleanup automatico token effimeri e challenge scaduti
 *
 * Esegue periodicamente la pulizia di:
 * - Challenge scaduti (TTL > 30 secondi)
 * - Token scaduti (TTL > 10 minuti dalla scadenza)
 *
 * Scheduling:
 * - Challenge: ogni 5 minuti
 * - Token: ogni 15 minuti
 */
export class EphemeralTokenCleanupScheduler {

    private challengeCleanupJob: CronJob | null = null;
    private tokenCleanupJob: CronJob | null = null;

    /**
     * Avvia i job di cleanup
     */
    start(): void {
        // Cleanup challenge scaduti ogni 5 minuti
        this.challengeCleanupJob = new CronJob(
            '*/5 * * * *', // Ogni 5 minuti
            async () => {
                try {
                    const deleted = await ephemeralTokenService.cleanupExpiredChallenges();
                    if (deleted > 0) {
                        log.info(`[Cleanup] Rimossi ${deleted} challenge scaduti`);
                    }
                } catch (error: any) {
                    log.error('[Cleanup] Errore durante cleanup challenge', {
                        error: error.message
                    });
                }
            },
            null, // onComplete
            true, // start immediately
            'Europe/Rome' // timezone
        );

        // Cleanup token scaduti ogni 15 minuti
        this.tokenCleanupJob = new CronJob(
            '*/15 * * * *', // Ogni 15 minuti
            async () => {
                try {
                    const deleted = await ephemeralTokenService.cleanupExpiredTokens();
                    if (deleted > 0) {
                        log.info(`[Cleanup] Rimossi ${deleted} token scaduti`);
                    }
                } catch (error: any) {
                    log.error('[Cleanup] Errore durante cleanup token', {
                        error: error.message
                    });
                }
            },
            null, // onComplete
            true, // start immediately
            'Europe/Rome' // timezone
        );

        log.info('[Cleanup] Scheduler avviato per cleanup automatico token effimeri');
    }

    /**
     * Ferma i job di cleanup
     */
    stop(): void {
        if (this.challengeCleanupJob) {
            this.challengeCleanupJob.stop();
            this.challengeCleanupJob = null;
        }

        if (this.tokenCleanupJob) {
            this.tokenCleanupJob.stop();
            this.tokenCleanupJob = null;
        }

        log.info('[Cleanup] Scheduler arrestato');
    }

    /**
     * Forza cleanup manuale (per testing o admin)
     */
    async forceCleanup(): Promise<{ challenges: number; tokens: number }> {
        log.info('[Cleanup] Cleanup manuale forzato');

        const challenges = await ephemeralTokenService.cleanupExpiredChallenges();
        const tokens = await ephemeralTokenService.cleanupExpiredTokens();

        log.info('[Cleanup] Cleanup manuale completato', {
            challenges_deleted: challenges,
            tokens_deleted: tokens
        });

        return { challenges, tokens };
    }
}

// Singleton instance
export const cleanupScheduler = new EphemeralTokenCleanupScheduler();

/**
 * Script standalone per cleanup manuale
 * Eseguibile con: node -r ts-node/register cleanup-ephemeral-tokens.ts
 */
if (require.main === module) {
    (async () => {
        try {
            log.info('[Cleanup] Avvio cleanup manuale standalone');

            const result = await cleanupScheduler.forceCleanup();

            log.info('[Cleanup] Cleanup completato con successo', result);
            process.exit(0);
        } catch (error: any) {
            log.error('[Cleanup] Errore durante cleanup', {
                error: error.message,
                stack: error.stack
            });
            process.exit(1);
        }
    })();
}
