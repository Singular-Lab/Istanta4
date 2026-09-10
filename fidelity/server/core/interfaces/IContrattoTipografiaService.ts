import { RootFileTree } from '../../../lib/types';

export interface IContrattoTipografiaService {
  creaContrattoTipografia(idGdo: string, data: {
    nome: string;
    idTipiExport: string[];
    contratto: RootFileTree;
    hostFtp?: string | null;
    userFtp?: string | null;
    pwdFtp?: string | null;
    portFtp?: number | null;
  }): Promise<any>;
  updateContrattoTipografia(data: {
    id: string;
    nome: string;
    idTipiExport: string[];
    contratto: RootFileTree;
    hostFtp?: string | null;
    userFtp?: string | null;
    pwdFtp?: string | null;
    portFtp?: number | null;
  }): Promise<any>;
}
