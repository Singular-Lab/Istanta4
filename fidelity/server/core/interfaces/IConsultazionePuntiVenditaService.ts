import type { PuntoVenditaConsultazione } from '../../../lib/puntiVendita/consultazione';
import type { VolantinoAttivoDTO } from '../dto/PuntoVenditaDTO';

/**
 * Consultazione dei punti vendita (contratto in lib/puntiVendita/consultazione.ts), sempre
 * nella GDO indicata: un punto vendita di un'altra GDO da' NotFoundError, come uno inesistente.
 */
export interface IConsultazionePuntiVenditaService {
  elenca(idGdo: string): Promise<PuntoVenditaConsultazione[]>;
  dettaglio(idGdo: string, idPuntoVendita: string): Promise<PuntoVenditaConsultazione>;
  volantiniAttivi(idGdo: string, idPuntoVendita: string): Promise<VolantinoAttivoDTO[]>;
}
