import { Request, Response } from 'express';
import { readFile } from 'fs/promises';
import path from 'path';
import { HttpStatusCode } from '../../../lib/enums';
import { BadRequestError, NotFoundError } from '../../../lib/errors';
import { ReferenzeIstanta, STATO_RICETTA, TIPO_RICETTA } from '../../../lib/types';
import { BaseController } from '../base/BaseController';
import config from "../config/index";
import { IGPTService } from '../interfaces/IGPTService';
import { IReferenzeService } from '../interfaces/IReferenzeService';
import { authMiddleware } from '../middleware/authMiddleware';
import { permissionGuard } from '../middleware/permissionGuard';
import { ServerUtils } from '../utils/ServerUtils';

// Tipi per migliorare la type safety
interface FiltriRicetta {
  idArea: string;
  idCanale: string;
  idPromo: string;
  data_da: string;
  data_a: string;
  sigle_reparto: string[];
}

interface ReferenzaMappata {
  titolo: string;
  brand: string;
  tipologia: string;
  grammatura: string;
  reparto: string;
  descrizione_reparto: string;
  descrizione_settore: string;
  peso: number;
  unita_misura_peso: string;
  prezzo: number;
  prezzo_standard: number;
  ean: string;
  compiled_field_descrizione: string;
}

export class GPTController extends BaseController {
  private gptService: IGPTService;
  private referenzeService: IReferenzeService;
  private dictionaryCache: Record<string, any> | null = null;

  constructor(gptService: IGPTService, referenzeService: IReferenzeService) {
    super('/api');
    this.gptService = gptService;
    this.referenzeService = referenzeService;
  }

  protected setupRoutes(): void {
    this.initializeRoutes();
  }

  public initializeRoutes(): void {
    // Recipe routes
    this.router.put("/genera_ricetta_corta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.generaRicetta.bind(this));
    this.router.put("/genera_ricette_corte_multiple", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.generaRicetteCorteMultiple.bind(this));
    this.router.put("/genera_ricetta_approfondita", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.generaRicettaApprofondita.bind(this));
    this.router.get("/get_all_ricette", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.getAllRicette.bind(this));
    this.router.get("/get_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.getRicettaById.bind(this));
    this.router.put("/get_all_ricette_by_filtri_e_promozioni_in_corso", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.getAllRicetteByFiltriEPromozioniInCorso.bind(this));
    this.router.get("/get_all_ricette_by_promozioni_in_corso_and_pubblicate", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.getAllRicetteByPromozioniInCorsoAndPubblicate.bind(this));
    this.router.get("/get_referenze_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.getReferenzePerRicetta.bind(this));
    this.router.put("/genera_foto_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.generaFotoRicetta.bind(this));
    this.router.put("/rigenera_foto_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.rigeneraFotoRicetta.bind(this));
    this.router.put("/aggiorna_foto_ricetta_a_main", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.aggiornaFotoRicettaAMain.bind(this));
    this.router.put("/cambia_stato_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.cambiaStatoRicetta.bind(this));
    this.router.put("/aggiorna_procedimento_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.aggiornaProcedimentoRicetta.bind(this));
    this.router.delete("/delete_ricetta", authMiddleware, permissionGuard('ai.gestisci_ricette'), this.deleteRicetta.bind(this));

    // Wine routes
    this.router.put("/genera_abbinamento_vino", authMiddleware, permissionGuard('ai.gestisci_vini'), this.generaAbbinamentoVino.bind(this));
    this.router.put("/get_vini_cliente_by_filtri_e_promo_in_corso", authMiddleware, permissionGuard('ai.gestisci_vini'), this.getViniClienteByFiltriEPromoInCorso.bind(this));
    this.router.get("/get_approfondimento_vino", authMiddleware, permissionGuard('ai.gestisci_vini'), this.getApprofondimentoVino.bind(this));
    this.router.put("/create_approfondimento_vino", authMiddleware, permissionGuard('ai.gestisci_vini'), this.createApprofondimentoVino.bind(this));
    this.router.delete("/delete_approfondimento_vino/:codice", authMiddleware, permissionGuard('ai.gestisci_vini'), this.deleteApprofondimentoVino.bind(this));
  }

  private async generaRicetta(req: Request, res: Response): Promise<void> {
    try {
      // Validazione input
      const { messaggio, filtri } = req.body;

      // Ottieni referenze
      const referenze = await this.referenzeService.getAllReferenzePromoInCorso(filtri);

      if (!referenze || referenze.length === 0) {
        res.status(HttpStatusCode.OK).json({
          message: 'Nessuna referenza trovata per i filtri specificati',
          data: []
        });
        return;
      }

      // Mappa referenze con gestione errori
      const referenze_array = await this.mapReferenzeToArray(referenze);

      // Rimuovi duplicati
      const referenzeUniche = this.removeDuplicatesByEan(referenze_array);

      // Genera ricetta
      const result = await this.gptService.generaRicetta({
        apiKey: config.API_KEY_AI as string,
        indicazioni: messaggio,
        prodottiInOfferta: referenzeUniche
      });

      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in generaRicetta:', error);
      this.handleError(res, error);
    }
  }

  private async generaRicetteCorteMultiple(req: Request, res: Response): Promise<void> {
    try {
      const { messaggio, filtri, quantita } = req.body;

      // Ottieni referenze
      const referenze = await this.referenzeService.getAllReferenzePromoInCorso(filtri);

      if (!referenze || referenze.length === 0) {
        res.status(HttpStatusCode.OK).json({
          message: 'Nessuna referenza trovata per i filtri specificati',
          data: []
        });
        return;
      }

      // Mappa referenze con gestione errori
      const referenze_array = await this.mapReferenzeToArray(referenze);

      // Rimuovi duplicati
      const referenzeUniche = this.removeDuplicatesByEan(referenze_array);

      // Genera ricette
      const result = await this.gptService.generaRicetteCorteMultiple({
        apiKey: config.API_KEY_AI as string,
        indicazioni: messaggio,
        numero_ricette: quantita,
        prodottiInOfferta: referenzeUniche
      });

      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in generaRicetteCorteMultiple:', error);
      this.handleError(res, error);
    }
  }

  private async getRicettaById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      if (!id) {
        throw new BadRequestError({
          message: 'ID della ricetta mancante',
        });
      }
      const ricetta = await this.gptService.getRicettaById(id);
      res.status(HttpStatusCode.OK).json(ricetta);
    } catch (error) {
      console.error('Errore in getRicettaById:', error);
      this.handleError(res, error);
    }
  }

  private async getAllRicette(req: Request, res: Response): Promise<void> {
    try {
      const ricette = await this.gptService.getAllRicette();
      res.status(HttpStatusCode.OK).json(ricette);
    } catch (error) {
      console.error('Errore in getAllRicette:', error);
      this.handleError(res, error);
    }
  }

  private async getAllRicetteByFiltriEPromozioniInCorso(req: Request, res: Response): Promise<void> {
    try {
      const filtri = req.body as {
        titolo: string,
        stato: STATO_RICETTA,
        tipo: TIPO_RICETTA,
        data_corrente: string,
        pagina: number,
        pagina_size: number
      };
      const ricette = await this.gptService.getAllRicetteByFiltriEPromozioniInCorso(filtri);
      res.status(HttpStatusCode.OK).json(ricette);
    } catch (error) {
      console.error('Errore in getAllRicetteByFiltriEPromozioniInCorso:', error);
      this.handleError(res, error);
    }
  }

  private async generaRicettaApprofondita(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.body;
      const result = await this.gptService.generaRicettaApprofondita({
        apiKey: config.API_KEY_AI as string,
        id: id
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in generaRicettaApprofondita:', error);
      this.handleError(res, error);
    }
  }

  private async generaFotoRicetta(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.body;
      const result = await this.gptService.generaFotoRicetta({
        apiKey: config.API_KEY_AI as string,
        id: id
      }, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in generaFotoRicetta:', error);
      this.handleError(res, error);
    }
  }

  private async rigeneraFotoRicetta(req: Request, res: Response): Promise<void> {
    try {
      const { id, idFoto } = req.body;
      const result = await this.gptService.rigeneraFotoRicetta({
        apiKey: config.API_KEY_AI as string,
        id: id,
        idFoto: idFoto
      }, req);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in rigeneraFotoRicetta:', error);
      this.handleError(res, error);
    }
  }

  private async getReferenzePerRicetta(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      if (!id) {
        throw new BadRequestError({
          message: 'ID della ricetta mancante',

        });
      }
      const result = await this.gptService.getReferenzePerRicetta(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in getReferenzePerRicetta:', error);
      this.handleError(res, error);
    }
  }

  private async generaAbbinamentoVino(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.body;
      const result = await this.gptService.generaAbbinamentoVino({
        apiKey: config.API_KEY_AI as string,
        id: id
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in generaAbbinamentoVino:', error);
      this.handleError(res, error);
    }
  }

  private async aggiornaProcedimentoRicetta(req: Request, res: Response): Promise<void> {
    try {
      const { id, procedimento } = req.body;
      const result = await this.gptService.aggiornaProcedimentoRicetta({
        id: id,
        procedimento: procedimento
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in aggiornaProcedimentoRicetta:', error);
      this.handleError(res, error);
    }
  }


  private async aggiornaFotoRicettaAMain(req: Request, res: Response): Promise<void> {
    try {
      const { id, idFoto } = req.body;
      const result = await this.gptService.aggiornaFotoRicettaAMain({
        id: id,
        idFoto: idFoto
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in aggiornaFotoRicettaAMain:', error);
      this.handleError(res, error);
    }
  }

  private async deleteRicetta(req: Request, res: Response): Promise<void> {
    try {
      const id = req.query.id as string;
      if (!id) {
        throw new BadRequestError({
          message: 'ID della ricetta mancante',

        });
      }
      const result = await this.gptService.deleteRicetta(id);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in deleteRicetta:', error);
      this.handleError(res, error);
    }
  }

  async cambiaStatoRicetta(req: Request, res: Response): Promise<void> {
    try {
      const { guidId, stato } = req.body as { guidId: string, stato: STATO_RICETTA };
      const result = await this.gptService.cambiaStatoRicetta(guidId, stato);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in cambiaStatoRicetta:', error);
      this.handleError(res, error);
    }
  }

  private async getAllRicetteByPromozioniInCorsoAndPubblicate(req: Request, res: Response): Promise<void> {
    try {
      const size = req.query.size ? Number(req.query.size) : undefined;
      const ricette = await this.gptService.getAllRicetteByPromozioniInCorsoAndPubblicate(size);
      res.status(HttpStatusCode.OK).json(ricette);
    } catch (error) {
      console.error('Errore in getAllRicetteByPromozioniInCorsoAndPubblicate:', error);
      this.handleError(res, error);
    }
  }

  private async getViniClienteByFiltriEPromoInCorso(req: Request, res: Response): Promise<void> {
    try {
      const filtri = req.body as {
        titolo: string,
        tipo: string,
        data_corrente: string
      };
      const vini = await this.gptService.getViniClienteByFiltriEPromoInCorso(filtri);
      res.status(HttpStatusCode.OK).json(vini);
    } catch (error) {
      console.error('Errore in getViniClienteByFiltriEPromoInCorso:', error);
      this.handleError(res, error);
    }
  }
  async getApprofondimentoVino(req: Request, res: Response): Promise<void> {
    try {
      const codice = req.query.codice as string;
      if (!codice) {
        throw new BadRequestError({
          message: 'Codice del vino mancante',

        });
      }
      const result = await this.gptService.getApprofondimentoVino(codice);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in getApprofondimentoVino:', error);
      this.handleError(res, error);
    }
  }

  //#region  Helper Methods


  private async mapReferenzeToArray(referenze: ReferenzeIstanta[]): Promise<ReferenzaMappata[]> {
    const dictionary = await this.getDictionary();
    const risultati: ReferenzaMappata[] = [];

    for (const referenza of referenze) {
      try {
        const mapped = await this.mapSingleReferenza(referenza, dictionary);
        risultati.push(mapped);
      } catch (error) {
        console.warn(`Errore nel mapping della referenza ${referenza.dataFields?.codice_referenza || 'unknown'}:`, error);
        // Continua con le altre referenze invece di fallire completamente
      }
    }

    return risultati;
  }

  private async getDictionary(): Promise<Record<string, any>> {
    if (this.dictionaryCache) {
      return this.dictionaryCache;
    }

    try {
      const __dirname = path.resolve();
      const dictionaryPath = path.join(__dirname, 'config/dictionary_translation.json');
      const dictionary = await readFile(dictionaryPath, 'utf8');
      this.dictionaryCache = JSON.parse(dictionary);
      if (!this.dictionaryCache) {
        throw new NotFoundError({
          message: 'Dizionario non trovato',
          entityType: 'Dizionario'
        })
      }
      return this.dictionaryCache;
    } catch (error) {
      console.warn('Errore nel caricamento del dizionario:', error);
      return {};
    }
  }

  private async mapSingleReferenza(referenza: ReferenzeIstanta, dictionary: Record<string, any>): Promise<ReferenzaMappata> {
    const getTranslatedField = (fieldName: string): string => {
      const value = referenza.dataFields?.[fieldName] as string;
      if (!value) return '';

      const translated = ServerUtils.t(value, dictionary) || value;
      return translated.trim();
    };

    const getNumericField = (fieldName: string): number => {
      const value = referenza.dataFields?.[fieldName];
      if (value === null || value === undefined) return 0;

      const parsed = parseFloat(value.toString());
      return isNaN(parsed) ? 0 : parsed;
    };

    const getCompiledDescription = (): string => {
      try {
        const field = referenza.compiledFields?.find(
          (field) => field.label_name?.toString() === "descrizione"
        );

        if (!field?.content) return '';
        // Pulisci il contenuto
        const cleaned = field.content
          .replace(/<[^>]*>/g, '')  // Remove HTML tags
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
          .replace(/[\\"]/g, '') // Remove backslashes and quotes that could break JSON
          .replace(/\s+/g, ' ')
          .trim();
        return ServerUtils.t(cleaned, dictionary) || cleaned;
      } catch (error) {
        console.warn('Errore nel parsing della descrizione compilata:', error);
        return '';
      }
    };

    return {
      titolo: referenza.dataFields?.descrizione_uno as string,
      brand: referenza.dataFields?.descrizione_due as string,
      tipologia: referenza.dataFields?.descrizione_tre as string,
      grammatura: referenza.dataFields?.descrizione_peso
        ? referenza.dataFields?.descrizione_peso.toString()
        : '',
      reparto: getTranslatedField("reparto"),
      descrizione_reparto: getTranslatedField("descrizione_reparto"),
      descrizione_settore: getTranslatedField("descrizione_settore"),
      peso: getNumericField("descrizione_peso"),
      unita_misura_peso: getTranslatedField("descrizione_unita_misura"),
      prezzo: getNumericField("prezzo"),
      prezzo_standard: getNumericField("prezzo_standard"),
      ean: referenza.dataFields?.codice_referenza as string,
      compiled_field_descrizione: getCompiledDescription()
    };
  }

  private removeDuplicatesByEan(referenze: ReferenzaMappata[]): ReferenzaMappata[] {
    const seen = new Set<string>();
    return referenze.filter(referenza => {
      if (!referenza.ean || seen.has(referenza.ean)) {
        return false;
      }
      seen.add(referenza.ean);
      return true;
    });
  }

  private async createApprofondimentoVino(req: Request, res: Response): Promise<void> {
    try {
      const { cantina, nome, codice, anno } = req.body;
      if (!cantina || !nome || !codice || !anno) {
        throw new BadRequestError({
          message: 'Dati mancanti',

        });
      }
      const result = await this.gptService.createApprofondimentoVino({
        cantina: cantina,
        nome: nome,
        codice: codice,
        anno: anno
      });
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in createApprofondimentoVino:', error);
      this.handleError(res, error);
    }
  }

  private async deleteApprofondimentoVino(req: Request, res: Response): Promise<void> {
    try {
      const codice = req.params.codice as string;
      const result = await this.gptService.deleteApprofondimentoVino(codice);
      res.status(HttpStatusCode.OK).json(result);
    } catch (error) {
      console.error('Errore in deleteApprofondimentoVino:', error);
      this.handleError(res, error);
    }
  }

  // Metodo per invalidare la cache del dizionario se necessario
  public invalidateDictionaryCache(): void {
    this.dictionaryCache = null;
  }
  //#endregion
}
