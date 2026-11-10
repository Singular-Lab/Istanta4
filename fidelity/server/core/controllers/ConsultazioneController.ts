import type { Request, Response } from 'express';
import { PERMESSI } from '../../../lib/accessi/catalogo';
import { isPeriodoConsultazione, PeriodoConsultazione } from '../../../lib/consultazione/periodi';
import type {
  FiltriContenutiDigitali,
  FiltriDettaglioPromozioneVolantini,
  FiltriFilePopConsultazione,
  FiltriPromozioniVolantiniConsultazione,
  FiltriVolantiniConsultazione,
  FiltriZipPopConsultazione,
  RichiestaZipPopConsultazione,
} from '../../../lib/consultazione/tipi';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError } from '../../../lib/errors';
import { ambitoGdoDellaRichiesta, type AmbitoGdo } from '../accessi/contestoAccesso';
import { BaseController } from '../base/BaseController';
import type { IConsultazioneService } from '../interfaces/IConsultazioneService';
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

/** Numero scritto per intero: "2024x" diventa NaN, e il servizio lo rifiuta invece di ignorarlo. */
const numeroEsatto = (valore: unknown): number | undefined => {
  const cifre = testo(valore);
  return cifre === undefined ? undefined : Number(cifre);
};

function periodoRichiesto(valore: unknown): PeriodoConsultazione {
  if (!isPeriodoConsultazione(valore)) {
    throw new BadRequestError({ message: 'Periodo mancante o non valido: usa attivi, prossimi o storico.' });
  }
  return valore;
}

/** Filtri dei file POP, uguali in query (GET) e nel campo `filtri` del body (POST). */
function filtriFilePop(sorgente: unknown): FiltriZipPopConsultazione {
  const campi = sorgente && typeof sorgente === 'object' ? sorgente as Record<string, unknown> : {};
  return {
    cerca: testo(campi.cerca),
    idArea: testo(campi.idArea),
    idCanale: testo(campi.idCanale),
    reparto: testo(campi.reparto),
  };
}

/** Richiesta dello ZIP dal body: JSON, o il form nascosto del download con il JSON nel campo `richiesta`. */
function richiestaZipDalCorpo(body: unknown): RichiestaZipPopConsultazione {
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
    filtri: filtriFilePop(corpo.filtri),
  };
}

/** Nome del file per Content-Disposition: niente separatori, virgolette o caratteri di controllo. */
const nomeAllegato = (nome: string): string =>
  [...nome.replace(/[\\/"]/g, '_')].filter(carattere => carattere.charCodeAt(0) >= 32).join('').trim() || 'file.pdf';

/**
 * API delle pagine di Visualizzazione (contratto in lib/consultazione/tipi.ts): solo materiali
 * pubblicati della GDO della sessione, senza dati di lavorazione, senza chiamate a Istanta.
 *
 * GDO: sempre quella della sessione; Superadmin e Agenzia possono indicarla con `gdo` e senza
 * vedono tutte le GDO; un utente senza GDO non vede nulla.
 *
 * Permessi: i volantini con uno fra "volantini.visualizza" (panoramica e storico),
 * "materiali.visualizza" (viste Volantini) e "analisi.dashboard_category" (dashboard Category); il
 * dettaglio di una promozione, che riassume gli insight dei suoi volantini, POP e contenuti digitali
 * con "materiali.visualizza"; ogni download con "materiali.scarica".
 */
export class ConsultazioneController extends BaseController {
  constructor(private readonly consultazione: IConsultazioneService) {
    super('/api/consultazione');
  }

  protected setupRoutes(): void {
    const volantini = [
      authMiddleware,
      permissionGuard([PERMESSI.VOLANTINI.VISUALIZZA, PERMESSI.MATERIALI.VISUALIZZA, PERMESSI.ANALISI.DASHBOARD_CATEGORY]),
    ];
    const materiali = [authMiddleware, permissionGuard(PERMESSI.MATERIALI.VISUALIZZA)];
    const scarica = [...materiali, permissionGuard(PERMESSI.MATERIALI.SCARICA)];

    this.router.get('/volantini', ...volantini, this.getVolantini.bind(this));
    this.router.get('/volantini/promozioni', ...volantini, this.getPromozioniVolantini.bind(this));
    // Come gli insight del volantino, che riassume: con "materiali.visualizza" (contratto in lib/consultazione/tipi.ts)
    this.router.get('/volantini/promozioni/:idPromo', ...materiali, this.getPromozioneVolantini.bind(this));
    this.router.get('/volantini/:idKit', ...volantini, this.getVolantino.bind(this));

    this.router.get('/pop/promozioni', ...materiali, this.getPromozioniPop.bind(this));
    this.router.get('/pop/promozioni/:idPromo', ...materiali, this.getRiepilogoPop.bind(this));
    this.router.get('/pop/promozioni/:idPromo/file', ...materiali, this.getFilePop.bind(this));
    this.router.get('/pop/promozioni/:idPromo/file/opzioni', ...materiali, this.getOpzioniFilePop.bind(this));
    this.router.post('/pop/promozioni/:idPromo/zip/verifica', ...scarica, this.verificaZip.bind(this));
    this.router.get('/pop/promozioni/:idPromo/zip', ...scarica, this.scaricaZipFiltrato.bind(this));
    this.router.post('/pop/promozioni/:idPromo/zip', ...scarica, this.scaricaZipSelezione.bind(this));

    this.router.get('/contenuti-digitali', ...materiali, this.getContenutiDigitali.bind(this));
    this.router.get('/contenuti-digitali/opzioni', ...materiali, this.getOpzioniContenutiDigitali.bind(this));

    this.router.get('/file/:idFile', authMiddleware, permissionGuard(PERMESSI.MATERIALI.SCARICA), this.scaricaFile.bind(this));
  }

  private ambito(req: Request, res: Response): Promise<AmbitoGdo> {
    return ambitoGdoDellaRichiesta(req, res, req.query.gdo);
  }

  /** Risposta JSON del lavoro, o l'errore. */
  private async rispondi(req: Request, res: Response, lavoro: (ambito: AmbitoGdo) => Promise<unknown>): Promise<void> {
    try {
      this.sendResponse(res, HttpStatusCode.OK, await lavoro(await this.ambito(req, res)));
    } catch (error) {
      this.handleError(res, error);
    }
  }

  private getVolantini(req: Request, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => {
      const filtri: FiltriVolantiniConsultazione = {
        periodo: periodoRichiesto(req.query.periodo),
        cerca: testo(req.query.cerca),
        idPromo: testo(req.query.idPromo),
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      return this.consultazione.getVolantini(filtri, ambito);
    });
  }

  private getPromozioniVolantini(req: Request, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => {
      const filtri: FiltriPromozioniVolantiniConsultazione = {
        periodo: periodoRichiesto(req.query.periodo),
        cerca: testo(req.query.cerca),
        idPromo: testo(req.query.idPromo),
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
        anno: numeroEsatto(req.query.anno),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      return this.consultazione.getPromozioniVolantini(filtri, ambito);
    });
  }

  private getPromozioneVolantini(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => {
      // Insegna (canale) e area dei kit da contare: il servizio verifica che siano UUID
      const filtri: FiltriDettaglioPromozioneVolantini = {
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
      };
      return this.consultazione.getPromozioneVolantini(req.params.idPromo, ambito, filtri);
    });
  }

  private getVolantino(req: Request<{ idKit: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => this.consultazione.getVolantino(req.params.idKit, ambito));
  }

  private getPromozioniPop(req: Request, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => this.consultazione.getPromozioniPop(periodoRichiesto(req.query.periodo), ambito));
  }

  private getRiepilogoPop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito =>
      this.consultazione.getRiepilogoPop(req.params.idPromo, periodoRichiesto(req.query.periodo), ambito));
  }

  private getFilePop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => {
      const filtri: FiltriFilePopConsultazione = {
        periodo: periodoRichiesto(req.query.periodo),
        idFormato: testo(req.query.idFormato) ?? '',
        ...filtriFilePop(req.query),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      return this.consultazione.getFilePop(req.params.idPromo, filtri, ambito);
    });
  }

  private getOpzioniFilePop(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => this.consultazione.getOpzioniFilePop(
      req.params.idPromo,
      { periodo: periodoRichiesto(req.query.periodo), idFormato: testo(req.query.idFormato) ?? '' },
      ambito
    ));
  }

  /** Prima di un download: gli errori (niente da scaricare, promo fuori periodo...) arrivano qui in JSON. */
  private verificaZip(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito =>
      this.consultazione.verificaZipPop(req.params.idPromo, richiestaZipDalCorpo(req.body), ambito));
  }

  private async scaricaZipFiltrato(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    await this.inviaZip(req, res, () => ({
      periodo: periodoRichiesto(req.query.periodo),
      idFormato: testo(req.query.idFormato) ?? '',
      filtri: filtriFilePop(req.query),
    }));
  }

  private async scaricaZipSelezione(req: Request<{ idPromo: string }>, res: Response): Promise<void> {
    await this.inviaZip(req, res, () => richiestaZipDalCorpo(req.body));
  }

  /**
   * Lo ZIP va direttamente nella risposta. Finche' non e' partito niente, un errore e' una risposta
   * JSON; dopo, la connessione si chiude e il browser vede il download interrotto.
   */
  private async inviaZip(
    req: Request<{ idPromo: string }>,
    res: Response,
    leggiRichiesta: () => RichiestaZipPopConsultazione
  ): Promise<void> {
    try {
      const zip = await this.consultazione.preparaZipPop(req.params.idPromo, leggiRichiesta(), await this.ambito(req, res));
      res.attachment(zip.nomeFile);
      res.setHeader('Content-Type', 'application/zip');
      res.flushHeaders();
      await this.consultazione.scriviZipPop(zip, res);
    } catch (error) {
      if (res.headersSent || res.destroyed) {
        log.warn('ZIP POP di consultazione interrotto durante l\'invio', {
          context: 'Consultazione',
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

  private getContenutiDigitali(req: Request, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => {
      const filtri: FiltriContenutiDigitali = {
        cerca: testo(req.query.cerca),
        idPromo: testo(req.query.idPromo),
        idTipoExport: testo(req.query.idTipoExport),
        idFormato: testo(req.query.idFormato),
        idArea: testo(req.query.idArea),
        idCanale: testo(req.query.idCanale),
        pagina: numero(req.query.pagina),
        dimensione: numero(req.query.dimensione),
      };
      return this.consultazione.getContenutiDigitali(filtri, ambito);
    });
  }

  private getOpzioniContenutiDigitali(req: Request, res: Response): Promise<void> {
    return this.rispondi(req, res, ambito => this.consultazione.getOpzioniContenutiDigitali(ambito));
  }

  /** Il file come allegato, con il suo nome; gli errori (non disponibile, Olimpo giu') in JSON. */
  private async scaricaFile(req: Request<{ idFile: string }>, res: Response): Promise<void> {
    try {
      const file = await this.consultazione.scaricaFile(req.params.idFile, await this.ambito(req, res));
      res.attachment(nomeAllegato(file.nome));
      res.setHeader('Content-Type', file.mime);
      res.status(HttpStatusCode.OK).send(file.contenuto);
    } catch (error) {
      this.handleError(res, error);
    }
  }
}
