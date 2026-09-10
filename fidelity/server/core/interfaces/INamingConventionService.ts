import { Request } from 'express';
import { NamingConventionResponseDTO } from '../dto';

export interface INamingConventionService {
  getAllNamingConventions(): Promise<NamingConventionResponseDTO[]>;
  creaNamingConventionConReq(data: any, req: Request): Promise<any>;
  deleteNamingConvention(id: string): Promise<any>;
  getAllNamingConventionFromIstanta(req: Request): Promise<any[]>;
}
