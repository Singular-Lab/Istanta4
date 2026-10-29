import { STATO_PROMO } from '../enums';

/**
 * Periodi delle viste Volantini e POP, che hanno sostituito le pagine Materiali.
 * Il periodo dipende solo dallo stato della promo; le promo eliminate non stanno in nessun periodo.
 */
export type PeriodoMateriali = 'in-corso' | 'attivi' | 'storico';

export const PERIODI_MATERIALI: readonly PeriodoMateriali[] = ['in-corso', 'attivi', 'storico'];

export const ETICHETTA_PERIODO: Readonly<Record<PeriodoMateriali, string>> = {
  'in-corso': 'In corso',
  attivi: 'Attivi',
  storico: 'Storico',
};

export const STATI_PROMO_PER_PERIODO: Readonly<Record<PeriodoMateriali, readonly STATO_PROMO[]>> = {
  'in-corso': [
    STATO_PROMO.PIANIFICATA,
    STATO_PROMO.IN_LAVORAZIONE,
    STATO_PROMO.IN_ATTESA_DI_VALIDITA,
    STATO_PROMO.IN_SCADENZA,
    STATO_PROMO.IN_RITARDO,
  ],
  attivi: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI],
  storico: [STATO_PROMO.ARCHIVIATA],
};

export const isPeriodoMateriali = (valore: unknown): valore is PeriodoMateriali =>
  typeof valore === 'string' && (PERIODI_MATERIALI as readonly string[]).includes(valore);

/** Periodo in cui compare una promo, o undefined per una promo eliminata o con stato sconosciuto. */
export const periodoDellaPromo = (stato: string | null | undefined): PeriodoMateriali | undefined =>
  PERIODI_MATERIALI.find(periodo => (STATI_PROMO_PER_PERIODO[periodo] as readonly string[]).includes(stato ?? ''));

/**
 * Nei periodi Attivi e Storico compaiono solo i kit pubblicati; In corso compare ogni kit non
 * eliminato, compresi quelli non ancora avviati.
 */
export const soloKitPubblicati = (periodo: PeriodoMateriali): boolean => periodo !== 'in-corso';

const conPromo = (percorso: string, idPromo?: string): string =>
  idPromo ? `${percorso}?promo=${encodeURIComponent(idPromo)}` : percorso;

export const percorsoVolantini = (periodo: PeriodoMateriali, idPromo?: string): string =>
  conPromo(`/volantini/${periodo}`, idPromo);

export const percorsoPop = (periodo: PeriodoMateriali, idPromo?: string): string =>
  conPromo(`/pop/${periodo}`, idPromo);

/** Dettaglio della promo: le promo archiviate stanno sotto lo storico, le altre sotto "in corso". */
export const percorsoPromo = (idPromo: string, statoPromo: string | null | undefined): string =>
  `/promozioni/${statoPromo === STATO_PROMO.ARCHIVIATA ? 'storico' : 'in-corso'}/dettagli/${idPromo}`;

/** Dettaglio di un kit avviato; un kit non avviato (senza runtime) si apre dai kit della promo. */
export const percorsoKit = (idPromo: string, statoPromo: string | null | undefined, idKit: string | null): string =>
  `${percorsoPromo(idPromo, statoPromo)}/kits${idKit ? `/${idKit}` : ''}`;
