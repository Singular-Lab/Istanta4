import { TIPO_UTENTI } from '../enums';

/**
 * Regole dell'inserimento manuale di un utente (pagina Gestione Utenti), condivise da modulo e server:
 * quali tipi puo' creare chi e' collegato, chi sceglie la GDO del nuovo utente, come deve essere
 * fatta la password e il telefono.
 *
 * Nota: il client compila con lib ES6, quindi qui niente Object.values/includes.
 */

const TUTTI_I_TIPI: TIPO_UTENTI[] = [
  TIPO_UTENTI.SUPERADMIN,
  TIPO_UTENTI.AGENZIA,
  TIPO_UTENTI.GDO,
  TIPO_UTENTI.CATEGORY,
  TIPO_UTENTI.MARKETING,
  TIPO_UTENTI.IT,
  TIPO_UTENTI.PUNTOVENDITA,
  TIPO_UTENTI.GUEST,
];

/** Tipi che chi crea non puo' assegnare, oltre al Superadmin (riservato al Superadmin). */
const ESCLUSI_PER_TIPO: Partial<Record<TIPO_UTENTI, TIPO_UTENTI[]>> = {
  [TIPO_UTENTI.GDO]: [TIPO_UTENTI.GDO],
  [TIPO_UTENTI.PUNTOVENDITA]: [TIPO_UTENTI.GDO, TIPO_UTENTI.GUEST],
};

/** Nome leggibile del tipo di utente, come lo mostra l'interfaccia. */
export const ETICHETTE_TIPO_UTENTE: Record<TIPO_UTENTI, string> = {
  [TIPO_UTENTI.SUPERADMIN]: 'Superadmin',
  [TIPO_UTENTI.AGENZIA]: 'Agenzia',
  [TIPO_UTENTI.PUNTOVENDITA]: 'Punto Vendita',
  [TIPO_UTENTI.GUEST]: 'Guest',
  [TIPO_UTENTI.GDO]: 'GDO',
  [TIPO_UTENTI.CATEGORY]: 'Category',
  [TIPO_UTENTI.MARKETING]: 'Marketing',
  [TIPO_UTENTI.IT]: 'IT',
};

/**
 * Tipi che puo' assegnare a un nuovo utente chi ha aperto la sessione con il tipo indicato.
 * Solo il Superadmin crea un Superadmin; GDO e Punto Vendita hanno limiti in piu'.
 */
export function tipiUtenteCreabili(tipoChiamante: string | null | undefined): TIPO_UTENTI[] {
  if (tipoChiamante === TIPO_UTENTI.SUPERADMIN) return TUTTI_I_TIPI.slice();
  const esclusi = ESCLUSI_PER_TIPO[tipoChiamante as TIPO_UTENTI] || [];
  return TUTTI_I_TIPI.filter(tipo => tipo !== TIPO_UTENTI.SUPERADMIN && esclusi.indexOf(tipo) === -1);
}

export function puoCreareTipo(tipoChiamante: string | null | undefined, tipo: string): boolean {
  return tipiUtenteCreabili(tipoChiamante).indexOf(tipo as TIPO_UTENTI) !== -1;
}

/**
 * Superadmin e Agenzia operano per piu' GDO e scelgono la GDO del nuovo utente;
 * per gli altri vale la GDO della sessione. Per il modulo: e' la stessa regola che il server
 * applica con operaPerPiuGdo (server/core/accessi/contestoAccesso.ts).
 */
export function scegliePiuGdo(tipoChiamante: string | null | undefined): boolean {
  return tipoChiamante === TIPO_UTENTI.SUPERADMIN || tipoChiamante === TIPO_UTENTI.AGENZIA;
}

/** Caratteri speciali ammessi nella password. */
export const SIMBOLI_PASSWORD = '@$!%*?&';

/** Almeno 8 caratteri con minuscola, maiuscola, cifra e simbolo, solo lettere, cifre e simboli ammessi. */
export const REGOLA_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const DESCRIZIONE_REGOLA_PASSWORD =
  `Almeno 8 caratteri, con una maiuscola, una minuscola, un numero e un simbolo fra ${SIMBOLI_PASSWORD}`;

/** Telefono facoltativo: cifre e spazi, eventualmente con il prefisso internazionale (+39 055 123 4567). */
export const REGOLA_TELEFONO = /^\+?[0-9][0-9 ]{5,18}[0-9]$/;
