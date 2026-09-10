import { DataWebPliant, ReferenzeIstanta } from '../../../lib/types';

export interface IWebPliantService {
  /** Workspace CRUD */
  aggiungiWorkspaceWebPliant(data: any): Promise<boolean>;
  eliminaWorkspaceWebPliant(id: string): Promise<boolean>;
  getAllWorkspaceWebPliant(): Promise<any[]>;
  getAllWorkspaceWebPliantDaIdGdo(id: string): Promise<any[]>;
  prendiWorkspaceDaID(id: string, isEditor: boolean): Promise<DataWebPliant>;
  creaWebPliantWorkspace(data: DataWebPliant): Promise<any>;
  tuttiIWorkspaceDaGDO(idUtente: string): Promise<any>;
  getIdsWorkspace(idUtente: string): Promise<any>;

  /** Data */
  getDataValiditaPerCarosello(content: any, referenze: ReferenzeIstanta[]): Promise<string>;
  getReferenzeWebPliant(idWorkspace: string, dataSelezionata: Date, idArea?: string, idCanale?: string, isEditor?: boolean): Promise<any[]>;
  getDatoMassivoPerWebPliant(): Promise<any[]>;

  /** Field options & Raggruppamento */
  get_field_options_filtri(): Promise<any>;
  getCampiDaRaggruppamento(params: {
    idWorkspace: string;
    idArea: string;
    idCanale: string;
    dataSelezionata: Date;
    campoSelezionato: string;
  }): Promise<any>;
}
