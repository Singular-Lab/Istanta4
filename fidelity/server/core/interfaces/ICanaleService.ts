import { Request } from 'express';
import { CanaliAttributes } from '../../../lib/types';
import { CanaleResponseDTO } from '../dto';

export interface ICanaleService {
  getAllCanali(): Promise<CanaleResponseDTO[]>;
  getCanaleById(id: string): Promise<CanaleResponseDTO | null>;
  updateCanale(id: string, data: Partial<CanaleResponseDTO>): Promise<CanaleResponseDTO | null>;
  getCanaliByGDOId(idGDO: string): Promise<CanaleResponseDTO[]>;
  getAllCanaliForGDO(idGDO: string): Promise<CanaleResponseDTO[]>;
  createCanale(data: { nome: string, sigla: string, id: string, idGDO: string }): Promise<CanaliAttributes>;
  deleteCanale(guidID: string, req?: Request): Promise<boolean>;

  // Materialized View Operations
  getAllCanaliFromMaterializedView(): Promise<CanaleResponseDTO[]>;
  getCanaliByGDOIdFromMaterializedView(idGDO: string): Promise<CanaleResponseDTO[]>;
}
