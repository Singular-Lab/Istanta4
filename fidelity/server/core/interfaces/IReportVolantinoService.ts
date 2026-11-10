import type { Request } from 'express';
import type { ReportVolantino } from '../../../lib/insightVolantino/report';
import type { AmbitoGdo } from '../accessi/contestoAccesso';

/**
 * Report PDF del volantino (contratto in lib/insightVolantino/report.ts): dati e sezioni composti
 * con la libreria agenzia del cliente; il PDF lo disegna il browser. Stesso ambito GDO degli
 * insight: un kit di un'altra GDO risponde 404.
 */
export interface IReportVolantinoService {
  /** La richiesta, facoltativa, serve al catalogo dei loghi delle linee del distributore. */
  report(idKit: string, ambito: AmbitoGdo, richiesta?: Request): Promise<ReportVolantino>;
}
