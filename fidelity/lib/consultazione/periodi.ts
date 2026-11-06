import { STATO_PROMO } from '../enums';

/**
 * Periodi dei dati di consultazione (/api/consultazione). Il periodo dipende solo dallo stato della
 * promo, come nelle viste Volantini e POP; in ogni periodo compaiono solo i kit pubblicati.
 * - attivi: promo in validita';
 * - prossimi: promo non ancora valide, con kit gia' pubblicati;
 * - storico: promo archiviate.
 * Le promo eliminate non stanno in nessun periodo e non sono consultabili.
 */
export type PeriodoConsultazione = 'attivi' | 'prossimi' | 'storico';

export const PERIODI_CONSULTAZIONE: readonly PeriodoConsultazione[] = ['attivi', 'prossimi', 'storico'];

/** Nome del periodo nei titoli delle viste Volantini e POP ("Volantini Prossimi"). */
export const ETICHETTA_PERIODO_CONSULTAZIONE: Readonly<Record<PeriodoConsultazione, string>> = {
  attivi: 'Attivi',
  prossimi: 'Prossimi',
  storico: 'Storico',
};

export const STATI_PROMO_CONSULTAZIONE: Readonly<Record<PeriodoConsultazione, readonly STATO_PROMO[]>> = {
  attivi: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI],
  prossimi: [
    STATO_PROMO.PIANIFICATA,
    STATO_PROMO.IN_LAVORAZIONE,
    STATO_PROMO.IN_ATTESA_DI_VALIDITA,
    STATO_PROMO.IN_SCADENZA,
    STATO_PROMO.IN_RITARDO,
  ],
  storico: [STATO_PROMO.ARCHIVIATA],
};

/** Stati delle promo consultabili in qualunque periodo: tutti tranne ELIMINATA. */
export const STATI_PROMO_CONSULTABILI: readonly STATO_PROMO[] = PERIODI_CONSULTAZIONE.flatMap(
  periodo => STATI_PROMO_CONSULTAZIONE[periodo]
);

export const isPeriodoConsultazione = (valore: unknown): valore is PeriodoConsultazione =>
  typeof valore === 'string' && (PERIODI_CONSULTAZIONE as readonly string[]).includes(valore);

/** Periodo in cui si consulta una promo, o undefined per una promo eliminata o con stato sconosciuto. */
export const periodoConsultazioneDellaPromo = (stato: string | null | undefined): PeriodoConsultazione | undefined =>
  PERIODI_CONSULTAZIONE.find(periodo => (STATI_PROMO_CONSULTAZIONE[periodo] as readonly string[]).includes(stato ?? ''));

const conPromo = (percorso: string, idPromo?: string): string =>
  idPromo ? `${percorso}?promo=${encodeURIComponent(idPromo)}` : percorso;

/** Vista Volantini del periodo, eventualmente filtrata su una promo. */
export const percorsoVolantini = (periodo: PeriodoConsultazione, idPromo?: string): string =>
  conPromo(`/volantini/${periodo}`, idPromo);

/** Vista POP del periodo, eventualmente aperta su una promo. */
export const percorsoPop = (periodo: PeriodoConsultazione, idPromo?: string): string =>
  conPromo(`/pop/${periodo}`, idPromo);

/** Base delle API di consultazione, relativa all'indirizzo delle API (ServerCall.getUrl()). */
export const PERCORSO_CONSULTAZIONE = '/consultazione';

/** Download di un file pubblicato (files_runtime.id), relativo all'indirizzo delle API. */
export const percorsoFileConsultazione = (idFile: string): string =>
  `${PERCORSO_CONSULTAZIONE}/file/${encodeURIComponent(idFile)}`;

/** Dettaglio di un kit volantino pubblicato, relativo all'indirizzo delle API. */
export const percorsoVolantinoConsultazione = (idKit: string): string =>
  `${PERCORSO_CONSULTAZIONE}/volantini/${encodeURIComponent(idKit)}`;
