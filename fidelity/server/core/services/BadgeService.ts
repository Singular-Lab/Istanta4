import type { IOrdiniStampaService } from '../interfaces/IOrdiniStampaService';
import type { IPromoService } from '../interfaces/IPromoService';
import { log } from '../logger';
import type { ContestoAccesso } from '../accessi/contestoAccesso';
import { RisolutoreAccessi } from '../accessi/RisolutoreAccessi';

/**
 * Service che aggrega i conteggi (badges) permission-aware.
 * Restituisce un oggetto { [key: string]: { count: number, variant?: string } }
 * dove la key è il pathname del menu (o il title se necessario).
 */
export class BadgeService {
    constructor(
        private promoService: IPromoService,
        private ordiniStampaService: IOrdiniStampaService,
    ) { }

    /**
     * Calcola tutti i badge rilevanti per un utente (permission-aware).
     */
    public async getBadgesForUser(contesto: ContestoAccesso) {
        try {
            const risolutore = RisolutoreAccessi.get();

            // 1) Promozioni in corso -> /promozioni/in-corso
            let promoCount = 0;
            try {
                promoCount = await this.promoService.getCurrentPromoCount();
            } catch (err) {
                log.error('Error counting promos for badges', err instanceof Error ? err : String(err));
            }

            // 2) Ordini di stampa in corso -> /ods-in-corso
            let odsCount = 0;
            try {
                const ordini = await this.ordiniStampaService.getAllOrdiniDiStampaInCorso();
                odsCount = Array.isArray(ordini) ? ordini.length : 0;
            } catch (err) {
                log.error('Error counting ordini di stampa for badges', err instanceof Error ? err : String(err));
            }

            // 3) Promo da cui creare un ordine di stampa -> /nuovo-ods (stesso criterio dell'elenco della pagina)
            let nuovoOdsCount = 0;
            try {
                nuovoOdsCount = await this.promoService.contaPromoSenzaOrdineDiStampa();
            } catch (err) {
                log.error('Error counting promo senza ordine di stampa for badges', err instanceof Error ? err : String(err));
            }

            // Map of candidate badges
            const candidateBadges: Record<string, { count: number; variant?: 'info' | 'warning' | 'error' }> = {
                '/promozioni/in-corso': { count: promoCount, variant: 'info' },
                '/ods-in-corso': { count: odsCount, variant: 'info' },
                '/nuovo-ods': { count: nuovoOdsCount, variant: 'warning' },
            };

            // Solo i badge delle pagine che l'utente puo' aprire
            const result: Record<string, { count: number; variant?: 'info' | 'warning' | 'error' }> = {};
            for (const key of Object.keys(candidateBadges)) {
                const badge = candidateBadges[key];
                if (!badge || !badge.count || badge.count <= 0) continue; // only include >0

                const hasAccess = await risolutore.puoAprire(contesto, key);
                if (hasAccess) {
                    result[key] = badge;
                }
            }

            return result;
        } catch (error) {
            log.error('Error in BadgeService.getBadgesForUser', error instanceof Error ? error : String(error));
            return {};
        }
    }
}

export default BadgeService;
