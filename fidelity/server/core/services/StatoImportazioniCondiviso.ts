import { durataStatoInCache, statoGiaRegistrato } from '../../../lib/produzione/statoImportazione';
import { log } from '../logger';
import { Tracciati } from '../models';

/**
 * Lo stato dell'importazione di un tracciato chiesto dalle schede dei tracciati, condiviso fra tutti
 * gli utenti (spec ciclo-promozione-importazione, "Stato dell'importazione senza richieste
 * superflue"). Prima di chiamare Istanta:
 * 1. una risposta ancora valida si riusa: 5 secondi mentre Istanta importa, un minuto mentre
 *    l'importazione aspetta un operatore, 10 minuti per un esito finale (lib/produzione/statoImportazione);
 * 2. un tracciato che FP ha gia' registrato come importato o scartato non si chiede a Istanta;
 * 3. piu' richieste contemporanee per lo stesso tracciato fanno una sola chiamata.
 * Un errore non resta: la richiesta successiva riprova. La cache e' del processo.
 *
 * L'eliminazione di un tracciato non passa di qui: legge da Istanta lo stato attuale, poi dimentica.
 */

export type StatoLetto = { stato: string; error?: string | null; esito?: boolean };

export interface DipendenzeStatoImportazioni {
  /** stato_tracciati salvato in FP, null se il tracciato non c'e' o non si legge. */
  statoRegistrato: (idTracciato: string) => Promise<string | null | undefined>;
  adesso: () => number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class StatoImportazioniCondiviso {
  private readonly risposte = new Map<string, { valore: StatoLetto; scade: number }>();
  private readonly inCorso = new Map<string, Promise<StatoLetto>>();

  constructor(private readonly dipendenze: DipendenzeStatoImportazioni) {}

  async leggi(idTracciato: string, chiediAIstanta: () => Promise<StatoLetto>): Promise<StatoLetto> {
    const valida = this.risposte.get(idTracciato);
    if (valida && valida.scade > this.dipendenze.adesso()) return valida.valore;

    const registrato = statoGiaRegistrato(await this.dipendenze.statoRegistrato(idTracciato));
    if (registrato) return { stato: registrato, error: '', esito: true };

    const giaInCorso = this.inCorso.get(idTracciato);
    if (giaInCorso !== undefined) return giaInCorso;

    const richiesta = chiediAIstanta()
      .then((valore) => {
        this.risposte.set(idTracciato, { valore, scade: this.dipendenze.adesso() + durataStatoInCache(valore?.stato) });
        return valore;
      })
      .finally(() => this.inCorso.delete(idTracciato));
    this.inCorso.set(idTracciato, richiesta);
    return richiesta;
  }

  /** Dopo un'eliminazione o uno scarto lo stato salvato non vale piu'. */
  dimentica(idTracciato: string): void {
    this.risposte.delete(idTracciato);
  }
}

export const statoImportazioniCondiviso = new StatoImportazioniCondiviso({
  statoRegistrato: async (idTracciato) => {
    if (!UUID.test(idTracciato)) return null;
    try {
      return (await Tracciati.findByPk(idTracciato, { attributes: ['stato_tracciati'] }))?.stato_tracciati ?? null;
    } catch (error) {
      log.warn(`Stato registrato del tracciato ${idTracciato} non letto: si chiede a Istanta`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  },
  adesso: () => Date.now(),
});
