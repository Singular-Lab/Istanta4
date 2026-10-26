import { Request } from 'express';
import { TIPO_KIT_DESIGN } from '../../../lib/enums';
import { Declinazione, FileItemKit, OggettoTipiDiExport, RaccoglitoreKit } from '../../../lib/types';

export interface IRaccoglitoreKitService {
  getRaccoglitoreKitById(id: string): Promise<RaccoglitoreKit | null>;
  eliminaRaccoglitoreKit(id: string): Promise<any>;
  updateRaccoglitoreKit(data: {
    id: string; titolo: string; quantita: number;
    tipiDiExportInKit: OggettoTipiDiExport[];
    guidAree: string[]; guidCanali: string[];
    guidIdPv?: string[]; guidFormato: string;
    tags?: string[];
    tipo: TIPO_KIT_DESIGN; files?: FileItemKit[];
  }): Promise<any>;
  checkSeRaccoglitoreEsisteDaDati(data: {
    titolo: string,
    filtro: any[],
    declinazioni: any[],
    tipiDiExportInKit: any[],
    quantita: number,
    tipo: TIPO_KIT_DESIGN
  }): Promise<boolean>;
  creaTemplateCombinazione(data: { guidId: string, titolo: string, filtro: any[], declinazioni: any[], tipiDiExportInKit: OggettoTipiDiExport[], quantita: number }): Promise<any>;
  createBulkCombinazioneDesign(data: { guidArea: string; guidCanale: string; guidFormato: string; tipiDiExportInKit: OggettoTipiDiExport[]; quantitaCopie: number; titolo: string; }[]): Promise<any>;
  /** Filtri */
  creaFiltroPerRaccoglitoreById(idCombinazione: string, filtri: any[]): Promise<any>;
  getFiltroById(id: string): Promise<any>;
  creaFiltroContestoPerRaccoglitoreById(idCombinazione: string, filtriContext: any[]): Promise<any>;
  getFiltroContestoDaIstanta(req: Request): Promise<any[]>;

  /** Declinazioni */
  getAllDeclinazioniKitDaIstanta(req: Request): Promise<any>;
  creaDeclinazioniPerRaccoglitoreById(guidId: string, declinazioni: Declinazione[]): Promise<any>;
  creaDeclinazioniPerCombinazioneById(guidId: string, declinazioni: Declinazione[]): Promise<any>;
}
