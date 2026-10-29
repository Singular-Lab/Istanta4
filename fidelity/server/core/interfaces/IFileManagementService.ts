import { Request } from 'express';
import type { Writable } from 'stream';
import { FileItemKit } from '../../../lib/types';

/** Voce di uno ZIP di Olimpo: il file (basta il suo id su Olimpo) e il percorso nell'archivio. */
export interface VoceZipOlimpo {
  file: { id_olimpo_cloud?: string | null };
  nome: string;
}

/** File messi nell'archivio e file elencati in FILE_MANCANTI.txt perche' non scaricati. */
export interface EsitoZipOlimpo {
  file: number;
  mancanti: number;
}

export interface IFileManagementService {
  /** Upload */
  invioMaterialeAdFP(guidKitRuntime: string, tipoExport: string, nomeFile: string, meta: any, file: Express.Multer.File, req: Request): Promise<any>;
  uploadMateriale(file: Express.Multer.File, data: any, req: Request): Promise<any>;
  uploadKitManuali(idPromo: string, idKit: string, files: Express.Multer.File[], metadata: any, req: Request): Promise<any>;
  replaceFileKitRuntime(idFile: string, file: Express.Multer.File, req: Request): Promise<any>;
  uploadForzatoImmaginiOlimpo(file: Express.Multer.File, guidId: string, req: Request): Promise<any>;
  updateImmagineReferenza(file: Express.Multer.File, data: any, req: Request): Promise<any>;
  updateImmagineGruppoReferenza(file: Express.Multer.File, data: any, req: Request): Promise<any>;

  /** Download */
  downloadFilesAsZip(files: any[]): Promise<Buffer>;
  downloadPromoFilesAsZip(files: FileItemKit[], promoName: string): Promise<Buffer>;
  /** Lo ZIP dei PDF di Olimpo scritto in uno stream (per esempio la risposta HTTP), senza tenerlo in memoria. */
  scriviZipDaOlimpo(voci: VoceZipOlimpo[], destinazione: Writable): Promise<EsitoZipOlimpo>;
  processRejectedZip(zipBuffer: Buffer, rejectedFiles: any[]): Promise<any>;

  /** Retrieval */
  getAllFiles(id: string): Promise<any>;
  getAllFilesDocumentale(page: number, pageSize: number, filters: {
    idArea?: string;
    idCanale?: string;
    idTipoExport?: string;
    idFormato?: string;
    idPuntoVendita?: string;
    idLavorazione?: string;
    idCombinazione?: string;
    nome?: string;
  }, metadataFilter?: { field: string; value: string }): Promise<any>;
  getAllContenutiDigitali(page: number, pageSize: number, filters: {
    idArea?: string;
    idCanale?: string;
    idTipoExport?: string;
    idFormato?: string;
    idPuntoVendita?: string;
    idLavorazione?: string;
    idCombinazione?: string;
    nome?: string;
  }, metadataFilter?: { field: string; value: string }): Promise<any>;
  getProprietaMetaFilesRuntime(idKitRuntime: string): Promise<string[]>;
  getAllCombinazioniRuntimePDF(codice?: string): Promise<any[]>;
  getAllCombinazioniRuntimePDFWebPliant(idArea: string, idCanale: string, idsKitDesign: string[], idsTipiDiExport: string[]): Promise<any[]>;
  getContenutoDigitali(): Promise<any>;


}
