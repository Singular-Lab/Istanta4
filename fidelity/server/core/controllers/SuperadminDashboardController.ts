import { Request, Response } from 'express';
import { HttpStatusCode, TIPO_UTENTI } from '../../../lib/enums';
import { BaseController } from '../base/BaseController';
import { sequelize } from '../db/SequelizeConnector';
import { authMiddleware } from '../middleware/authMiddleware';
import { userRoleGuard } from '../middleware/userRoleGuard';
import { getConnectionMonitor } from '../monitoring';
import { AuditLogService, AuditSeverity } from '../services/AuditLogService';
import { getIO, isIOInitialized } from '../../ws-server';

type DashboardAlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type DashboardAlertStatus = 'NUOVO' | 'ACK' | 'RISOLTO';
type DashboardAlertSource = 'DATABASE' | 'SICUREZZA' | 'OPERATIVO' | 'SESSIONI';

interface DashboardAlertAction {
    label: string;
    href: string;
    variant: 'primary' | 'secondary' | 'danger';
}

interface DashboardAlert {
    id: string;
    title: string;
    description: string;
    severity: DashboardAlertSeverity;
    status: DashboardAlertStatus;
    source: DashboardAlertSource;
    metricValue?: number;
    threshold?: number;
    createdAt: string;
    actions: DashboardAlertAction[];
}

export class SuperadminDashboardController extends BaseController {
    constructor() {
        super('/api/superadmin-dashboard');
    }

    protected setupRoutes(): void {
        this.router.get(
            '/overview',
            authMiddleware,
            userRoleGuard([TIPO_UTENTI.SUPERADMIN]),
            this.getOverview.bind(this)
        );
    }

    private async getOverview(_req: Request, res: Response): Promise<void> {
        try {
            const [database, audit, onlineUsers, recentErrors] = await Promise.all([
                this.getDatabaseHealth(),
                this.getAuditMetrics(),
                this.getOnlineUsers(),
                this.getRecentErrors(),
            ]);
            const alerts = this.buildActionableAlerts(database, audit, onlineUsers, recentErrors);

            this.sendResponse(res, HttpStatusCode.OK, {
                database,
                audit,
                onlineUsers,
                recentErrors,
                alerts,
            });
        } catch (error) {
            this.handleError(res, error);
        }
    }

    private async getDatabaseHealth() {
        const monitor = getConnectionMonitor();
        if (!monitor) {
            return {
                health: {
                    status: 'critical' as const,
                    poolUtilization: 0,
                    activeConnections: 0,
                    waitingRequests: 0,
                    responseTimeMs: 0,
                    message: 'Connection monitor non inizializzato',
                },
                metrics: {
                    activeConnections: 0,
                    idleConnections: 0,
                    waitingRequests: 0,
                    totalConnections: 0,
                    utilizationPercent: 0,
                    timestamp: new Date(),
                },
                averages: {
                    avgActiveConnections: 0,
                    avgUtilization: 0,
                    peakActiveConnections: 0,
                    peakUtilization: 0,
                },
            };
        }

        const [health, metrics, averages] = await Promise.all([
            monitor.healthCheck(),
            Promise.resolve(monitor.getMetrics()),
            Promise.resolve(monitor.getAverageMetrics()),
        ]);
        const history = monitor.getMetricsHistory();

        return { health, metrics, averages, history };
    }

    private getAuditMetrics() {
        return AuditLogService.getInstance().getMetrics();
    }

    private async getOnlineUsers(): Promise<{ activeSessions: number; wsConnections: number }> {
        let activeSessions = 0;
        let wsConnections = 0;

        try {
            const [results] = await sequelize.query(
                `SELECT COUNT(*) as count FROM sessions WHERE expire > NOW()`
            );
            activeSessions = parseInt((results as any)[0]?.count ?? '0', 10);
        } catch {
            activeSessions = 0;
        }

        try {
            if (isIOInitialized()) {
                const io = getIO();
                wsConnections = io.engine?.clientsCount ?? 0;
            }
        } catch {
            wsConnections = 0;
        }

        return { activeSessions, wsConnections };
    }

    private getRecentErrors() {
        const auditService = AuditLogService.getInstance();
        const criticalEvents = auditService.getEventsBySeverity(AuditSeverity.CRITICAL, 20);
        const highEvents = auditService.getEventsBySeverity(AuditSeverity.HIGH, 20);

        return [...criticalEvents, ...highEvents]
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            .slice(0, 30);
    }

    private buildActionableAlerts(
        database: Awaited<ReturnType<SuperadminDashboardController['getDatabaseHealth']>>,
        audit: Awaited<ReturnType<SuperadminDashboardController['getAuditMetrics']>>,
        onlineUsers: Awaited<ReturnType<SuperadminDashboardController['getOnlineUsers']>>,
        recentErrors: Awaited<ReturnType<SuperadminDashboardController['getRecentErrors']>>,
    ): DashboardAlert[] {
        const alerts: DashboardAlert[] = [];
        const now = new Date().toISOString();

        const pushAlert = (alert: Omit<DashboardAlert, 'createdAt' | 'status'> & { status?: DashboardAlertStatus }) => {
            alerts.push({
                ...alert,
                status: alert.status ?? 'NUOVO',
                createdAt: now,
            });
        };

        const poolUtilization = database.metrics.utilizationPercent;
        if (poolUtilization >= 90) {
            pushAlert({
                id: 'db-pool-utilization-critical',
                title: 'Utilizzo pool DB critico',
                description: `Il pool connessioni è al ${poolUtilization}% (soglia 90%).`,
                severity: 'CRITICAL',
                source: 'DATABASE',
                metricValue: poolUtilization,
                threshold: 90,
                actions: [
                    { label: 'Vedi stato database', href: '/superadmin/dashboard', variant: 'danger' },
                    { label: 'Apri dashboard operativa', href: '/gdo/dashboard', variant: 'secondary' },
                ],
            });
        } else if (poolUtilization >= 80) {
            pushAlert({
                id: 'db-pool-utilization-high',
                title: 'Utilizzo pool DB alto',
                description: `Il pool connessioni è al ${poolUtilization}% (soglia 80%).`,
                severity: 'HIGH',
                source: 'DATABASE',
                metricValue: poolUtilization,
                threshold: 80,
                actions: [
                    { label: 'Vedi stato database', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Controlla carico operativo', href: '/gdo/dashboard', variant: 'secondary' },
                ],
            });
        }

        const waitingRequests = database.metrics.waitingRequests;
        if (waitingRequests >= 5) {
            pushAlert({
                id: 'db-waiting-requests-high',
                title: 'Code DB in attesa',
                description: `${waitingRequests} richieste in attesa sul pool connessioni.`,
                severity: 'HIGH',
                source: 'DATABASE',
                metricValue: waitingRequests,
                threshold: 5,
                actions: [
                    { label: 'Apri dashboard superadmin', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Verifica promozioni in corso', href: '/promozioni/in-corso', variant: 'secondary' },
                ],
            });
        }

        const responseTimeMs = database.health.responseTimeMs;
        if (responseTimeMs >= 1500) {
            pushAlert({
                id: 'db-response-time-critical',
                title: 'Latenza database critica',
                description: `Tempo risposta DB ${responseTimeMs} ms (soglia 1500 ms).`,
                severity: 'CRITICAL',
                source: 'DATABASE',
                metricValue: responseTimeMs,
                threshold: 1500,
                actions: [
                    { label: 'Apri stato sistema', href: '/superadmin/dashboard', variant: 'danger' },
                    { label: 'Controlla materiali in corso', href: '/materiali-in-corso', variant: 'secondary' },
                ],
            });
        } else if (responseTimeMs >= 800) {
            pushAlert({
                id: 'db-response-time-high',
                title: 'Latenza database elevata',
                description: `Tempo risposta DB ${responseTimeMs} ms (soglia 800 ms).`,
                severity: 'HIGH',
                source: 'DATABASE',
                metricValue: responseTimeMs,
                threshold: 800,
                actions: [
                    { label: 'Apri stato sistema', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Controlla dashboard operativa', href: '/gdo/dashboard', variant: 'secondary' },
                ],
            });
        }

        if (audit.suspiciousActivities > 0) {
            pushAlert({
                id: 'security-suspicious-activity',
                title: 'Attività sospette rilevate',
                description: `${audit.suspiciousActivities} eventi sospetti registrati nel periodo corrente.`,
                severity: 'CRITICAL',
                source: 'SICUREZZA',
                metricValue: audit.suspiciousActivities,
                threshold: 1,
                actions: [
                    { label: 'Verifica permessi', href: '/gestione-permessi', variant: 'danger' },
                    { label: 'Controlla utenti', href: '/gestione-utenti', variant: 'secondary' },
                ],
            });
        }

        if (audit.failedLogins >= 20) {
            pushAlert({
                id: 'security-failed-logins-high',
                title: 'Picco login falliti',
                description: `${audit.failedLogins} login falliti rilevati (soglia 20).`,
                severity: 'HIGH',
                source: 'SICUREZZA',
                metricValue: audit.failedLogins,
                threshold: 20,
                actions: [
                    { label: 'Apri gestione utenti', href: '/gestione-utenti', variant: 'primary' },
                    { label: 'Verifica permessi', href: '/gestione-permessi', variant: 'secondary' },
                ],
            });
        } else if (audit.failedLogins >= 8) {
            pushAlert({
                id: 'security-failed-logins-medium',
                title: 'Login falliti sopra soglia',
                description: `${audit.failedLogins} login falliti rilevati (soglia 8).`,
                severity: 'MEDIUM',
                source: 'SICUREZZA',
                metricValue: audit.failedLogins,
                threshold: 8,
                actions: [
                    { label: 'Apri gestione utenti', href: '/gestione-utenti', variant: 'primary' },
                    { label: 'Verifica sessioni attive', href: '/superadmin/dashboard', variant: 'secondary' },
                ],
            });
        }

        if (recentErrors.length >= 10) {
            pushAlert({
                id: 'operational-recent-errors-high',
                title: 'Volume errori elevato',
                description: `${recentErrors.length} eventi HIGH/CRITICAL negli ultimi record monitorati.`,
                severity: 'HIGH',
                source: 'OPERATIVO',
                metricValue: recentErrors.length,
                threshold: 10,
                actions: [
                    { label: 'Apri ultimi errori', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Controlla promo in corso', href: '/promozioni/in-corso', variant: 'secondary' },
                ],
            });
        } else if (recentErrors.length >= 3) {
            pushAlert({
                id: 'operational-recent-errors-medium',
                title: 'Errori recenti da verificare',
                description: `${recentErrors.length} eventi HIGH/CRITICAL presenti negli ultimi record.`,
                severity: 'MEDIUM',
                source: 'OPERATIVO',
                metricValue: recentErrors.length,
                threshold: 3,
                actions: [
                    { label: 'Apri ultimi errori', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Vai a materiali in corso', href: '/materiali-in-corso', variant: 'secondary' },
                ],
            });
        }

        const wsConnections = onlineUsers.wsConnections;
        const activeSessions = onlineUsers.activeSessions;
        if (activeSessions > 0 && wsConnections > activeSessions * 3) {
            pushAlert({
                id: 'sessions-ws-anomaly',
                title: 'Anomalia connessioni WebSocket',
                description: `${wsConnections} socket attivi su ${activeSessions} sessioni utente.`,
                severity: 'MEDIUM',
                source: 'SESSIONI',
                metricValue: wsConnections,
                threshold: activeSessions * 3,
                actions: [
                    { label: 'Apri stato sistema', href: '/superadmin/dashboard', variant: 'primary' },
                    { label: 'Verifica utenti online', href: '/gestione-utenti', variant: 'secondary' },
                ],
            });
        }

        const severityWeight: Record<DashboardAlertSeverity, number> = {
            CRITICAL: 4,
            HIGH: 3,
            MEDIUM: 2,
            LOW: 1,
        };

        return alerts.sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity]);
    }
}
