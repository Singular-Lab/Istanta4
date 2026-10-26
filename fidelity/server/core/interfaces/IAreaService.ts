import { AreaResponseDTO, CreateAreaDTO } from '../dto';

export interface IAreaService {
  // CRUD Operations
  getAllAreas(): Promise<AreaResponseDTO[]>;
  getAreaById(id: string): Promise<AreaResponseDTO | null>;
  createArea(data: CreateAreaDTO): Promise<AreaResponseDTO>;
  updateArea(id: string, data: Partial<AreaResponseDTO>): Promise<AreaResponseDTO | null>;
  deleteArea(guid_id: string): Promise<boolean>;

  // Business Operations
  getAreasByGDOId(gdoId: string): Promise<AreaResponseDTO[]>;
  getAllAreeForGDO(gdoId: string): Promise<AreaResponseDTO[]>;

  // Materialized View Operations
  getAllAreasFromMaterializedView(): Promise<AreaResponseDTO[]>;
  getAreasByGDOIdFromMaterializedView(gdoId: string): Promise<AreaResponseDTO[]>;
}
