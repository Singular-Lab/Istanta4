import { TIPO_UTENTI } from '../../../lib/enums';

export interface PermessoDTO {
  id_permesso: string;
  codice: string;
  nome: string;
  descrizione?: string;
  categoria: string;
  risorsa: string;
}

export interface PermessoConStatoDTO extends PermessoDTO {
  abilitato: boolean;
  is_override?: boolean;
}

export interface IPermessiService {
  getAllPermessi(): Promise<PermessoDTO[]>;
  getPermessiPerRuolo(tipoUtente: TIPO_UTENTI, idRuoloGdo?: string): Promise<PermessoConStatoDTO[]>;
  getPermessiEffettivi(tipoUtente: TIPO_UTENTI, idGdo?: string, idRuoloGdo?: string): Promise<string[]>;
  getPermessiEffettiviConDettagli(tipoUtente: TIPO_UTENTI, idGdo?: string, idRuoloGdo?: string): Promise<PermessoConStatoDTO[]>;
  getPermessiUtente(userId: string): Promise<string[]>;

  setPermessiRuolo(tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string): Promise<void>;
  setPermessiRuoloGdo(idGdo: string, tipoUtente: TIPO_UTENTI, permessi: { id_permesso: string; abilitato: boolean }[], idRuoloGdo?: string): Promise<void>;
  resetOverrideGdo(idGdo: string, tipoUtente?: TIPO_UTENTI, idRuoloGdo?: string): Promise<void>;

  seedPermessiIniziali(): Promise<void>;
  reseedPermessi(): Promise<void>;
}
