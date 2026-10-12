import { Request } from 'express';
import { DESIGN_KIT, FileItemKit, FileItemKitLog, ImportStorico, RUNTIME_KIT } from '../../../lib/types';

export interface IKitRuntimeService {
  /** Retrieval */
  getAllKitPerGestioneLavorazione(idPromo: string, req: Request): Promise<{
    lavorazioni: any[];
    volantini: Array<{
      guidId: string;
      titolo: string;
      nomeArea?: string;
      nomeCanale?: string;
      stato_lavorazione: string;
      files: any[];
    }>;
  }>;
  getKitPerGestioneLavorazione(idPromo: string, idKit: string, req: Request): Promise<any>;
  getFilesPerGestioneLavorazione(idKit: string, req: Request): Promise<any>;
  getKitRuntimeById(id: string): Promise<RUNTIME_KIT>;
  getKitRuntimeByIdPerWebhook(id: string): Promise<any>;
  getAllKitRuntimeByIdPromo(idPromo: string): Promise<RUNTIME_KIT[]>;
  getAllKitByAreaCanalePV(data: {
    idArea?: string; idCanale?: string; idPv?: string;
    idPromo?: string; idFormato?: string; id?: string;
    promoContext?: { nome_field: string; user_value: string; }[];
    tags?: string[];
    tipoLavorazione?:number
  }): Promise<any>;

  /** Mutations */
  createKitRunTime(data: RUNTIME_KIT): Promise<any>;
  creaKitRuntimeManuale(idPromo: string, data: any): Promise<any>;
  bulkCreateRuntime(data: (DESIGN_KIT & { idPromo: string })[]): Promise<RUNTIME_KIT[]>;
  mettiInStatoDiEliminazione(id: string): Promise<any>;
  eliminaKitRuntime(id: string): Promise<any>;
  eliminaFileKitRuntime(id: string): Promise<any>;

  /** Workflow & States */
  avvioRevisioneKitManuale(idLavorazione: string): Promise<any>;
  avvioRevisioneKitAutomatico(idLavorazione: string): Promise<any>;
  riportaInLavorazione(idLavorazione: string, filesAccepted: string[], filesRejected: { id: string; log: { messaggio: string } }[], req: Request): Promise<any>;
  riportaInLavorazioneConErroriAutomatico(idLavorazione: string, filesAccepted: string[], filesRejected: { id: string; log: { messaggio: string } }[], req: Request): Promise<any>;
  pubblicaKitRuntime(idLavorazione: string, req: Request): Promise<any>;

  /** Combinations */
  getAllKitRuntime(): Promise<RUNTIME_KIT[]>;
  getAllCombinazioniRuntimeFilters(filters: any): Promise<RUNTIME_KIT[]>;
  cambioStatoCombinazione(guidId: string, stato: "ATTIVO" | "DISATTIVO"): Promise<any>;

  /** File Runtime */
  getFilesRuntimeByIdKitRuntime(idKitRuntime: string): Promise<FileItemKit[]>;
  getFilesRuntimeByIdKitRuntimePaginated(params: {
    idKitRuntime: string;
    page?: number;
    pageSize?: number;
    search?: string;
    searchProperty?: string;
  }): Promise<{
    files: FileItemKit[];
    totalItems: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
    stats: {
      totalFiles: number;
      inRevisionCount: number;
      filesWithMetaCount: number;
      duplicateCount: number;
    };
  }>;
  getFilesRuntimeByIdKitRuntimeFilters(filters: Partial<FileItemKit>): Promise<FileItemKit[]>;
  insertNewFileRuntimeLog(data: FileItemKitLog): Promise<any>;
  getFileRunTimeLogByNomeFileEIdKitRuntime(nomeFile: string, idKitRuntime: string): Promise<FileItemKitLog | null>;
  insertNewFileRuntime(data: FileItemKit): Promise<any>;
  updateSingleFileRuntime(data: FileItemKit): Promise<any>;
  updateSingleFileRuntimeLog(data: FileItemKitLog): Promise<any>;
  getKitManualeDaId(idKit: string): Promise<any>;
  /** Marca la lavorazione come recuperata dallo storico e ne registra l'esito. */
  salvaImportStorico(idKitRuntime: string, esito: ImportStorico): Promise<any>;
  clearAllFilesKitRuntime(idKitRuntime: string, guidIdExport: string): Promise<boolean>
}
