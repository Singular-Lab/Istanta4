import type { NextFunction, Request, RequestHandler, Response } from 'express';
import fs from 'node:fs';
import multer from 'multer';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { gdoOperativaPerRichiesta, operaPerPiuGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import { createUpload, FILE_SIZE_LIMITS, storageConfigs } from '../config/multerConfig';
import type { IStoriaPuntoVenditaService } from '../interfaces/IStoriaPuntoVenditaService';
import { log } from '../logger';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';

export const MASSIMO_FILE_EXPORT = 300;
export const DIMENSIONE_MASSIMA_EXPORT = FILE_SIZE_LIMITS.MEDIUM;

/** Gli export JSON del Plugin (campo `file` ripetuto): su disco nei temporanei con un nome univoco, letti uno alla volta. */
export const caricaExportPlugin: RequestHandler = createUpload({
  storage: storageConfigs.materialiPOP,
  fileSize: DIMENSIONE_MASSIMA_EXPORT,
  files: MASSIMO_FILE_EXPORT,
}).array('file', MASSIMO_FILE_EXPORT);

const numero = (valore: unknown): number | undefined => {
  if (typeof valore !== 'string' || valore.trim() === '') return undefined;
  const intero = Number.parseInt(valore, 10);
  return Number.isFinite(intero) ? intero : undefined;
};

/** Gli errori di multer diventano richieste non valide, con un messaggio che dice cosa correggere. */
function messaggioCaricamento(errore: multer.MulterError): string {
  if (errore.code === 'LIMIT_FILE_SIZE') return `Ogni export puo' pesare al massimo ${DIMENSIONE_MASSIMA_EXPORT / (1024 * 1024)} MB`;
  if (errore.code === 'LIMIT_FILE_COUNT') return `Al massimo ${MASSIMO_FILE_EXPORT} file per volta`;
  if (errore.code === 'LIMIT_UNEXPECTED_FILE') {
    return errore.field === 'file' ? `Al massimo ${MASSIMO_FILE_EXPORT} file per volta` : 'Gli export vanno inviati nel campo file';
  }
  return errore.message;
}

/**
 * La storia di un punto vendita dalle liste dei volantini (contratto in lib/puntiVendita/storia.ts).
 * Letture con "gdo.visualizza"; l'import degli export JSON del Plugin con "gdo.gestisci_punti_vendita".
 * Un punto vendita di un'altra GDO risponde come inesistente.
 */
export class StoriaPuntoVenditaController extends BaseController {
  constructor(
    private readonly storia: IStoriaPuntoVenditaService,
    private readonly caricaExport: RequestHandler = caricaExportPlugin,
  ) {
    super('/api/punti-vendita');
  }

  protected setupRoutes(): void {
    const visualizza = [authMiddleware, permissionGuard('gdo.visualizza')];
    this.router.post(
      '/storia/import-export',
      authMiddleware,
      permissionGuard('gdo.gestisci_punti_vendita'),
      this.riceviExport.bind(this),
      this.importaExport.bind(this),
    );
    this.router.get('/:id/storia', ...visualizza, this.getStoria.bind(this));
    this.router.get('/:id/storia/volantini', ...visualizza, this.getVolantini.bind(this));
  }

  /**
   * GDO in cui cercare il PV: quella dell'utente. Senza GDO solo chi lavora per piu' GDO (Superadmin,
   * Agenzia) vede i PV di tutte (null); per gli altri nessun PV e' visibile (undefined).
   */
  private async ambitoGdo(req: Request, res: Response): Promise<string | null | undefined> {
    const idGdo = await gdoOperativaPerRichiesta(req, res);
    if (idGdo) return idGdo;
    return operaPerPiuGdo(req.session?.tipo_utente) ? null : undefined;
  }

  private async gdoDellaLettura(req: Request<{ id: string }>, res: Response): Promise<string | null> {
    const ambito = await this.ambitoGdo(req, res);
    if (ambito === undefined) {
      throw new NotFoundError({ message: 'Punto vendita non trovato', entityType: 'PuntoVendita', entityId: req.params.id });
    }
    return ambito;
  }

  private async getStoria(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaLettura(req, res);
      this.sendResponse(res, HttpStatusCode.OK, await this.storia.getStoria(req.params.id, idGdo));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private async getVolantini(req: Request<{ id: string }>, res: Response): Promise<void> {
    try {
      const idGdo = await this.gdoDellaLettura(req, res);
      const pagina = numero(req.query.pagina);
      const dimensione = numero(req.query.dimensione);
      this.sendResponse(res, HttpStatusCode.OK, await this.storia.getVolantini(req.params.id, idGdo, pagina, dimensione));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private riceviExport(req: Request, res: Response, next: NextFunction): void {
    this.caricaExport(req, res, (errore?: unknown) => {
      if (!errore) {
        next();
        return;
      }
      if (errore instanceof multer.MulterError) {
        this.handleError(res, new BadRequestError({ message: messaggioCaricamento(errore) }));
        return;
      }
      this.handleError(res, errore);
    });
  }

  /** Registra le liste dei PV degli export JSON nella GDO dell'utente: un file sbagliato si scarta, gli altri proseguono. */
  private async importaExport(req: Request, res: Response): Promise<void> {
    const file = Array.isArray(req.files) ? req.files : [];
    let esito: Awaited<ReturnType<IStoriaPuntoVenditaService['importaExport']>> | undefined;
    let errore: unknown;
    try {
      if (file.length === 0) throw new BadRequestError({ message: 'Nessun export caricato' });
      // Sempre la GDO dell'utente, mai una indicata nella richiesta
      const idGdo = await gdoOperativaPerRichiesta(req, res);
      if (!idGdo) throw new BadRequestError({ message: 'GDO non specificata' });

      esito = await this.storia.importaExport(file.map(caricato => ({
        nomeFile: caricato.originalname,
        leggi: async () => (caricato.buffer ? caricato.buffer.toString('utf8') : fs.promises.readFile(caricato.path, 'utf8')),
      })), idGdo);
      log.info('Storia PV: export del Plugin importati', {
        idGdo, file: file.length, registrati: esito.registrati, scartati: esito.scartati, righe: esito.righe,
      });
    } catch (error) {
      errore = error;
    }
    // I temporanei si tolgono prima di rispondere: a risposta arrivata non resta niente sul disco
    await Promise.all(file
      .filter(caricato => caricato.path)
      .map(caricato => fs.promises.rm(caricato.path, { force: true }).catch(() => undefined)));
    if (esito) this.sendResponse(res, HttpStatusCode.OK, esito);
    else this.handleError(res, errore);
  }
}
