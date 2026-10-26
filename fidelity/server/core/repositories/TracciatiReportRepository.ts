import type { TracciatiReportAttributes } from '../models/tracciati_report';
import { TracciatiReport } from '../models/tracciati_report';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type TracciatiReportInstance = InstanceType<typeof TracciatiReport>;

export interface ITracciatiReportRepository
  extends IBaseRepository<TracciatiReportInstance, string> {
  findByPromoId(idPromo: string): Promise<TracciatiReportInstance[]>;
}

export class TracciatiReportRepository
  extends BaseRepository<TracciatiReportInstance, TracciatiReportAttributes, string>
  implements ITracciatiReportRepository {

  constructor() {
    super(TracciatiReport, 'id');
  }

  async findByPromoId(idPromo: string): Promise<TracciatiReportInstance[]> {
    return this.model.findAll({
      where: { id_promo: idPromo } as any,
      order: [['createdat', 'DESC']],
    });
  }
}
