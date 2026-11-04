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
  /** Elimina le referenze del kit e inserisce le nuove in un'unica transazione */
  sostituisciReferenzeKit(idKitRuntime: string, referenze: ReferenzeIstanta[]): Promise<any>;
  /** Per ogni nome originale di un mapping, quante referenze salvate lo hanno ancora. */
  contaCampiNonTradotti(campi: string[]): Promise<Record<string, number>>;
  /** Rinomina il campo in tutte le referenze, in una transazione: tutte o nessuna. */
  sincronizzaCampoNonTradotto(campo: string, tradotto: string): Promise<{ referenze: number; kit: number }>;

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
    dataSelezionata: Date | string,
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
