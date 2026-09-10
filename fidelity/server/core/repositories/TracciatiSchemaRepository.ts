import type { TracciatiSchemaAttributes } from '../models/tracciati_schema';
import { TracciatiSchema } from '../models/tracciati_schema';
import { BaseRepository } from './BaseRepository';
import type { IBaseRepository } from './IBaseRepository';

type TracciatiSchemaInstance = InstanceType<typeof TracciatiSchema>;

export interface ITracciatiSchemaRepository
  extends IBaseRepository<TracciatiSchemaInstance, string> {}

export class TracciatiSchemaRepository
  extends BaseRepository<TracciatiSchemaInstance, TracciatiSchemaAttributes, string>
  implements ITracciatiSchemaRepository {

  constructor() {
    super(TracciatiSchema, 'id');
  }
}
