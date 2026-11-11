import type {
  AnalisiPuntoVendita,
  DettaglioReferenzaPv,
  DettaglioVolantinoPv,
  PaginaRigheNonAbbinate,
  PaginaVerificaCollegamenti,
  PosizioneRiga,
  QualitaPuntiVendita,
  ReteInsegne,
  VolantiniRigaNonAbbinata,
} from '../../../lib/puntiVendita/analisi';
import type { EsitoRicercaPosizione } from '../repositories/PosizioniRigheRepository';
import type { FiltriVerifica } from '../services/AnalisiPuntoVenditaService';
import type { IndirizzoDaCercare } from '../services/PosizioniRigheJob';

/**
 * Le pagine del punto vendita costruite sulla timeline dei volantini (contratto in
 * lib/puntiVendita/analisi.ts). Con idGdo null (chi lavora per piu' GDO, senza GDO) il PV si cerca
 * fra tutte; un PV di un'altra GDO, o un kit che non e' nella storia del PV, da' NotFoundError.
 */
export interface IAnalisiPuntoVenditaService {
  analisi(idPuntoVendita: string, idGdo: string | null): Promise<AnalisiPuntoVendita>;
  volantino(idPuntoVendita: string, idKit: string, idGdo: string | null): Promise<DettaglioVolantinoPv>;
  referenza(idPuntoVendita: string, chiave: string, idGdo: string | null): Promise<DettaglioReferenzaPv>;
  reteInsegne(idGdo: string): Promise<ReteInsegne>;
  qualita(idGdo: string): Promise<QualitaPuntiVendita>;
  righeNonAbbinate(idGdo: string, pagina?: number, dimensione?: number): Promise<PaginaRigheNonAbbinate>;
  /**
   * I volantini in cui compare la riga non abbinata `chiave` (RigaNonAbbinata.chiave), dal piu'
   * recente. BadRequestError senza chiave, NotFoundError se la riga non e' piu' fra le non abbinate.
   */
  volantiniRigaNonAbbinata(idGdo: string, chiave: unknown): Promise<VolantiniRigaNonAbbinata>;
  /** I gruppi di righe collegati a un PV con l'esito della verifica, filtrati per esito e tipo. */
  verificaCollegamenti(idGdo: string, filtri?: FiltriVerifica): Promise<PaginaVerificaCollegamenti>;
  /** Gli indirizzi stampati da cercare con Nominatim: mai cercati o, con ancheNonTrovate, non trovati. */
  indirizziDaCercare(idGdo: string, ancheNonTrovate?: boolean): Promise<IndirizzoDaCercare[]>;
  salvaRicercaPosizione(idGdo: string, chiave: string, esito: EsitoRicercaPosizione, idUtente: string | null): Promise<void>;
  /**
   * Salva la posizione corretta a mano (CorrezionePosizione). BadRequestError per chiave o coordinate
   * non valide, NotFoundError se nessuna riga della GDO ha quella posizione.
   */
  correggiPosizione(idGdo: string, richiesta: unknown, idUtente: string | null): Promise<PosizioneRiga>;
}
