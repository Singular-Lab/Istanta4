import { Request } from 'express';
import type { Writable } from 'stream';
import type { PeriodoMateriali } from '../../../lib/materiali/periodi';
import type {
  ElencoPromozioniPop,
  FiltriFilePop,
  FiltriKitVolantini,
  PaginaFilePop,
  PaginaKitVolantini,
  RichiestaZipPop,
  RiepilogoPop,
} from '../../../lib/materiali/tipi';
import type { EsitoZipOlimpo, VoceZipOlimpo } from './IFileManagementService';

/** ZIP pronto da scrivere: nome dell'archivio e file, una cartella per kit. */
export interface ZipPop {
  nomeFile: string;
  voci: VoceZipOlimpo[];
}

/**
 * Viste Volantini e POP (contratto in lib/materiali/tipi.ts). La richiesta serve solo per
 * chiedere a Istanta i kit non avviati delle promo in corso.
 */
export interface IMaterialiService {
  getVolantini(filtri: FiltriKitVolantini, req: Request): Promise<PaginaKitVolantini>;
  getPromozioniPop(periodo: PeriodoMateriali): Promise<ElencoPromozioniPop>;
  getRiepilogoPop(idPromo: string, periodo: PeriodoMateriali, req: Request): Promise<RiepilogoPop>;
  getFilePop(idPromo: string, filtri: FiltriFilePop): Promise<PaginaFilePop>;
  /** File da mettere nello ZIP; NotFoundError se non ce n'e' nessuno. */
  preparaZipPop(idPromo: string, richiesta: RichiestaZipPop): Promise<ZipPop>;
  scriviZipPop(zip: ZipPop, destinazione: Writable): Promise<EsitoZipOlimpo>;
}
