
import { GDOResponseDTO, RuoloUtenteGDOResponseDTO } from '../dto';

export interface IGdoService {
  // GDO Management
  getGDOById(id: string): Promise<GDOResponseDTO | null>;
  getGDOByUtenteId(id: string): Promise<GDOResponseDTO | null>;
  getAllRuoliGDO(): Promise<RuoloUtenteGDOResponseDTO[]>;
  getAllGDO(): Promise<GDOResponseDTO[]>;
}
