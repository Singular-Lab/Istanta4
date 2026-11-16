/**
 * Quando un tracciato si puo' eliminare (spec ciclo-promozione-importazione, "Eliminazione di un
 * tracciato non importato"): solo se Istanta non l'ha importato. Lo usano il comando della scheda
 * del tracciato e DELETE /api/tracciati/:idTracciato, cosi' interfaccia e server decidono allo
 * stesso modo. Chi puo' eliminarlo lo dice il permesso di sistema "sistema.elimina_tracciati",
 * cioe' solo il Superadmin.
 */

/** Stato dell'importazione che legge da Istanta (getStatusImportazione): il nome dell'OperationStatus. */
export type StatoImportazioneIstanta = string | null | undefined;

export interface StatoTracciatoPerEliminazione {
  /** Salvato in FP e non ancora accettato da Istanta: in attesa o non accettato. */
  inAttesaIstanta: boolean;
  /** stato_tracciati salvato in FP ("Scartato", "Terminata" o vuoto). */
  statoTracciato?: string | null;
  /** Stato dell'importazione in Istanta, quando si conosce. */
  statoImportazione?: StatoImportazioneIstanta;
}

/** Istanta l'ha importato: i dati sono gia' nelle sue lavorazioni. */
const IMPORTATO: { [stato: string]: true } = { Terminata: true, TerminataConErrori: true, Esaminata: true };

/** Non importato: in attesa o non accettato da Istanta, oppure con l'importazione scartata. */
export const tracciatoNonImportato = ({ inAttesaIstanta, statoTracciato, statoImportazione }: StatoTracciatoPerEliminazione): boolean =>
  inAttesaIstanta || statoTracciato === 'Scartato' || statoImportazione === 'Scartata';

/** Il motivo per cui un tracciato importato, o con l'importazione ancora aperta, non si elimina. */
export const motivoTracciatoNonEliminabile = (statoImportazione: StatoImportazioneIstanta): string =>
  statoImportazione && IMPORTATO[statoImportazione]
    ? 'Il tracciato è già importato in Istanta: non si può eliminare.'
    : "L'importazione del tracciato in Istanta non è conclusa: non si può eliminare.";
