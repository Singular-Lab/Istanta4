import { PuntoVenditaResponseDTO } from '../dto';
import {
  CreateDispositivoPuntoVenditaDTO,
  DispositivoPuntoVenditaResponseDTO,
  PuntiVenditaPaginatedResponseDTO,
  UpdateDispositivoPuntoVenditaDTO
} from '../dto/PuntoVenditaDTO';
import { DispositivoMetadata } from '../models/punto_vendita/dispositivi_punto_vendita';
import type { PuntoVenditaTextInput } from '../utils/puntoVenditaNormalization';

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
  getPuntiVenditaForPlugin(idGdo: string | undefined, idArea: string, idCanale: string): Promise<PuntoVenditaResponseDTO[]>;
  checkPuntiVenditaForPlugin(idGdo: string | undefined, idArea: string, idCanale: string, items: PuntoVenditaTextInput[]): Promise<{
    results: Array<{
      input: PuntoVenditaTextInput;
      stato: 'present' | 'missing' | 'possibleDuplicate';
      puntoVendita?: PuntoVenditaResponseDTO;
    }>;
    presenti: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
    mancanti: PuntoVenditaTextInput[];
    possibiliDuplicati: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
  }>;
  loadPuntiVenditaForPlugin(idGdo: string | undefined, idArea: string, idCanale: string, items: PuntoVenditaTextInput[]): Promise<{
    matched: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
    created: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
    updated: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
    missing: PuntoVenditaTextInput[];
    possibleDuplicates: Array<{ input: PuntoVenditaTextInput; puntoVendita: PuntoVenditaResponseDTO }>;
    duplicates: Array<{ key: string; puntoVenditaIds: string[] }>;
  }>;

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
