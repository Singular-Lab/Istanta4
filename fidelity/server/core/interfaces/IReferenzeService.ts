import { Request } from 'express';
import { ContenutoAggiuntivoReferenza, LoghiReferenza, PageLayoutItem, ReferenzeIstanta } from '../../../lib/types';

export interface IReferenzeService {
  /** Referenze CRUD */
  getReferenzaByEAN(ean: string): Promise<ReferenzeIstanta>;
  getAllReferenze(): Promise<ReferenzeIstanta[]>;
  getReferenzaById(id: string): Promise<any>;
  getReferenzaByCodice(codice: string): Promise<ReferenzeIstanta | null>;
  updateReferenzaWebpliant(data: ReferenzeIstanta): Promise<any>;
  updateReferenza(id: string, data: ReferenzeIstanta): Promise<any>;
  bulkCreateReferenze(refs: ReferenzeIstanta[]): Promise<any>;
  bulkEliminateReferenzeFromGuidIdKitRuntime(idKitRuntime: string): Promise<any>;

  /** Ricerca */
  ricercaReferenzePromo(data: { query: string; idWorkspace: string; idArea: string; idCanale: string }): Promise<any[]>;
  getAllReferenzePromoInCorso(filtri: {
    idArea: string;
    idCanale: string;
    idPromo: string;
    data_da: string;
    data_a: string;
    sigle_reparto: string[];
  }): Promise<ReferenzeIstanta[]>;
  getFilteredReferenze(
    idWorkspace: string,
    dataSelezionata: Date,
    idArea: string | undefined,
    idCanale: string | undefined,
    idPV: string | undefined,
    item: PageLayoutItem,
    isEditor: boolean
  ): Promise<ReferenzeIstanta[]>;

  /** Loghi e Immagini */
  getAllLoghiDaReferenze(req: Request): Promise<LoghiReferenza[]>;
  resolveImmaginiGruppo(): Promise<any>;

  /** Contenuti Aggiuntivi */
  creaContenutiAggiuntiviReferenza(data: ContenutoAggiuntivoReferenza): Promise<boolean>;
  getAllContenutiAggiuntivi(): Promise<ContenutoAggiuntivoReferenza[]>;
  getContenutiAggiuntiviDaRegolePerReferenza(referenza: ReferenzeIstanta): Promise<ContenutoAggiuntivoReferenza[]>;

  /** ISTANTA & WebPliant data */
  getAddestramentiDaIstanta(req: Request): Promise<any[]>;
  getDatiPerWebPliantDisponibili(): Promise<any>;
}
