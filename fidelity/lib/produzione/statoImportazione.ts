/**
 * Quanto spesso si chiede a Istanta lo stato dell'importazione di un tracciato (spec
 * ciclo-promozione-importazione, "Stato dell'importazione senza richieste superflue"). Lo usano la
 * scheda del tracciato, per decidere ogni quanto chiedere, e il server, per decidere quanto a lungo
 * tenere la risposta di Istanta valida per tutti gli utenti.
 */

/** Stato dell'importazione come lo restituisce /getStatusImportazione: il nome dell'OperationStatus. */
export type StatoImportazione = string | null | undefined;

/**
 * - in_corso: Istanta la sta importando, cambia in pochi secondi;
 * - in_attesa: aspetta un operatore di Istanta (conferma, esame), puo' restare cosi' per giorni;
 * - conclusa: non cambia piu'.
 */
export type FaseImportazione = 'in_corso' | 'in_attesa' | 'conclusa';

const IN_CORSO: { [stato: string]: true } = { InAttesaDiAssegnazione: true, InCoda: true, ElaborazioneDati: true, AttesaIO: true, IO: true };
const CONCLUSA: { [stato: string]: true } = { Terminata: true, TerminataConErrori: true, Scartata: true };

/** Uno stato sconosciuto o assente vale come in attesa: si ricontrolla, ma senza fretta. */
export const faseImportazione = (stato: StatoImportazione): FaseImportazione =>
  stato && IN_CORSO[stato] ? 'in_corso' : stato && CONCLUSA[stato] ? 'conclusa' : 'in_attesa';

/** Al piu' una richiesta a Istanta ogni 5 secondi mentre importa. */
export const INTERVALLO_IN_CORSO_MS = 5_000;
/** Al piu' una richiesta al minuto mentre aspetta un operatore di Istanta. */
export const INTERVALLO_IN_ATTESA_MS = 60_000;
/** Un esito finale resta valido sul server per 10 minuti; la scheda non lo richiede piu'. */
export const DURATA_CONCLUSA_MS = 10 * 60_000;

/** Ogni quanto la scheda richiede lo stato; false: non lo richiede piu'. */
export const intervalloAggiornamentoStato = (stato: StatoImportazione): number | false => {
  const fase = faseImportazione(stato);
  return fase === 'conclusa' ? false : fase === 'in_corso' ? INTERVALLO_IN_CORSO_MS : INTERVALLO_IN_ATTESA_MS;
};

/** Per quanto il server riusa la risposta di Istanta per tutti gli utenti, prima di chiederla di nuovo. */
export const durataStatoInCache = (stato: StatoImportazione): number => {
  const fase = faseImportazione(stato);
  return fase === 'conclusa' ? DURATA_CONCLUSA_MS : fase === 'in_corso' ? INTERVALLO_IN_CORSO_MS : INTERVALLO_IN_ATTESA_MS;
};

/**
 * Lo stato che FP ha gia' registrato per il tracciato (stato_tracciati) e che rende inutile chiedere
 * a Istanta: importato o scartato non cambiano piu'. null: va chiesto a Istanta.
 */
export const statoGiaRegistrato = (statoTracciato: string | null | undefined): 'Terminata' | 'Scartata' | null =>
  statoTracciato === 'Terminata' ? 'Terminata' : statoTracciato === 'Scartato' ? 'Scartata' : null;
