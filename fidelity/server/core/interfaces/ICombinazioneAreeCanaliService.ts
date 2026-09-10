
import { CombinazioneCanaleAreaResponseDTO } from '../dto';

export interface ICombinazioneAreeCanaliService {
  getAllCombinazioniForGDO(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]>;
  createCombinazione(data: {
    guidID: string,
    guidIDCanale: string,
    guidIDArea: string,
    enabled: boolean,
    idGDO: string
  }): Promise<CombinazioneCanaleAreaResponseDTO>;

  getAllCombinazioniForGDOReworked(idGDO: string): Promise<{
    id: string;
    sigla_combinazione: string;
    stato_combinazione: string;
  }[]>;
  deleteCombinazione(guidID: string): Promise<boolean>;

  // Materialized View Operations
  getAllCombinazioniFromMaterializedView(): Promise<CombinazioneCanaleAreaResponseDTO[]>;
  getCombinazioniByGDOIdFromMaterializedView(idGDO: string): Promise<CombinazioneCanaleAreaResponseDTO[]>;
}
