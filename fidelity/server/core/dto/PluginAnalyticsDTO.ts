import { z } from 'zod';

// ---- Beacon Payload (sendBeacon fallback) ----

const PluginAnalyticsEventSchema = z.object({
  eventId: z.string().max(36),
  type: z.string().max(50),
  timestamp: z.string(),
  slug: z.string().max(100),
  fpVersion: z.string().max(20).optional().default(''),
  pageOrigin: z.string().max(255),
  pagePath: z.string().max(500).optional().default(''),
  sessionId: z.string().max(36),
  data: z.record(z.unknown()).optional().nullable(),
});

export const BeaconPayloadSchema = z.object({
  type: z.literal('events:batch'),
  events: z.array(PluginAnalyticsEventSchema).max(100),
});

export type BeaconPayloadDTO = z.infer<typeof BeaconPayloadSchema>;

// ---- Filtri per query eventi (admin endpoints) ----

export const PluginAnalyticsFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  slug: z.string().optional(),
  eventType: z.string().optional(),
  sessionId: z.string().optional(),
  pageOrigin: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['timestamp_event', 'event_type', 'slug', 'created_at']).default('timestamp_event'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
});

export type PluginAnalyticsFiltersDTO = z.infer<typeof PluginAnalyticsFiltersSchema>;

// ---- Response DTOs ----

export interface PluginAnalyticsAggregateDTO {
  totalEvents: number;
  uniqueSessions: number;
  uniqueSlugs: number;
  uniqueOrigins: number;
  eventsByType: Array<{ event_type: string; count: number }>;
  eventsBySlug: Array<{ slug: string; count: number }>;
  eventsByDay: Array<{ date: string; count: number }>;
  topOrigins: Array<{ page_origin: string; count: number }>;
}

export interface PluginAnalyticsMonitorDTO {
  activeConnections: number;
  totalEventsReceived: number;
  totalEventsPersisted: number;
  totalErrors: number;
  eventsPerSecond: number;
  queueSize: number;
  lastFlushTime: string | null;
}
