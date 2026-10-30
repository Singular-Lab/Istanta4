import { Request, Response } from 'express';
import { HttpStatusCode, type STATO_LOG_FILE } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { isPeriodoMateriali, PeriodoMateriali } from '../../../lib/materiali/periodi';
import type {
  FiltriFilePop,
  FiltriKitVolantini,
  FiltriPromozioniVolantini,
  RichiestaZipPop,
  StatoKitMateriali,
} from '../../../lib/materiali/tipi';
import { BaseController } from '../base/BaseController';
import type { IMaterialiService } from '../interfaces/IMaterialiService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

/** Testo di un parametro (query o body); i parametri ripetuti e i valori vuoti non contano. */
const testo = (valore: unknown): string | undefined =>
  typeof valore === 'string' && valore.trim() !== '' ? valore.trim() : undefined;

const numero = (valore: unknown): number | undefined => {
  if (typeof valore === 'number') return Number.isFinite(valore) ? valore : undefined;
  const cifre = testo(valore);
  if (cifre === undefined) return undefined;
  const intero = Number.parseInt(cifre, 10);
  return Number.isFinite(intero) ? intero : undefined;
};

/** Numero scritto per intero: "2024x" o "abc" diventano NaN, e il servizio li rifiuta invece di ignorarli. */
const numeroEsatto = (valore: unknown): number | undefined => {
  const cifre = testo(valore);
  return cifre === undefined ? undefined : Number(cifre);
};

export function periodoRichiesto(valore: unknown): PeriodoMateriali {
  if (!isPeriodoMateriali(valore)) {
    throw new BadRequestError({ message: 'Periodo mancante o non valido: usa in-corso, attivi o storico.' });
  }
  return valore;
}

/** Filtri dei file POP, uguali in query (GET) e nel campo `filtri` del body (POST). */
function filtriFile(sorgente: unknown): Omit<FiltriFilePop, 'periodo' | 'idFormato' | 'pagina' | 'dimensione'> {
  const campi = sorgente && typeof sorgente === 'object' ? sorgente as Record<string, unknown> : {};
  return {
    cerca: testo(campi.cerca),
    stato: testo(campi.stato) as STATO_LOG_FILE | undefined,
    idArea: testo(campi.idArea),
    idCanale: testo(campi.idCanale),
    reparto: testo(campi.reparto),
  };
}

/**
 * RichiestaZipPop dal body: JSON, oppure il form nascosto del download, che la manda come testo
 * JSON nel campo `richiesta` (accanto a `_csrf`) perche' il browser riceva lo ZIP in streaming.
 */
function richiestaZipDalCorpo(body: unknown): RichiestaZipPop {
  let corpo: Record<string, unknown> = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (typeof corpo.richiesta === 'string') {
    let letto: unknown;
    try {
      letto = JSON.parse(corpo.richiesta);
    } catch {
      throw new BadRequestError({ message: 'Richiesta di download non valida.' });
    }
    corpo = letto && typeof letto === 'object' ? letto as Record<string, unknown> : {};
  }
  const idFile = Array.isArray(corpo.idFile)
    ? corpo.idFile.filter((id): id is string => typeof id === 'string')
    : undefined;
  return {
    periodo: periodoRichiesto(corpo.periodo),
    idFormato: testo(corpo.idFormato) ?? '',
    idFile,
    filtri: filtriFile(corpo.filtri),
  };
}

/**
 * Viste Volantini e POP per periodo (In corso, Attivi, Storico), in sola lettura. Contratto in
 * lib/materiali/tipi.ts. Tutto richiede "materiali.visualizza"; gli ZIP anche "file.download".
 */
export class MaterialiController extends BaseController {
  constructor(private readonly materialiService: IMaterialiService) {
    super('/api/materiali');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard('materiali.visualizza')];
    const scarica = [...visualizza, permissionGuard('file.download')];

    this.router.get('/volantini', ...visualizza, this.getVolantini.bind(this));
    this.router.get('/volantini/promozioni', ...visualizza, this.getPromozioniVolantini.bind(this));
    this.router.get('/pop/promozioni',...visualizza, this.getPromozioniPop.bind(this));
    this.router.get('/pop/promozioni/:idPromo/formati', ...visualizza, this.getRiepilogoPop.bind(this));
    this.router.get('/pop/promozioni/:idPromo/file', ...visualizza, this.getFilePop.bind(this));
    this.router.get('/pop/promozioni/:idPromo/file/opzioni', ...visualizza, this.getOpzioniFilePop.bind(this));
    this.router.post('/pop/promozioni/:idPromo/zip/verifica', ...scarica, this.verificaZip.bind(this));
    this.router.get('/pop/promozioni/:idPromo/zip', ...scarica, this.scaricaZipFiltrato.bind(this));
    this.router.post('/pop/promozioni/:idPromo/zip', ...scarica, this.scaricaZipSelezione.bind(this));
  }

  private async getVolantini(req: Request, res: Response): Promise<void> {
    try {
      const filtri: FiltriKitVolantini = {
        periodo: periodoRichiesto(req.query.periodo),
        cerca: testo(req.query.cerca),
        idPromo: testo(req.query.idPromo),
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
        stato: testo(req.query.stato) as StatoKitMateriali | undefined,
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getVolantini(filtri, req));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPromozioniVolantini(req: Request, res: Response): Promise<void> {
    try {
      const filtri: FiltriPromozioniVolantini = {
        periodo: periodoRichiesto(req.query.periodo),
        cerca: testo(req.query.cerca),
        idPromo: testo(req.query.idPromo),
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
        anno: numeroEsatto(req.query.anno),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getPromozioniVolantini(filtri));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getPromozioniPop(req: Request, res: Response): Promise<void> {
    try {
      const periodo = periodoRichiesto(req.query.periodo);
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getPromozioniPop(periodo, req));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getRiepilogoPop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const periodo = periodoRichiesto(req.query.periodo);
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getRiepilogoPop(req.params.idPromo, periodo, req));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getFilePop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const filtri: FiltriFilePop = {
        periodo: periodoRichiesto(req.query.periodo),
        idFormato: testo(req.query.idFormato) ?? '',
        ...filtriFile(req.query),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getFilePop(req.params.idPromo, filtri));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getOpzioniFilePop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      const filtri = { periodo: periodoRichiesto(req.query.periodo), idFormato: testo(req.query.idFormato) ?? '' };
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.getOpzioniFilePop(req.params.idPromo, filtri));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Prima di un download: gli errori (niente da scaricare, promo fuori periodo...) arrivano qui in JSON. */
  private async verificaZip(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.materialiService.verificaZipPop(req.params.idPromo, richiestaZipDalCorpo(req.body)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Tutti i file del formato che corrispondono ai filtri in query. */
  private async scaricaZipFiltrato(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    await this.inviaZip(req, res, () => ({
      periodo: periodoRichiesto(req.query.periodo),
      idFormato: testo(req.query.idFormato) ?? '',
      filtri: filtriFile(req.query),
    }));
  }

  /** I file selezionati (idFile), o i filtri del body. */
  private async scaricaZipSelezione(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    await this.inviaZip(req, res, () => richiestaZipDalCorpo(req.body));
  }

  /**
   * Lo ZIP va direttamente nella risposta, senza tenerlo in memoria. Finche' non e' partito
   * niente, un errore e' una risposta JSON normale; dopo, la connessione si chiude e il browser
   * vede il download interrotto invece di un archivio troncato.
   */
  private async inviaZip(req: Request<{ idPromo: string }>, res: Response, leggiRichiesta: () => RichiestaZipPop): Promise<void> {
    try {
      const zip = await this.materialiService.preparaZipPop(req.params.idPromo, leggiRichiesta());
      res.attachment(zip.nomeFile);
      res.setHeader('Content-Type', 'application/zip');
      // Le intestazioni partono subito: il browser apre il download mentre arrivano i primi file da Olimpo
      res.flushHeaders();
      await this.materialiService.scriviZipPop(zip, res);
    } catch (error) {
      if (res.headersSent || res.destroyed) {
        log.warn('ZIP POP interrotto durante l\'invio', {
          context: 'Materiali',
          idPromo: req.params.idPromo,
          errore: error instanceof Error ? error.message : String(error),
        });
        res.destroy();
        return;
      }
      res.removeHeader('Content-Disposition');
      res.removeHeader('Content-Type');
      this.handleError(res, error);
    }
  }
}
