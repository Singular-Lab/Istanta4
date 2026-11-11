/**
 * La scheda del box del volantino adattata alla GDO (spec insight-volantino, "Scheda del volantino
 * adattata al cliente e alla GDO"): quali dati dei prodotti mostra in vista e quali codici mette nei
 * "Dettagli tecnici", dalla sezione volantino della configurazione degli insight. Senza zod: lo usa
 * anche il client; la verifica della configurazione e' in configurazione.ts.
 */

/**
 * I dati dei prodotti che la scheda del box puo' mostrare in vista (volantino.scheda.datiProdotto),
 * nell'ordine in cui si elencano (spec insight-volantino, "Scheda del volantino adattata al cliente
 * e alla GDO").
 */
export const DATI_PRODOTTO_SCHEDA = ['codice', 'ean', 'settore', 'segmento', 'tema', 'ruolo'] as const;
/** I codici che la scheda puo' mettere nei "Dettagli tecnici": quelli dei prodotti e quelli del box. */
export const DATI_TECNICI_SCHEDA = [...DATI_PRODOTTO_SCHEDA, 'meccanicaFonte', 'origine', 'codiceBox'] as const;

export type DatoProdottoScheda = (typeof DATI_PRODOTTO_SCHEDA)[number];
export type DatoTecnicoScheda = (typeof DATI_TECNICI_SCHEDA)[number];

/** Senza indicazioni della GDO: in vista tutti i dati dei prodotti, nei dettagli i codici della fonte. */
export const DATI_PRODOTTO_PREDEFINITI: readonly DatoProdottoScheda[] = DATI_PRODOTTO_SCHEDA;
export const DATI_TECNICI_PREDEFINITI: readonly DatoTecnicoScheda[] = ['meccanicaFonte', 'origine', 'codiceBox'];

/** La sezione volantino della configurazione: cosa mostra la scheda del box per questa GDO. */
export interface ConfigurazioneVolantino {
  scheda?: {
    /** I dati dei prodotti in vista, in quest'ordine. */
    datiProdotto?: DatoProdottoScheda[];
    /** I codici nei "Dettagli tecnici" chiusi. */
    dettagliTecnici?: DatoTecnicoScheda[];
  };
}
