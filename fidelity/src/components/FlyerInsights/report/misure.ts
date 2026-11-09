/**
 * Griglia fissa del report PDF del volantino, in punti tipografici (1 mm = 2,835 pt). Valori puri,
 * senza @react-pdf: li usano gli stili, l'impaginazione e i test.
 */

/** Famiglia registrata da fontReport.ts (Noto Sans, OFL 1.1). */
export const FAMIGLIA_REPORT = "NotoSansReport";

/** Riserva quando i file della famiglia non si caricano: font standard del PDF. */
export const FAMIGLIA_RISERVA = "Helvetica";

/** A4 verticale. */
export const A4 = { larghezza: 595.28, altezza: 841.89 } as const;

/** Margini laterali: 18 mm. */
export const MARGINE = 51;
/** Sopra il contenuto: testata (a 34 pt dal bordo) e respiro. */
export const MARGINE_ALTO = 82;
/** Sotto il contenuto: piè di pagina (a 30 pt dal bordo) e respiro. */
export const MARGINE_BASSO = 66;

export const LARGHEZZA_UTILE = A4.larghezza - 2 * MARGINE;
export const ALTEZZA_UTILE = A4.altezza - MARGINE_ALTO - MARGINE_BASSO;

/** Distanza fra due colonne della griglia. */
export const SPAZIO_COLONNE = 18;
/** Una delle due colonne della griglia. */
export const MEZZA_COLONNA = (LARGHEZZA_UTILE - SPAZIO_COLONNE) / 2;

/** Corpi del testo, in pt. */
export const CORPO = {
  titoloCopertina: 26,
  titoloSezione: 17,
  titoloGrafico: 10.5,
  corpo: 9.5,
  frase: 10,
  tabella: 8.5,
  nota: 7.5,
  etichetta: 7,
  valoreIndicatore: 20,
} as const;

/** Interlinea come multiplo del corpo. */
export const INTERLINEA = { stretta: 1.2, normale: 1.45, ampia: 1.55 } as const;

/** Altezza dell'intestazione di una sezione: numero, titolo e filetto (senza introduzione). */
export const ALTEZZA_INTESTAZIONE_SEZIONE = 72;
/** Intestazione ridotta delle pagine che continuano una sezione. */
export const ALTEZZA_INTESTAZIONE_SEGUE = 30;

/** Riga di tabella: padding verticale e orizzontale delle celle. */
export const CELLA = { paddingVerticale: 4.5, paddingOrizzontale: 6 } as const;
