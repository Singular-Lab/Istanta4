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

/** Istanta l'ha importato, o l'importazione e' terminata con errori: i dati possono essere nelle sue lavorazioni. */
const IMPORTATO: { [stato: string]: true } = { Terminata: true, TerminataConErrori: true };

/**
 * Arrivato in Istanta ma non importato: in attesa della conferma dell'operatore di Istanta, oppure
 * soltanto esaminato (l'esame gira senza salvare). Prima di eliminarlo Fidelity chiede a Istanta di
 * scartarne l'importazione (FicoProcess/scartaImportazione), altrimenti confermando le importazioni
 * della promo Istanta lo importerebbe lo stesso.
 */
const DA_SCARTARE_IN_ISTANTA: { [stato: string]: true } = { InAttesaDiConfermaUtente: true, Esaminata: true };

/** L'importazione e' in Istanta e va scartata li' prima di eliminare il tracciato. */
export const daScartareInIstanta = (statoImportazione: StatoImportazioneIstanta): boolean =>
  !!statoImportazione && DA_SCARTARE_IN_ISTANTA[statoImportazione] === true;

/**
 * Non importato: in attesa o non accettato da Istanta, con l'importazione scartata, oppure arrivato
 * in Istanta con l'importazione in attesa di conferma o soltanto esaminata.
 */
export const tracciatoNonImportato = ({ inAttesaIstanta, statoTracciato, statoImportazione }: StatoTracciatoPerEliminazione): boolean =>
  inAttesaIstanta || statoTracciato === 'Scartato' || statoImportazione === 'Scartata' || daScartareInIstanta(statoImportazione);

/** Il motivo per cui un tracciato importato, o con l'importazione avviata e non conclusa, non si elimina. */
export const motivoTracciatoNonEliminabile = (statoImportazione: StatoImportazioneIstanta): string =>
  statoImportazione && IMPORTATO[statoImportazione]
    ? 'Il tracciato è già importato in Istanta: non si può eliminare.'
    : "L'importazione del tracciato in Istanta è già avviata e non è conclusa: non si può eliminare.";
