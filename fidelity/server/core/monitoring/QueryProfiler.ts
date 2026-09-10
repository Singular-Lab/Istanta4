import { QueryTypes, Sequelize } from 'sequelize';
import { log } from '../logger';

/**
 * Profiles database queries to identify slow queries and performance bottlenecks.
 */

export interface QueryMetric {
  sql: string;
  duration: number;
  timestamp: Date;
  type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  table?: string;
}

export interface SlowQuery {
  query: string;
  calls: number;
  totalTime: number;
  meanTime: number;
  maxTime: number;
  minTime: number;
}

export interface QueryProfilerConfig {
  slowQueryThresholdMs: number;
  maxStoredQueries: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn';
}

const DEFAULT_CONFIG: QueryProfilerConfig = {
  slowQueryThresholdMs: 100,
  maxStoredQueries: 1000,
  enableLogging: true,
  logLevel: 'warn'
};

export class QueryProfiler {
  private queryHistory: QueryMetric[] = [];
  private slowQueries: Map<string, SlowQuery> = new Map();
  private config: QueryProfilerConfig;
  private originalQuery: typeof Sequelize.prototype.query | null = null;

  constructor(
    private sequelize: Sequelize,
    config: Partial<QueryProfilerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Starts profiling queries by wrapping Sequelize's query method
   */
  public startProfiling(): void {
    if (this.originalQuery) {
      log.warn('Query profiling already active');
      return;
    }

    // Store original query method
    this.originalQuery = this.sequelize.query.bind(this.sequelize);

    // Wrap query method
    (this.sequelize as any).query = async (sqlOrOptions: any, options?: any) => {
      const start = process.hrtime.bigint();
      const sqlText = this.normalizeInputQuery(sqlOrOptions);

      try {
        const result = await this.originalQuery!(sqlOrOptions, options);
        const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms

        this.recordQuery(sqlText, duration);
        return result;
      } catch (error) {
        const duration = Number(process.hrtime.bigint() - start) / 1e6;
        this.recordQuery(sqlText, duration, true);
        throw error;
      }
    };

    log.info('Query profiling started', {
      slowQueryThresholdMs: this.config.slowQueryThresholdMs
    });
  }

  /**
   * Stops profiling queries
   */
  public stopProfiling(): void {
    if (this.originalQuery) {
      (this.sequelize as any).query = this.originalQuery;
      this.originalQuery = null;
      log.info('Query profiling stopped');
    }
  }

  /**
   * Records a query execution
   */
  private recordQuery(sql: string, duration: number, isError: boolean = false): void {
    const queryType = this.getQueryType(sql);
    const table = this.extractTableName(sql);
    const normalizedSql = this.normalizeQuery(sql);

    const metric: QueryMetric = {
      sql: normalizedSql,
      duration,
      timestamp: new Date(),
      type: queryType,
      table
    };

    // Store in history
    this.queryHistory.push(metric);
    if (this.queryHistory.length > this.config.maxStoredQueries) {
      this.queryHistory.shift();
    }

    // Track slow queries
    if (duration >= this.config.slowQueryThresholdMs) {
      this.trackSlowQuery(normalizedSql, duration);

      if (this.config.enableLogging) {
        const logFn = this.config.logLevel === 'debug' ? log.debug :
          this.config.logLevel === 'info' ? log.info : log.warn;

        logFn.call(log, `Slow query detected (${duration.toFixed(2)}ms)`, {
          duration: `${duration.toFixed(2)}ms`,
          type: queryType,
          table,
          query: sql.substring(0, 200) + (sql.length > 200 ? '...' : '')
        });
      }
    }
  }

  /**
   * Safely extracts the SQL string from Sequelize query invocations
   */
  private normalizeInputQuery(sqlOrOptions: unknown): string {
    if (typeof sqlOrOptions === 'string') {
      return sqlOrOptions;
    }

    if (sqlOrOptions && typeof sqlOrOptions === 'object') {
      const query = (sqlOrOptions as { query?: string }).query;
      if (typeof query === 'string') {
        return query;
      }
      try {
        return JSON.stringify(sqlOrOptions);
      } catch {
        return '[object QueryObject]';
      }
    }

    return String(sqlOrOptions ?? '');
  }

  /**
   * Tracks a slow query for aggregation
   */
  private trackSlowQuery(normalizedSql: string, duration: number): void {
    const existing = this.slowQueries.get(normalizedSql);

    if (existing) {
      existing.calls++;
      existing.totalTime += duration;
      existing.meanTime = existing.totalTime / existing.calls;
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.minTime = Math.min(existing.minTime, duration);
    } else {
      this.slowQueries.set(normalizedSql, {
        query: normalizedSql,
        calls: 1,
        totalTime: duration,
        meanTime: duration,
        maxTime: duration,
        minTime: duration
      });
    }
  }

  /**
   * Determines the type of SQL query
   */
  private getQueryType(sql: string): QueryMetric['type'] {
    const upperSql = sql.trim().toUpperCase();
    if (upperSql.startsWith('SELECT')) return 'SELECT';
    if (upperSql.startsWith('INSERT')) return 'INSERT';
    if (upperSql.startsWith('UPDATE')) return 'UPDATE';
    if (upperSql.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  /**
   * Extracts the table name from a SQL query
   */
  private extractTableName(sql: string): string | undefined {
    const patterns = [
      /FROM\s+["']?(\w+)["']?/i,
      /INTO\s+["']?(\w+)["']?/i,
      /UPDATE\s+["']?(\w+)["']?/i,
      /DELETE\s+FROM\s+["']?(\w+)["']?/i
    ];

    for (const pattern of patterns) {
      const match = sql.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return undefined;
  }

  /**
   * Normalizes a SQL query by replacing literal values with placeholders
   */
  private normalizeQuery(sql: string): string {
    return sql
      .replace(/\d+/g, '?')
      .replace(/'[^']*'/g, '?')
      .replace(/"[^"]*"/g, '?')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Gets recent query metrics
   */
  public getRecentQueries(limit: number = 50): QueryMetric[] {
    return this.queryHistory.slice(-limit);
  }

  /**
   * Gets slow query aggregations sorted by total time
   */
  public getSlowQueries(limit: number = 20): SlowQuery[] {
    return Array.from(this.slowQueries.values())
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, limit);
  }

  /**
   * Gets query statistics
   */
  public getStatistics(): {
    totalQueries: number;
    slowQueries: number;
    avgDuration: number;
    maxDuration: number;
    queriesByType: Record<string, number>;
    queriesByTable: Record<string, number>;
  } {
    const stats = {
      totalQueries: this.queryHistory.length,
      slowQueries: this.slowQueries.size,
      avgDuration: 0,
      maxDuration: 0,
      queriesByType: {} as Record<string, number>,
      queriesByTable: {} as Record<string, number>
    };

    if (this.queryHistory.length === 0) {
      return stats;
    }

    let totalDuration = 0;
    for (const metric of this.queryHistory) {
      totalDuration += metric.duration;
      stats.maxDuration = Math.max(stats.maxDuration, metric.duration);

      // Count by type
      stats.queriesByType[metric.type] = (stats.queriesByType[metric.type] || 0) + 1;

      // Count by table
      if (metric.table) {
        stats.queriesByTable[metric.table] = (stats.queriesByTable[metric.table] || 0) + 1;
      }
    }

    stats.avgDuration = Math.round((totalDuration / this.queryHistory.length) * 100) / 100;
    stats.maxDuration = Math.round(stats.maxDuration * 100) / 100;

    return stats;
  }

  /**
   * Clears stored query metrics
   */
  public clearMetrics(): void {
    this.queryHistory = [];
    this.slowQueries.clear();
    log.info('Query profiler metrics cleared');
  }

  /**
   * Analyzes query and provides EXPLAIN output (PostgreSQL specific)
   */
  public async explainQuery(sql: string): Promise<any[]> {
    try {
      const results = await this.sequelize.query<any[]>(
        `EXPLAIN ANALYZE ${sql}`,
        { type: QueryTypes.SELECT }
      );
      return results;
    } catch (error) {
      log.error('Failed to explain query', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Gets slow queries from pg_stat_statements (if available)
   */
  public async getSlowQueriesFromDb(thresholdMs: number = 100, limit: number = 20): Promise<any[]> {
    try {
      const results = await this.sequelize.query<any[]>(`
        SELECT
          query,
          calls,
          round(total_exec_time::numeric, 2) as total_time_ms,
          round(mean_exec_time::numeric, 2) as mean_time_ms,
          round(max_exec_time::numeric, 2) as max_time_ms,
          rows
        FROM pg_stat_statements
        WHERE mean_exec_time > :threshold
        ORDER BY total_exec_time DESC
        LIMIT :limit
      `, {
        replacements: { threshold: thresholdMs, limit },
        type: QueryTypes.SELECT
      });
      return results;
    } catch (error) {
      // pg_stat_statements might not be installed
      log.debug('pg_stat_statements not available', { error: (error as Error).message });
      return [];
    }
  }

  /**
   * Gets query statistics by table
   */
  public getTableStats(): {
    table: string;
    queryCount: number;
    avgDuration: number;
    totalDuration: number;
  }[] {
    const tableStats = new Map<string, { count: number; totalDuration: number }>();

    for (const metric of this.queryHistory) {
      if (metric.table) {
        const existing = tableStats.get(metric.table) || { count: 0, totalDuration: 0 };
        existing.count++;
        existing.totalDuration += metric.duration;
        tableStats.set(metric.table, existing);
      }
    }

    return Array.from(tableStats.entries())
      .map(([table, stats]) => ({
        table,
        queryCount: stats.count,
        avgDuration: Math.round((stats.totalDuration / stats.count) * 100) / 100,
        totalDuration: Math.round(stats.totalDuration * 100) / 100
      }))
      .sort((a, b) => b.totalDuration - a.totalDuration);
  }
}

// Singleton instance
let queryProfilerInstance: QueryProfiler | null = null;

export const initializeQueryProfiler = (
  sequelize: Sequelize,
  config?: Partial<QueryProfilerConfig>
): QueryProfiler => {
  if (!queryProfilerInstance) {
    queryProfilerInstance = new QueryProfiler(sequelize, config);
  }
  return queryProfilerInstance;
};

export const getQueryProfiler = (): QueryProfiler | null => {
  return queryProfilerInstance;
};

export default QueryProfiler;
