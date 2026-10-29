import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { Op, literal } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { ExternalApiError, isAppError, NotFoundError, ServiceUnavailableError, wrapDatabaseError } from '../../../lib/errors';
import { log } from '../logger';
import { ApprofondimentoVino, FotoRicetta, ReferenzeIstanta, Ricette, STATO_RICETTA, TIPO_RICETTA } from '../../../lib/types';
import config from '../config';
import { chiamaHttp, ErroreHttp } from '../http/clienteHttp';
import { IGPTService } from '../interfaces/IGPTService';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { ApprofondimentoVino as ApprofondimentoVinoModel } from '../models/approfondimento_vino';
import { Promo } from '../models/promo';
import { Referenze as ReferenzeIstantaModel } from '../models/referenze';
import { Ricette as RicetteModel } from '../models/ricette';
import { RuntimeKit as KitRunTimeModel } from '../models/runtime_kit';
import { ServerUtils } from '../utils/ServerUtils';
import { urlOlimpo } from '../utils/urlOlimpo';

// Quoting dei valori che entrano in un literal SQL: lo fa Sequelize, non a mano.
const sqlString = (value: unknown): string => ReferenzeIstantaModel.sequelize!.escape(String(value));

dayjs.extend(isBetween);

const SERVIZIO_AI = 'AI ricette';
// L'immagine arriva da un indirizzo scelto dal servizio AI: tempo e dimensione limitati
const TIMEOUT_IMMAGINE_MS = 30_000;
const DIMENSIONE_MASSIMA_IMMAGINE = 10 * 1024 * 1024;

/** Motivo breve dato dal servizio: niente oggetti interi, che potrebbero contenere la richiesta. */
function motivoBreve(dati: unknown): string {
  const testo = (dati as { message?: unknown } | null)?.message;
  return typeof testo === 'string' ? testo.trim().slice(0, 200) : '';
}

/**
 * POST verso il servizio AI delle ricette (`?azione=...`). Mai ritentata: ogni chiamata ha un
 * costo e genera un contenuto nuovo. Gli errori riportano solo stato e motivo breve: la chiave
 * viaggia nella richiesta e non deve finire nei log.
 */
export async function chiamaServizioAi<T>(azione: string, apiKey: string, dati: Record<string, unknown>, operazione: string): Promise<T> {
  const url = new URL(config.AI_RICETTE_API_URL);
  url.searchParams.set('azione', azione);

  let risposta: Response;
  try {
    risposta = await chiamaHttp(url.toString(), {
      method: 'POST',
      timeoutMs: config.AI_RICETTE_TIMEOUT_MS,
      idempotente: false,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ apiKey, ...dati }),
    });
  } catch (err) {
    if (err instanceof ErroreHttp) {
      throw new ServiceUnavailableError({
        message: err.motivo === 'timeout'
          ? `Il servizio AI non ha risposto in tempo durante ${operazione}`
          : `Servizio AI non raggiungibile durante ${operazione}`,
        service: SERVIZIO_AI,
        details: { azione, motivo: err.motivo },
      });
    }
    throw err;
  }

  const corpo = await risposta.json().catch(() => null) as any;
  const motivo = motivoBreve(corpo);
  if (!risposta.ok) {
    throw new ExternalApiError({
      message: `Errore del servizio AI durante ${operazione} (HTTP ${risposta.status})${motivo ? `: ${motivo}` : ''}`,
      service: SERVIZIO_AI,
      endpoint: azione,
      statusCode: risposta.status,
    });
  }
  if (!corpo || typeof corpo !== 'object' || corpo.success === false) {
    throw new ExternalApiError({
      message: `Il servizio AI non ha completato ${operazione}${motivo ? `: ${motivo}` : ''}`,
      service: SERVIZIO_AI,
      endpoint: azione,
      statusCode: risposta.status,
    });
  }
  return corpo as T;
}

/** Scarica l'immagine generata: solo https, 30 s, al massimo 10 MB anche se il Content-Length manca o mente. */
export async function scaricaImmagineGenerata(indirizzo: unknown): Promise<Buffer> {
  const errore = (message: string, statusCode?: number) =>
    new ExternalApiError({ message, service: SERVIZIO_AI, endpoint: 'immagine generata', statusCode });

  let url: URL | null = null;
  try { url = new URL(String(indirizzo)); } catch { /* indirizzo non valido */ }
  if (!url || url.protocol !== 'https:') {
    throw errore("Il servizio AI non ha restituito un indirizzo https valido per l'immagine");
  }

  let risposta: Response;
  try {
    // GET senza effetti: un secondo tentativo se la connessione cade
    risposta = await chiamaHttp(url.toString(), { method: 'GET', timeoutMs: TIMEOUT_IMMAGINE_MS, idempotente: true, tentativi: 2 });
  } catch (err) {
    if (err instanceof ErroreHttp) {
      throw new ServiceUnavailableError({ message: "Download dell'immagine generata non riuscito", service: SERVIZIO_AI, details: { motivo: err.motivo } });
    }
    throw err;
  }

  const scarta = () => risposta.body?.cancel().catch(() => undefined);
  if (!risposta.ok) {
    await scarta();
    throw errore(`Download dell'immagine generata non riuscito (HTTP ${risposta.status})`, risposta.status);
  }
  // Un redirect non deve portare fuori da https
  if (risposta.url && !risposta.url.startsWith('https:')) {
    await scarta();
    throw errore("L'immagine generata non e' servita in https");
  }
  if (Number(risposta.headers.get('content-length')) > DIMENSIONE_MASSIMA_IMMAGINE) {
    await scarta();
    throw errore("L'immagine generata supera il limite di 10 MB");
  }

  const lettore = risposta.body?.getReader();
  if (!lettore) throw errore("Il servizio AI ha restituito un'immagine vuota");
  const parti: Uint8Array[] = [];
  let letti = 0;
  try {
    for (;;) {
      const { done, value } = await lettore.read();
      if (done) break;
      letti += value.byteLength;
      if (letti > DIMENSIONE_MASSIMA_IMMAGINE) {
        await lettore.cancel().catch(() => undefined);
        throw errore("L'immagine generata supera il limite di 10 MB");
      }
      parti.push(value);
    }
  } catch (err) {
    if (isAppError(err)) throw err;
    // Tempo scaduto o connessione caduta durante la lettura
    throw new ServiceUnavailableError({ message: "Download dell'immagine generata interrotto", service: SERVIZIO_AI });
  }
  if (letti === 0) throw errore("Il servizio AI ha restituito un'immagine vuota");
  return Buffer.concat(parti);
}

/** sendToFICOApi non lancia: un upload fallito arriva come stato 0/4xx/5xx o come esito false. */
function guidIdFotoCaricata(send: { status: number; data: any }): string {
  const riuscito = send.status >= 200 && send.status < 300 && send.data?.esito !== false;
  const guidId = riuscito ? send.data?.record?.guidId : undefined;
  if (typeof guidId === 'string' && guidId) return guidId;
  throw new ExternalApiError({
    message: send.status === 0
      ? 'Impossibile contattare Olimpo per salvare la foto della ricetta'
      : 'Olimpo non ha salvato la foto della ricetta',
    service: 'Olimpo',
    endpoint: '/foto/uploadFotoWebPliant',
    statusCode: send.status || undefined,
  });
}

/** Form dell'upload su Olimpo della foto di una ricetta. */
function formFotoRicetta(immagine: Buffer, idRicetta: string): FormData {
  const formData = new FormData();
  formData.append("data", JSON.stringify({ id: idRicetta, device: "desktop", type: "thumbnail" }));
  formData.append("file", new Blob([immagine], { type: "image/jpeg" }), `thumbnail_${idRicetta}.jpeg`);
  return formData;
}

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
      // success false arriva gia' come ExternalApiError
      const risultato = await chiamaServizioAi<{
        success: boolean;
        message: string;
        risposta: ApprofondimentoVino
      }>('approfondimentoVinoNoDb', config.API_KEY_AI, {
        dati_vino: {
          cantina: params.cantina,
          nome: params.nome,
          anno: params.anno
        }
      }, "la generazione dell'approfondimento vino");

      const approfondimentoVino = await ApprofondimentoVinoModel.create({
        id: uuidv4(),
        ...risultato.risposta,
        anno: params.anno,
        nome: params.nome,
        codice: params.codice,
        cantina: params.cantina,
      } as any) as unknown as ApprofondimentoVino;
      return approfondimentoVino;
    } catch (error) {
      if (isAppError(error)) {
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
      const codesLiteral = codiciPerReferenze.map(sqlString).join(',');
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
      const codesLiteral = codiciPerReferenze.map(sqlString).join(',');
      realResultRefs = await ReferenzeIstantaModel.findAll({
        where: literal(`data_fields->>'codice_referenza' IN (${codesLiteral})`),
        raw: true
      }) as any[];
    }

    realResultRefs = realResultRefs.map(ref => ({
      ...ref,
      foto: (ref.foto || [])
        .map((f: any) => typeof f === "string" ? f : f?.guidId)
        .filter(Boolean)
        .map((guidId: string) =>
          urlOlimpo('/foto/getThumbNailOnDemand', { guidId })
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
    const generata = await chiamaServizioAi<{
      success: boolean;
      message: string;
      prompt: string;
      risultato: string;
      url: string
    }>('generaImmagineRicettaByDatiRicettaCortaNoDb', params.apiKey, {
      titolo: `${ricetta.titolo}Genera un piatto pronto da mangiare`,
      ingredienti: ricetta?.ingredienti?.map((ing: any) => ({
        nome_prodotto: ing.nome_prodotto
      }))
    }, "la generazione della foto della ricetta");
    const immagine = await scaricaImmagineGenerata(generata.url);

    const send = await ServerUtils.sendToFICOApi<{
      message: string,
      esito: boolean,
      record: { guidId: string },
      error: string
    }>(
      request,
      `${config.OLYMPUS_IP_ADDRESS}/foto/uploadFotoWebPliant`,
      "POST",
      formFotoRicetta(immagine, ricetta.id),
      undefined,
      undefined,
      { categoria: 'lunga' }
    );
    const guidId = guidIdFotoCaricata(send);

    const fotoRicetta: any[] = [...(ricetta.foto_ricetta || [])];
    const fotoIndex = fotoRicetta.findIndex(foto => foto.id === params.idFoto);
    if (fotoIndex !== -1) {
      fotoRicetta[fotoIndex] = {
        ...fotoRicetta[fotoIndex],
        id_olimpo_cloud: guidId,
        url: urlOlimpo('/foto/getThumbNailOnDemand', { guidId }),
        meta: {
          id: ricetta.id,
          device: "desktop",
          type: "thumbnail"
        },
        prompt: generata.prompt
      };
      await RicetteModel.update({ foto_ricetta: fotoRicetta }, { where: { id: ricetta.id } });
    }
    log.info('Foto ricetta rigenerata con successo');
    return urlOlimpo('/foto/getThumbNailOnDemand', { guidId });
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

    const generata = await chiamaServizioAi<{
      success: boolean;
      message: string;
      prompt: string;
      risultato: string;
      url: string;
    }>('generaImmagineRicettaByDatiRicettaCortaNoDb', params.apiKey, {
      titolo: ricetta.titolo,
      ingredienti: ricetta?.ingredienti?.map((ing: any) => ({
        nome_prodotto: ing.nome_prodotto
      }))
    }, "la generazione della foto della ricetta");
    const immagine = await scaricaImmagineGenerata(generata.url);

    const send = await ServerUtils.sendToFICOApi<{
      message: string,
      esito: boolean,
      record: { guidId: string },
      error: string
    }>(
      request,
      `${config.OLYMPUS_IP_ADDRESS}/foto/uploadFotoWebPliant`,
      "POST",
      formFotoRicetta(immagine, ricetta.id),
      undefined,
      undefined,
      { categoria: 'lunga' }
    );
    const guidId = guidIdFotoCaricata(send);

    const hasFotoMain = (ricetta.foto_ricetta || []).some((foto: any) => foto.main);
    const nuovaFoto: FotoRicetta = {
      main: !hasFotoMain,
      id_olimpo_cloud: guidId,
      url: urlOlimpo('/foto/getThumbNailOnDemand', { guidId }),
      meta: {
        id: ricetta.titolo,
        device: "desktop",
        type: "thumbnail"
      },
      id: uuidv4(),
      prompt: generata.prompt
    };

    const currentFotoRicetta: any[] = [...(ricetta.foto_ricetta || []), nuovaFoto];
    await RicetteModel.update({ foto_ricetta: currentFotoRicetta }, { where: { id: ricetta.id } });

    log.info('Foto ricetta generata con successo');

    return urlOlimpo('/foto/getThumbNailOnDemand', { guidId });
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
      const response = await chiamaServizioAi<{
        success: boolean;
        message: string;
        risposta: {
          vini_abbinati: Array<string>;
          motivazione: string;
        };
      }>('abbinamentoVinoNoDb', params.apiKey, {
        ricetta: {
          titolo: ricetta.titolo,
          ingredienti: ricetta?.ingredienti?.map(ing => ing.nome_prodotto)
        },
        vini: viniDisponibili
      }, "la generazione dell'abbinamento vino");

      const abbinamentoVino = {
        vini_abbinati: response.risposta.vini_abbinati,
        motivazione: response.risposta.motivazione
      };
      await RicetteModel.update({ abbinamento_vino: abbinamentoVino }, { where: { id: params.id } });
      return RicetteModel.findOne({ where: { id: params.id }, raw: true });
    } catch (error) {
      log.error("Errore durante la generazione dell'abbinamento vino", error instanceof Error ? error : new Error(String(error)));
      // Gli errori del servizio AI hanno gia' stato e motivo
      if (isAppError(error)) throw error;
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
    const response = await chiamaServizioAi<{
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
    }>('generaRicettaEstesaByDatiInviatiSenzaDb', params.apiKey, {
      dati_ricetta: ricetta
    }, "l'approfondimento della ricetta");

    await RicetteModel.update({
      procedimento: response.risposta.procedimento,
      ingredienti: response.risposta.ingredienti.map(ing => ({
        nome_prodotto: ing.nome_prodotto,
        ean: ing.ean,
        quantita_necessaria: ing.quantita_necessaria,
        unita_misura_peso: ing.unita_misura_peso,
        costo_ingrediente_euro: ing.costo_ingrediente_euro,
        incluso_nel_volantino: ing.inclusoNelVolantino === "true"
      })),
      stato: STATO_RICETTA.REVISIONARE,
      tipo: TIPO_RICETTA.LUNGA,
      tempo_in_secondi: response.risposta.tempo_in_secondi,
      costo_in_euro: response.risposta.costo_in_euro
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
      const response = await chiamaServizioAi<{
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
      }>('generaRicetteCorteMultipleSenzaSalvareNelDb', params.apiKey, {
        indicazioni: params.indicazioni,
        numero_ricette: params.numero_ricette,
        prodottiInOfferta
      }, "la generazione delle ricette");
      if (!response.success) {
        throw new ExternalApiError({
          message: "Il servizio AI non ha completato la generazione delle ricette",
          service: SERVIZIO_AI,
          endpoint: 'generaRicetteCorteMultipleSenzaSalvareNelDb'
        });
      }
      const ricette = response.risposta.map((ricetta) => ({
        ...ricetta,
        id: uuidv4(),
        stato: STATO_RICETTA.REVISIONARE,
        tipo: TIPO_RICETTA.CORTA,
      }));
      await RicetteModel.bulkCreate(ricette as any[]);
      return {
        success: true,
        message: response.message,
        indicazioni: response.indicazioni,
        risposta: ricette
      };
    } catch (error) {
      log.error('Errore nella generazione delle ricette corte multiple', error instanceof Error ? error : new Error(String(error)));
      // Errori del servizio AI (solo stato e motivo) o del database
      if (isAppError(error)) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: "Errore durante la generazione delle ricette",
        operation: 'generaRicetteCorteMultiple',
        entity: 'GPTService'
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
      const response = await chiamaServizioAi<{
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
      }>('generaRicettaCortaSenzaSalvareNelDb', params.apiKey, {
        indicazioni: params.indicazioni,
        prodottiInOfferta,
      }, "la generazione della ricetta");
      if (!response.success) {
        throw new ExternalApiError({
          message: "Il servizio AI non ha completato la generazione della ricetta",
          service: SERVIZIO_AI,
          endpoint: 'generaRicettaCortaSenzaSalvareNelDb'
        });
      }
      const ricetta = {
        ...response.risposta,
        id: uuidv4(),
        stato: STATO_RICETTA.REVISIONARE,
        tipo: TIPO_RICETTA.CORTA,
      };
      await RicetteModel.create(ricetta as any);
      return response;
    } catch (error) {
      log.error('Errore nella generazione della ricetta', error instanceof Error ? error : new Error(String(error)));
      // Errori del servizio AI (solo stato e motivo) o del database
      if (isAppError(error)) {
        throw error;
      }
      throw wrapDatabaseError(error, {
        message: "Errore durante la generazione della ricetta",
        operation: 'generaRicetta',
        entity: 'GPTService'
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
        const codesLiteral = codiciVini.map(sqlString).join(',');
        referenzeIstanta = await ReferenzeIstantaModel.findAll({
          where: literal(`data_fields->>'codice_referenza' IN (${codesLiteral})`),
          raw: true
        }) as any[];
        referenzeIstanta = referenzeIstanta.map(ref => ({
          ...ref,
          foto: (ref.foto || [])
            .map((f: any) => typeof f === "string" ? f : f?.guidId)
            .filter(Boolean)
            .map((guidId: string) =>
              urlOlimpo('/foto/getThumbNailOnDemand', { guidId })
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
      throw wrapDatabaseError(new Error(`Errore durante la modifica dello stato della ricetta: ${error}`), {
        message: `Errore durante la modifica dello stato della ricetta: ${error}`,
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
      // queryViniConfig usa formato { "dataFields.xxx": "value" }.
      // Convertiamo in Sequelize JSONB literal: data_fields->>'xxx' = 'value'
      const guidIdKits = tuttiIKitPerPromozione.map(kit => kit.id);
      const viniLiterals = Object.entries(queryViniConfig).map(([key, val]) => {
        const jsonbField = key.replace(/^dataFields\./, '');
        return literal(`data_fields->>${sqlString(jsonbField)} = ${sqlString(val)}`);
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
          foto: (referenza.foto || [])
            .map((f: any) => typeof f === "string" ? f : f?.guidId)
            .filter(Boolean)
            .map((guidId: string) =>
              urlOlimpo('/foto/getThumbNailOnDemand', { guidId })
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
