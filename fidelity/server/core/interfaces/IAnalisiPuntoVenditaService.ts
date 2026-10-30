import type {
  AnalisiPuntoVendita,
  DettaglioReferenzaPv,
  DettaglioVolantinoPv,
  PaginaRigheNonAbbinate,
  QualitaPuntiVendita,
  ReteInsegne,
} from '../../../lib/puntiVendita/analisi';

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
}
