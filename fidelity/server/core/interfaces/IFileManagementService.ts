import { Request } from 'express';
import { FileItemKit } from '../../../lib/types';

export interface IFileManagementService {
  /** Upload */
  invioMaterialeAdFP(guidKitRuntime: string, tipoExport: string, nomeFile: string, meta: any, file: Express.Multer.File, req: Request): Promise<any>;
  uploadMateriale(file: Express.Multer.File, data: any, req: Request): Promise<any>;
  uploadKitManuali(idPromo: string, idKit: string, files: Express.Multer.File[], metadata: any, req: Request): Promise<any>;
  replaceFileKitRuntime(idFile: string, file: Express.Multer.File, req: Request): Promise<any>;
  uploadForzatoImmaginiOlimpo(file: Express.Multer.File, guidId: string): Promise<any>;
  updateImmagineReferenza(file: Express.Multer.File, data: any): Promise<any>;
  updateImmagineGruppoReferenza(file: Express.Multer.File, data: any): Promise<any>;

  /** Download */
  downloadFilesAsZip(files: any[]): Promise<Buffer>;
  downloadPromoFilesAsZip(files: FileItemKit[], promoName: string): Promise<Buffer>;
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
  getKitRunTimeById(id: string, get_files?: boolean): Promise<any>;
  getProprietaMetaFilesRuntime(idKitRuntime: string): Promise<string[]>;
  getAllCombinazioniRuntimePDF(codice?: string): Promise<any[]>;
  getAllCombinazioniRuntimePDFWebPliant(idArea: string, idCanale: string, idsKitDesign: string[], idsTipiDiExport: string[]): Promise<any[]>;
  getContenutoDigitali(): Promise<any>;


}
