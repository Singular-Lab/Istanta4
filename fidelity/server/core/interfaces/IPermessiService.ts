import { TIPO_UTENTI } from '../../../lib/enums';
import type { CodicePermesso } from '../../../lib/accessi/catalogo';
import type { ContestoAccesso } from '../accessi/contestoAccesso';

/** Ruolo (e GDO) di cui si leggono o scrivono i permessi. Senza idGdo: i permessi del ruolo; con idGdo: gli override di quella GDO. */
export type AmbitoPermessi = {
  tipo: TIPO_UTENTI;
  idRuoloGdo?: string | null;
  idGdo?: string | null;
};

export type StatoPermesso = {
  codice: CodicePermesso;
  /** Valore che si vede in questo ambito: quello impostato qui, altrimenti quello ereditato. */
  abilitato: boolean;
  /** True se l'ambito ha un valore proprio; false se eredita. */
  impostato: boolean;
  /** Valore che l'ambito avrebbe senza un valore proprio. */
  ereditato: boolean;
  /** Vale davvero per gli utenti: considera le regole d'area e i permessi di sistema. */
  efficace: boolean;
};

export type ConfigurazionePermessi = {
  ambito: AmbitoPermessi;
  /** L'ambito eredita da un altro livello (sotto-ruolo o override di GDO). */
  eredita: boolean;
  permessi: StatoPermesso[];
};

export type ModificaPermesso = {
  codice: string;
  /** null toglie il valore proprio: l'ambito torna a ereditare. */
  abilitato: boolean | null;
};

export type RuoliGestibili = {
  tipi: TIPO_UTENTI[];
  ruoliGdo: Array<{ id: string; nome: string }>;
  gdo: Array<{ id: string; nome: string }>;
};

export type ConfrontoRuoli = {
  colonne: Array<{ chiave: string; tipo: TIPO_UTENTI; idRuoloGdo: string | null; etichetta: string; permessi: CodicePermesso[] }>;
};

export interface IPermessiService {
  getRuoliGestibili(): Promise<RuoliGestibili>;
  getConfigurazione(ambito: AmbitoPermessi): Promise<ConfigurazionePermessi>;
  salvaConfigurazione(ambito: AmbitoPermessi, modifiche: ModificaPermesso[]): Promise<ConfigurazionePermessi>;
  ripristinaOverride(ambito: AmbitoPermessi & { idGdo: string }): Promise<number>;
  getConfronto(idGdo?: string | null): Promise<ConfrontoRuoli>;
  getPermessiEffettivi(contesto: ContestoAccesso): Promise<CodicePermesso[]>;
}
