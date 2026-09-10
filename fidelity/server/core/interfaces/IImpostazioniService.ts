import { Request } from 'express';

export interface IImpostazioniService {
  salvaGestionePagineSingular(idGdo: string, data: string): Promise<any>;
  getAllPromoForTimeline(idArea: string, idCanale: string): Promise<any[]>;
  getQuickSearchSettings(req: Request): Promise<any>;
}
