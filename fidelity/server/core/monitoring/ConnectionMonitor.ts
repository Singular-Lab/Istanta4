import { Sequelize } from 'sequelize';
import { log } from '../logger';

/**
 * Pool metrics snapshot
 */
export interface PoolMetrics {
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  totalConnections: number;
  utilizationPercent: number;
  timestamp: Date;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'critical';
  poolUtilization: number;
  activeConnections: number;
  waitingRequests: number;
  responseTimeMs: number;
  message: string;
}

/**
 * Monitor configuration
 */
export interface ConnectionMonitorConfig {
  maxPoolSize: number;
  alertThreshold: number;     // 0–1
  criticalThreshold: number;  // 0–1
  checkIntervalMs: number;
}

/**
 * Default config
 */
const DEFAULT_CONFIG: ConnectionMonitorConfig = {
  maxPoolSize: 20,
  alertThreshold: 0.8,
  criticalThreshold: 0.95,
  checkIntervalMs: 30000
};

export class ConnectionMonitor {
  private metrics: PoolMetrics = {
    activeConnections: 0,
    idleConnections: 0,
    waitingRequests: 0,
    totalConnections: 0,
    utilizationPercent: 0,
    timestamp: new Date()
  };

  private metricsHistory: PoolMetrics[] = [];
  private readonly maxHistorySize = 100;
  private interval: NodeJS.Timeout | null = null;
  private readonly config: ConnectionMonitorConfig;

  constructor(
    private readonly sequelize: Sequelize,
    config: Partial<ConnectionMonitorConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private getPool(): any | null {
    return (this.sequelize as any).connectionManager?.pool ?? null;
  }

  private updateMetricsFromPool(): void {
    const pool = this.getPool();
    if (!pool) return;

    const active = pool.using || 0;
    const idle = pool.available || 0;
    const pending = pool.pending || 0;
    const total = pool.size || active + idle;

    const utilization = active / this.config.maxPoolSize;

    this.metrics = {
      activeConnections: active,
      idleConnections: idle,
      waitingRequests: pending,
      totalConnections: total,
      utilizationPercent: Math.round(utilization * 100),
      timestamp: new Date()
    };

    this.metricsHistory.push({ ...this.metrics });
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    this.checkThresholds(utilization);
  }

  private checkThresholds(utilization: number): void {
    if (utilization >= this.config.criticalThreshold) {
      log.error('CRITICAL: Database connection pool near exhaustion', {
        activeConnections: this.metrics.activeConnections,
        maxPoolSize: this.config.maxPoolSize,
        utilization: `${this.metrics.utilizationPercent}%`
      });
      return;
    }

    if (utilization >= this.config.alertThreshold) {
      log.warn('WARNING: Database connection pool utilization high', {
        activeConnections: this.metrics.activeConnections,
        maxPoolSize: this.config.maxPoolSize,
        utilization: `${this.metrics.utilizationPercent}%`
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  public startMonitoring(): void {
    if (this.interval) return;

    this.interval = setInterval(async () => {
      this.updateMetricsFromPool();

      const health = await this.healthCheck();
      if (health.status !== 'healthy') {
        log.warn('Database health check degraded', { health });
      }
    }, this.config.checkIntervalMs);

    log.info('Connection monitoring started', {
      intervalMs: this.config.checkIntervalMs
    });
  }

  public stopMonitoring(): void {
    if (!this.interval) return;

    clearInterval(this.interval);
    this.interval = null;
    log.info('Connection monitoring stopped');
  }

  public getMetrics(): PoolMetrics {
    return { ...this.metrics };
  }

  public getMetricsHistory(): PoolMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Lightweight health check (non invasivo)
   */
  public async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now();
    let responseTimeMs = 0;

    try {
      // Query minimale, NON authenticate()
      await this.sequelize.query('SELECT 1');
      responseTimeMs = Date.now() - start;
    } catch (error) {
      responseTimeMs = Date.now() - start;

      return {
        status: 'critical',
        poolUtilization: this.metrics.utilizationPercent,
        activeConnections: this.metrics.activeConnections,
        waitingRequests: this.metrics.waitingRequests,
        responseTimeMs,
        message: `Database unreachable: ${(error as Error).message}`
      };
    }

    const utilization = this.metrics.activeConnections / this.config.maxPoolSize;

    let status: HealthCheckResult['status'] = 'healthy';
    let message = 'All systems operational';

    if (utilization >= this.config.criticalThreshold) {
      status = 'critical';
      message = 'Connection pool near exhaustion';
    } else if (utilization >= this.config.alertThreshold) {
      status = 'degraded';
      message = 'High pool utilization';
    } else if (responseTimeMs > 1000) {
      status = 'degraded';
      message = 'Slow database response';
    }
    // Traduzione messaggi in italiano
    if (status === 'critical') {
      message = 'Pool di connessioni quasi esaurito';
    } else if (status === 'degraded') {
      if (utilization >= this.config.alertThreshold) {
        message = 'Utilizzo elevato del pool di connessioni';
      } else if (responseTimeMs > 1000) {
        message = 'Risposta lenta dal database';
      }
    } else {
      message = 'Tutti i sistemi operativi';
    }

    return {
      status,
      poolUtilization: this.metrics.utilizationPercent,
      activeConnections: this.metrics.activeConnections,
      waitingRequests: this.metrics.waitingRequests,
      responseTimeMs,
      message
    };
  }

  /**
   * Average metrics over last N samples
   */
  public getAverageMetrics(windowSize = 10): {
    avgActiveConnections: number;
    avgUtilization: number;
    peakActiveConnections: number;
    peakUtilization: number;
  } {
    const samples = this.metricsHistory.slice(-windowSize);
    if (!samples.length) {
      return {
        avgActiveConnections: 0,
        avgUtilization: 0,
        peakActiveConnections: 0,
        peakUtilization: 0
      };
    }

    const avgActive =
      samples.reduce((s, m) => s + m.activeConnections, 0) / samples.length;

    const avgUtil =
      samples.reduce((s, m) => s + m.utilizationPercent, 0) / samples.length;

    return {
      avgActiveConnections: Number(avgActive.toFixed(2)),
      avgUtilization: Number(avgUtil.toFixed(2)),
      peakActiveConnections: Math.max(...samples.map(m => m.activeConnections)),
      peakUtilization: Math.max(...samples.map(m => m.utilizationPercent))
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let instance: ConnectionMonitor | null = null;

export const initializeConnectionMonitor = (
  sequelize: Sequelize,
  config?: Partial<ConnectionMonitorConfig>
): ConnectionMonitor => {
  if (!instance) {
    instance = new ConnectionMonitor(sequelize, config);
  }
  return instance;
};

export const getConnectionMonitor = (): ConnectionMonitor | null => instance;

export default ConnectionMonitor;
