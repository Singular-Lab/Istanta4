import { FlyerInsightsDTO } from '../dto';

export interface IVolantinoService {
  getFlyerInsights(guidIdKitRuntime: string): Promise<FlyerInsightsDTO>;
  prendiIVolantiniCaricatiDaDB(): Promise<any>;
}
