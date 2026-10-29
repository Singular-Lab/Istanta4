// ---- Response DTOs ----

export interface PluginAnalyticsMonitorDTO {
  activeConnections: number;
  totalEventsReceived: number;
  totalEventsPersisted: number;
  totalErrors: number;
  eventsPerSecond: number;
  queueSize: number;
  lastFlushTime: string | null;
}
