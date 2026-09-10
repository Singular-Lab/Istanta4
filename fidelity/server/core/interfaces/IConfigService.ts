import { TIPO_UTENTI } from "../../../lib/enums";
import { AvvisoManutenzione, Config, ConfigWebpliant, Dashboard, RegoleMenabo } from "../../../lib/types";

export interface IConfigService {
    getStiliToText(): Promise<string>;
    get_config(): Promise<Config>;
    saveConfig(config: Config): Promise<Config>;
    caricaStiliInConfig(id: string, stili: string): Promise<any>;
    getConfigWebPliantFromVolantino(): Promise<ConfigWebpliant>;
    getColoreDaStile(): Promise<string>;
    saveConfigWebPliantFromVolantino(config: Config, guidId: string): Promise<any>;
    saveDashBoardConfig(dashboard: Dashboard, role: TIPO_UTENTI): Promise<any>;
    getDashBoardConfig(role: TIPO_UTENTI): Promise<Dashboard>;
    getPluginRegistry(): Promise<any[]>;
    getFlyerInsightsConfig(): Promise<Record<string, any>>;
    getAvvisoManutenzione(): Promise<AvvisoManutenzione | null>;
    saveAvvisoManutenzione(avviso: AvvisoManutenzione | null): Promise<void>;
    getRegoleMenabo(): Promise<RegoleMenabo | null>;
    saveRegoleMenabo(regole: RegoleMenabo | null): Promise<void>;
} 
