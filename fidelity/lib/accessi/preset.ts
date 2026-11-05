import { CodicePermesso, PERMESSI as P, TUTTI_I_PERMESSI, VocePermesso } from './catalogo';
import type { SezionePagina } from './sezioni';

/**
 * Preset di permessi: insiemi pronti da applicare a un ruolo dalla gestione accessi (come modifiche
 * da rivedere prima di salvarle) e da cui nascono i ruoli di un'installazione nuova.
 *
 * - Solo visualizzazione: chi consulta i dati dei volantini senza seguire la produzione
 *   (Category, Marketing).
 * - Agenzia: chi fa la produzione e gestisce l'anagrafica, senza Visualizzazione né Comunicazione.
 *
 * Nota: il client compila con lib ES6, quindi qui niente Object.values/includes.
 */

export type IdPreset = 'solo-visualizzazione' | 'agenzia';

export interface DefinizionePreset {
  id: IdPreset;
  nome: string;
  descrizione: string;
  permessi: CodicePermesso[];
}

/** Aree del menu che l'Agenzia non vede (D9): i loro permessi non sono nel suo preset. */
export const SEZIONI_ESCLUSE_AGENZIA: readonly SezionePagina[] = ['visualizzazione', 'comunicazione'];

const assegnabili = (filtro: (voce: VocePermesso) => boolean): CodicePermesso[] =>
  TUTTI_I_PERMESSI.filter(voce => !voce.sistema && filtro(voce)).map(voce => voce.codice);

/** Permessi delle aree che l'Agenzia non vede: la migrazione dell'Agenzia li toglie. */
export const PERMESSI_FUORI_DA_AGENZIA: readonly CodicePermesso[] =
  assegnabili(voce => SEZIONI_ESCLUSE_AGENZIA.indexOf(voce.area.sezione) >= 0);

export const PRESET: readonly DefinizionePreset[] = [
  {
    id: 'solo-visualizzazione',
    nome: 'Solo visualizzazione',
    descrizione: 'Consultazione di volantini, POP, punti vendita, WebPliant, report, dashboard e strumenti, senza la produzione.',
    permessi: [
      P.MATERIALI.VISUALIZZA, P.MATERIALI.SCARICA,
      P.VOLANTINI.VISUALIZZA,
      P.ANALISI.VISUALIZZA, P.ANALISI.DASHBOARD_CATEGORY, P.ANALISI.DASHBOARD_MARKETING,
      P.GDO.VISUALIZZA,
      P.WEBPLIANT.VISUALIZZA,
      P.STRUMENTI.VISUALIZZA,
    ],
  },
  {
    id: 'agenzia',
    nome: 'Agenzia',
    descrizione: 'Tutta la Produzione e la Gestione interna, senza Visualizzazione né Comunicazione.',
    permessi: assegnabili(voce => SEZIONI_ESCLUSE_AGENZIA.indexOf(voce.area.sezione) < 0),
  },
];

export const presetDi = (id: IdPreset): DefinizionePreset => {
  for (const preset of PRESET) if (preset.id === id) return preset;
  throw new Error(`Preset sconosciuto: ${id}`);
};
