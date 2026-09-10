import { PuntoVenditaResponseDTO } from '../dto';
import {
  CreateDispositivoPuntoVenditaDTO,
  DispositivoPuntoVenditaResponseDTO,
  UpdateDispositivoPuntoVenditaDTO,
  PuntiVenditaPaginatedResponseDTO
} from '../dto/PuntoVenditaDTO';
import { DispositivoMetadata } from '../models/punto_vendita/dispositivi_punto_vendita';

export interface IPuntoVenditaService {
  // CRUD Operations
  getAllPuntiVendita(): Promise<PuntoVenditaResponseDTO[]>;
  getPuntoVenditaById(id: string): Promise<PuntoVenditaResponseDTO | null>;
  createPuntoVendita(data: Partial<PuntoVenditaResponseDTO>): Promise<PuntoVenditaResponseDTO>;
  updatePuntoVendita(id: string, data: Partial<PuntoVenditaResponseDTO>): Promise<PuntoVenditaResponseDTO | null>;
  deletePuntoVendita(id: string): Promise<boolean>;

  // Dispositivi punto vendita
  getAllDispositiviPuntoVendita(id_pv: string): Promise<DispositivoPuntoVenditaResponseDTO[]>;
  getDispositivoById(id: string): Promise<DispositivoPuntoVenditaResponseDTO | null>;
  createDispositivo(data: CreateDispositivoPuntoVenditaDTO): Promise<DispositivoPuntoVenditaResponseDTO>;
  updateDispositivo(id: string, data: UpdateDispositivoPuntoVenditaDTO): Promise<DispositivoPuntoVenditaResponseDTO | null>;
  deleteDispositivo(id: string): Promise<boolean>;
  getDispositivoByToken(token: string): Promise<DispositivoPuntoVenditaResponseDTO | null>;
  deviceHeartbeat(token: string, metadata?: DispositivoMetadata): Promise<boolean>;
  regenerateDeviceToken(id: string): Promise<string | null>;


  // Business Operations
  getPuntiVenditaByGDOId(gdoId: string): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByAreaId(areaId: string): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByRegione(regione: string): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByProvincia(provincia: string): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByCitta(citta: string): Promise<PuntoVenditaResponseDTO[]>;
  searchPuntiVendita(query: string): Promise<PuntoVenditaResponseDTO[]>;
  getPuntiVenditaByFilters(filters: {
    gdoId?: string;
    areaId?: string;
    canaleId?: string;
    regione?: string;
    provincia?: string;
    citta?: string;
  }): Promise<PuntoVenditaResponseDTO[]>;
  getAllPuntiVenditaFromIdGDO(idGDO: string): Promise<PuntoVenditaResponseDTO[]>;

  // Paginated Operations
  getAllPuntiVenditaPaginated(params: {
    idGDO: string;
    page?: number;
    pageSize?: number;
    search?: string;
    sortBy?: 'nome' | 'citta' | 'cap' | 'createdat';
    sortDirection?: 'asc' | 'desc';
    hasCoordinate?: boolean;
    idCombinazioneCanaleArea?: string;
  }): Promise<PuntiVenditaPaginatedResponseDTO>;

}
