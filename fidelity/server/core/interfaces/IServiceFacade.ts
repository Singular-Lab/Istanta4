import type { AnagraficaAreeCanali } from '../../../lib/areeCanali/anagrafica';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { AreaResponseDTO, CanaleResponseDTO, CombinazioneCanaleAreaResponseDTO, FormatiResponseDTO, GDOResponseDTO, PuntoVenditaResponseDTO, TipiDiExportResponseDTO } from '../dto';

/**
 * Interfaccia Facade che aggrega le funzionalità di diversi servizi
 * per ridurre le dipendenze nei controller
 */
export interface IServiceFacade {
  // GDO Services
  getGDOByUtenteId(idUtente: string): Promise<GDOResponseDTO | null>;

  /** Aree, canali e combinazioni della GDO (lib/areeCanali/anagrafica.ts). */
  getAllAreeCanaliECombinazioni(ambito: AmbitoGdo): Promise<AnagraficaAreeCanali>;
  // Area Services
  getAllAreas(): Promise<AreaResponseDTO[]>;
  getAreasByGDOId(gdoId: string): Promise<AreaResponseDTO[]>;

  // Canale Services
  getAllCanali(): Promise<CanaleResponseDTO[]>;
  getCanaliByGDOId(idGDO: string): Promise<CanaleResponseDTO[]>;

  // PuntoVendita Services
  getAllPuntiVendita(): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByGDOId(gdoId: string): Promise<PuntoVenditaResponseDTO[]>;

  // Impostazioni Services
  getAllFormati(): Promise<FormatiResponseDTO[]>;
  getAllTipiExport(): Promise<TipiDiExportResponseDTO[]>;

  // Combinazione Services
  getAllCombinazioniForGDO(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]>;

  getPuntoVenditaById(id: string): Promise<PuntoVenditaResponseDTO | null>;
}
