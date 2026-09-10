import { encryptString } from '../../../lib/encryption';
import { RootFileTree } from '../../../lib/types';
import { wrapDatabaseError } from '../../../lib/errors';
import config from '../config';
import { IContrattoTipografiaService } from '../interfaces/IContrattoTipografiaService';
import { ContrattoTipografia } from '../models/contratto_tipografia';

const normalizeNullableString = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const encryptNullableFtpString = (value?: string | null): string | null => {
  const normalized = normalizeNullableString(value);
  if (!normalized) {
    return null;
  }

  return encryptString(normalized, config.FICO_SECRET);
};

export class ContrattoTipografiaService implements IContrattoTipografiaService {

  async creaContrattoTipografia(idGDO: string, data: {
    nome: string,
    idTipiExport: string[],
    contratto: RootFileTree,
    hostFtp?: string | null,
    userFtp?: string | null,
    pwdFtp?: string | null,
    portFtp?: number | null
  }) {
    try {
      const contratto = await ContrattoTipografia.create({
        id_gdo_contrattotipografia: idGDO,
        nome_contrattotipografia: data.nome,
        tipiexport_contrattotipografia: data.idTipiExport,
        json_contrattotipografia: data.contratto,
        host_ftp_contrattotipografia: encryptNullableFtpString(data.hostFtp),
        user_ftp_contrattotipografia: encryptNullableFtpString(data.userFtp),
        pwd_ftp_contrattotipografia: encryptNullableFtpString(data.pwdFtp),
        port_ftp_contrattotipografia: data.portFtp ?? null
      });
      return contratto;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante la creazione del contratto tipografia"), {
        message: "Errore durante la creazione del contratto tipografia",
        operation: 'create',
        entity: 'ContrattoTipografia',
        details: { error }
      });
    }
  }

  async updateContrattoTipografia(data: {
    id: string,
    nome: string,
    idTipiExport: string[],
    contratto: RootFileTree,
    hostFtp?: string | null,
    userFtp?: string | null,
    pwdFtp?: string | null,
    portFtp?: number | null
  }) {
    try {
      const payloadToUpdate: Record<string, any> = {
        nome_contrattotipografia: data.nome,
        tipiexport_contrattotipografia: data.idTipiExport,
        json_contrattotipografia: data.contratto
      };

      if (Object.prototype.hasOwnProperty.call(data, 'hostFtp')) {
        payloadToUpdate.host_ftp_contrattotipografia = encryptNullableFtpString(data.hostFtp);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'userFtp')) {
        payloadToUpdate.user_ftp_contrattotipografia = encryptNullableFtpString(data.userFtp);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'pwdFtp')) {
        payloadToUpdate.pwd_ftp_contrattotipografia = encryptNullableFtpString(data.pwdFtp);
      }

      if (Object.prototype.hasOwnProperty.call(data, 'portFtp')) {
        payloadToUpdate.port_ftp_contrattotipografia = data.portFtp ?? null;
      }

      const contratto = await ContrattoTipografia.update(payloadToUpdate, {
        where: {
          id_contrattotipografia: data.id
        }
      });
      return contratto;
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento del contratto tipografia"), {
        message: "Errore durante l'aggiornamento del contratto tipografia",
        operation: 'update',
        entity: 'ContrattoTipografia',
        details: { error }
      });
    }
  }
}
