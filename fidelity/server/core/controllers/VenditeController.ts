import type { NextFunction, Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError, ForbiddenError } from '../../../lib/errors';
import { PERCORSI_VENDITE } from '../../../lib/vendite/tipi';
import { gdoOperativaPerRichiesta } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import { createExtensionFilter, createUpload, FILE_SIZE_LIMITS } from '../config/multerConfig';
import type { IConfigService } from '../interfaces/IConfigService';
import { ImportVenditeInCorso, type FileVendite, type IImportVenditeService } from '../interfaces/IImportVenditeService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Codice della risposta 409: il client (ServerCall) legge httpStatus e code dal corpo dell'errore. */
export const CODICE_IMPORT_VENDITE_IN_CORSO = 'IMPORT_VENDITE_IN_CORSO';

/** Come l'import dei punti vendita: un foglio di calcolo in memoria, al massimo 10 MB. */
export const DIMENSIONE_MASSIMA_FILE_VENDITE = FILE_SIZE_LIMITS.MEDIUM;

export const MESSAGGIO_FORMATO_VENDITE = 'Formato file non supportato: usa un file .xlsx, .xls o .csv';

/**
 * Il file delle vendite nel campo "file", riconosciuto dall'estensione: il tipo MIME di un CSV
 * cambia da un browser all'altro (text/csv, text/plain, application/vnd.ms-excel).
 */
export const caricaFileVendite: RequestHandler = createUpload({
  fileSize: DIMENSIONE_MASSIMA_FILE_VENDITE,
  files: 1,
  fileFilter: createExtensionFilter(['.xlsx', '.xls', '.csv'], MESSAGGIO_FORMATO_VENDITE),
}).single('file');

/** Gli errori di multer diventano richieste non valide, con un messaggio che dice cosa correggere. */
function messaggioCaricamento(errore: multer.MulterError): string {
  if (errore.code === 'LIMIT_FILE_SIZE') return `Il file delle vendite puo' pesare al massimo ${DIMENSIONE_MASSIMA_FILE_VENDITE / (1024 * 1024)} MB`;
  if (errore.code === 'LIMIT_FILE_COUNT' || errore.code === 'LIMIT_UNEXPECTED_FILE') return 'Invia un solo file, nel campo file';
  return errore.message;
}

/** Multer legge il nome del file come latin1: torna in UTF-8 se lo era (accenti nel nome). */
function nomeOriginale(nome: string): string {
  const utf8 = Buffer.from(nome, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? nome : utf8;
}

/**
 * Import delle vendite del cliente (contratto in lib/vendite/tipi.ts, PERCORSI_VENDITE sotto /api),
 * tutto con il permesso "analisi.importa_vendite", sempre sulla GDO operativa della sessione (anche
 * per Superadmin e Agenzia: ?gdo= non conta). Una sessione senza GDO operativa riceve 403.
 * Autenticazione e permesso si controllano prima di ricevere il file.
 */
export class VenditeController extends BaseController {
  constructor(
    private readonly vendite: IImportVenditeService,
    /** "Vendite e previsioni" e' una funzione da attivare per GDO (Impostazioni di produzione). */
    private readonly funzionalita: Pick<IConfigService, 'getFunzionalita'>,
    private readonly caricaFile: RequestHandler = caricaFileVendite,
  ) {
    super('/api');
  }

  protected setupRoutes(): void {
    const guardia = [authMiddleware, permissionGuard(PERMESSI.ANALISI.IMPORTA_VENDITE)];
    const ricevi = this.riceviFile.bind(this);
    this.router.post(PERCORSI_VENDITE.anteprima, ...guardia, ricevi, this.anteprima.bind(this));
    this.router.post(PERCORSI_VENDITE.importa, ...guardia, ricevi, this.importa.bind(this));
    this.router.get(PERCORSI_VENDITE.stato, ...guardia, this.stato.bind(this));
    this.router.post(PERCORSI_VENDITE.annulla, ...guardia, this.annulla.bind(this));
    this.router.get(PERCORSI_VENDITE.riepilogo, ...guardia, this.riepilogo.bind(this));
  }

  private riceviFile(req: Request, res: Response, next: NextFunction): void {
    this.caricaFile(req, res, (errore?: unknown) => {
      if (!errore) {
        next();
        return;
      }
      if (errore instanceof multer.MulterError) {
        this.handleError(res, new BadRequestError({ message: messaggioCaricamento(errore) }));
        return;
      }
      if (errore instanceof Error && errore.message === MESSAGGIO_FORMATO_VENDITE) {
        this.handleError(res, new BadRequestError({ message: errore.message }));
        return;
      }
      this.handleError(res, errore);
    });
  }

  /**
   * La GDO delle vendite: sempre e solo la GDO operativa della sessione, anche per chi opera per piu'
   * GDO (Superadmin, Agenzia); ?gdo= non conta. Senza GDO operativa non si importa (403).
   */
  private async gdo(req: Request, res: Response): Promise<string> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (!idGdo || !UUID.test(idGdo)) {
      throw new ForbiddenError({
        message: "La sessione non ha una GDO operativa: scegli una GDO per lavorare sulle sue vendite",
        resource: 'vendite',
        action: 'importa',
      });
    }
    const { vendite } = await this.funzionalita.getFunzionalita(idGdo);
    if (vendite !== true) {
      throw new ForbiddenError({
        message: 'Vendite e previsioni non sono attive per questa GDO: si attivano in Impostazioni di produzione, Funzionalità',
        resource: 'vendite',
        action: 'funzione_non_attiva',
      });
    }
    return idGdo;
  }

  /** Il file ricevuto; 400 se manca. */
  private file(req: Request): FileVendite {
    if (!req.file) throw new BadRequestError({ message: 'Nessun file caricato: invia il file delle vendite nel campo file' });
    return { contenuto: req.file.buffer, nome: nomeOriginale(req.file.originalname) };
  }

  private async anteprima(req: Request, res: Response): Promise<void> {
    try {
      const file = this.file(req);
      const idGdo = await this.gdo(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.vendite.anteprima(file, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /**
   * Avvia l'import in background e risponde subito (202); 409 con l'import gia' in corso della GDO.
   * Il 409 porta anche httpStatus e code: ServerCall ricava lo stato dell'errore dal corpo, e senza
   * lo darebbe come 500 (la pagina Vendite riconosce l'import gia' in corso dal 409).
   */
  private async importa(req: Request, res: Response): Promise<void> {
    try {
      const file = this.file(req);
      const idGdo = await this.gdo(req, res);
      const avviato = await this.vendite.avvia(file, idGdo, String(req.session?.id_utente ?? ''));
      this.sendResponse(res, HttpStatusCode.ACCEPTED, avviato);
    } catch (error) {
      if (error instanceof ImportVenditeInCorso) {
        log.info('importVendite - rifiutato, import gia\' in corso', { id: error.importInCorso.id });
        this.sendResponse(res, HttpStatusCode.CONFLICT, {
          message: error.message,
          stato: error.importInCorso,
          httpStatus: HttpStatusCode.CONFLICT,
          code: CODICE_IMPORT_VENDITE_IN_CORSO,
        });
        return;
      }
      this.handleError(res, error);
    }
  }

  /** L'ultimo import della GDO, o null. */
  private async stato(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.vendite.stato(await this.gdo(req, res)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  /** Ferma l'import in corso al blocco successivo; le vendite gia' scritte restano. */
  private async annulla(req: Request, res: Response): Promise<void> {
    try {
      const stato = await this.vendite.annulla(await this.gdo(req, res));
      if (!stato) {
        this.sendResponse(res, HttpStatusCode.NOT_FOUND, {
          message: 'Nessun import delle vendite per questa GDO',
          httpStatus: HttpStatusCode.NOT_FOUND,
        });
        return;
      }
      this.sendResponse(res, HttpStatusCode.OK, stato);
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async riepilogo(req: Request, res: Response): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await this.vendite.riepilogo(await this.gdo(req, res)));
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
