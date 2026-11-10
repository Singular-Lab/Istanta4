/**
 * Lettura delle referenze per gli insight del volantino (config/flyerInsightsConfig.json), uguale
 * per i kit di Istanta e per quelli dello storico, che scrivono gli stessi dati in modo diverso:
 * - un campo della config puo' indicare piu' percorsi, vale il primo non vuoto (la meccanica sta
 *   nella colonna per Istanta, fra i data_fields per lo storico);
 * - una chiave che contiene il punto ("Referenza.Codice") si legge per intero;
 * - l'anagrafica dei reparti dell'installazione riconduce ogni referenza al suo reparto, dal codice
 *   con o senza zeri iniziali ("1" e "01") o dalla descrizione.
 *
 * Funzioni pure: niente database, niente lettura della config.
 */

/** Un reparto dell'anagrafica dell'installazione (dataMapping.reparti). */
export interface RepartoAnagrafica {
  codice: string;
  descrizione: string;
}

/** Percorso di un campo: uno solo, oppure piu' alternative in ordine. */
export type PercorsoCampo = string | readonly string[];

function segui(sorgente: unknown, parti: readonly string[]): unknown {
  if (parti.length === 0) return sorgente;
  if (sorgente === null || typeof sorgente !== 'object') return undefined;
  const oggetto = sorgente as Record<string, unknown>;
  // Prima la chiave piu' lunga: "data_fields.Referenza.Codice" trova la chiave "Referenza.Codice"
  for (let fine = parti.length; fine >= 1; fine--) {
    const chiave = parti.slice(0, fine).join('.');
    if (!Object.prototype.hasOwnProperty.call(oggetto, chiave)) continue;
    const valore = segui(oggetto[chiave], parti.slice(fine));
    if (valore !== undefined && valore !== null) return valore;
  }
  return undefined;
}

/** Il valore di un percorso: array e oggetti come sono, il resto come testo, '' se manca. */
function valoreDelPercorso(sorgente: unknown, percorso: string): unknown {
  const valore = segui(sorgente, percorso.split('.'));
  if (valore === undefined || valore === null) return '';
  if (typeof valore === 'object') return valore;
  return String(valore);
}

function vuoto(valore: unknown): boolean {
  if (typeof valore === 'string') return valore.trim() === '';
  if (Array.isArray(valore)) return valore.length === 0;
  return valore === undefined || valore === null;
}

/**
 * Il valore di un campo della config. Con piu' percorsi vale il primo non vuoto; se sono tutti
 * vuoti, il valore del primo (cosi' le foto restano un elenco vuoto e non diventano testo).
 */
export function valoreCampo(sorgente: unknown, percorso: PercorsoCampo): unknown {
  const percorsi = typeof percorso === 'string' ? [percorso] : percorso;
  if (percorsi.length === 0) return '';
  const valori = percorsi.map(alternativa => valoreDelPercorso(sorgente, alternativa));
  return valori.find(valore => !vuoto(valore)) ?? valori[0];
}

/** L'anagrafica dei reparti dalla config: solo le voci con codice e descrizione. */
export function leggiAnagraficaReparti(config: unknown): RepartoAnagrafica[] {
  if (!Array.isArray(config)) return [];
  return config.flatMap((voce): RepartoAnagrafica[] => {
    if (voce === null || typeof voce !== 'object') return [];
    const { codice, descrizione } = voce as Record<string, unknown>;
    if (typeof codice !== 'string' || typeof descrizione !== 'string') return [];
    if (codice.trim() === '' || descrizione.trim() === '') return [];
    return [{ codice: codice.trim(), descrizione: descrizione.trim() }];
  });
}

/** Testo per i confronti: maiuscole e spazi singoli. */
export const testoNormalizzato = (testo: string): string => testo.toUpperCase().trim().replace(/\s+/g, ' ');

/** Stesso codice reparto: numerici a confronto come numeri ("1" = "01"), gli altri come testo. */
export function stessoCodice(a: string, b: string): boolean {
  const primo = a.trim();
  const secondo = b.trim();
  if (/^\d+$/.test(primo) && /^\d+$/.test(secondo)) return Number(primo) === Number(secondo);
  return testoNormalizzato(primo) === testoNormalizzato(secondo);
}

/** Il reparto dell'anagrafica: dal codice, altrimenti dalla descrizione. */
export function repartoInAnagrafica(
  anagrafica: readonly RepartoAnagrafica[],
  codice: unknown,
  descrizione: unknown,
): RepartoAnagrafica | undefined {
  const codiceLetto = typeof codice === 'string' ? codice : '';
  if (codiceLetto.trim() !== '') {
    const trovato = anagrafica.find(reparto => stessoCodice(reparto.codice, codiceLetto));
    if (trovato) return trovato;
  }
  const descrizioneLetta = typeof descrizione === 'string' ? testoNormalizzato(descrizione) : '';
  if (descrizioneLetta === '') return undefined;
  return anagrafica.find(reparto => testoNormalizzato(reparto.descrizione) === descrizioneLetta);
}

/**
 * Riconduce la referenza al reparto dell'anagrafica: codice e descrizione diventano quelli
 * dell'anagrafica. Un reparto che non c'e' resta com'e' arrivato.
 */
export function applicaAnagraficaReparti(
  referenza: Record<string, unknown>,
  anagrafica: readonly RepartoAnagrafica[],
  campoCodice: string,
  campoDescrizione?: string,
): void {
  if (anagrafica.length === 0) return;
  const reparto = repartoInAnagrafica(
    anagrafica,
    referenza[campoCodice],
    campoDescrizione ? referenza[campoDescrizione] : undefined,
  );
  if (!reparto) return;
  referenza[campoCodice] = reparto.codice;
  if (campoDescrizione) referenza[campoDescrizione] = reparto.descrizione;
}
