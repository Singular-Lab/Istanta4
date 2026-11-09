import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { FlyerInsightsDTO } from '../dto';

export interface IVolantinoService {
  /**
   * Gli insight del volantino, solo se il kit e' della GDO dell'ambito (predefinito: tutte):
   * un kit di un'altra GDO risponde 404 come un kit inesistente.
   */
  getFlyerInsights(guidIdKitRuntime: string, ambito?: AmbitoGdo): Promise<FlyerInsightsDTO>;
  prendiIVolantiniCaricatiDaDB(): Promise<any>;
}
