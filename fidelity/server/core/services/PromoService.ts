import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Request as ExpressRequest } from 'express';
import { createHmac } from 'node:crypto';
import { Op, QueryTypes, type WhereOptions } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { Colorize } from '../../../lib/Colorize';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_CONTEXT, TIPO_KIT_DESIGN } from '../../../lib/enums';
import { BadRequestError, DatabaseError, NotFoundError, wrapApiError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import {
  AnalisiMomentoTracciato,
  DataFields,
  DataWebPliant,
  IndesignPluginExport,
  KitStatusDesign,
  KitStatusRunTime,
  MenaboLayoutDivisioneSalvata,
  MenaboLayoutSalvato,
  NuovaPromoPerDashboard,
  SaveMenaboLayoutRequest,
  SystemNotification,
} from '../../../lib/types';
import { emitToClients } from '../../ws-server';
import type { IAgenziaLib } from '../agenzia_lib/types';
import config from '../config';
import { sequelize } from '../db';
import { CreatePromoDTO, PromoResponseDTO, UpdatePromoDTO, type PromoContextItem } from '../dto';
import { IConfigService } from '../interfaces/IConfigService';
import { IIstantaService } from '../interfaces/IIstantaService';
import { IPromoService } from '../interfaces/IPromoService';
import type { IWebPliantService } from '../interfaces/IWebPliantService';
import { log } from '../logger';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { DesignKit } from '../models/design_kit';
import { FilesRuntime } from '../models/files_runtime';
import { PromoAttributes } from '../models/promo';
import { Referenze } from '../models/referenze';
import { RuntimeKit } from '../models/runtime_kit';
import { TracciatiMomento } from '../models/tracciati_momento';
import { Utente } from '../models/utenti';
import type { IPromoRepository } from '../repositories/PromoRepository';
import { normalizePromoModel } from '../utils/PromoModelUtils';
import { ServerUtils } from '../utils/ServerUtils';
dayjs.extend(isBetween);


export class PromoService implements IPromoService {
  constructor(
    private webPliantService: IWebPliantService,
    private istantaService: IIstantaService,
    private promoRepository: IPromoRepository,
    private agenziaLib: IAgenziaLib,
    private configService: IConfigService
  ) { }

  private normalizeInternalOriginalUrl(url: string): string {
    if (!url) return '/';
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        const parsed = new URL(url);
        return `${parsed.pathname}${parsed.search}` || '/';
      } catch {
        return '/';
      }
    }
    return url.startsWith('/') ? url : `/${url}`;
  }

  private buildInternalRequestHeaders(req: ExpressRequest, method: string, originalUrl: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const authorization = req.headers.authorization;
    if (typeof authorization === 'string' && authorization.trim().length > 0) {
      headers.Authorization = authorization;
    }

    const secret = config.INTERNAL_REQUEST_SECRET;
    if (!secret) {
      return headers;
    }

    const timestamp = Date.now().toString();
    const normalizedMethod = method.toUpperCase();
    const normalizedUrl = this.normalizeInternalOriginalUrl(originalUrl);
    const payload = `${normalizedMethod}\n${normalizedUrl}\n${timestamp}`;
    const signature = createHmac('sha256', secret).update(payload).digest('hex');

    headers['x-internal-request-ts'] = timestamp;
    headers['x-internal-request-signature'] = signature;

    return headers;
  }

  private normalizeMenaboTracciati(risultato: unknown): AnalisiMomentoTracciato[] {
    const source = (() => {
      if (Array.isArray(risultato)) return risultato;
      if (risultato && typeof risultato === 'object' && Array.isArray((risultato as any).tracciati)) {
        return (risultato as any).tracciati as unknown[];
      }
      return [];
    })();

    return source
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const raw = item as Record<string, unknown>;
        const rawRecords = Array.isArray(raw.records) ? raw.records : [];
        const records = rawRecords
          .filter((record) => record != null && typeof record === 'object')
          .map((record) => ({ ...(record as DataFields) }));

        return {
          guidCanale: String(raw.guidCanale ?? ''),
          guidArea: String(raw.guidArea ?? ''),
          context: typeof raw.context === 'string' ? raw.context : JSON.stringify(raw.context ?? []),
          records,
        } satisfies AnalisiMomentoTracciato;
      })
      .filter((item): item is AnalisiMomentoTracciato => item !== null);
  }

  async getPromoByNome(nome: string): Promise<PromoResponseDTO> {
    try {
      const promo = await this.promoRepository.findOneWithOptions({
        where: { nome_promo: nome }
      });
      if (!promo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: nome
        });
      }
      const promoValues = normalizePromoModel(promo);
      return {
        id: promoValues.id_promo,
        nome: promoValues.nome_promo,
        data_registrazione: promoValues.data_registrazione,
        validita_dal: promoValues.validita_dal,
        validita_al: promoValues.validita_al,
        data_scadenza: promoValues.data_scadenza,
        offset_visibilita: promoValues.offset_visibilita,
        stato: promoValues.stato,
        context: promoValues.context,
        gdo: promoValues.gdo,
        is_active: dayjs().isBetween(dayjs(promoValues.validita_dal), dayjs(promoValues.validita_al), null, '[]'),
        is_expired: dayjs().isAfter(dayjs(promoValues.validita_al)),
        days_until_expiry: dayjs(promoValues.data_scadenza).diff(dayjs(), 'day'),
        days_since_start: dayjs().diff(dayjs(promoValues.validita_dal), 'day')
      } as PromoResponseDTO;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero della promozione per nome"), {
          message: "Errore durante il recupero della promozione per nome",
          operation: 'get',
          entity: 'Promo',
          details: { error }
        });
      }
    }
  }

  async getCurrentPromoCount(): Promise<number> {
    try {
      const resultCount = await this.promoRepository.countByStatoNotIn([STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA]);
      return resultCount;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il conteggio delle promo correnti"), {
        message: "Errore durante il conteggio delle promo correnti",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }

  }


  async getAllPromoTimeline(): Promise<PromoResponseDTO[]> {
    try {
      const query = `
        SELECT
          id_promo as id,
          nome_promo as nome,
          data_scadenza,
          data_registrazione,
          validita_dal,
          validita_al,
          stato,
          offset_visibilita,
          context,
          gdo,
          CASE
            WHEN NOW() BETWEEN validita_dal AND validita_al THEN true
            ELSE false
          END as is_active,
          CASE
            WHEN NOW() > data_scadenza THEN true
            ELSE false
          END as is_expired,
          EXTRACT(DAY FROM (data_scadenza - NOW())) as days_until_expiry,
          EXTRACT(DAY FROM (NOW() - validita_dal)) as days_since_start
        FROM promo
        WHERE validita_al > NOW()
        ORDER BY validita_dal DESC
      `;

      const results = await sequelize.query(query, {
        type: QueryTypes.SELECT
      });

      return results as PromoResponseDTO[];
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promo per la timeline"), {
        message: "Errore durante il recupero delle promo per la timeline",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async createPromo(data: Partial<CreatePromoDTO>): Promise<PromoResponseDTO> {
    try {
      const obj: any = {
        nome_promo: data.nome,
        data_registrazione: data.data_registrazione,
        validita_dal: data.validita_dal,
        validita_al: data.validita_al,
        data_scadenza: data.data_scadenza,
        offset_visibilita: data.offset_visibilita,
        stato: data.stato,
        context: data.context,
        gdo: data.gdo
      }
      const result = await this.promoRepository.create(obj);
      const objToReturn: PromoResponseDTO = {
        id: result.id_promo,
        nome: result.nome_promo,
        data_registrazione: result.data_registrazione,
        validita_dal: result.validita_dal,
        validita_al: result.validita_al,
        data_scadenza: result.data_scadenza!,
        offset_visibilita: result.offset_visibilita,
        stato: result.stato,
        context: result.context as PromoContextItem[],
        gdo: result.gdo,
        is_active: dayjs().isBetween(dayjs(result.validita_dal), dayjs(result.validita_al), null, '[]'),
        is_expired: dayjs().isAfter(dayjs(result.validita_al)),
        days_until_expiry: dayjs(result.data_scadenza).diff(dayjs(), 'day'),
        days_since_start: dayjs().diff(dayjs(result.validita_dal), 'day'),
        is_deletable: false,
        numero_kit_collegati: 0
      }
      return objToReturn;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della promo"), {
        message: "Errore durante la creazione della promo",
        operation: 'create',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async inizioNuovaLavorazione(data: {
    titolo: string,
    dataDiScadenza: string,
    dataDiInizio: string,
    dataDiFine: string,
    offsetVisibilita: number,
    context: any
  }, idGDO: string, req: ExpressRequest): Promise<PromoResponseDTO> {
    const scadenza = dayjs(data.dataDiScadenza, "DD/MM/YYYY");
    const inizioValidita = dayjs(data.dataDiInizio, "DD/MM/YYYY");
    if (scadenza.isValid() && inizioValidita.isValid() && !scadenza.isBefore(inizioValidita)) {
      throw new BadRequestError({ message: 'La data di scadenza deve essere precedente alla data di inizio validità' });
    }

    const promo: any = {
      guid_id: uuidv4(),
      GDO: idGDO,
      nomePromo: data.titolo,
      dataRegistrazione: new Date(),
      validitaDal: dayjs(data.dataDiInizio, "DD/MM/YYYY").toDate(),
      validitaAl: dayjs(data.dataDiFine, "DD/MM/YYYY").toDate(),
      dataScadenza: dayjs(data.dataDiScadenza, "DD/MM/YYYY").toDate(),
      stato: STATO_PROMO.PIANIFICATA,
      context: data.context,
      offsetVisibilita: data.offsetVisibilita,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const chiamataIstantaResult = await ServerUtils.sendToFICOApi<{ esito: boolean }>(
      req,
      config.ISTANTA_IP_ADDRESS + "/FicoProcess/inizioNuovaLavorazione",
      "PUT",
      promo
    );

    if (!chiamataIstantaResult.data.esito) {
      throw wrapApiError(new Error("Errore durante la chiamata all'API di Istanta"), {
        message: "Errore durante la chiamata all'API di Istanta",
        service: 'ISTANTA',
        endpoint: '/FicoProcess/inizioNuovaLavorazione'
      });
    }
    const obj: PromoAttributes = {
      id_promo: promo.guid_id,
      gdo: promo.GDO,
      nome_promo: promo.nomePromo,
      data_registrazione: promo.dataRegistrazione as Date,
      validita_dal: promo.validitaDal as Date,
      validita_al: promo.validitaAl as Date,
      data_scadenza: promo.dataScadenza as Date,
      stato: promo.stato as STATO_PROMO,
      context: promo.context as object,
      offset_visibilita: promo.offsetVisibilita,
      createdat: promo.createdAt as Date,
      updatedat: promo.updatedAt as Date
    }
    const result = await this.promoRepository.create(obj);
    if ('error' in result) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della promo"), {
        message: "Errore durante la creazione della promo",
        operation: 'create',
        entity: 'Promo',
        details: { error: typeof result.error === 'string' ? new Error(result.error) : undefined }
      });
    }

    const objToReturn: PromoResponseDTO = {
      id: result.id_promo,
      nome: result.nome_promo,
      data_registrazione: result.data_registrazione,
      validita_dal: result.validita_dal,
      validita_al: result.validita_al,
      data_scadenza: result.data_scadenza!,
      offset_visibilita: result.offset_visibilita,
      stato: result.stato,
      context: result.context as PromoContextItem[],
      gdo: result.gdo,
      is_active: dayjs().isBetween(dayjs(result.validita_dal), dayjs(result.validita_al), null, '[]'),
      is_expired: dayjs().isAfter(dayjs(result.validita_al)),
      days_until_expiry: dayjs(result.data_scadenza).diff(dayjs(), 'day'),
      days_since_start: dayjs().diff(dayjs(result.validita_dal), 'day')
    }
    return objToReturn;
  }

  async getContestoPerNuovaLavorazione(req: ExpressRequest): Promise<any> {
    try {
      const result = await ServerUtils.sendToFICOApi<{ content: string, esito: boolean, error: string }>(
        req,
        config.ISTANTA_IP_ADDRESS + "/FicoProcess/getFormContext/" + TIPO_CONTEXT.NUOVA_LAVORAZIONE,
        "GET",
        undefined
      );

      if (!result.data.esito) {
        throw wrapApiError(new Error("Errore durante la chiamata all'API di Istanta"), {
          message: "Errore durante la chiamata all'API di Istanta",
          service: 'ISTANTA',
          endpoint: '/FicoProcess/getFormContext/' + TIPO_CONTEXT.NUOVA_LAVORAZIONE
        });
      }

      let context = JSON.parse(result.data.content) as any[];

      // Esegui le chiamate in parallelo ma con un intervallo di 200ms tra ciascuna per evitare overload
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      await Promise.all(
        context.map(async (c, idx) => {
          if (c.chiamata_runtime != undefined) {
            if (c.chiamata_runtime != false) {
              // Attendi un intervallo in base all'indice per scaglionare le chiamate
              if (idx > 0) {
                await delay(idx * 1000);
              }
              if (c.chiamata_runtime.url.startsWith(".")) {
                // Chiamata interna al server
                // Chiamata interna al server usando node-fetch
                const fetch = (await import('node-fetch')).default;
                const relativeUrl = c.chiamata_runtime.url.replace(/^\./, ''); // Rimuovi il punto iniziale
                const baseUrl = config.VITE_API_URL.split("/api")[0] || 'http://localhost:3000'; // Sostituisci con la tua base URL
                const url = relativeUrl.startsWith('http')
                  ? relativeUrl
                  : baseUrl + relativeUrl;
                const method = c.chiamata_runtime.metodo || 'GET';
                const body = c.chiamata_runtime.body ? JSON.stringify(c.chiamata_runtime.body) : undefined;
                const headers = this.buildInternalRequestHeaders(req, method, relativeUrl);

                const response = await fetch(url, {
                  method,
                  headers,
                  body: method !== 'GET' && body ? body : undefined,
                });

                if (!response.ok) {
                  throw wrapApiError(new Error(`Errore chiamata interna: ${response.statusText}`), {
                    message: `Errore chiamata interna: ${response.statusText}`,
                    service: 'INTERNAL',
                    endpoint: url
                  });
                }

                const resultChiamataRuntime = await response.json() as any;

                const val = typeof resultChiamataRuntime === "string"
                  ? JSON.parse(resultChiamataRuntime)
                  : resultChiamataRuntime;
                console.log("VALORE ARRAY DELLE COMBINAZIONI");
                console.log(val);

                if (Array.isArray(val)) {
                  const valoreLavorato = val.map((v: any) => {
                    //HACK Contenuto fatto a posta per le combinazioni area canale
                    if (v && typeof v === "object" && "sigla" in v && "id" in v) {
                      return {
                        titolo: v.sigla,
                        valore: v.id
                      }
                    }
                    return undefined;
                  }).filter((item): item is { titolo: string; valore: string } => item !== undefined);
                  c.valore = valoreLavorato;
                }
                if (c.chiamata_runtime) {
                  delete c.chiamata_runtime;
                }
              } else {
                const resultChiamataRuntime = await ServerUtils.sendToFICOApi<{ content: string, esito: boolean, error: string }>(
                  req,
                  c.chiamata_runtime.url,
                  c.chiamata_runtime.metodo,
                  c.chiamata_runtime.body,
                );

                if (!resultChiamataRuntime.data.esito) {
                  throw wrapApiError(new Error("Errore durante la chiamata all'API di Istanta"), {
                    message: "Errore durante la chiamata all'API di Istanta",
                    service: 'ISTANTA',
                    endpoint: c.chiamata_runtime.url
                  });
                }

                if (typeof resultChiamataRuntime.data.content === "string") {
                  c.valore = JSON.parse(resultChiamataRuntime.data.content);
                } else {
                  c.valore = resultChiamataRuntime.data.content;
                }

                if (c.chiamata_runtime) {
                  delete c.chiamata_runtime;
                }
              }
            } else {
              if (c.chiamata_runtime) {
                delete c.chiamata_runtime;
              }
            }
          }
        })
      );

      return context;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del contesto per nuova lavorazione"), {
        message: "Errore durante il recupero del contesto per nuova lavorazione",
        operation: 'get',
        entity: 'ContextDinamico',
        details: { error }
      });
    }
  }


  async get_contesto_per_importazione(req: ExpressRequest): Promise<any> {
    try {
      console.log(Colorize.bgBlue(config.ISTANTA_IP_ADDRESS))
      const result = await ServerUtils.sendToFICOApi<{
        content: string, esito: boolean, error: string | null
      }>(
        req,
        config.ISTANTA_IP_ADDRESS + '/FicoProcess/getFormContext/' + TIPO_CONTEXT.IMPORTA_LAVORAZIONE,
        "GET",
        undefined
      );

      const resultDefinitivo = await ServerUtils.sendToFICOApi<{
        list: {
          content: { titolo: string; valore: string }[],
          idField: string,
          titoloField: string,
          tipoField: string,
          visible: boolean,
          esito: boolean,
          error: string | null
          nullable: boolean
        }[], esito: boolean, error: string | null
      }>(
        req,
        //NOTE abbiamo cambiato la dicitura aggiungendo l'ultimo parametro che è lo scope.
        //`${config.ISTANTA_IP_ADDRESS}/FicoProcess/getSourceFields/${req.query.guidId}/importInLavorazione`,
        `${config.ISTANTA_IP_ADDRESS}/FicoProcess/getSourceFields/${req.query.guidId}`,
        "GET",
        undefined
      );
      const context = JSON.parse(result.data.content)
      for (const c of context) {
        if (c.chiamata_runtime !== undefined && c.chiamata_runtime !== false) {
          try {
            console.log(Colorize.bgBlue(c.chiamata_runtime.url))
            console.log(Colorize.bgBlue(c.chiamata_runtime.metodo))
            console.log(Colorize.bgBlue(c.chiamata_runtime.body))
            if (c.chiamata_runtime.url.startsWith(".")) {
              // Chiamata interna al server
              // Chiamata interna al server usando node-fetch
              const fetch = (await import('node-fetch')).default;
              const relativeUrl = c.chiamata_runtime.url.replace(/^\./, ''); // Rimuovi il punto iniziale
              const baseUrl = config.VITE_API_URL.split("/api")[0] || 'http://localhost:3000'; // Sostituisci con la tua base URL
              const url = relativeUrl.startsWith('http')
                ? relativeUrl
                : baseUrl + relativeUrl;
              const method = c.chiamata_runtime.metodo || 'GET';
              const body = c.chiamata_runtime.body ? JSON.stringify(c.chiamata_runtime.body) : undefined;
              const headers = this.buildInternalRequestHeaders(req, method, relativeUrl);

              const response = await fetch(url, {
                method,
                headers,
                body: method !== 'GET' && body ? body : undefined,
              });

              if (!response.ok) {
                throw wrapApiError(new Error(`Errore chiamata interna: ${response.statusText}`), {
                  message: `Errore chiamata interna: ${response.statusText}`,
                  service: 'INTERNAL',
                  endpoint: url
                });
              }

              const resultChiamataRuntime = await response.json() as any;

              const val = typeof resultChiamataRuntime === "string"
                ? JSON.parse(resultChiamataRuntime)
                : resultChiamataRuntime;
              console.log("VALORE ARRAY DELLE COMBINAZIONI");
              console.log(val);

              if (Array.isArray(val)) {
                const valoreLavorato = val.map((v: any) => {
                  //HACK Contenuto fatto a posta per le combinazioni area canale
                  if (v && typeof v === "object" && "sigla" in v && "id" in v) {
                    return {
                      titolo: v.sigla,
                      valore: v.id
                    }
                  }
                  return undefined;
                }).filter((item): item is { titolo: string; valore: string } => item !== undefined);
                c.valore = valoreLavorato;
              }
              if (c.chiamata_runtime) {
                delete c.chiamata_runtime;
              }
            } else {
              const resultChiamataRuntime = await ServerUtils.sendToFICOApi<{ content: string, esito: boolean, error: string }>(
                req,
                c.chiamata_runtime.url,
                c.chiamata_runtime.metodo,
                c.chiamata_runtime.body,
              );

              if (!resultChiamataRuntime.data.esito) {
                throw wrapApiError(new Error("Errore durante la chiamata all'API di Istanta"), {
                  message: "Errore durante la chiamata all'API di Istanta",
                  service: 'ISTANTA',
                  endpoint: c.chiamata_runtime.url
                });
              }

              if (typeof resultChiamataRuntime.data.content === "string") {
                c.valore = JSON.parse(resultChiamataRuntime.data.content);
              } else {
                c.valore = resultChiamataRuntime.data.content;
              }

              if (c.chiamata_runtime) {
                delete c.chiamata_runtime;
              }
            }
          } catch (error) {
            throw wrapDatabaseError(new Error("Errore durante l'esecuzione della chiamata runtime"), {
              message: "Errore durante l'esecuzione della chiamata runtime",
              operation: 'get',
              entity: 'ContextDinamico',
              details: { error }
            });
          }
        } else {
          if (c.chiamata_runtime) {
            delete c.chiamata_runtime;
          }
        }
      }
      let contextCiclato = resultDefinitivo.data.list.map(cDef => {
        if (!cDef.visible) {
          return null;
        }
        return {
          nome_field: cDef.idField,
          titolo_field: cDef.titoloField,
          tipo_field: cDef.tipoField,
          valore: cDef.content,
          dipendenze: [],
          nullable: cDef.nullable
        }
      })
      contextCiclato = contextCiclato.filter(c => c !== null);
      const contextCorretto = [
        ...context,
        ...contextCiclato
      ]
      // let contextResult = [resultAddestramenti.data.content, resultContextPromo.data.content, context]
      return contextCorretto;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero del contesto per importazione"), {
        message: "Errore durante il recupero del contesto per importazione",
        operation: 'get',
        entity: 'ContextDinamico',
        details: { error }
      });
    }
  }

  async creaInizioLavorazione(data: CreatePromoDTO): Promise<PromoResponseDTO> {
    try {
      const obj: any = {
        nome_promo: data.nome,
        data_registrazione: data.data_registrazione,
        validita_dal: data.validita_dal,
        validita_al: data.validita_al,
        data_scadenza: data.data_scadenza,
        offset_visibilita: data.offset_visibilita,
        stato: data.stato,
        context: data.context,
        gdo: data.gdo
      }
      const promo = await this.promoRepository.create(obj);
      const kitCollegati = await RuntimeKit.findAll({
        where: { id_promo: promo.id_promo },
        raw: true
      });
      const isDeletable = kitCollegati.length === 0;
      const objToReturn: PromoResponseDTO = {
        id: promo.id_promo,
        nome: promo.nome_promo,
        data_registrazione: promo.data_registrazione,
        validita_dal: promo.validita_dal!,
        validita_al: promo.validita_al!,
        data_scadenza: promo.data_scadenza!,
        offset_visibilita: promo.offset_visibilita,
        stato: promo.stato,
        context: promo.context as PromoContextItem[],
        gdo: promo.gdo,
        is_active: dayjs().isBetween(dayjs(promo.validita_dal), dayjs(promo.validita_al), null, '[]'),
        is_expired: dayjs().isAfter(dayjs(promo.validita_al)),
        days_until_expiry: dayjs(promo.data_scadenza).diff(dayjs(), 'day'),
        days_since_start: dayjs().diff(dayjs(promo.validita_dal), 'day'),
        is_deletable: isDeletable,
        numero_kit_collegati: kitCollegati.length
      }
      return objToReturn;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante la creazione della promozione"), {
        message: "Errore durante la creazione della promozione",
        operation: 'create',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async getAllPromo(): Promise<PromoResponseDTO[]> {
    try {
      const promo = await this.promoRepository.findAll();

      if (promo.length === 0) {
        console.log('⚠️ [PromoService] Nessuna promozione trovata nel database');
        return [];
      }
      const objToReturn: PromoResponseDTO[] = await Promise.all(promo.map(async p => {
        const promoData = normalizePromoModel(p);
        const kitCollegati = await RuntimeKit.findAll({
          where: { id_promo: promoData.id_promo },
          raw: true
        });
        const isDeletable = kitCollegati.length === 0;
        return {
          id: promoData.id_promo,
          nome: promoData.nome_promo,
          data_registrazione: promoData.data_registrazione!,
          validita_dal: promoData.validita_dal!,
          validita_al: promoData.validita_al!,
          data_scadenza: promoData.data_scadenza!,
          offset_visibilita: promoData.offset_visibilita,
          stato: promoData.stato,
          context: Array.isArray(promoData.context) ? promoData.context : [],
          gdo: promoData.gdo,
          is_active: dayjs().isBetween(dayjs(promoData.validita_dal), dayjs(promoData.validita_al), null, '[]'),
          is_expired: dayjs().isAfter(dayjs(promoData.validita_al)),
          days_until_expiry: dayjs(promoData.data_scadenza).diff(dayjs(), 'day'),
          days_since_start: dayjs().diff(dayjs(promoData.validita_dal), 'day'),
          is_deletable: isDeletable,
          numero_kit_collegati: kitCollegati.length
        };
      }));

      return objToReturn;
    } catch (error) {
      console.error('❌ [PromoService] Errore in getAllPromo:', error);
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promozioni"), {
        message: "Errore durante il recupero delle promozioni",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }
  }


  async getAllPromoFiltered(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    stato?: string;
    validitaDal?: string;
    validitaAl?: string;
    validitaAlFrom?: string;
    validitaAlTo?: string;
    excludeStato?: string;
    sortBy?: 'nome' | 'validita_dal' | 'validita_al' | 'stato';
    sortDirection?: 'asc' | 'desc';
  }): Promise<{
    promos: PromoResponseDTO[];
    totalItems: number;
    currentPage: number;
    totalPages: number;
    pageSize: number;
  }> {
    try {
      const {
        page = 1,
        pageSize = 10,
        search = '',
        stato = '',
        validitaDal = '',
        validitaAl = '',
        validitaAlFrom = '',
        validitaAlTo = '',
        excludeStato = '',
        sortBy = 'nome',
        sortDirection = 'asc'
      } = params;

      console.log('🔍 [PromoService] Inizio getAllPromoFiltered con parametri:', params);

      // Costruisci le condizioni WHERE
      const whereConditions: any = {};

      // Filtro per ricerca nome
      if (search) {
        whereConditions.nome_promo = {
          [Op.like]: `%${search}%`
        };
      }

      // Filtro per stato (priorità: se specificato 'stato', usa quello; altrimenti usa 'excludeStato')
      if (stato) {
        whereConditions.stato = stato;
      } else if (excludeStato) {
        whereConditions.stato = {
          [Op.notIn]: [excludeStato]
        };
      }

      // Filtro per data validità dal (combina multiple condizioni con Op.and)
      const validitaDalConditions: any[] = [];
      if (validitaDal) {
        validitaDalConditions.push({ [Op.gte]: new Date(validitaDal) });
      }

      if (validitaDalConditions.length === 1) {
        whereConditions.validita_dal = validitaDalConditions[0];
      } else if (validitaDalConditions.length > 1) {
        whereConditions.validita_dal = { [Op.and]: validitaDalConditions };
      }

      // Filtro per data validità al (combina multiple condizioni con Op.and)
      const validitaAlConditions: any[] = [];
      if (validitaAl) {
        validitaAlConditions.push({ [Op.lte]: new Date(validitaAl) });
      }
      if (validitaAlFrom) {
        validitaAlConditions.push({ [Op.gte]: new Date(validitaAlFrom) });
      }
      if (validitaAlTo) {
        validitaAlConditions.push({ [Op.lt]: new Date(validitaAlTo) });
      }

      if (validitaAlConditions.length === 1) {
        whereConditions.validita_al = validitaAlConditions[0];
      } else if (validitaAlConditions.length > 1) {
        whereConditions.validita_al = { [Op.and]: validitaAlConditions };
      }

      // Mappa i campi di sort
      const sortFieldMap: Record<string, string> = {
        'nome': 'nome_promo',
        'validita_dal': 'validita_dal',
        'validita_al': 'validita_al',
        'stato': 'stato'
      };

      const orderField = sortFieldMap[sortBy] || 'nome_promo';
      const orderDirection = sortDirection.toUpperCase() as 'ASC' | 'DESC';

      // Calcola offset
      const offset = (page - 1) * pageSize;

      const typedWhere = whereConditions as WhereOptions<PromoAttributes>;

      const [promo, count] = await Promise.all([
        this.promoRepository.findAllWithOptions({
          where: typedWhere,
          order: [[orderField, orderDirection]],
          limit: pageSize,
          offset
        }),
        this.promoRepository.countByWhere(typedWhere)
      ]);

      console.log('📊 [PromoService] Promozioni trovate:', promo.length, 'di', count);

      // Mappa i risultati con kit collegati
      const objToReturn: PromoResponseDTO[] = await Promise.all(promo.map(async p => {
        const promoData = normalizePromoModel(p);
        const kitCollegati = await RuntimeKit.findAll({
          where: { id_promo: promoData.id_promo },
          raw: true
        });
        const isDeletable = kitCollegati.length === 0;

        return {
          id: promoData.id_promo,
          nome: promoData.nome_promo,
          data_registrazione: promoData.data_registrazione!,
          validita_dal: promoData.validita_dal!,
          validita_al: promoData.validita_al!,
          data_scadenza: promoData.data_scadenza!,
          offset_visibilita: promoData.offset_visibilita,
          stato: promoData.stato,
          context: Array.isArray(promoData.context) ? promoData.context : [],
          gdo: promoData.gdo,
          is_active: dayjs().isBetween(dayjs(promoData.validita_dal), dayjs(promoData.validita_al), null, '[]'),
          is_expired: dayjs().isAfter(dayjs(promoData.validita_al)),
          days_until_expiry: dayjs(promoData.data_scadenza).diff(dayjs(), 'day'),
          days_since_start: dayjs().diff(dayjs(promoData.validita_dal), 'day'),
          is_deletable: isDeletable,
          numero_kit_collegati: kitCollegati.length
        };
      }));

      const totalPages = Math.ceil(count / pageSize);

      console.log('✅ [PromoService] Promo elaborate:', objToReturn.length, 'Pagina:', page, 'di', totalPages);

      return {
        promos: objToReturn,
        totalItems: count,
        currentPage: page,
        totalPages: totalPages,
        pageSize: pageSize
      };
    } catch (error) {
      console.error('❌ [PromoService] Errore in getAllPromoFiltered:', error);
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promozioni filtrate"), {
        message: "Errore durante il recupero delle promozioni filtrate",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async getAllPromoStorico(): Promise<PromoResponseDTO[]> {
    try {
      const promo = await this.promoRepository.findAllWithOptions({
        where: {
          stato: {
            [Op.in]: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA]
          }
        } as WhereOptions<PromoAttributes>,
        raw: true,
        order: [["data_registrazione", "DESC"]]
      });
      const result = await Promise.all(promo.map(async p => {
        const kitCollegati = await RuntimeKit.findAll({
          where: { id_promo: p.id_promo },
          raw: true
        });
        const isDeletable = kitCollegati.length === 0;
        return {
          id: p.id_promo,
          nome: p.nome_promo,
          data_scadenza: p.data_scadenza!,
          data_registrazione: p.data_registrazione!,
          validita_dal: p.validita_dal!,
          validita_al: p.validita_al!,
          stato: p.stato,
          offset_visibilita: p.offset_visibilita,
          context: p.context,
          gdo: p.gdo,
          is_active: dayjs().isBetween(dayjs(p.validita_dal), dayjs(p.validita_al), null, '[]'),
          is_expired: dayjs().isAfter(dayjs(p.validita_al)),
          days_until_expiry: dayjs(p.data_scadenza).diff(dayjs(), 'day'),
          days_since_start: dayjs().diff(dayjs(p.validita_dal), 'day'),
          is_deletable: isDeletable,
          numero_kit_collegati: kitCollegati.length
        };
      })) as PromoResponseDTO[];
      return result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promozioni storico"), {
        message: "Errore durante il recupero delle promozioni storico",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }
  }
  /**
   * @deprecated
   * @param req
   * @returns
   */
  async getAllPromoInCorso(req: ExpressRequest): Promise<NuovaPromoPerDashboard[]> {
    try {
      // Fetch active promos
      const promo = await this.promoRepository.findAllWithOptions({
        where: {
          stato: {
            [Op.notIn]: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA, STATO_PROMO.ELIMINATA]
          }
        } as WhereOptions<PromoAttributes>
      });

      // Process each promo in parallel
      const result = await Promise.all(promo.map(async (p) => {
        // Get istanta combinations for the promo
        const { lista: listaIstanta } = await this.istantaService.getCombinazioniDaIstanta(p.id_promo, req);

        // Extract area and channel IDs for filtering
        const areaIds = listaIstanta.map(i => i.guidIdArea);
        const channelIds = listaIstanta.map(i => i.guidIdCanale);

        // Fetch runtime kits for the promo
        const kitRuntime = await RuntimeKit.findAll({
          where: {
            id_promo: p.id_promo,
            id_area: { [Op.in]: areaIds },
            id_canale: { [Op.in]: channelIds }
          },
          raw: true
        }) as any[];
        const kitDesign = await DesignKit.findAll({
          where: {
            id_area: { [Op.in]: areaIds },
            id_canale: { [Op.in]: channelIds }
          },
          raw: true
        }) as any[];

        // Initialize kit status arrays
        const kitStatuses = {
          [STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO]: [],
          [STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE]: [],
          [STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE]: []
        } as Record<string, (KitStatusDesign | KitStatusRunTime)[]>;

        // Process each kit in parallel
        await Promise.all(kitRuntime.map(async (kit) => {
          const kitStatus = await this.getKitStatus(kit);
          if (!kitStatus) return;

          const baseKitInfo = {
            nome: kitStatus.nome,
            files_totali: kitStatus.files_totali,
            files_completati: kitStatus.files_completati,
            files_in_lavorazione: kitStatus.files_in_lavorazione,
            tipo: kitStatus.tipo,
            hasRefs: kitStatus.hasRefs,
            ...(kitStatus.tipo === TIPO_KIT_DESIGN.AUTOMATICO && {
              numero_referenze: kitStatus.numero_referenze
            })
          };

          const targetArray = kitStatuses[kit.stato_lavorazione];
          if (targetArray) {
            targetArray.push(baseKitInfo as any);
          }
        }));

        // Calculate statistics
        const statistics = {
          totale_kit: kitDesign.length,
          kit_completati: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO].length,
          kit_in_corso: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE].length,
          kit_in_revisione: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE].length,
          percentuale_completamento: kitRuntime.length > 0
            ? (kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO].length / kitRuntime.length) * 100
            : 0
        };

        // Format dates using dayjs
        const formatDate = (date: Date) => dayjs(date).format("DD/MM/YYYY");

        // Construct promo data object
        return {
          guid_id: p.id_promo,
          nomePromo: p.nome_promo,
          dataScadenza: formatDate(p.data_scadenza as Date),
          dataRegistrazione: formatDate(p.data_registrazione as Date),
          validitaDal: formatDate(p.validita_dal as Date),
          validitaAl: formatDate(p.validita_al as Date),
          stato: p.stato,
          offsetVisibilita: p.offset_visibilita,
          kit_pubblicati: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO],
          kit_in_lavorazione: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE],
          kit_in_revisione: kitStatuses[STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE],
          statistiche: statistics,
          ultimo_aggiornamento: new Date(),
          context: p.context,
          GDO: p.gdo,
          createdAt: new Date(),
          updatedAt: new Date()
        } as NuovaPromoPerDashboard;
      }));

      // Sort results by completed kits
      return result.sort((a, b) => a.statistiche.kit_completati - b.statistiche.kit_completati);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promozioni in corso"), {
        message: "Errore durante il recupero delle promozioni in corso",
        operation: 'get',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  private async getKitStatus(kit: any): Promise<KitStatusDesign | KitStatusRunTime | null> {
    if (kit.tipo === TIPO_KIT_DESIGN.MANUALE) {
      const files = await FilesRuntime.findAll({ where: { id_runtime: kit.id }, raw: true }) as any[];
      if (files.length === 0 && (kit.files_data?.length === 0 || !kit.files_data)) {
        return null;
      }

      const filesCompletati = files.filter((f: any) => f.id_olimpo_cloud !== null && kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.PUBBLICATO);
      const filesInCorso = files.filter((f: any) => f.id_olimpo_cloud === null && kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE);
      const filesInRevisione = filesCompletati.filter((f: any) => f.id_olimpo_cloud !== null && kit.stato_lavorazione === STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE);
      return {
        nome: kit.titolo,
        files_totali: kit.files_data?.length || 0,
        files_completati: filesCompletati.length,
        files_in_lavorazione: filesInCorso.length,
        files_in_revisione: filesInRevisione.length,
        tipo: kit.tipo,
        hasRefs: false
      };
    } else if (kit.tipo === TIPO_KIT_DESIGN.AUTOMATICO) {
      const hasRefs = await Referenze.findAll({
        where: { id_runtime_kit: kit.id },
        raw: true
      }) as any[];


      return {
        nome: kit.titolo,
        files_totali: 0,
        files_completati: 0,
        files_in_lavorazione: 0,
        tipo: kit.tipo,
        hasRefs: hasRefs.length > 0,
        numero_referenze: hasRefs.length
      };
    }
    return null;
  }


  async deleteNonPermanentePromo(id: string): Promise<boolean> {
    try {
      const promo = await this.promoRepository.update(id, { stato: STATO_PROMO.ELIMINATA } as Partial<PromoAttributes>);
      return Boolean(promo);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione della promozione"), {
        message: "Errore durante l'eliminazione della promozione",
        operation: 'update',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async riportaInLavorazionePromo(id: string): Promise<boolean> {
    try {
      const promo = await this.promoRepository.update(id, { stato: STATO_PROMO.IN_LAVORAZIONE } as Partial<PromoAttributes>);
      return Boolean(promo);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il ripristino della promozione"), {
        message: "Errore durante il ripristino della promozione",
        operation: 'update',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async getPromoById(id: string): Promise<PromoResponseDTO> {
    try {
      const promo = await this.promoRepository.findById(id);
      if (!promo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: id
        });
      }
      const promoValues = normalizePromoModel(promo);
      return {
        id: promoValues.id_promo,
        nome: promoValues.nome_promo,
        data_registrazione: promoValues.data_registrazione,
        validita_dal: promoValues.validita_dal,
        validita_al: promoValues.validita_al,
        data_scadenza: promoValues.data_scadenza,
        offset_visibilita: promoValues.offset_visibilita,
        stato: promoValues.stato,
        context: promoValues.context,
        gdo: promoValues.gdo,
        is_active: dayjs().isBetween(dayjs(promoValues.validita_dal), dayjs(promoValues.validita_al), null, '[]'),
        is_expired: dayjs().isAfter(dayjs(promoValues.validita_al)),
        days_until_expiry: dayjs(promoValues.data_scadenza).diff(dayjs(), 'day'),
        days_since_start: dayjs().diff(dayjs(promoValues.validita_dal), 'day')
      } as PromoResponseDTO;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero della promozione"), {
          message: "Errore durante il recupero della promozione",
          operation: 'get',
          entity: 'Promo',
          details: { error },
        });
      }
    }
  }

  async updateStatoPromo(idPromo: string, stato: STATO_PROMO): Promise<boolean> {
    try {
      const updated = await this.promoRepository.update(idPromo, { stato } as Partial<PromoAttributes>);
      return Boolean(updated);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiornamento dello stato della promozione"), {
        message: "Errore durante l'aggiornamento dello stato della promozione",
        operation: 'update',
        entity: 'Promo',
        details: { error }
      });
    }
  }




  async getMenaboLayout(idPromo: string): Promise<MenaboLayoutSalvato | null> {
    try {
      const promo = await this.promoRepository.findById(idPromo);
      if (!promo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: idPromo
        });
      }

      const promoValues = normalizePromoModel(promo);
      return promoValues.menabo_layout ?? null;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw wrapDatabaseError(new Error("Errore durante il recupero del layout menabò"), {
        message: "Errore durante il recupero del layout menabò",
        operation: 'get',
        entity: 'Promo',
        details: { error, idPromo }
      });
    }
  }

  async saveMenaboLayout(idPromo: string, payload: SaveMenaboLayoutRequest): Promise<MenaboLayoutSalvato> {
    try {
      const now = new Date().toISOString();
      const updatedDivision = {
        ...payload.divisione,
        updatedAt: now,
      };

      // Scrittura ATOMICA della singola divisione dentro il JSONB `menabo_layout`.
      // Prima si faceva read-modify-write dell'intera colonna (findById → merge in memoria →
      // update completo): con più utenti che salvano divisioni diverse in parallelo, chi committava
      // per ultimo partiva da uno snapshot stale e sovrascriveva la divisione dell'altro (lost
      // update) — il salvataggio rispondeva 200 ma il dato spariva. Qui il merge avviene dentro
      // l'UPDATE: il row-lock di Postgres serializza i salvataggi e ogni `jsonb_set` si applica sul
      // valore già committato, quindi nessuna divisione viene persa. `||` garantisce i metadati di
      // primo livello preservando le divisioni esistenti; `jsonb_set(...,true)` scrive/crea la chiave.
      const rows = await sequelize.query<{ menabo_layout: MenaboLayoutSalvato }>(
        `UPDATE promo
         SET menabo_layout = jsonb_set(
               coalesce(menabo_layout, '{}'::jsonb)
                 || jsonb_build_object(
                      'schemaVersion', 1,
                      'idPromo', :idPromo,
                      'tipoDivisione', :tipoDivisione,
                      'updatedAt', :now,
                      'divisioni', coalesce(menabo_layout -> 'divisioni', '{}'::jsonb)
                    ),
               ARRAY['divisioni', :divisionId],
               (:division)::jsonb,
               true
             ),
             updatedat = now()
         WHERE id_promo = :idPromo
         RETURNING menabo_layout`,
        {
          type: QueryTypes.SELECT,
          replacements: {
            idPromo,
            tipoDivisione: payload.tipoDivisione,
            now,
            divisionId: updatedDivision.divisionId,
            division: JSON.stringify(updatedDivision),
          },
        },
      );

      const saved = rows[0]?.menabo_layout;
      if (!saved) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: idPromo
        });
      }

      return saved;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }

      throw wrapDatabaseError(new Error("Errore durante il salvataggio del layout menabò"), {
        message: "Errore durante il salvataggio del layout menabò",
        operation: 'update',
        entity: 'Promo',
        details: { error, idPromo }
      });
    }
  }

  async updatePromo(id: string, data: Partial<UpdatePromoDTO>): Promise<PromoResponseDTO> {
    try {
      const findPromo = await this.promoRepository.findById(id);
      if (!findPromo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: id
        });
      }
      const promoValues = normalizePromoModel(findPromo);
      const mappedData: PromoAttributes = {
        id_promo: id,
        nome_promo: data.nome ?? promoValues.nome_promo,
        data_registrazione: data.data_registrazione ? dayjs(data.data_registrazione).toDate() : promoValues.data_registrazione,
        validita_dal: data.validita_dal ? dayjs(data.validita_dal).toDate() : promoValues.validita_dal,
        validita_al: data.validita_al ? dayjs(data.validita_al).toDate() : promoValues.validita_al,
        data_scadenza: data.data_scadenza ? dayjs(data.data_scadenza).toDate() : promoValues.data_scadenza,
        offset_visibilita: data.offset_visibilita ?? promoValues.offset_visibilita,
        stato: data.stato ?? promoValues.stato,
        context: data.context ?? promoValues.context,
        gdo: data.gdo ?? promoValues.gdo
      };
      const updatedPromo = await this.promoRepository.update(
        id,
        { ...mappedData, updatedat: new Date() } as Partial<PromoAttributes>
      );

      if (!updatedPromo) {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della promozione"), {
          message: "Promozione non trovata dopo l'aggiornamento",
          operation: 'update',
          entity: 'Promo'
        });
      }

      return this.getPromoById(id);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante l'aggiornamento della promozione"), {
          message: "Errore durante l'aggiornamento della promozione",
          operation: 'update',
          entity: 'Promo',
          details: { error }
        });
      }
    }
  }

  async deletePromo(id: string): Promise<boolean> {
    try {
      return this.promoRepository.delete(id);
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione della promozione"), {
        message: "Errore durante l'eliminazione della promozione",
        operation: 'delete',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async prendiPromoDaDB(idPromo: string): Promise<PromoResponseDTO> {
    try {
      const promo = await this.promoRepository.findById(idPromo);
      if (!promo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: idPromo
        });
      }
      const promoValues = normalizePromoModel(promo);
      const objToReturn: PromoResponseDTO = {
        id: promoValues.id_promo,
        nome: promoValues.nome_promo,
        data_registrazione: promoValues.data_registrazione,
        validita_dal: promoValues.validita_dal,
        validita_al: promoValues.validita_al,
        data_scadenza: promoValues.data_scadenza!,
        offset_visibilita: promoValues.offset_visibilita,
        stato: promoValues.stato,
        context: promoValues.context as PromoContextItem[],
        gdo: promoValues.gdo,
        is_active: dayjs().isBetween(dayjs(promoValues.validita_dal), dayjs(promoValues.validita_al), null, '[]'),
        is_expired: dayjs().isAfter(dayjs(promoValues.validita_al)),
        days_until_expiry: dayjs(promoValues.data_scadenza).diff(dayjs(), 'day'),
        days_since_start: dayjs().diff(dayjs(promoValues.validita_dal), 'day')
      }
      return objToReturn;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero della promozione"), {
          message: "Errore durante il recupero della promozione",
          operation: 'get',
          entity: 'Promo',
          details: { error }
        });
      }
    }
  }

  async getPromozioniInCorsoPerDashboard(): Promise<{
    idKit: string;
    idCanale: string;
    nomeCanale: string;
    idArea: string;
    nomeArea: string;
    disattivo_mancanza_referenze: boolean;
    disattivo_mancanza_workspace: boolean;
    workspaceApplicabili: DataWebPliant[];
    messaggio: string;
    data_inizio_promo_corrente: string;
    data_fine_promo_corrente: string;
  }[]> {
    try {
      const result = await this.webPliantService.getDatoMassivoPerWebPliant();
      return result.filter(((promo: any) => {
        return !promo.disattivo_mancanza_referenze && !promo.disattivo_mancanza_workspace
      }))
    } catch (error) {
      throw new DatabaseError({
        message: "Errore durante il recupero delle promozioni in corso",
        operation: 'get',
        entity: 'Promo',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async getDatoPerMenabo(idPromo: string, canale?: string): Promise<any> {
    try {
      const promo = await this.promoRepository.findById(idPromo);
      if (!promo) {
        throw wrapNotFoundError(new Error("Promozione non trovata"), {
          message: "Promozione non trovata",
          entityType: "Promo",
          entityId: idPromo
        });
      }
      const promoValues = normalizePromoModel(promo);
      const momentiPerPromo = await TracciatiMomento.findAll({
        where: {
          id_promo: promoValues.id_promo
        },
        order: [
          ['ordine', 'ASC'],
          ['createdat', 'ASC']
        ]
      });
      if (momentiPerPromo.length === 0) {
        throw wrapNotFoundError(new Error("Tracciati momento per promozione non trovati"), {
          message: "Tracciati momento per promozione non trovati",
          entityType: "TracciatiMomento",
          entityId: idPromo
        });
      }
      const risultati = this.normalizeMenaboTracciati(momentiPerPromo[0].risultato);
      if (risultati.length === 0) {
        throw wrapNotFoundError(new Error("Risultati tracciati per menabò non trovati"), {
          message: "Risultati tracciati per menabò non trovati",
          entityType: "TracciatiMomento",
          entityId: idPromo
        });
      }
      const regoleMenabo = await this.configService.getRegoleMenabo();
      const tipoDivisione = regoleMenabo?.tipoDivisione ?? 'canale';
      const risultatoDatiDaAgenziaLib = await this.agenziaLib.getDatoPerMenabo(risultati, {
        tipoDivisione,
        dataDivisione: [],
      });

      // Arricchisce label: sostituisce i GUID con i codici leggibili di Canale/Area
      const guidCanaliSet = new Set<string>();
      const guidAreeSet = new Set<string>();
      for (const r of risultatoDatiDaAgenziaLib.risultati) {
        const parts = r.id.split(':');
        if (tipoDivisione === 'canale') { guidCanaliSet.add(parts[0]); }
        else if (tipoDivisione === 'area') { guidAreeSet.add(parts[0]); }
        else { if (parts[0]) guidCanaliSet.add(parts[0]); if (parts[1]) guidAreeSet.add(parts[1]); }
      }
      const [canaliRows, areeRows] = await Promise.all([
        guidCanaliSet.size > 0
          ? Canale.findAll({ where: { id_canali: { [Op.in]: [...guidCanaliSet] } }, attributes: ['id_canali', 'codice_canali'], raw: true })
          : Promise.resolve([]),
        guidAreeSet.size > 0
          ? Area.findAll({ where: { id_aree: { [Op.in]: [...guidAreeSet] } }, attributes: ['id_aree', 'codice_aree'], raw: true })
          : Promise.resolve([]),
      ]);
      const canaleMap = new Map((canaliRows as any[]).map(c => [c.id_canali as string, c.codice_canali as string]));
      const areaMap = new Map((areeRows as any[]).map(a => [a.id_aree as string, a.codice_aree as string]));
      for (const r of risultatoDatiDaAgenziaLib.risultati) {
        const parts = r.id.split(':');
        if (tipoDivisione === 'canale') {
          r.label = canaleMap.get(parts[0]) ?? r.label;
        } else if (tipoDivisione === 'area') {
          r.label = areaMap.get(parts[0]) ?? r.label;
        } else {
          r.label = `${canaleMap.get(parts[0]) ?? parts[0]} / ${areaMap.get(parts[1]) ?? parts[1]}`;
        }
      }

      return { ...risultatoDatiDaAgenziaLib, nomePromo: promoValues.nome_promo as string };
    } catch (error: any) {
      throw new DatabaseError({
        message: "Errore durante il recupero delle promozioni in corso",
        operation: 'get',
        entity: 'Promo',
        cause: error instanceof Error ? error : undefined
      });
    }
  }

  async generateMenaboExcel(layout: MenaboLayoutDivisioneSalvata): Promise<Buffer> {
    const buffer = await this.agenziaLib.exportMenaboExcel(layout);
    return Buffer.from(buffer);
  }

  async generateIndesignPluginJson(layout: MenaboLayoutDivisioneSalvata): Promise<IndesignPluginExport> {
    return this.agenziaLib.buildIndesignPluginJson(layout);
  }

  async testNotifica(req: ExpressRequest): Promise<void> {
    try {
      log.info('Tentativo di invio notifica di test...');
      const utente = req.session.id_utente;
      const utenteModel = await Utente.findByPk(utente);
      if (!utenteModel) {
        throw new NotFoundError({ message: `Utente con id ${utente} non trovato.`, entityType: 'Utente' });
      }
      const notifica: SystemNotification = {
        titolo: 'Notifica di Prova',
        messaggio: `una notifica di prova inviata dal server! ${utenteModel.nome_utenti} ${utenteModel.cognome_utenti}`,
        tipo: 'success'
      };

      emitToClients('notifica', notifica);

      log.info('Notifica di test inviata con successo');
    } catch (error) {
      log.error('Errore durante l\'invio della notifica di test:', error);
      throw error;
    }
  }
}
