import { CreateTipiDiExportDTO, TipiDiExportResponseDTO } from '../dto';

export interface ITipoExportService {
  creaTipoExport(data: CreateTipiDiExportDTO): Promise<TipiDiExportResponseDTO>;
  getTipoExportById(id: string): Promise<TipiDiExportResponseDTO | null>;
  getTipoExportByCodice(codice: string): Promise<TipiDiExportResponseDTO | null>;
  getAllTipiExport(): Promise<TipiDiExportResponseDTO[]>;
  deleteTipoExport(id: string): Promise<any>;
  getTipiExportPerPOP(): Promise<TipiDiExportResponseDTO[]>;
}
