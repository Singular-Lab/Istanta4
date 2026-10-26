import { describe, expect, it } from 'vitest';
import { AuditLogFilterSchema } from '../AuditLogDTO';
import { BeaconPayloadSchema, PluginAnalyticsFiltersSchema } from '../PluginAnalyticsDTO';

const evento = (i: number) => ({
  eventId: `e-${i}`,
  type: 'view',
  timestamp: '2026-10-26T09:00:00Z',
  slug: 'banner',
  pageOrigin: 'https://example.test',
  sessionId: 's-1',
  data: { posizione: i },
});

describe('beacon del plugin', () => {
  it('accetta un lotto valido e completa i campi facoltativi', () => {
    const esito = BeaconPayloadSchema.parse({ type: 'events:batch', events: [evento(1)] });

    expect(esito.events[0].fpVersion).toBe('');
    expect(esito.events[0].data).toEqual({ posizione: 1 });
  });

  it('rifiuta un lotto con più di 100 eventi', () => {
    const events = Array.from({ length: 101 }, (_, i) => evento(i));

    expect(BeaconPayloadSchema.safeParse({ type: 'events:batch', events }).success).toBe(false);
  });
});

describe('filtri da query string', () => {
  it('applicano i default e convertono i numeri', () => {
    expect(PluginAnalyticsFiltersSchema.parse({ page: '3' })).toMatchObject({
      page: 3, pageSize: 25, sortBy: 'timestamp_event', sortOrder: 'DESC',
    });
    expect(AuditLogFilterSchema.parse({})).toMatchObject({ page: 1, limit: 50, sortBy: 'createdat', sortOrder: 'DESC' });
  });

  it('rifiutano valori fuori dai limiti', () => {
    const esito = AuditLogFilterSchema.safeParse({ limit: '500', userId: 'non-uuid' });

    expect(esito.success).toBe(false);
    expect(Object.keys(esito.error!.flatten().fieldErrors).sort()).toEqual(['limit', 'userId']);
  });
});
