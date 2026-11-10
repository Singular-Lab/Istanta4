import type { Request } from 'express';
import type { AmbitoGdo } from '../accessi/contestoAccesso';
import { FlyerInsightsDTO } from '../dto';

export interface IVolantinoService {
  /**
   * Gli insight del volantino, solo se il kit e' della GDO dell'ambito (predefinito: tutte):
   * un kit di un'altra GDO risponde 404 come un kit inesistente. La richiesta, facoltativa, serve a
   * leggere da Istanta il catalogo dei loghi delle linee del distributore.
   */
  getFlyerInsights(guidIdKitRuntime: string, ambito?: AmbitoGdo, richiesta?: Request): Promise<FlyerInsightsDTO>;
  prendiIVolantiniCaricatiDaDB(): Promise<any>;
}
