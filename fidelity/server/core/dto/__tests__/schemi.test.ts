import { describe, expect, it } from 'vitest';
import { AuditLogFilterSchema } from '../AuditLogDTO';

// Il beacon HTTP del plugin e i filtri delle statistiche del plugin sono stati rimossi con
// PluginAnalyticsController (mai registrato): gli eventi arrivano solo dal WebSocket.

describe('filtri da query string', () => {
  it('applicano i default e convertono i numeri', () => {
    expect(AuditLogFilterSchema.parse({})).toMatchObject({ page: 1, limit: 50, sortBy: 'createdat', sortOrder: 'DESC' });
    expect(AuditLogFilterSchema.parse({ page: '3', limit: '20' })).toMatchObject({ page: 3, limit: 20 });
  });

  it('rifiutano valori fuori dai limiti', () => {
    const esito = AuditLogFilterSchema.safeParse({ limit: '500', userId: 'non-uuid' });

    expect(esito.success).toBe(false);
    expect(Object.keys(esito.error!.flatten().fieldErrors).sort()).toEqual(['limit', 'userId']);
  });
});
