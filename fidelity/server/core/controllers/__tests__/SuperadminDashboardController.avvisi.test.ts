import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';

// Gli avvisi della dashboard Superadmin che parlano della lavorazione portano ad Avanzamento
// produzione: le viste Volantini mostrano solo i materiali pubblicati, senza stati di lavorazione.

vi.mock('../../middleware/authMiddleware', () => ({
  authMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../middleware/permissionGuard', () => ({
  permissionGuard: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock('../../logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../db/SequelizeConnector', () => ({ sequelize: {} }));
vi.mock('../../monitoring', () => ({ getConnectionMonitor: vi.fn() }));
vi.mock('../../../ws-server', () => ({ getIO: vi.fn(), isIOInitialized: () => false }));
vi.mock('../../services/AuditLogService', () => ({
  AuditLogService: { getInstance: vi.fn() },
  AuditSeverity: { CRITICAL: 'CRITICAL', HIGH: 'HIGH' },
}));

import { SuperadminDashboardController } from '../SuperadminDashboardController';

interface Avviso {
  id: string;
  actions: Array<{ label: string; href: string }>;
}

type ConAvvisi = {
  buildActionableAlerts: (database: unknown, audit: unknown, onlineUsers: unknown, recentErrors: unknown[]) => Avviso[];
};

const avvisi = (responseTimeMs: number, errori: number): Avviso[] =>
  (new SuperadminDashboardController() as unknown as ConAvvisi).buildActionableAlerts(
    { health: { responseTimeMs }, metrics: { utilizationPercent: 0, waitingRequests: 0 } },
    { suspiciousActivities: 0, failedLogins: 0 },
    { wsConnections: 0, activeSessions: 0 },
    Array.from({ length: errori }, () => ({}))
  );

describe('avvisi della dashboard Superadmin', () => {
  it('latenza critica del database ed errori recenti portano ad Avanzamento produzione, non ai volantini', () => {
    const elenco = avvisi(1600, 3);
    const azioni = (id: string) => elenco.find(avviso => avviso.id === id)?.actions.map(azione => azione.href);

    expect(azioni('db-response-time-critical')).toEqual(['/superadmin/dashboard', '/avanzamento-produzione']);
    expect(azioni('operational-recent-errors-medium')).toEqual(['/superadmin/dashboard', '/avanzamento-produzione']);
    expect(elenco.flatMap(avviso => avviso.actions).some(azione => azione.href.startsWith('/volantini'))).toBe(false);
  });
});
