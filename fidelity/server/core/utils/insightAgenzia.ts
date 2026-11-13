import type { InsightVolantinoAgenzia } from '../agenzia_lib/types';
import type { OpzioniInsight } from './insightVolantino';
import { regoleLinee, sigleAssegnate } from './lineeDistributore';
import { datoDellaRiga, type RigaReferenza } from './referenzaStampata';

/** Le opzioni degli insight che dichiara la libreria agenzia del cliente. */
export type OpzioniDellAgenzia = Pick<
  OpzioniInsight,
  'lineeDistributore' | 'loghiAssegnati' | 'descrizioneBox' | 'ruoli' | 'temi' | 'sezionePagina' | 'nomeSezione'
>;

/**
 * Le opzioni degli insight del volantino che vengono dalla libreria agenzia del cliente, lette sulle
 * righe del kit: linee del distributore con i loghi assegnati da Istanta, descrizione del box,
 * etichette di ruoli e temi e sezione delle pagine del menabò. Le stesse per la pagina degli insight
 * (VolantinoService) e per il dettaglio della promozione (ConsultazioneService), cosi' linea e ruolo
 * di un prodotto sono uguali nelle due pagine. Senza libreria, nessuna opzione.
 */
export function opzioniDellAgenzia(agenzia: InsightVolantinoAgenzia | undefined, righe: readonly RigaReferenza[]): OpzioniDellAgenzia {
  if (!agenzia) return {};
  const opzioni: OpzioniDellAgenzia = {};
  const regole = regoleLinee(agenzia.lineeDistributore);
  if (regole) {
    const loghi = new Map(righe.map(riga => [String(riga.id), sigleAssegnate(riga.foto_extra)] as const));
    opzioni.lineeDistributore = regole;
    opzioni.loghiAssegnati = idReferenza => loghi.get(idReferenza) ?? [];
  }
  // Legate al modulo della libreria: le funzioni dichiarate possono usare `this`
  if (agenzia.descrizioneBox) opzioni.descrizioneBox = testi => agenzia.descrizioneBox!(testi);
  if (agenzia.ruoli) opzioni.ruoli = agenzia.ruoli;
  if (agenzia.temi) opzioni.temi = agenzia.temi;
  const menabo = agenzia.menabo;
  if (menabo?.campo) {
    const sezioni = new Map(righe.map(riga => [String(riga.id), datoDellaRiga(riga, menabo.campo)] as const));
    opzioni.sezionePagina = idReferenza => sezioni.get(idReferenza) ?? null;
    if (menabo.nome) opzioni.nomeSezione = sezione => menabo.nome!(sezione);
  }
  return opzioni;
}
