import { AreaResponseDTO, CanaleResponseDTO, CombinazioneCanaleAreaResponseDTO, FormatiResponseDTO, GDOResponseDTO, PuntoVenditaResponseDTO, TipiDiExportResponseDTO } from '../dto';
import type { AnagraficaAreeCanali } from '../../../lib/areeCanali/anagrafica';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { IAreaService } from '../interfaces/IAreaService';
import { ICanaleService } from '../interfaces/ICanaleService';
import { ICombinazioneAreeCanaliService } from '../interfaces/ICombinazioneAreeCanaliService';
import { IGdoService } from '../interfaces/IGdoService';
import { IFormatoService } from '../interfaces/IFormatoService';
import { IPuntoVenditaService } from '../interfaces/IPuntoVenditaService';
import { IServiceFacade } from '../interfaces/IServiceFacade';
import { ITipoExportService } from '../interfaces/ITipoExportService';
import { anagraficaAreeCanali } from './areeCanaliProxy';

/**
 * Implementazione del pattern Facade per aggregare i vari servizi
 * e ridurre le dipendenze nei controller
 */
export class ServiceFacade implements IServiceFacade {
  constructor(
    private gdoService: IGdoService,
    private areaService: IAreaService,
    private canaleService: ICanaleService,
    private puntoVenditaService: IPuntoVenditaService,
    private formatoService: IFormatoService,
    private tipoExportService: ITipoExportService,
    private combinazioneAreeCanaliService: ICombinazioneAreeCanaliService
  ) { }

  // GDO Services
  async getGDOByUtenteId(idUtente: string): Promise<GDOResponseDTO | null> {
    return this.gdoService.getGDOByUtenteId(idUtente);
  }

  // Area Services
  async getAllAreas(): Promise<AreaResponseDTO[]> {
    return this.areaService.getAllAreas();
  }

  async getAreasByGDOId(gdoId: string): Promise<AreaResponseDTO[]> {
    return this.areaService.getAreasByGDOId(gdoId);
  }

  // Canale Services
  async getAllCanali(): Promise<CanaleResponseDTO[]> {
    return this.canaleService.getAllCanali();
  }

  async getCanaliByGDOId(idGDO: string): Promise<CanaleResponseDTO[]> {
    return this.canaleService.getCanaliByGDOId(idGDO);
  }

  // PuntoVendita Services
  async getAllPuntiVendita(): Promise<PuntoVenditaResponseDTO[]> {
    return this.puntoVenditaService.getAllPuntiVendita();
  }

  async getPuntiVenditaByGDOId(gdoId: string): Promise<PuntoVenditaResponseDTO[]> {
    return this.puntoVenditaService.getAllPuntiVenditaFromIdGDO(gdoId);
  }

  async getPuntoVenditaById(id: string): Promise<PuntoVenditaResponseDTO | null> {
    return this.puntoVenditaService.getPuntoVenditaById(id);
  }

  // Impostazioni Services
  async getAllFormati(): Promise<FormatiResponseDTO[]> {
    return this.formatoService.getAllFormati();
  }

  async getAllTipiExport(): Promise<TipiDiExportResponseDTO[]> {
    return this.tipoExportService.getAllTipiExport();
  }

  // Combinazione Services
  async getAllCombinazioniForGDO(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]> {
    return this.combinazioneAreeCanaliService.getAllCombinazioniForGDO(idGDO);
  }

  /** Aree, canali e combinazioni della GDO, letti dalle tabelle (vedi lib/areeCanali/anagrafica.ts). */
  async getAllAreeCanaliECombinazioni(ambito: AmbitoGdo): Promise<AnagraficaAreeCanali> {
    return anagraficaAreeCanali(ambito);
  }

}
