import { PERCORSO_AVANZAMENTO_PRODUZIONE } from '../produzione/avanzamento';
import { TIPO_MENU_ITEM } from '../enums';
import { ordineNelMenu, type VoceMenuConvertibile } from './menuMateriali';
import { normalizzaPercorso, sezioneDiPercorso } from './pagine';
import { SEZIONI_ESCLUSE_AGENZIA } from './preset';

/**
 * Un menu salvato dell'Agenzia senza le aree che l'Agenzia non vede (D9: Visualizzazione e
 * Comunicazione), applicato una volta dalla migrazione degli accessi:
 *
 * - le voci delle pagine di quelle aree se ne vanno; una voce che ha ancora sottovoci resta come
 *   gruppo, senza indirizzo;
 * - se ne va anche un gruppo (voce senza indirizzo o intestazione) rimasto senza voci;
 * - se la pagina iniziale se n'è andata, diventa pagina iniziale "Avanzamento produzione", se il
 *   menu ce l'ha, altrimenti la prima voce attiva rimasta, nell'ordine del menu.
 *
 * Le voci senza pagina nel catalogo (per esempio Correggo) restano: non sono di quelle aree.
 */

export interface EsitoMenuAgenzia<V> {
  /** Voci da togliere dal menu salvato. */
  tolte: V[];
  /** Voci rimaste che cambiano (indirizzo tolto o pagina iniziale), nella forma nuova. */
  aggiornate: V[];
}

const daTogliere = (pathname: string | null | undefined): boolean => {
  if (!pathname) return false;
  const sezione = sezioneDiPercorso(pathname);
  return sezione !== undefined && SEZIONI_ESCLUSE_AGENZIA.indexOf(sezione) >= 0;
};

export const pulisciMenuAgenzia = <V extends VoceMenuConvertibile>(menu: readonly V[]): EsitoMenuAgenzia<V> => {
  const voci = ordineNelMenu(menu.map(voce => ({ ...voce })));
  const figli = new Map<string, V[]>();
  for (const voce of voci) {
    if (!voce.id_parent) continue;
    figli.set(voce.id_parent, [...(figli.get(voce.id_parent) ?? []), voce]);
  }

  const tolte = new Set<V>();
  const aggiornate = new Set<V>();
  // Una voce resta se ha ancora una pagina che l'Agenzia vede o sottovoci rimaste; si decide dal basso.
  const resta = (voce: V): boolean => {
    const sottovoci = (figli.get(voce.id_menu_item) ?? []).filter(resta);
    if (voce.tipo === TIPO_MENU_ITEM.SEPARATOR) return true;
    if (!daTogliere(voce.pathname)) {
      if (voce.pathname || sottovoci.length > 0) return true;
      // Gruppo senza indirizzo che aveva sottovoci, tutte tolte
      if ((figli.get(voce.id_menu_item) ?? []).length > 0) {
        tolte.add(voce);
        return false;
      }
      return true;
    }
    if (sottovoci.length > 0) {
      voce.pathname = null;
      voce.codice_permesso = null;
      aggiornate.add(voce);
      return true;
    }
    tolte.add(voce);
    return false;
  };
  // Una voce si toglie solo senza sottovoci rimaste: le sottovoci tolte lo sono gia' per conto loro
  for (const voce of voci) if (!voce.id_parent) resta(voce);

  // Intestazioni senza voci fino alla successiva, fra le voci dello stesso livello
  const fratelli = new Map<string, V[]>();
  for (const voce of voci) {
    const chiave = voce.id_parent ?? '';
    fratelli.set(chiave, [...(fratelli.get(chiave) ?? []), voce]);
  }
  for (const livello of fratelli.values()) {
    livello.forEach((voce, i) => {
      if (voce.tipo !== TIPO_MENU_ITEM.SEPARATOR) return;
      const seguenti = livello.slice(i + 1);
      const fine = seguenti.findIndex(v => v.tipo === TIPO_MENU_ITEM.SEPARATOR);
      const sezione = fine < 0 ? seguenti : seguenti.slice(0, fine);
      if (sezione.every(v => tolte.has(v))) tolte.add(voce);
    });
  }

  const rimaste = voci.filter(voce => !tolte.has(voce));
  const iniziale = voci.find(voce => voce.start_page);
  if (iniziale && tolte.has(iniziale)) {
    const attive = rimaste.filter(voce => voce.tipo !== TIPO_MENU_ITEM.SEPARATOR && voce.pathname && !voce.disabilitato);
    const nuova = attive.find(voce => normalizzaPercorso(voce.pathname ?? '') === PERCORSO_AVANZAMENTO_PRODUZIONE) ?? attive[0];
    if (nuova) {
      nuova.start_page = true;
      aggiornate.add(nuova);
    }
  }

  return {
    tolte: voci.filter(voce => tolte.has(voce)),
    aggiornate: rimaste.filter(voce => aggiornate.has(voce)),
  };
};
