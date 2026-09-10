import dayjs from 'dayjs';
import { Request } from 'express';
import 'express-session';
import { readFileSync } from 'fs';
import path from 'path';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { STATO_LAVORAZIONE_KIT_RUNTIME, STATO_PROMO, TIPO_UTENTI } from '../../../lib/enums';
import { DatabaseError, NotFoundError, wrapDatabaseError, wrapNotFoundError } from '../../../lib/errors';
import { GDOAttributes, GdoMenuStructure, MenuElement, MenuItem, MenuStructure, OggettoTipiDiExport, RaccoglitoreKit, TimelinePromoItem } from '../../../lib/types';
import { TYPES, container } from '../di';
import { IImpostazioniService } from '../interfaces/IImpostazioniService';
import { IIstantaService } from '../interfaces/IIstantaService';
import { IMenuService } from '../interfaces/IMenuService';
import type { ITipoExportService } from '../interfaces/ITipoExportService';
import { IUserService } from '../interfaces/IUserService';
import { IWebhookService } from '../interfaces/IWebhookService';
import { log } from '../logger';
import { Area } from '../models/aree';
import { Canale } from '../models/canali';
import { Config } from '../models/config';
import { DesignKit } from '../models/design_kit';
import { Promo } from '../models/promo';
import { Referenze } from '../models/referenze';
import { RuntimeKit } from '../models/runtime_kit';

export class ImpostazioniService implements IImpostazioniService {
  constructor(
    private readonly istantaService: IIstantaService,
    private readonly webhookService: IWebhookService,
    private readonly userService: IUserService,
    private readonly menuService: IMenuService
  ) { }

  async salvaGestionePagineSingular(idGdo: string, data: string): Promise<GDOAttributes | null> {
    try {
      return null;
    } catch (error) {
      log.error('Impossibile salvare la gestione pagine Singular', error instanceof Error ? error : new Error(String(error)), { idGdo });
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il salvataggio della gestione pagine"), {
        message: "Errore durante il salvataggio della gestione pagine",
        operation: 'update',
        entity: 'GDO',
        details: { idGdo, data },
      });
    }
  }

  async getAllCanaliForGDO(idGDO: string): Promise<any[]> {
    try {
      const canali = await Canale.findAll({
        where: {
          id_gdo_canali: idGDO
        }
      });
      return canali;
    } catch (error) {
      log.error('Impossibile recuperare i canali per la GDO', error instanceof Error ? error : new Error(String(error)), { idGDO });
      throw wrapDatabaseError(new Error("Errore durante il recupero dei canali"), {
        message: "Errore durante il recupero dei canali",
        operation: 'findAll',
        entity: 'Canale',
        details: { idGDO },
      });
    }
  }

  async getAllAreeForGDO(idGDO: string): Promise<any[]> {
    try {
      const aree = await Area.findAll({
        where: {
          id_gdo_aree: idGDO
        }
      });
      return aree;
    } catch (error) {
      log.error('Impossibile recuperare le aree per la GDO', error instanceof Error ? error : new Error(String(error)), { idGDO });
      throw wrapDatabaseError(new Error("Errore durante il recupero delle aree"), {
        message: "Errore durante il recupero delle aree",
        operation: 'findAll',
        entity: 'Area',
        details: { error }
      });
    }
  }

  async createCombinazioneDesign(data: { quantitaCopie: number, tipiDiExportInKit: OggettoTipiDiExport[], guidFormato: string, guidPv: string, guidArea: string, guidCanale: string, titolo: string }): Promise<RaccoglitoreKit | null> {
    try {
      const resultCreazioneCombinazioneDesign = await DesignKit.create({
        id_area: data.guidArea,
        id_canale: data.guidCanale,
        id_formato: data.guidFormato,
        tipi_di_export_in_kit: data.tipiDiExportInKit,
        quantita_copie: data.quantitaCopie,
        titolo: data.titolo,
      } as any);
      if (!resultCreazioneCombinazioneDesign) {
        return null;
      }
      return resultCreazioneCombinazioneDesign as unknown as RaccoglitoreKit;
    } catch (error) {
      log.error('Impossibile creare la combinazione design', error instanceof Error ? error : new Error(String(error)));
      throw wrapDatabaseError(new Error("Errore durante la creazione della combinazione design"), {
        message: "Errore durante la creazione della combinazione design",
        operation: 'create',
        entity: 'DesignKit',
        details: { data },
      });
    }
  }

  async caricaStiliInConfig(id: string, stile: string): Promise<void> {
    try {
      const configRecord = await Config.findOne({ where: { id }, raw: true }) as any;
      if (configRecord == undefined) {
        await Config.create({
          id: uuidv4(),
          webpliant: { css_text: stile, stili: [] }
        } as any);
      } else {
        const updatedWebpliant = { ...(configRecord.webpliant || {}), css_text: stile, stili: [] };
        await Config.update(
          { webpliant: updatedWebpliant } as any,
          { where: { id: configRecord.id } }
        );
      }
    } catch (error: any) {
      throw wrapDatabaseError(new Error("Errore durante il recupero dei formati"), {
        message: "Errore durante il recupero dei formati",
        operation: 'findOne',
        entity: 'ConfigWebpliant',
        details: { error }
      });
    }
  }

  async getAllPromoForTimeline(idArea: string, idCanale: string): Promise<TimelinePromoItem[]> {
    try {
      const resultTipoExportWEB = await container.get<ITipoExportService>(TYPES.TipoExportService).getTipoExportByCodice("WEB");
      if (!resultTipoExportWEB) {
        throw new NotFoundError({
          message: "TipoExport 'WEB' non trovato",
          entityType: 'TipoExport',
          entityId: "WEB"
        });
      }

      const [resultPromo, resultCombinazioni] = await Promise.all([
        Promo.findAll({}),
        RuntimeKit.findAll({
          where: {
            id_promo: { [Op.notIn]: [null, "", undefined] },
            tipi_di_export_in_kit: {
              [Op.contains]: [{
                tipo_di_export_guid_id: resultTipoExportWEB.id,
                filtro: [],
                // If your model requires use_webhook and webhook_events, add them here as well:
                // use_webhook: false,
                // webhook_events: ""
              }]
            },
            id_area: idArea,
            id_canale: idCanale
          },
          raw: true
        })
      ]);

      if (!resultPromo || !resultCombinazioni) {
        throw wrapNotFoundError(new Error("Dati non trovati"), {
          message: "Dati non trovati",
          entityType: 'Promo',
          entityId: "WEB"
        });
      }

      const combinazioniIds = resultCombinazioni.map((c: any) => c.id);
      const hasRefsAll = combinazioniIds.length > 0
        ? await Referenze.findAll({ where: { id_runtime_kit: { [Op.in]: combinazioniIds } }, raw: true })
        : [];
      const refsSet = new Set(hasRefsAll.map((r: any) => r.id_runtime_kit));

      let timelineItems = await Promise.all(resultPromo.map(async (promo) => {
        const combinazioni = resultCombinazioni.filter((combinazione: any) => combinazione.id_promo === promo.id_promo && combinazione.id_area == idArea && combinazione.id_canale == idCanale);

        if (combinazioni.length == 0) {
          return null;
        }
        const hasRefs = combinazioni.some((c: any) => refsSet.has(c.id));
        const startDate = dayjs(promo.validita_dal).format("DD/MM/YYYY");
        const endDate = dayjs(promo.validita_al).format("DD/MM/YYYY");
        log.info("startDate: " + startDate);
        log.info("endDate: " + endDate);
        if (!hasRefs) {
          return null;
        }
        return {
          id: uuidv4(),
          name: promo.nome_promo,
          startDate,
          endDate,
          idPromo: promo.id_promo,
          combinazioni: combinazioni.length
        } as TimelinePromoItem;
      }));
      timelineItems = timelineItems.filter((item) => item != null) as TimelinePromoItem[];
      return timelineItems.filter((item): item is TimelinePromoItem => item !== null);
    } catch (error: any) {
      log.error('Impossibile recuperare le promozioni per la timeline', error instanceof Error ? error : new Error(String(error)), { idArea, idCanale });
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw wrapDatabaseError(new Error("Errore durante il recupero delle promo per la timeline"), {
        message: "Errore durante il recupero delle promo per la timeline",
        operation: 'find',
        entity: 'Promo',
        details: { error }
      });
    }
  }

  async getQuickSearchSettings(req: Request): Promise<any> {
    try {
      interface QuickSearchItem {
        id: string;
        title: string;
        path: string;
        icon: string;
        category: string;
        description?: string;
        icon_color?: string;
      }

      // Recupera le promo e i kit in lavorazione
      const allPromoWithLavorazioni = await Promo.findAll();
      const allPromoWithLavorazioniIds = allPromoWithLavorazioni.map(p => p.id_promo);
      const allKitRuntime = await RuntimeKit.findAll({
        where: {
          id_promo: { [Op.in]: allPromoWithLavorazioniIds },
          stato_lavorazione: {
            [Op.in]: [
              STATO_LAVORAZIONE_KIT_RUNTIME.IN_LAVORAZIONE,
              STATO_LAVORAZIONE_KIT_RUNTIME.IN_REVISIONE
            ]
          }
        },
        raw: true
      }) as any[];

      const userId = req.session.id_utente as string | undefined;
      const tipoUtente = req.session.tipo_utente as TIPO_UTENTI | undefined;
      let ruoloGdoKey: string | undefined;

      if (userId && tipoUtente === TIPO_UTENTI.GDO) {
        ruoloGdoKey = await this.userService.resolveGdoRuoloKey(userId);
      }

      let menuPerUtenteConSessione: MenuElement[] = [];
      try {
        if (tipoUtente) {
          menuPerUtenteConSessione = await this.menuService.getMenuPerUtente(tipoUtente, ruoloGdoKey);
        }
      } catch {
        menuPerUtenteConSessione = [];
      }

      // Fallback emergenziale su JSON se il menu runtime non è disponibile
      if (!Array.isArray(menuPerUtenteConSessione) || menuPerUtenteConSessione.length === 0) {
        const pathPerMenu = path.join(process.cwd(), 'config', 'menu.json');
        const menuParsed = JSON.parse(readFileSync(pathPerMenu, 'utf8')) as MenuStructure;

        if (tipoUtente === TIPO_UTENTI.GDO) {
          const gdoMenus = menuParsed.TIPO_UTENTI.GDO as GdoMenuStructure;
          menuPerUtenteConSessione = gdoMenus[ruoloGdoKey || 'GDO_ADMIN'] || gdoMenus.GDO_ADMIN || [];
        } else {
          const userType = tipoUtente?.toUpperCase();
          if (userType && Object.prototype.hasOwnProperty.call(menuParsed.TIPO_UTENTI, userType)) {
            const maybeMenu = menuParsed.TIPO_UTENTI[userType as keyof typeof menuParsed.TIPO_UTENTI];
            menuPerUtenteConSessione = Array.isArray(maybeMenu) ? maybeMenu : [];
          } else {
            menuPerUtenteConSessione = [];
          }
        }
      }

      const quickSearchItems: QuickSearchItem[] = [];

      const flattenMenuPaths = (menu: MenuElement[]): string[] => {
        const paths: string[] = [];

        const walk = (items: MenuElement[]) => {
          for (const item of items) {
            if (typeof item === 'string') {
              continue;
            }

            if (item.pathname && typeof item.pathname === 'string') {
              paths.push(item.pathname);
            }

            if (Array.isArray(item.subMenu) && item.subMenu.length > 0) {
              walk(item.subMenu);
            }
          }
        };

        walk(menu);
        return paths;
      };

      const allMenuPaths = flattenMenuPaths(menuPerUtenteConSessione);

      const hasPageInMenu = (targetPath: string) => {
        return allMenuPaths.some((menuPath) =>
          menuPath === targetPath || targetPath.startsWith(`${menuPath}/`)
        );
      };

      allPromoWithLavorazioni.forEach(promo => {
        const kitInLavorazione = allKitRuntime.filter((kit: any) => kit.id_promo === promo.id_promo);
        const promoPath = `/promozioni/in-corso/dettagli/${promo.id_promo}`;
        if (kitInLavorazione.length > 0 && hasPageInMenu('/promozioni/in-corso')) {
          quickSearchItems.push({
            id: uuidv4(),
            title: `Promo: ${promo.nome_promo}`,
            path: promoPath,
            icon: 'Package',
            category: 'Promo in Lavorazione',
            icon_color: 'orange',
            description: `${kitInLavorazione.length} kit in lavorazione`
          });
        }
      });

      allKitRuntime.forEach((kit: any) => {
        const promo = allPromoWithLavorazioni.find(p => p.id_promo === kit.id_promo);
        if (promo) {
          if (promo.stato === STATO_PROMO.IN_LAVORAZIONE && hasPageInMenu('/promozioni/in-corso')) {
            quickSearchItems.push({
              id: uuidv4(),
              title: `Kit: ${kit.titolo || 'Kit senza nome'}`,
              path: `/promozioni/in-corso/dettagli/${kit.id_promo}/kits/${kit.id}`,
              icon: 'Box',
              category: 'Kit in Lavorazione',
              icon_color: "green",
              description: `Promo: ${promo.nome_promo} - Stato: ${kit.stato_lavorazione}`
            });
          } else if ((
            promo.stato === STATO_PROMO.VALIDA ||
            promo.stato === STATO_PROMO.VALIDA_CON_ERRORI ||
            promo.stato === STATO_PROMO.ARCHIVIATA
          ) && hasPageInMenu('/promozioni/storico')) {
            quickSearchItems.push({
              id: uuidv4(),
              title: `Kit: ${kit.titolo || 'Kit senza nome'}`,
              path: `/promozioni/storico/dettagli/${kit.id_promo}/kits/${kit.id}`,
              icon: "Box",
              category: 'Kit in Storico',
              icon_color: "blue",
              description: `Promo: ${promo.nome_promo} - Stato: ${kit.stato_lavorazione}`
            });
          }
        }
      });

      const hasDynamicParams = (path: string): boolean => {
        return path.includes(':') || path.includes('{') || path.includes('}');
      };

      const getIconColorForCategory = (category: string): string => {
        const colorMap: Record<string, string> = {
          'Dashboard': 'blue',
          'Volantini': 'green',
          'Ordini Stampa': 'purple',
          'POP Documentale': 'indigo',
          'Contenuti Digitali': 'pink',
          'WebPliant': 'cyan',
          'Promozioni in corso': 'orange',
          'Storico promozioni': 'gray',
          'Nuova promozione': 'yellow',
          'GDO AI': 'emerald',
          'Impostazioni': 'slate'
        };
        return colorMap[category] || 'slate';
      };

      const addMenuItemToQuickSearch = (item: MenuItem, category: string) => {
        if (!item.pathname || hasDynamicParams(item.pathname) || item.pathname === '' || item.disabled === true) {
          return;
        }
        quickSearchItems.push({
          id: uuidv4(),
          title: item.title,
          path: item.pathname,
          icon: item.icon || '',
          category,
          icon_color: getIconColorForCategory(category),
          description: ''
        });
      };

      const processMenuItemsRecursively = (
        items: MenuElement[],
        inheritedCategory: string,
        parentTitle?: string
      ) => {
        let currentTopLevelCategory = inheritedCategory;

        items.forEach(item => {
          if (typeof item === 'string') {
            currentTopLevelCategory = item;
            return;
          }

          const category = parentTitle || currentTopLevelCategory || 'Generale';
          addMenuItemToQuickSearch(item, category);

          if (Array.isArray(item.subMenu) && item.subMenu.length > 0) {
            processMenuItemsRecursively(item.subMenu, currentTopLevelCategory, item.title);
          }
        });
      };

      processMenuItemsRecursively(menuPerUtenteConSessione, 'Generale');

      const uniqueByPath = new Map<string, QuickSearchItem>();
      quickSearchItems.forEach(item => {
        if (!uniqueByPath.has(item.path)) {
          uniqueByPath.set(item.path, item);
        }
      });

      return Array.from(uniqueByPath.values());
    } catch (error) {
      throw new DatabaseError({
        message: "Errore durante il recupero delle impostazioni del quick search",
        operation: 'readFileSync',
        entity: 'quick_search.json',
        cause: error instanceof Error ? error : undefined
      });
    }
  }
}
