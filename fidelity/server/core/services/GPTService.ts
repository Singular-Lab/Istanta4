import axios, { AxiosError } from 'axios';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { Op, literal } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseError, ExternalApiError, NotFoundError, wrapApiError, wrapDatabaseError } from '../../../lib/errors';
import { log } from '../logger';
import { ApprofondimentoVino, FotoRicetta, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from '../../../lib/types';
import config from '../config';
import { IGPTService } from '../interfaces/IGPTService';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { ApprofondimentoVino as ApprofondimentoVinoModel } from '../models/approfondimento_vino';
import { Promo } from '../models/promo';
import { Referenze as ReferenzeIstantaModel } from '../models/referenze';
import { Ricette as RicetteModel } from '../models/ricette';
import { RuntimeKit as KitRunTimeModel } from '../models/runtime_kit';
import { ServerUtils } from '../utils/ServerUtils';

dayjs.extend(isBetween);

export class GPTService implements IGPTService {
  constructor(private readonly impostazioniService: IImpostazioniService) { }

  async deleteApprofondimentoVino(codice: string): Promise<any> {
    const approfondimentoVino = await ApprofondimentoVinoModel.findOne({ where: { codice }, raw: true }) as unknown as ApprofondimentoVino;
    if (!approfondimentoVino) {
      return null;
    }
    await ApprofondimentoVinoModel.destroy({ where: { id: approfondimentoVino.id }, limit: 1 });
    return {
      success: true,
      message: "Approfondimento vino eliminato con successo"
    };
  }

  async createApprofondimentoVino(params: { cantina: string; nome: string; codice: string; anno: number }): Promise<ApprofondimentoVino> {
    try {
      const resultAxios = await axios.post<{
        success: boolean;
        message: string;
        risposta: ApprofondimentoVino
      }>(`https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=approfondimentoVinoNoDb`, {
        apiKey: config.API_KEY_AI,
        dati_vino: {
          cantina: params.cantina,
          nome: params.nome,
          anno: params.anno
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.API_KEY_AI}`
        }
      });

      if (!resultAxios.data.success) {
        throw new ExternalApiError({
          message: 'Errore durante la generazione dell\'approfondimento vino',
          service: 'AI Service',
          details: { message: resultAxios.data.message }
        });
      }
      const approfondimentoVino = await ApprofondimentoVinoModel.create({
        id: uuidv4(),
        ...resultAxios.data.risposta,
        anno: params.anno,
        nome: params.nome,
        codice: params.codice,
        cantina: params.cantina,
      } as any) as unknown as ApprofondimentoVino;
      return approfondimentoVino;
    } catch (error) {
      if (error instanceof ExternalApiError) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: "Errore durante la generazione dell'approfondimento vino",
        operation: 'createApprofondimentoVino',
        entity: 'GPTService',
      });
    }
  }

  async getApprofondimentoVino(codice: string): Promise<ApprofondimentoVino | null> {
    const approfondimentoVino = await ApprofondimentoVinoModel.findOne({ where: { codice }, raw: true }) as unknown as ApprofondimentoVino;
    if (!approfondimentoVino) {
      return null;
    }
    return approfondimentoVino;
  }

  async getAllRicetteByPromozioniInCorsoAndPubblicate(size?: number): Promise<Ricette[]> {
    const result = await this.getAllRicetteByFiltriEPromozioniInCorso({
      titolo: "",
      stato: STATO_RICETTA.PUBBLICARE,
      tipo: TIPO_RICETTA.LUNGA,
      data_corrente: dayjs().format("YYYY-MM-DD"),
      pagina: 1,
      pagina_size: size || 10
    });
    return result;
  }

  async aggiornaFotoRicettaAMain(params: { id: string; idFoto: string; }): Promise<any> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }
    const fotoRicetta: any[] = ricetta.foto_ricetta || [];
    const foto = fotoRicetta.find(f => f.id === params.idFoto);
    if (!foto) {
      throw wrapDatabaseError(new Error("Foto non trovata"), {
        operation: 'findOne',
        entity: 'FotoRicetta',
        details: { id: params.idFoto },
        message: "Foto non trovata"
      });
    }

    const newFotoRicetta = JSON.parse(JSON.stringify(fotoRicetta));

    const mainIndex = newFotoRicetta.findIndex((f: any) => f.main === true);
    if (mainIndex !== -1) {
      newFotoRicetta[mainIndex].main = false;
    }

    const fotoIndex = newFotoRicetta.findIndex((f: any) => f.id === params.idFoto);
    if (fotoIndex !== -1) {
      newFotoRicetta[fotoIndex].main = true;
      await RicetteModel.update({ foto_ricetta: newFotoRicetta }, { where: { id: ricetta.id } });
      return RicetteModel.findOne({ where: { id: ricetta.id }, raw: true });
    }

    throw wrapDatabaseError(new Error("Foto non trovata nell'array"), {
      operation: 'update',
      entity: 'FotoRicetta',
      details: { id: params.idFoto },
      message: "Foto non trovata nell'array"
    });
  }

  async aggiornaProcedimentoRicetta(params: { id: string; procedimento: string; }): Promise<any> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }
    if (ricetta.tipo === TIPO_RICETTA.CORTA) {
      throw wrapDatabaseError(new Error("La ricetta deve essere approfondita per generare l'abbinamento vino"), {
        message: "La ricetta deve essere approfondita per generare l'abbinamento vino",
        operation: 'update',
        entity: 'Ricetta',
        details: { id: params.id },
      });
    }
    await RicetteModel.update({ procedimento: params.procedimento }, { where: { id: ricetta.id } });
    return RicetteModel.findOne({ where: { id: ricetta.id }, raw: true });
  }

  async getAllRicetteByFiltriEPromozioniInCorso(filtri: {
    titolo: string;
    stato: STATO_RICETTA;
    tipo: TIPO_RICETTA;
    data_corrente: string;
    pagina: number;
    pagina_size: number;
  }): Promise<any> {
    if (!filtri) {
      throw wrapDatabaseError(new Error("I filtri sono obbligatori"), {
        message: "I filtri sono obbligatori"
      });
    }

    const data_corrente = dayjs(filtri.data_corrente, "YYYY-MM-DD").isValid()
      ? dayjs(filtri.data_corrente, "YYYY-MM-DD").toDate()
      : dayjs().toDate();
    const stato_ricetta = filtri.stato || "";
    const tipo_ricetta = filtri.tipo || "";
    const titolo = filtri.titolo || "";
    const pagina = filtri.pagina || 1;
    const pagina_size = filtri.pagina_size || 10;

    const promozioniInCorsoDaDataSpecificata = await Promo.findAll({
      where: {
        validita_dal: { [Op.lte]: data_corrente },
        validita_al: { [Op.gte]: data_corrente },
      },
      attributes: ['id_promo']
    });

    const tuttiIKitPerPromozione = await KitRunTimeModel.findAll({
      where: { id_promo: { [Op.in]: promozioniInCorsoDaDataSpecificata.map(promo => promo.id_promo) } },
      raw: true
    }) as any[];

    const tutteLeReferenzePerKit = await ReferenzeIstantaModel.findAll({
      where: { id_runtime_kit: { [Op.in]: tuttiIKitPerPromozione.map(kit => kit.id) } },
      raw: true
    }) as any[];

    const codiciPerReferenze = tutteLeReferenzePerKit
      .map(ref => ref.data_fields?.codice_referenza)
      .filter(Boolean);

    const skip = (pagina - 1) * pagina_size;

    let ingredientiWhere: any;
    if (codiciPerReferenze.length > 0) {
      const codesLiteral = codiciPerReferenze
        .map((c: string) => `'${String(c).replace(/'/g, "''")}'`)
        .join(',');
      ingredientiWhere = literal(
        `EXISTS (SELECT 1 FROM jsonb_array_elements(ingredienti) AS elem WHERE elem->>'ean' IN (${codesLiteral}))`
      );
    } else {
      ingredientiWhere = literal('FALSE');
    }

    const andConditions: any[] = [ingredientiWhere];
    if (titolo) andConditions.push({ titolo: { [Op.iLike]: `%${titolo}%` } });
    if (stato_ricetta) andConditions.push({ stato: stato_ricetta });
    if (tipo_ricetta) andConditions.push({ tipo: tipo_ricetta });

    const [ricette, totalCount] = await Promise.all([
      RicetteModel.findAll({
        where: { [Op.and]: andConditions },
        offset: skip,
        limit: pagina_size,
        raw: true
      }),
      RicetteModel.count({
        where: { [Op.and]: andConditions }
      })
    ]);

    return {
      data: (ricette as any[]).map(r => ({ ...r, guid_id: r.id })),
      pagination: {
        total: totalCount,
        page: pagina,
        pageSize: pagina_size,
        totalPages: Math.ceil(totalCount / pagina_size)
      }
    };
  }

  async getReferenzePerRicetta(id: string): Promise<ReferenzeIstanta[]> {
    const ricetta = await RicetteModel.findOne({ where: { id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id },
        message: "Ricetta non trovata"
      });
    }

    if (!ricetta.ingredienti) {
      throw wrapDatabaseError(new Error("La ricetta non ha ingredienti definiti"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id },
        message: "La ricetta non ha ingredienti definiti"
      });
    }

    const codiciPerReferenze: string[] = (ricetta.ingredienti as any[])
      .map(ing => ing.ean)
      .filter(Boolean);

    let realResultRefs: any[] = [];
    if (codiciPerReferenze.length > 0) {
      const codesLiteral = codiciPerReferenze
        .map(c => `'${String(c).replace(/'/g, "''")}'`)
        .join(',');
      realResultRefs = await ReferenzeIstantaModel.findAll({
        where: literal(`data_fields->>'codice_referenza' IN (${codesLiteral})`),
        raw: true
      }) as any[];
    }

    realResultRefs = realResultRefs.map(ref => ({
      ...ref,
      foto: (ref.foto || []).map((foto: string) =>
        `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${foto}`
      )
    }));

    return realResultRefs as ReferenzeIstanta[];
  }

  async rigeneraFotoRicetta(params: { apiKey: string; id: string; idFoto: string }, request: Request): Promise<string> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }
    const response = await axios.post<{
      success: boolean;
      message: string;
      prompt: string;
      risultato: string;
      url: string
    }>("https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=generaImmagineRicettaByDatiRicettaCortaNoDb", {
      apiKey: params.apiKey,
      titolo: ricetta.titolo + "Genera un piatto pronto da mangiare",
      ingredienti: ricetta?.ingredienti?.map((ing: any) => ({
        nome_prodotto: ing.nome_prodotto
      }))
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      }
    });
    let base64Image: string;
    const fotoBuffer = await axios.get(response.data.url, { responseType: 'arraybuffer' });
    base64Image = Buffer.from(fotoBuffer.data).toString('base64');

    const formData = new FormData();
    const buffer = Buffer.from(base64Image, "base64");
    const blob = new Blob([buffer], { type: "image/jpeg" });
    formData.append("data", JSON.stringify({ id: ricetta.id, device: "desktop", type: "thumbnail" }));
    formData.append("file", blob, `thumbnail_${ricetta.id}.jpeg`);

    const send = await ServerUtils.sendToFICOApi<{
      message: string,
      esito: boolean,
      record: { guidId: string },
      error: string
    }>(
      request,
      `${config.OLYMPUS_IP_ADDRESS}/foto/uploadFotoWebPliant`,
      "POST",
      formData
    );

    const fotoRicetta: any[] = [...(ricetta.foto_ricetta || [])];
    const fotoIndex = fotoRicetta.findIndex(foto => foto.id === params.idFoto);
    if (fotoIndex !== -1) {
      fotoRicetta[fotoIndex] = {
        ...fotoRicetta[fotoIndex],
        id_olimpo_cloud: send.data.record.guidId,
        url: `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${send.data.record.guidId}`,
        meta: {
          id: ricetta.id,
          device: "desktop",
          type: "thumbnail"
        },
        prompt: response.data.prompt
      };
      await RicetteModel.update({ foto_ricetta: fotoRicetta }, { where: { id: ricetta.id } });
    }
    log.info('Foto ricetta rigenerata con successo');
    return `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${send.data.record.guidId}`;
  }

  async generaFotoRicetta(params: { apiKey: string; id: string; }, request: Request): Promise<string> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }

    if (ricetta.tipo === TIPO_RICETTA.CORTA) {
      throw wrapDatabaseError(new Error("La ricetta deve essere approfondita per generare l'immagine"), {
        message: "La ricetta deve essere approfondita per generare l'immagine",
        operation: 'update',
        entity: 'Ricetta',
        details: { id: params.id },
      });
    }

    const requestData = {
      apiKey: params.apiKey,
      titolo: ricetta.titolo,
      ingredienti: ricetta?.ingredienti?.map((ing: any) => ({
        nome_prodotto: ing.nome_prodotto
      }))
    };

    const response = await axios.post<{
      success: boolean;
      message: string;
      prompt: string;
      risultato: string;
      url: string;
    }>("https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=generaImmagineRicettaByDatiRicettaCortaNoDb",
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.apiKey}`
        }
      }
    );

    let base64Image: string;
    const fotoBuffer = await axios.get(response.data.url, { responseType: 'arraybuffer' });
    base64Image = Buffer.from(fotoBuffer.data).toString('base64');

    const formData = new FormData();
    const buffer = Buffer.from(base64Image, "base64");
    const blob = new Blob([buffer], { type: "image/jpeg" });
    formData.append("data", JSON.stringify({ id: ricetta.id, device: "desktop", type: "thumbnail" }));
    formData.append("file", blob, `thumbnail_${ricetta.id}.jpeg`);

    const send = await ServerUtils.sendToFICOApi<{
      message: string,
      esito: boolean,
      record: { guidId: string },
      error: string
    }>(
      request,
      `${config.OLYMPUS_IP_ADDRESS}/foto/uploadFotoWebPliant`,
      "POST",
      formData
    );

    const hasFotoMain = (ricetta.foto_ricetta || []).some((foto: any) => foto.main);
    const nuovaFoto: FotoRicetta = {
      main: !hasFotoMain,
      id_olimpo_cloud: send.data.record.guidId,
      url: `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${send.data.record.guidId}`,
      meta: {
        id: ricetta.titolo,
        device: "desktop",
        type: "thumbnail"
      },
      id: uuidv4(),
      prompt: response.data.prompt
    };

    const currentFotoRicetta: any[] = [...(ricetta.foto_ricetta || []), nuovaFoto];
    await RicetteModel.update({ foto_ricetta: currentFotoRicetta }, { where: { id: ricetta.id } });

    log.info('Foto ricetta generata con successo');

    return `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${send.data.record.guidId}`;
  }

  async generaAbbinamentoVino(params: { apiKey: string; id: string; }): Promise<any> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as unknown as Ricette;
    let viniDisponibiliOggi = await this.getViniClienteByFiltriEPromoInCorso({
      titolo: "",
      tipo: "",
      data_corrente: new Date().toISOString()
    });
    viniDisponibiliOggi = viniDisponibiliOggi.filter(v => v.approfondimento);
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }
    if (ricetta.tipo === TIPO_RICETTA.CORTA) {
      throw wrapDatabaseError(new Error("La ricetta deve essere approfondita per generare l'abbinamento vino"), {
        message: "La ricetta deve essere approfondita per generare l'abbinamento vino",
        operation: 'update',
        entity: 'Ricetta',
        details: { id: params.id },
      });
    }

    try {
      const viniDisponibili = viniDisponibiliOggi.map(v => ({
        id: v.approfondimento.id,
        cantina: v.approfondimento.cantina,
        vino: v.approfondimento.nome,
        anno: v.approfondimento.anno
      }));
      const response = await axios.post<{
        success: boolean;
        message: string;
        risposta: {
          vini_abbinati: Array<string>;
          motivazione: string;
        };
      }>("https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=abbinamentoVinoNoDb", {
        apiKey: params.apiKey,
        ricetta: {
          titolo: ricetta.titolo,
          ingredienti: ricetta?.ingredienti?.map(ing => ing.nome_prodotto)
        },
        vini: viniDisponibili
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${params.apiKey}`
        }
      });

      const abbinamentoVino = {
        vini_abbinati: response.data.risposta.vini_abbinati,
        motivazione: response.data.risposta.motivazione
      };
      await RicetteModel.update({ abbinamento_vino: abbinamentoVino }, { where: { id: params.id } });
      return RicetteModel.findOne({ where: { id: params.id }, raw: true });
    } catch (error) {
      log.error("Errore durante la generazione dell'abbinamento vino", error instanceof Error ? error : new Error(String(error)));
      throw new ExternalApiError({
        message: 'Impossibile generare l\'abbinamento vino. Si prega di riprovare più tardi.',
        service: 'MattoliniAPI',
        endpoint: '/abbinamento-vino',
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  async generaRicettaApprofondita(params: { apiKey: string; id: string; }): Promise<any> {
    const ricetta = await RicetteModel.findOne({ where: { id: params.id }, raw: true }) as any;
    if (!ricetta) {
      throw wrapDatabaseError(new Error("Ricetta non trovata"), {
        operation: 'findOne',
        entity: 'Ricetta',
        details: { id: params.id },
        message: "Ricetta non trovata"
      });
    }
    if (ricetta.tipo === TIPO_RICETTA.LUNGA) {
      throw wrapDatabaseError(new Error("La ricetta è già stata approfondita"), {
        message: "La ricetta è già stata approfondita",
        operation: 'update',
        entity: 'Ricetta',
        details: { id: params.id },
      });
    }
    const response = await axios.post<{
      success: boolean;
      message: string;
      risposta: {
        procedimento: string;
        ingredienti: Array<{
          nome_prodotto: string;
          ean: string;
          quantita_necessaria: number;
          unita_misura_peso: string;
          costo_ingrediente_euro: number;
          inclusoNelVolantino: string;
        }>;
        tempo_in_secondi: string;
        costo_in_euro: string;
      }
    }>("https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=generaRicettaEstesaByDatiInviatiSenzaDb", {
      apiKey: params.apiKey,
      dati_ricetta: ricetta
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      }
    });

    await RicetteModel.update({
      procedimento: response.data.risposta.procedimento,
      ingredienti: response.data.risposta.ingredienti.map(ing => ({
        nome_prodotto: ing.nome_prodotto,
        ean: ing.ean,
        quantita_necessaria: ing.quantita_necessaria,
        unita_misura_peso: ing.unita_misura_peso,
        costo_ingrediente_euro: ing.costo_ingrediente_euro,
        incluso_nel_volantino: ing.inclusoNelVolantino === "true"
      })),
      stato: STATO_RICETTA.REVISIONARE,
      tipo: TIPO_RICETTA.LUNGA,
      tempo_in_secondi: response.data.risposta.tempo_in_secondi,
      costo_in_euro: response.data.risposta.costo_in_euro
    } as any, { where: { id: params.id } });

    return RicetteModel.findOne({ where: { id: params.id }, raw: true });
  }

  async generaRicetteCorteMultiple(params:
    {
      apiKey: string;
      indicazioni: string;
      numero_ricette: number
      prodottiInOfferta: Array<{
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
      }>;
    }): Promise<any> {
    try {
      const prodottiInOfferta = params.prodottiInOfferta.sort(() => Math.random() - 0.5).slice(10, 30);
      const response = await axios.post<{
        success: boolean;
        message: string;
        indicazioni: string;
        risposta: Array<{
          titolo: string;
          ingredienti: Array<{
            nome_prodotto: string;
            ean: string;
            peso: number;
            unita_misura_peso: string;
            costo_per_unita_misura: number;
            inclusoNelVolantino: string;
          }>;
        }>;
      }>(
        "https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=generaRicetteCorteMultipleSenzaSalvareNelDb",
        {
          apiKey: params.apiKey,
          indicazioni: params.indicazioni,
          numero_ricette: params.numero_ricette,
          prodottiInOfferta: prodottiInOfferta
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${params.apiKey}`
          }
        }
      );
      if (response.data.success) {
        const ricette = response.data.risposta.map((ricetta) => ({
          ...ricetta,
          id: uuidv4(),
          stato: STATO_RICETTA.REVISIONARE,
          tipo: TIPO_RICETTA.CORTA,
        }));
        const ricetteSalvate = await RicetteModel.bulkCreate(ricette as any[]);
        return {
          success: true,
          message: response.data.message,
          indicazioni: response.data.indicazioni,
          risposta: ricette
        };
      } else {
        throw wrapDatabaseError(new Error("Errore durante la generazione delle ricette"), {
          message: "Errore durante la generazione delle ricette",
          operation: 'generaRicetteCorteMultiple',
          entity: 'GPTService'
        });
      }
    } catch (error) {
      log.error('Errore nella generazione delle ricette corte multiple', error instanceof Error ? error : new Error(String(error)));
      if (error instanceof AxiosError) {
        throw wrapApiError(error, {
          message: error.response?.data.message,
          details: { error },
          service: 'GPTService',
          endpoint: 'generaRicetteCorteMultiple'
        });
      }
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante la generazione delle ricette"), {
        message: "Errore durante la generazione delle ricette",
        operation: 'generaRicetteCorteMultiple',
        entity: 'GPTService',
        details: { error }
      });
    }
  }

  async generaRicetta(params: {
    apiKey: string;
    indicazioni: string;
    prodottiInOfferta: Array<{
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
    }>;
  }): Promise<any> {
    try {
      const prodottiInOfferta = params.prodottiInOfferta.sort(() => Math.random() - 0.5).slice(0, 5);
      const response = await axios.post<{
        status: string;
        message: string;
        risposta: {
          titolo: string;
          ingredienti: {
            nome_prodotto: string;
            ean: string;
            peso: number;
            unita_misura_peso: string;
            costo_per_unita_misura: number;
            inclusoNelVolantino: boolean;
          }[];
        };
        success: boolean;
      }>(
        "https://www.istantabusiness.it/betatools/ricette_ai/endpoint-api.php?azione=generaRicettaCortaSenzaSalvareNelDb",
        {
          apiKey: params.apiKey,
          indicazioni: params.indicazioni,
          prodottiInOfferta: prodottiInOfferta,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${params.apiKey}`
          }
        }
      );
      if (response.data.success) {
        const ricetta = {
          ...response.data.risposta,
          id: uuidv4(),
          stato: STATO_RICETTA.REVISIONARE,
          tipo: TIPO_RICETTA.CORTA,
        };
        const ricettaSalvata = await RicetteModel.create(ricetta as any);
        return response.data;
      } else {
        throw wrapDatabaseError(new Error("Errore durante la generazione della ricetta"), {
          message: "Errore durante la generazione della ricetta",
          operation: 'generaRicetta',
          entity: 'GPTService'
        });
      }
    } catch (error) {
      log.error('Errore nella generazione della ricetta', error instanceof Error ? error : new Error(String(error)));
      if (error instanceof AxiosError) {
        throw wrapApiError(error, {
          message: error.response?.data.message,
          details: { error },
          service: 'GPTService',
          endpoint: 'generaRicetta'
        });
      }
      if (error instanceof DatabaseError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante la generazione della ricetta"), {
        message: "Errore durante la generazione della ricetta",
        operation: 'generaRicetta',
        entity: 'GPTService',
        details: { error }
      });
    }
  }

  async getRicettaById(id: string): Promise<any> {
    try {
      // Step 1: trova la ricetta
      const ricetta = await RicetteModel.findOne({ where: { id }, raw: true }) as any;
      if (!ricetta) {
        throw new NotFoundError({
          entityType: 'Ricetta',
          entityId: id,
          message: "Ricetta non trovata"
        });
      }

      // Step 2: trova approfondimenti vino dai vini abbinati
      const viniAbbinati: string[] = ricetta.abbinamento_vino?.vini_abbinati || [];
      let approfondimentiVini: any[] = [];
      if (Array.isArray(viniAbbinati) && viniAbbinati.length > 0) {
        approfondimentiVini = await ApprofondimentoVinoModel.findAll({
          where: { id: { [Op.in]: viniAbbinati } },
          raw: true
        }) as any[];
      }

      // Step 3: trova referenze per codici dei vini
      const codiciVini = approfondimentiVini.map((v: any) => v.codice);
      let referenzeIstanta: any[] = [];
      if (codiciVini.length > 0) {
        const codesLiteral = codiciVini
          .map((c: string) => `'${String(c).replace(/'/g, "''")}'`)
          .join(',');
        referenzeIstanta = await ReferenzeIstantaModel.findAll({
          where: literal(`data_fields->>'codice_referenza' IN (${codesLiteral})`),
          raw: true
        }) as any[];
        referenzeIstanta = referenzeIstanta.map(ref => ({
          ...ref,
          foto: (ref.foto || []).map((fotoId: string) =>
            `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${fotoId}`
          )
        }));
      }

      // Step 4: ricostruisce struttura abbinamento_vino con dati completi
      let abbinamentoVino = ricetta.abbinamento_vino;
      if (abbinamentoVino && approfondimentiVini.length > 0 && referenzeIstanta.length > 0) {
        abbinamentoVino = {
          motivazione: abbinamentoVino.motivazione,
          vini_abbinati: referenzeIstanta.map(ref => ({
            ...ref,
            approfondimento: approfondimentiVini.find(
              (a: any) => a.codice === ref.data_fields?.codice_referenza
            ) || null
          }))
        };
      }

      return { ...ricetta, abbinamento_vino: abbinamentoVino };
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante la ricerca della ricetta"), {
        message: "Errore durante la ricerca della ricetta",
        operation: 'getRicettaById',
        entity: 'GPTService',
        details: { error }
      });
    }
  }

  async getAllRicette(): Promise<any> {
    try {
      const ricette = await RicetteModel.findAll({ raw: true });
      return ricette;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la ricerca delle ricette"), {
        message: "Errore durante la ricerca delle ricette",
        operation: 'getAllRicette',
        entity: 'GPTService'
      });
    }
  }

  async deleteRicetta(id: string): Promise<any> {
    try {
      const ricetta = await RicetteModel.findOne({ where: { id }, raw: true });
      if (!ricetta) {
        throw new NotFoundError({
          entityType: 'Ricetta',
          entityId: id,
          message: "Ricetta non trovata"
        });
      }
      await RicetteModel.destroy({ where: { id } });
      return ricetta;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante la cancellazione della ricetta"), {
        message: "Errore durante la cancellazione della ricetta",
        operation: 'deleteRicetta',
        entity: 'GPTService',
        details: { error }
      });
    }
  }

  async cambiaStatoRicetta(guidId: string, stato: STATO_RICETTA): Promise<any> {
    try {
      const [count] = await RicetteModel.update({ stato }, { where: { id: guidId } });
      if (count === 0) {
        throw new NotFoundError({
          entityType: 'Ricetta',
          entityId: guidId,
          message: "Ricetta non trovata"
        });
      }
      return RicetteModel.findOne({ where: { id: guidId }, raw: true });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante la modifica dello stato della ricetta: " + error), {
        message: "Errore durante la modifica dello stato della ricetta: " + error,
        operation: 'cambiaStatoRicetta',
        entity: 'GPTService',
        details: { error }
      });
    }
  }

  async getViniClienteByFiltriEPromoInCorso(filtri: {
    titolo: string,
    tipo: string,
    data_corrente: string
  }): Promise<(ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[]> {
    try {
      const configQueryVini = fs.readFileSync(
        path.join(process.cwd(), 'config', 'vini_query.json'),
        'utf8'
      );
      const queryViniConfig = JSON.parse(configQueryVini);

      const data_corrente = dayjs(filtri.data_corrente, "YYYY-MM-DD").isValid()
        ? dayjs(filtri.data_corrente, "YYYY-MM-DD").toDate()
        : dayjs().toDate();

      // Step 1: Trova le promozioni in corso usando il modello Sequelize
      const promozioniCandidate = await Promo.findAll({
        where: {
          validita_al: { [Op.gte]: data_corrente }
        },
        attributes: ['id_promo', 'validita_dal', 'validita_al', 'offset_visibilita']
      });

      const currentDay = dayjs(data_corrente);
      const promozioniInCorso = promozioniCandidate.filter(promo => {
        const offsetDays = Number(promo.offset_visibilita) || 0;
        const inizioVisibilita = dayjs(promo.validita_dal).subtract(offsetDays, 'day');
        const fineVisibilita = dayjs(promo.validita_al);
        return (currentDay as any).isBetween(inizioVisibilita, fineVisibilita, 'day', '[]');
      });

      if (promozioniInCorso.length === 0) {
        return [];
      }

      const idPromozioni = promozioniInCorso.map(promo => promo.id_promo);

      // Step 2: Trova tutti i kit runtime per queste promozioni
      const tuttiIKitPerPromozione = await KitRunTimeModel.findAll({
        where: { id_promo: { [Op.in]: idPromozioni } },
        raw: true
      }) as any[];

      if (tuttiIKitPerPromozione.length === 0) {
        return [];
      }

      // Step 3: Trova tutte le referenze per questi kit.
      // queryViniConfig usa formato { "dataFields.xxx": "value" } (path MongoDB).
      // Convertiamo in Sequelize JSONB literal: data_fields->>'xxx' = 'value'
      const guidIdKits = tuttiIKitPerPromozione.map(kit => kit.id);
      const viniLiterals = Object.entries(queryViniConfig).map(([key, val]) => {
        const jsonbField = key.replace(/^dataFields\./, '');
        return literal(`data_fields->>'${jsonbField}' = '${String(val).replace(/'/g, "''")}'`);
      });

      const tutteLeReferenzePerKit = await ReferenzeIstantaModel.findAll({
        where: {
          id_runtime_kit: { [Op.in]: guidIdKits },
          ...(viniLiterals.length > 0 ? { [Op.and]: viniLiterals } : {})
        },
        raw: true
      }) as any[];

      if (tutteLeReferenzePerKit.length === 0) {
        return [];
      }

      // Step 4: Estrai i codici delle referenze
      const codiciPerReferenze = tutteLeReferenzePerKit
        .map(ref => ref.data_fields?.codice_referenza)
        .filter(Boolean);

      // Step 5: Trova approfondimenti vino per questi codici
      const approfondimentiVino = await ApprofondimentoVinoModel.findAll({
        where: { codice: { [Op.in]: codiciPerReferenze } },
        raw: true
      }) as any[];

      // Step 6: Combina i risultati normalizzando snake_case → camelCase
      const risultato = tutteLeReferenzePerKit.map(referenza => {
        const codiceReferenza = referenza.data_fields?.codice_referenza;
        const appRaw = approfondimentiVino.find((app: any) => app.codice === codiceReferenza);

        return {
          ...referenza,
          // ReferenzeIstanta camelCase
          guidIdKitRuntime: referenza.id_runtime_kit,
          idPromo: referenza.id_promo,
          compiledFields: referenza.compiled_fields,
          deletedFields: referenza.deleted_fields,
          fotoExtra: referenza.foto_extra,
          groupElements: referenza.group_elements,
          codiceBox: referenza.codice_box,
          dataFields: referenza.data_fields,
          foto: (referenza.foto || []).map((fotoId: string) =>
            `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${fotoId}`
          ),
          approfondimento: appRaw ? {
            ...appRaw,
            dataCreazione: appRaw.data_creazione,
            dataPubblicazione: appRaw.data_pubblicazione,
          } : null
        };
      });

      return risultato as (ReferenzeIstanta & { approfondimento: ApprofondimentoVino })[];

    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la ricerca dei vini"), {
        message: "Errore durante la ricerca dei vini",
        operation: 'getViniClienteByFiltriEPromoInCorso',
        entity: 'GPTService',
        details: { error }
      });
    }
  }
}
