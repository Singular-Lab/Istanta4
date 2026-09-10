import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Op, type WhereOptions } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { STATO_PROMO } from '../../../lib/enums';
import { DatabaseError, NotFoundError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import {
  DataWebPliant,
  PageLayoutItem,
  ReferenzeIstanta
} from '../../../lib/types';
import { AreaResponseDTO, CanaleResponseDTO } from '../dto';
import { IAreaService } from '../interfaces/IAreaService';
import { ICanaleService } from '../interfaces/ICanaleService';
import { IGdoService } from '../interfaces/IGdoService';
import { ITipoExportService } from '../interfaces/ITipoExportService';
import { IWebPliantService } from '../interfaces/IWebPliantService';
import { log } from '../logger';
import { Config } from '../models/config';
import { PromoAttributes } from '../models/promo';
import { Referenze } from '../models/referenze';
import { RuntimeKit } from '../models/runtime_kit';
import { WorkspaceWebpliant } from '../models/workspace_webpliant';
import type { IPromoRepository } from '../repositories/PromoRepository';
import { normalizePromoModel, trasformaData } from '../utils/PromoModelUtils';

dayjs.extend(isBetween);

/**
 * Autonomous WebPliant service with its own implementation.
 * Manages WebPliant workspaces, referenze, and data for the carousel/flyer system.
 */
export class WebPliantService implements IWebPliantService {
  constructor(
    private readonly promoRepository: IPromoRepository,
    private readonly areeService: IAreaService,
    private readonly canaliService: ICanaleService,
    private readonly gdoService: IGdoService,
    private readonly tipoExportService: ITipoExportService
  ) { }

  /* ------------------------------------------------------------------ */
  /*  Workspace CRUD                                                     */
  /* ------------------------------------------------------------------ */

  async aggiungiWorkspaceWebPliant(data: any): Promise<boolean> {
    try {
      if (!data.idWorkspace) {
        data.idWorkspace = uuidv4();
      }
      const result = await WorkspaceWebpliant.create({
        id: data.idWorkspace || uuidv4(),
        id_area: data.idArea,
        id_canale: data.idCanale,
        id_gdo: data.idGDO || data.idGdo,
        nome_workspace: data.nomeWorkspace,
        webpliant: data.webpliant || [],
        sitemap: data.sitemap || []
      } as any);
      return !!result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'aggiunta del workspace WebPliant"), {
        message: "Errore durante l'aggiunta del workspace WebPliant",
        operation: 'create',
        entity: 'WorkspaceDataWebPliant',
        details: { error }
      });
    }
  }

  async eliminaWorkspaceWebPliant(id: string): Promise<boolean> {
    try {
      const result = await WorkspaceWebpliant.destroy({ where: { id }, limit: 1 });
      return !!result;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante l'eliminazione del workspace WebPliant"), {
        message: "Errore durante l'eliminazione del workspace WebPliant",
        operation: 'delete',
        entity: 'WorkspaceDataWebPliant',
        details: { error }
      });
    }
  }

  async getAllWorkspaceWebPliant(): Promise<any[]> {
    try {
      const result = await WorkspaceWebpliant.findAll({ raw: true });
      const workspace: any[] = [];
      for (let i = 0; i < result.length; i++) {
        const singoloWorkspace = result[i] as any as (typeof result[0] & { isGlobal: boolean, nomeArea: string, nomeCanale: string });
        if (!singoloWorkspace) {
          continue;
        }
        let area: AreaResponseDTO | null = null;
        let canali: CanaleResponseDTO | null = null;
        if (singoloWorkspace.id_area) {
          area = await this.areeService.getAreaById(singoloWorkspace.id_area);
        }
        if (singoloWorkspace.id_canale) {
          canali = await this.canaliService.getCanaleById(singoloWorkspace.id_canale);
        }

        const workspaceItem = {
          idWorkspace: singoloWorkspace.id,
          nomeWorkspace: singoloWorkspace.nome_workspace,
          idArea: singoloWorkspace.id_area,
          idCanale: singoloWorkspace.id_canale,
          idGDO: singoloWorkspace.id_gdo,
          idPV: singoloWorkspace.id_pv,
          createdAt: singoloWorkspace.createdAt,
          updatedAt: singoloWorkspace.updatedAt,
          isGlobal: !area || !canali,
          nomeArea: area?.nome,
          nomeCanale: canali?.nome,
        };
        workspace.push(workspaceItem);
      }
      return workspace;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei workspace WebPliant"), {
        message: "Errore durante il recupero dei workspace WebPliant",
        operation: 'get',
        entity: 'WorkspaceDataWebPliant',
        details: { error }
      });
    }
  }

  async getAllWorkspaceWebPliantDaIdGdo(id: string): Promise<any[]> {
    try {
      const result = await WorkspaceWebpliant.findAll({ where: { id_gdo: id }, raw: true });
      return (result ?? []).map((r: any) => ({
        idWorkspace: r.id,
        nomeWorkspace: r.nome_workspace,
        idArea: r.id_area,
        idCanale: r.id_canale,
        idGDO: r.id_gdo,
        idPV: r.id_pv,
        webpliant: r.webpliant ?? [],
        sitemap: r.sitemap ?? [],
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }));
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei workspace WebPliant"), {
        message: "Errore durante il recupero dei workspace WebPliant",
        operation: 'get',
        entity: 'WorkspaceDataWebPliant',
        details: { error }
      });
    }
  }

  async prendiWorkspaceDaID(id: string, isEditor: boolean): Promise<DataWebPliant> {
    try {
      const raw = await WorkspaceWebpliant.findOne({ where: { id }, raw: true }) as any;
      if (!raw) {
        throw wrapNotFoundError(new Error("Workspace non trovato"), {
          message: "Workspace non trovato",
          entityType: "Workspace",
          entityId: id
        });
      }
      const workspace: DataWebPliant = {
        ...raw,
        idWorkspace: raw.idWorkspace ?? raw.id,
        idArea: raw.idArea ?? raw.id_area,
        idCanale: raw.idCanale ?? raw.id_canale,
        idGDO: raw.idGDO ?? raw.id_gdo,
        idPV: raw.idPV ?? raw.id_pv,
        nomeWorkspace: raw.nomeWorkspace ?? raw.nome_workspace,
        webpliant: raw.webpliant ?? [],
        sitemap: raw.sitemap ?? [],
      };
      if (isEditor) {
        return workspace;
      }
      const workspaceFiltered = workspace.webpliant.map((page) => {
        return {
          ...page,
          struttura: page.struttura
            .map((item) => {
              const isHybrid = item.is_hybrid;
              const isInCurrentDate = item.keyframes?.some((kf) => {
                const startDate = dayjs(kf.startDate);
                const endDate = dayjs(kf.endDate);
                return dayjs().isBetween(startDate, endDate, 'day', '[]');
              }) || false;
              const currentContentOverride = item.keyframes?.find((kf) => {
                const startDate = dayjs(kf.startDate);
                const endDate = dayjs(kf.endDate);
                return dayjs().isBetween(startDate, endDate, 'day', '[]');
              })?.modification?.content;
              if (isHybrid && isInCurrentDate) {
                return {
                  ...item,
                  is_hybrid: true,
                  keyframes: item.keyframes,
                  content: currentContentOverride
                };
              } else if (!isHybrid && currentContentOverride) {
                return {
                  ...item,
                  content: currentContentOverride
                };
              }
              if (isHybrid && !isInCurrentDate) {
                return null;
              }
              return item;
            })
            .filter((item): item is PageLayoutItem => item !== null)
        }
      });
      const updatedWorkspace: DataWebPliant = {
        ...workspace,
        webpliant: workspaceFiltered
      };
      return updatedWorkspace;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero del workspace"), {
          message: "Errore durante il recupero del workspace",
          operation: 'get',
          entity: 'Workspace',
          details: { error },
        });
      }
    }
  }

  async creaWebPliantWorkspace(data: DataWebPliant): Promise<any> {
    try {
      const pgData: any = {
        id: data.idWorkspace,
        id_area: data.idArea || (data as any).id_area,
        id_canale: data.idCanale || (data as any).id_canale,
        id_gdo: data.idGDO || (data as any).idGdo || (data as any).id_gdo,
        nome_workspace: data.nomeWorkspace || (data as any).nome_workspace,
        webpliant: data.webpliant,
        sitemap: data.sitemap,
      };
      await WorkspaceWebpliant.upsert(pgData as any);
      return true;
    } catch (error) {
      console.error('Errore durante la creazione del workspace webpliant:', error);
      throw wrapDatabaseError(new Error("Errore durante la creazione del workspace webpliant"), {
        message: "Errore durante la creazione del workspace webpliant",
        operation: 'create',
        entity: 'WorkspaceDataWebPliant',
        details: { error }
      });
    }
  }

  async tuttiIWorkspaceDaGDO(idUtente: string): Promise<any> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(idUtente);
      if (gdo == null) {
        throw wrapNotFoundError(new Error("GDO non trovata"), {
          message: "GDO non trovata",
          entityType: "GDO",
          entityId: idUtente
        });
      }
      const id_gdo = gdo.id;
      const workspace = await WorkspaceWebpliant.findAll({
        where: { id_gdo: id_gdo },
        raw: true
      }) as any;

      const result: (DataWebPliant & { isGlobal: boolean, nomeArea: string | undefined, nomeCanale: string | undefined })[] = [];

      for (let i = 0; i < workspace.length; i++) {
        const singoloWorkspace = workspace[i] as any;
        if (!singoloWorkspace) {
          throw wrapNotFoundError(new Error("Workspace non trovato"), {
            message: "Workspace non trovato",
            entityType: "Workspace",
            entityId: singoloWorkspace?.id || "unknown"
          });
        }

        let area: AreaResponseDTO | null = null;
        let canali: CanaleResponseDTO | null = null;
        if (singoloWorkspace.id_area) {
          area = await this.areeService.getAreaById(singoloWorkspace.id_area);
        }
        if (singoloWorkspace.id_canale) {
          canali = await this.canaliService.getCanaleById(singoloWorkspace.id_canale);
        }

        result.push({
          idWorkspace: singoloWorkspace.id,
          nomeWorkspace: singoloWorkspace.nome_workspace,
          idArea: singoloWorkspace.id_area,
          idCanale: singoloWorkspace.id_canale,
          idGDO: singoloWorkspace.id_gdo,
          idPV: singoloWorkspace.id_pv,
          createdAt: singoloWorkspace.createdAt,
          updatedAt: singoloWorkspace.updatedAt,
          isGlobal: !area || !canali,
          nomeArea: area?.nome,
          nomeCanale: canali?.nome,
        } as any);
      }
      return result;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero dei workspace"), {
          message: "Errore durante il recupero dei workspace",
          operation: 'get',
          entity: 'Workspace',
          details: { error }
        });
      }
    }
  }

  async getIdsWorkspace(idUtente: string): Promise<any> {
    try {
      const gdo = await this.gdoService.getGDOByUtenteId(idUtente);
      if (gdo == null) {
        throw wrapNotFoundError(new Error("GDO non trovata"), {
          message: "GDO non trovata",
          entityType: "GDO",
          entityId: idUtente
        });
      }

      const result = await WorkspaceWebpliant.findAll({
        where: { id_gdo: gdo.id },
        raw: true
      });

      const ids = result?.map(r => ({
        id: r.id,
        nomeWorkspace: r.nome_workspace
      }));

      return ids;
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      } else if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero degli ID workspace"), {
          message: "Errore durante il recupero degli ID workspace",
          operation: 'get',
          entity: 'Workspace',
          details: { error }
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Data                                                               */
  /* ------------------------------------------------------------------ */

  async getDataValiditaPerCarosello(content: any, referenze: ReferenzeIstanta[]): Promise<string> {
    let dataScritta = "";
    let validoDal, validoAl;

    if ((referenze[0] as any).data_fields?.data_da === undefined || (referenze[0] as any).data_fields?.data_a === undefined) {
      const idPromo = (referenze[0] as any).id_promo;
      const promo = await this.promoRepository.findById(idPromo as string);
      if (!promo) throw new NotFoundError({
        message: "Promo non trovata",
        entityType: "Promo",
        entityId: idPromo as string
      });
      const promoValues = normalizePromoModel(promo);
      validoDal = promoValues.validita_dal;
      validoAl = promoValues.validita_al;
    } else {
      validoDal = (referenze[0] as any).data_fields?.data_da as string;
      validoAl = (referenze[0] as any).data_fields?.data_a as string;
    }

    if (!validoDal || !validoAl) {
      throw new NotFoundError({
        message: "Date di validità mancanti",
        entityType: "Promo",
        details: { validoDal, validoAl }
      });
    }

    const refValidoAl = dayjs(validoAl);
    const refValidoDal = dayjs(validoDal);
    const validDalBool = content?.options?.validita?.validitaDal;
    const validAlBool = content?.options?.validita?.validitaAl;
    const auto = content?.options?.validita?.auto;

    if (auto) {
      const dataAlUguali = referenze.every((val) => {
        const dataFine = (val as any).valido_al ? dayjs((val as any).data_fields?.data_a as string) : refValidoAl;
        return dataFine.isSame(refValidoAl, 'day');
      });

      const dataDalUguali = referenze.every((val) => {
        const dataInizio = (val as any).valido_dal ? dayjs((val as any).data_fields?.data_da as string) : refValidoDal;
        return dataInizio.isSame(refValidoDal, 'day');
      });

      dataScritta = trasformaData(validoDal.toString(), validoAl.toString(), validDalBool, validAlBool, auto, dataDalUguali, dataAlUguali);
    } else {
      if (validDalBool && validAlBool) {
        const today = dayjs();
        const equal = referenze.every((val) => {
          const dataInizio = (val as any).valido_dal ? dayjs((val as any).valido_dal) : refValidoDal;
          const dataFine = (val as any).valido_al ? dayjs((val as any).valido_al) : refValidoAl;
          return dataInizio.isSame(refValidoDal, 'day') && dataFine.isSame(refValidoAl, 'day') && dataFine.isAfter(today);
        });

        if (equal) {
          dataScritta = trasformaData(validoDal.toString(), validoAl.toString(), validDalBool, validAlBool);
        }
      } else if (!validDalBool && validAlBool) {
        const today = dayjs();
        const equal = referenze.every((val) => {
          const dataInizio = (val as any).valido_dal ? dayjs((val as any).valido_dal) : refValidoDal;
          const dataFine = (val as any).valido_al ? dayjs((val as any).valido_al) : refValidoAl;
          return dataInizio.isSame(refValidoDal, 'day') && dataFine.isSame(refValidoAl, 'day') && dataFine.isAfter(today) && dataInizio.isBefore(today);
        });

        if (equal) {
          dataScritta = trasformaData(validoDal.toString(), validoAl.toString(), validDalBool, validAlBool);
        }
      } else if (validDalBool && !validAlBool) {
        const today = dayjs();
        const equal = referenze.every((val) => {
          const dataInizio = (val as any).valido_dal ? dayjs((val as any).valido_dal) : refValidoDal;
          return dataInizio.isSame(refValidoDal, 'day') && dataInizio.isAfter(today, 'day');
        });

        if (equal) {
          dataScritta = trasformaData(validoDal.toString(), validoAl.toString(), validDalBool, validAlBool);
        }
      }
    }

    return dataScritta;
  }

  async getReferenzeWebPliant(idWorkspace: string, dataSelezionata: Date, idArea?: string, idCanale?: string, isEditor?: boolean): Promise<any[]> {
    try {
      const workspace = await WorkspaceWebpliant.findOne({ where: { id: idWorkspace }, raw: true });
      if (!workspace) {
        throw wrapNotFoundError(new Error("Workspace non trovato"), {
          message: "Workspace non trovato",
          entityType: "WorkspaceDataWebPliant",
          entityId: idWorkspace
        });
      }

      const pgQuery: any = {};
      if (idArea) pgQuery.id_area = idArea;
      if (idCanale) pgQuery.id_canale = idCanale;

      const combinazioni = await RuntimeKit.findAll({ where: pgQuery, raw: true }) as unknown as Array<
        any & {
          webpliant?: ReferenzeIstanta[];
          visibile?: boolean;
        }
      >;

      await Promise.all(
        combinazioni.map(async (combo) => {
          try {
            if (!combo.id_promo) return;
            const promo = await this.promoRepository.findById(combo.id_promo);
            if (!promo) return;
            const promoValues = normalizePromoModel(promo);

            const referenze = await Referenze.findAll({
              where: { id_runtime_kit: (combo as any).id },
              raw: true
            }) as unknown as ReferenzeIstanta[];

            let visibile = true;
            if (!isEditor && dataSelezionata) {
              const offsetGiorni = Number(promoValues.offset_visibilita) || 0;
              const inizioOffset = dayjs(promoValues.validita_dal).subtract(offsetGiorni, 'days');
              const fineOffset = dayjs(promoValues.validita_al);
              visibile =
                (dayjs(dataSelezionata).isAfter(inizioOffset) && dayjs(dataSelezionata).isBefore(fineOffset)) ||
                dayjs(dataSelezionata).isSame(inizioOffset) ||
                dayjs(dataSelezionata).isSame(fineOffset);
            }

            combo.visibile = visibile;
            combo.webpliant = referenze.map((r) => {
              const daField = (r as any).data_fields?.data_da as string;
              const aField = (r as any).data_fields?.data_a as string;
              const offsetGiorni = Number(promoValues.offset_visibilita) || 0;
              (r as any).id_promo = promoValues.id_promo;
              r.visibile = visibile;
              r.validoDal = daField
                ? dayjs(new Date(daField)).subtract(offsetGiorni, 'days').toDate().toDateString()
                : dayjs(promoValues.validita_dal).subtract(offsetGiorni, 'days').toDate().toDateString();
              r.validoAl = aField
                ? dayjs(new Date(aField)).toDate().toDateString()
                : dayjs(promoValues.validita_al).toDate().toDateString();
              return r;
            });
          } catch (innerErr) {
            log.error(`getReferenzeWebPliant inner error for combo ${(combo as any).id}:`, innerErr);
            // do not propagate — skip this kit
            combo.visibile = false;
            combo.webpliant = [];
          }
        })
      );
      const risultato = isEditor ? combinazioni : combinazioni.filter((c) => c.visibile);
      return risultato;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      log.error("getReferenzeWebPliant error:", error);
      throw wrapDatabaseError(new Error("Errore durante il recupero delle referenze WebPliant"), {
        message: "Errore durante il recupero delle referenze WebPliant",
        operation: 'get',
        entity: 'CombinazioniRuntime',
        details: { error }
      });
    }
  }

  async getDatoMassivoPerWebPliant(): Promise<any[]> {
    try {
      const [aree, canali, tipoExportWebPliant] = await Promise.all([
        this.areeService.getAllAreas(),
        this.canaliService.getAllCanali(),
        this.tipoExportService.getTipoExportByCodice("WEB"),
      ]);

      if (!tipoExportWebPliant) {
        throw wrapNotFoundError(new Error("Tipo export WEB non trovato"), {
          message: "Tipo export WEB non trovato",
          entityType: "TipoExport",
          entityId: "WEB"
        });
      }

      const [combinazioni_runtime, workspaces, promozioni] = await Promise.all([
        RuntimeKit.findAll({ raw: true }),
        WorkspaceWebpliant.findAll({ raw: true }),
        this.promoRepository.findAllWithOptions({
          where: {
            stato: {
              [Op.notIn]: [STATO_PROMO.VALIDA, STATO_PROMO.VALIDA_CON_ERRORI, STATO_PROMO.ARCHIVIATA, STATO_PROMO.ELIMINATA]
            }
          } as WhereOptions<PromoAttributes>
        })
      ]);

      log.debug("combinazioni_runtime dato massivo per webpliant", combinazioni_runtime)

      if (!combinazioni_runtime || !workspaces) {
        throw wrapDatabaseError(new Error("Errore durante il recupero dei dati massivi per webpliant"), {
          message: "Failed to fetch data from database",
          operation: 'get',
          entity: 'CombinazioniRuntime',
        });
      }

      const promoById = new Map<string, PromoAttributes>();
      promozioni.forEach((promo) => {
        const data = normalizePromoModel(promo);
        promoById.set(data.id_promo, data);
      });

      const combinazioniFiltrate = combinazioni_runtime.filter((combinazione) =>
        combinazione?.tipi_di_export_in_kit?.some(
          (tipoExport: any) => tipoExport.tipo_di_export_guid_id === tipoExportWebPliant.id
        )
      );

      const referenzeMap = new Map<string, ReferenzeIstanta[]>();
      const referenze = await Referenze.findAll({
        where: { id_runtime_kit: { [Op.in]: combinazioniFiltrate.map((c: any) => c.id) } },
        raw: true
      }) as unknown as ReferenzeIstanta[];

      referenze.forEach((ref) => {
        const kitId = (ref as any).id_runtime_kit;
        if (!referenzeMap.has(kitId)) {
          referenzeMap.set(kitId, []);
        }
        referenzeMap.get(kitId)!.push(ref);
      });

      const groupedCombinazioni = new Map<string, any>();
      combinazioniFiltrate.forEach((combinazione) => {
        const key = `${(combinazione as any).id_canale}|${(combinazione as any).id_area}`;
        if (groupedCombinazioni.has(key)) {
          const existing = groupedCombinazioni.get(key)!;
          existing.webpliant = [
            ...(existing.webpliant || []),
            ...(referenzeMap.get((combinazione as any).id) || []),
          ];
        } else {
          groupedCombinazioni.set(key, {
            ...combinazione,
            webpliant: referenzeMap.get((combinazione as any).id) || [],
          });
        }
      });

      const datiMassivi: any[] = [];
      for (const combinazione of Array.from(groupedCombinazioni.values())) {
        const area = aree.find((a) => a.id === (combinazione as any).id_area);
        const canale = canali.find((c) => c.id === (combinazione as any).id_canale);
        if (!area || !canale) continue;

        const workspace = workspaces.find(
          (w) => w.id_area === (combinazione as any).id_area && w.id_canale === (combinazione as any).id_canale
        );

        const mapWsToCamel = (w: any) => ({
          idWorkspace: w.id,
          nomeWorkspace: w.nome_workspace,
          idArea: w.id_area,
          idCanale: w.id_canale,
          idGDO: w.id_gdo,
          idPV: w.id_pv,
          webpliant: w.webpliant,
          sitemap: w.sitemap,
        });

        const workSpaceGlobale = workspaces
          .filter((w) => w.id_area === "" && w.id_canale === "")
          .map(mapWsToCamel);
        const workSpaceApplicabili = workspaces
          .filter((w) => w.id_area === (combinazione as any).id_area && w.id_canale === (combinazione as any).id_canale)
          .map(mapWsToCamel)
          .concat(workSpaceGlobale);
        const promozioneCorrente = (combinazione as any).id_promo ? promoById.get((combinazione as any).id_promo) : undefined;
        if (!workspace) {
          datiMassivi.push({
            idKit: (combinazione as any).id,
            idCanale: (combinazione as any).id_canale,
            nomeCanale: canale.nome,
            nomeArea: area.nome,
            idArea: (combinazione as any).id_area,
            disattivo_mancanza_referenze: !combinazione.webpliant ? true : combinazione.webpliant.length === 0,
            disattivo_mancanza_workspace: true,
            workspaceApplicabili: workSpaceGlobale,
            messaggio: combinazione?.webpliant?.length
              ? "Workspace non presente"
              : "Manca il workspace e le referenze",
            data_inizio_promo_corrente: promozioneCorrente?.validita_dal,
            data_fine_promo_corrente: promozioneCorrente?.validita_al
          });
        } else {
          datiMassivi.push({
            idKit: (combinazione as any).id,
            idCanale: (combinazione as any).id_canale,
            nomeCanale: canale.nome,
            idArea: (combinazione as any).id_area,
            nomeArea: area.nome,
            disattivo_mancanza_referenze: !combinazione.webpliant ? true : combinazione.webpliant.length === 0,
            disattivo_mancanza_workspace: false,
            workspaceApplicabili: workSpaceApplicabili,
            messaggio: combinazione.webpliant?.length ? "" : "Referenze non presenti",
            data_inizio_promo_corrente: promozioneCorrente?.validita_dal,
            data_fine_promo_corrente: promozioneCorrente?.validita_al
          });
        }
      }

      return datiMassivi;
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      } else {
        throw wrapDatabaseError(new Error("Errore durante il recupero dei dati massivi per webpliant"), {
          message: "Errore durante il recupero dei dati massivi per webpliant",
          operation: 'get',
          entity: 'Promo',
          details: { error }
        });
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Field options & Raggruppamento                                     */
  /* ------------------------------------------------------------------ */

  async get_field_options_filtri(): Promise<any> {
    try {
      const result = await Config.findOne({ raw: true }) as any;
      if (!result) {
        throw new NotFoundError({
          message: "Nessun risultato trovato",
          entityType: 'Config',
        });
      }
      return result.webpliant?.data_fields_refs;
    } catch (error) {
      throw wrapDatabaseError(new Error("Errore durante il recupero delle opzioni dei filtri"), {
        message: "Errore durante il recupero delle opzioni dei filtri",
        operation: 'get',
        entity: 'Config',
        details: { error }
      });
    }
  }

  async getCampiDaRaggruppamento({
    idWorkspace,
    idArea,
    idCanale,
    dataSelezionata,
    campoSelezionato,
  }: {
    idWorkspace: string;
    idArea: string;
    idCanale: string;
    dataSelezionata: Date;
    campoSelezionato: string;
  }): Promise<any> {
    try {
      const resultReferenze = await this.getReferenzeWebPliant(idWorkspace, dataSelezionata, idArea, idCanale);
      if (Array.isArray(resultReferenze) && resultReferenze.length > 0) {
        let referenze: ReferenzeIstanta[] = [];
        for (const r of resultReferenze) {
          if (r.webpliant != undefined) {
            for (const w of r.webpliant) {
              w.visibile = r.visibile;
              referenze.push(w);
            }
          }
        }
        const uniqueValues: string[] = [];
        referenze.forEach((referenza) => {
          const value = (referenza as any).data_fields?.[campoSelezionato];
          if (value) {
            if (typeof value === 'string') {
              uniqueValues.push(value);
            } else if (typeof value !== 'undefined') {
              uniqueValues.push(String(value));
            }
          }
        });
        const result = Array.from(new Set(uniqueValues)).map((value) => String(value));
        log.debug('Risultato:', result);
        return result;
      } else {
        console.error('Nessuna referenza trovata per il workspace:', idWorkspace);
        return [];
      }
    } catch (error) {
      console.error('Errore durante il recupero dei campi da raggruppamento:', error);
      throw wrapDatabaseError(new Error("Errore durante il recupero dei campi da raggruppamento"), {
        message: "Errore durante il recupero dei campi da raggruppamento",
        operation: 'get',
        entity: 'CombinazioniRuntime',
        details: { error }
      });
    }
  }
}
