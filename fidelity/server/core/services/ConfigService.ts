import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { TIPO_UTENTI } from "../../../lib/enums";
import { NotFoundError, wrapDatabaseError } from "../../../lib/errors";
import { AvvisoManutenzione, Config, ConfigWebpliant, Dashboard, RegoleMenabo } from "../../../lib/types";
import config from "../config";
import { IConfigService } from "../interfaces/IConfigService";
import { Config as ConfigModel } from "../models/config";
import { log } from '../logger/index.js';


export class ConfigService implements IConfigService {
  async getDashBoardConfig(role: TIPO_UTENTI): Promise<Dashboard> {
    try {
      const configDoc = await ConfigModel.findOne({ raw: true }) as any;

      // Se non esiste nessun documento di configurazione, ritorna dashboard vuota
      if (!configDoc) {
        return {
          version: 2,
          lastUpdated: new Date(),
          plugins: []
        };
      }

      // Prima prova a caricare la dashboard specifica per ruolo
      if (configDoc.dashboards_by_role && configDoc.dashboards_by_role[role]) {
        return configDoc.dashboards_by_role[role] as Dashboard;
      }

      // Fallback alla dashboard globale (backward compatibility)
      if (configDoc.dashboard) {
        return configDoc.dashboard;
      }

      // Nessuna configurazione trovata, ritorna dashboard vuota
      return {
        version: 2,
        lastUpdated: new Date(),
        plugins: []
      };
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero della configurazione",
        operation: 'findOne',
        entity: 'Config',
      });
    }
  }

  async getPluginRegistry(): Promise<any[]> {
    try {
      // Percorso al file plugin_registry.json
      const pluginRegistryPath = path.join(process.cwd(), 'config', 'plugin_registry.json');

      // Verifica se il file esiste
      if (!fs.existsSync(pluginRegistryPath)) {
        throw new NotFoundError({
          message: 'File plugin_registry.json non trovato',
          entityType: 'PluginRegistry',
          entityId: pluginRegistryPath,
        });
      }

      // Legge il file JSON
      const fileContent = fs.readFileSync(pluginRegistryPath, 'utf8');
      const pluginRegistry = JSON.parse(fileContent);

      return pluginRegistry;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero del registry dei plugin",
        operation: 'readFile',
        entity: 'PluginRegistry',
      });
    }
  }

  async saveDashBoardConfig(dashboard: Dashboard, role: TIPO_UTENTI): Promise<any> {
    try {
      // In PG, dashboards_by_role è un campo JSONB: fetch-merge-update
      const current = await ConfigModel.findOne({ raw: true }) as any;
      if (current) {
        const updatedDashboardsByRole = { ...(current.dashboards_by_role || {}), [role]: dashboard };
        await ConfigModel.update(
          { dashboards_by_role: updatedDashboardsByRole },
          { where: { id: current.id } }
        );
        return ConfigModel.findOne({ raw: true });
      } else {
        return ConfigModel.create({
          id: uuidv4(),
          dashboards_by_role: { [role]: dashboard },
          webpliant: {}
        } as any);
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il salvataggio della configurazione",
        operation: 'update',
        entity: 'Config',
      });
    }
  }

  async get_config(): Promise<Config> {
    try {
      const configWebpliant = await ConfigModel.findOne({ raw: true }) as any as Config;
      if (configWebpliant.webpliant.icona_pagina != undefined) {
        const regexBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
        if (!regexBase64.test(configWebpliant.webpliant.icona_pagina)) {
          const url = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${configWebpliant.webpliant.icona_pagina}`;
          configWebpliant.webpliant.icona_pagina = url;
        }
      }
      if (configWebpliant.webpliant.icona_pagina == undefined) {
        configWebpliant.webpliant.icona_pagina = "";
      }

      return configWebpliant;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero della configurazione",
        operation: 'findOne',
        entity: 'Config',
      });
    }
  }

  async saveConfig(configData: Config): Promise<Config> {
    try {
      const current = await ConfigModel.findOne();
      if (current) {
        await current.update(configData as any);
        return current.get({ plain: true }) as any as Config;
      } else {
        const created = await ConfigModel.create({ id: uuidv4(), ...(configData as any) });
        return created.get({ plain: true }) as any as Config;
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il salvataggio della configurazione",
        operation: 'update',
        entity: 'Config',
      });
    }
  }

  async caricaStiliInConfig(id: string, stile: string): Promise<void> {
    try {
      const configDoc = await ConfigModel.findOne({ where: { id } });
      if (configDoc == undefined) {
        await ConfigModel.create(
          { id: uuidv4(), webpliant: { css_text: stile, stili: [] } } as any
        );
      } else {
        await ConfigModel.update(
          { webpliant: { css_text: stile, stili: [] } } as any,
          { where: { id } }
        );
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero dei formati",
        operation: 'findOne',
        entity: 'ConfigWebpliant',
      });
    }
  }

  async getConfigWebPliantFromVolantino(): Promise<ConfigWebpliant> {
    try {
      const configWebpliant = await ConfigModel.findOne({ raw: true }) as any as Config;
      const regexBase64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
      if (!regexBase64.test(configWebpliant.webpliant.icona_pagina)) {
        const url = `${config.OLYMPUS_IP_ADDRESS}/foto/getThumbNailOnDemand?guidId=${configWebpliant.webpliant.icona_pagina}`;
        configWebpliant.webpliant.icona_pagina = url;
      }
      return configWebpliant.webpliant;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante l'aggiornamento delle combinazioni di design",
        operation: 'findOne',
        entity: 'ConfigWebpliant',
      });
    }
  }

  async getStiliToText(): Promise<string> {
    try {
      const configDoc = await ConfigModel.findOne({ raw: true }) as any;
      if (configDoc == undefined) {
        return "";
      } else {
        return configDoc.webpliant?.css_text != undefined ? configDoc.webpliant.css_text : "";
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero dei formati",
        operation: 'findOne',
        entity: 'ConfigWebpliant',
      });
    }
  }

  async getColoreDaStile(): Promise<string> {
    try {
      const configDoc = await ConfigModel.findOne({ raw: true }) as any;
      if (configDoc == undefined) {
        return "";
      } else {
        return configDoc.webpliant?.color_gdo ?? "";
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero dei formati",
        operation: 'findOne',
        entity: 'ConfigWebpliant',
      });
    }
  }

  async saveConfigWebPliantFromVolantino(configWebpliant: Config & { id: string }, guidId: string): Promise<any> {
    try {
      const find = await ConfigModel.findOne({ where: { id: configWebpliant.id } });
      if (find == undefined) {
        throw wrapDatabaseError(new Error("Configurazione non trovata"), {
          message: "Configurazione non trovata",
          operation: 'findOne',
          entity: 'ConfigWebpliant',
        });
      }

      // Assicurati che data_fields_refs sia nel formato corretto
      if (configWebpliant.webpliant?.data_fields_refs) {
        configWebpliant.webpliant.data_fields_refs = configWebpliant.webpliant.data_fields_refs.map((item: any) => {
          if (typeof item === 'object' && item.expected_input !== undefined && item.expected_output !== undefined) {
            return {
              expected_input: String(item.expected_input),
              expected_output: String(item.expected_output)
            };
          }
          return item;
        });
      }

      const result = await ConfigModel.update(
        configWebpliant as any,
        { where: { id: configWebpliant.id } }
      );
      return result;
    } catch (error) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il salvataggio della configurazione",
        operation: 'update',
        entity: 'ConfigWebpliant',
      });
    }
  }

  async getAvvisoManutenzione(): Promise<AvvisoManutenzione | null> {
    try {
      const configDoc = await ConfigModel.findOne({ raw: true }) as any;
      return configDoc?.maintenance_alert ?? null;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero dell'avviso di manutenzione",
        operation: 'findOne',
        entity: 'Config',
      });
    }
  }

  async saveAvvisoManutenzione(avviso: AvvisoManutenzione | null): Promise<void> {
    try {
      const current = await ConfigModel.findOne();
      if (current) {
        await current.update({ maintenance_alert: avviso } as any);
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il salvataggio dell'avviso di manutenzione",
        operation: 'update',
        entity: 'Config',
      });
    }
  }

  async getRegoleMenabo(): Promise<RegoleMenabo | null> {
    try {
      const configDoc = await ConfigModel.findOne({ raw: true }) as any;
      return configDoc?.regole_menabo ?? null;
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il recupero delle regole menabò",
        operation: 'findOne',
        entity: 'Config',
      });
    }
  }

  async saveRegoleMenabo(regole: RegoleMenabo | null): Promise<void> {
    try {
      const current = await ConfigModel.findOne();
      if (current) {
        await current.update({ regole_menabo: regole } as any);
      }
    } catch (error: any) {
      throw wrapDatabaseError(error, {
        message: "Errore durante il salvataggio delle regole menabò",
        operation: 'update',
        entity: 'Config',
      });
    }
  }

  async getFlyerInsightsConfig(): Promise<Record<string, any>> {
    const { remember } = await import('../../src/shared/cache/cache.service.js');
    const cwdCandidate = path.join(process.cwd(), 'config', 'flyerInsightsConfig.json');
    const serviceDir = path.dirname(fileURLToPath(import.meta.url));
    const fileRelativeCandidate = path.resolve(serviceDir, '../../../config/flyerInsightsConfig.json');
    const configPath = fs.existsSync(cwdCandidate) ? cwdCandidate : fileRelativeCandidate;

    if (!fs.existsSync(configPath)) {
      throw new NotFoundError({
        message: 'File flyerInsightsConfig.json non trovato',
        entityType: 'FlyerInsightsConfig',
        entityId: configPath,
      });
    }

    const readFromDisk = async (): Promise<Record<string, any>> => {
      const fileContent = await fs.promises.readFile(configPath, 'utf-8');
      return JSON.parse(fileContent) as Record<string, any>;
    };

    try {
      return await remember('config:flyer-insights', 300, readFromDisk);
    } catch (err) {
      log.warn('Redis non disponibile, FlyerInsightsConfig restituito senza cache', { configPath });
      return readFromDisk();
    }
  }

}
