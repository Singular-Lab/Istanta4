import { PERCORSO_AVANZAMENTO_PRODUZIONE } from '../produzione/avanzamento';
import type { EsitoConversioneMenu, VoceMenuConvertibile } from './menuMateriali';
import { normalizzaPercorso, paginaPer, voceDiMenuPer } from './pagine';

/**
 * La pagina Avanzamento produzione entra nei menu salvati subito prima di "Promozioni in corso",
 * sotto lo stesso padre, con titolo e icona del catalogo e lo stato attivo/disattivo della voce
 * vicina; le voci che seguono scendono di un posto. Un menu senza "Promozioni in corso", o che ha
 * già la voce, non cambia. La regola vale per il menu predefinito del Superadmin e per la
 * migrazione dei menu salvati, che la applica una volta sola.
 */

export const PERCORSO_PROMOZIONI_IN_CORSO = '/promozioni/in-corso';

const conPercorso = (voce: VoceMenuConvertibile, percorso: string): boolean =>
  !!voce.pathname && normalizzaPercorso(voce.pathname) === percorso;

export const aggiungiVoceAvanzamento = <V extends VoceMenuConvertibile>(
  menu: readonly V[],
  nuovoId: () => string
): EsitoConversioneMenu<V> => {
  const voci = menu.map(voce => ({ ...voce }));
  const inCorso = voci
    .filter(voce => conPercorso(voce, PERCORSO_PROMOZIONI_IN_CORSO))
    .sort((a, b) => a.ordinamento - b.ordinamento)[0];
  if (!inCorso || voci.some(voce => conPercorso(voce, PERCORSO_AVANZAMENTO_PRODUZIONE))) {
    return { voci, aggiornate: [], inserite: [] };
  }

  const padre = inCorso.id_parent ?? null;
  const posizione = inCorso.ordinamento;
  const aggiornate: V[] = [];
  for (const voce of voci) {
    if ((voce.id_parent ?? null) !== padre || voce.ordinamento < posizione) continue;
    voce.ordinamento += 1;
    aggiornate.push(voce);
  }

  const catalogo = voceDiMenuPer(PERCORSO_AVANZAMENTO_PRODUZIONE);
  const avanzamento: V = {
    ...inCorso,
    id_menu_item: nuovoId(),
    titolo: catalogo?.titolo ?? 'Avanzamento produzione',
    icona: catalogo?.icona ?? null,
    pathname: PERCORSO_AVANZAMENTO_PRODUZIONE,
    codice_permesso: paginaPer(PERCORSO_AVANZAMENTO_PRODUZIONE)?.permesso ?? null,
    disabilitato: inCorso.disabilitato ?? false,
    start_page: false,
    ordinamento: posizione,
  };
  voci.splice(voci.indexOf(inCorso), 0, avanzamento);
  return { voci, aggiornate, inserite: [avanzamento] };
};
