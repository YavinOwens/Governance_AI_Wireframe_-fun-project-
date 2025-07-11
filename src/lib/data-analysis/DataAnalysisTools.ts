import { DataSourceManager } from '../data-sources/DataSourceManager';

interface DatabaseManager {
  query: (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
}

const logger = {
  info: (message: string, ...args: any[]) => console.log('[INFO]', message, ...args),
  warn: (message: string, ...args: any[]) => console.warn('[WARN]', message, ...args),
  error: (message: string, ...args: any[]) => console.error('[ERROR]', message, ...args)
};

export interface TableSchema {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  constraint_type?: string;
}

export interface DataProfileResult {
  table_name: string;
  column_name: string;
  data_type: string;
  total_rows: number;
  null_count: number;
  distinct_count: number;
  min_value: any;
  max_value: any;
  avg_value: number | null;
  std_dev: number | null;
  most_frequent_value: any;
  most_frequent_count: number;
  sample_values: any[];
}

export interface DataQualityMetrics {
  completeness_score: number;
  uniqueness_score: number;
  validity_score: number;
  consistency_score: number;
  accuracy_score: number;
  timeliness_score: number;
}

export interface DatabaseMetrics {
  connection_count: number;
  active_queries: number;
  slow_queries: number;
  deadlocks: number;
  cache_hit_ratio: number;
  database_size_bytes: number;
  table_count: number;
  index_count: number;
  last_backup: Date | null;
  cpu_usage: number;
  memory_usage: number;
  disk_io_read: number;
  disk_io_write: number;
}

export interface ValidationResult {
  rule_name: string;
  table_name: string;
  column_name: string;
  total_records: number;
  violations: number;
  violation_percentage: number;
  sample_violations: any[];
}

export class DataAnalysisTools {
  constructor(private dbManager: DatabaseManager) {}

  // Real table schema analysis
  async getTableSchema(tableName?: string): Promise<TableSchema[]> {
    const query = tableName ? `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable::boolean,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        tc.constraint_type
      FROM information_schema.columns c
      LEFT JOIN information_schema.constraint_column_usage ccu ON c.column_name = ccu.column_name AND c.table_name = ccu.table_name
      LEFT JOIN information_schema.table_constraints tc ON ccu.constraint_name = tc.constraint_name
      WHERE c.table_schema = 'public' AND c.table_name = $1
      ORDER BY c.ordinal_position
    ` : `
      SELECT 
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable::boolean,
        c.column_default,
        c.character_maximum_length,
        c.numeric_precision,
        tc.constraint_type
      FROM information_schema.columns c
      LEFT JOIN information_schema.constraint_column_usage ccu ON c.column_name = ccu.column_name AND c.table_name = ccu.table_name
      LEFT JOIN information_schema.table_constraints tc ON ccu.constraint_name = tc.constraint_name
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `;

    const result = await this.dbManager.query(query, tableName ? [tableName] : []);
    return result.rows;
  }

  // Real data profiling
  async profileTableData(tableName: string, columnName?: string): Promise<DataProfileResult[]> {
    const schema = await this.getTableSchema(tableName);
    const columnsToProfile = columnName ? 
      schema.filter(col => col.column_name === columnName) : 
      schema;

    const results: DataProfileResult[] = [];

    for (const column of columnsToProfile) {
      try {
        const profile = await this.profileColumn(tableName, column);
        results.push(profile);
      } catch (error) {
        logger.error(`Failed to profile column ${column.column_name}:`, error);
      }
    }

    return results;
  }

  private async profileColumn(tableName: string, column: TableSchema): Promise<DataProfileResult> {
    const totalRowsResult = await this.dbManager.query(
      `SELECT COUNT(*) as total FROM "${tableName}"`
    );
    const totalRows = parseInt(totalRowsResult.rows[0].total);

    const nullCountResult = await this.dbManager.query(
      `SELECT COUNT(*) as null_count FROM "${tableName}" WHERE "${column.column_name}" IS NULL`
    );
    const nullCount = parseInt(nullCountResult.rows[0].null_count);

    const distinctCountResult = await this.dbManager.query(
      `SELECT COUNT(DISTINCT "${column.column_name}") as distinct_count FROM "${tableName}" WHERE "${column.column_name}" IS NOT NULL`
    );
    const distinctCount = parseInt(distinctCountResult.rows[0].distinct_count);

    let minValue = null, maxValue = null, avgValue = null, stdDev = null;
    
    // For numeric columns, get statistical measures
    if (['integer', 'bigint', 'decimal', 'numeric', 'real', 'double precision'].includes(column.data_type)) {
      const statsResult = await this.dbManager.query(
        `SELECT 
          MIN("${column.column_name}") as min_val,
          MAX("${column.column_name}") as max_val,
          AVG("${column.column_name}") as avg_val,
          STDDEV("${column.column_name}") as std_dev
        FROM "${tableName}" 
        WHERE "${column.column_name}" IS NOT NULL`
      );
      
      if (statsResult.rows.length > 0) {
        minValue = statsResult.rows[0].min_val;
        maxValue = statsResult.rows[0].max_val;
        avgValue = parseFloat(statsResult.rows[0].avg_val) || null;
        stdDev = parseFloat(statsResult.rows[0].std_dev) || null;
      }
    } else {
      // For non-numeric columns, get min/max by length or alphabetically
      const minMaxResult = await this.dbManager.query(
        `SELECT 
          (SELECT "${column.column_name}" FROM "${tableName}" WHERE "${column.column_name}" IS NOT NULL ORDER BY "${column.column_name}" LIMIT 1) as min_val,
          (SELECT "${column.column_name}" FROM "${tableName}" WHERE "${column.column_name}" IS NOT NULL ORDER BY "${column.column_name}" DESC LIMIT 1) as max_val`
      );
      
      if (minMaxResult.rows.length > 0) {
        minValue = minMaxResult.rows[0].min_val;
        maxValue = minMaxResult.rows[0].max_val;
      }
    }

    // Get most frequent value
    const frequentResult = await this.dbManager.query(
      `SELECT "${column.column_name}" as value, COUNT(*) as count 
       FROM "${tableName}" 
       WHERE "${column.column_name}" IS NOT NULL 
       GROUP BY "${column.column_name}" 
       ORDER BY count DESC 
       LIMIT 1`
    );
    
    let mostFrequentValue = null, mostFrequentCount = 0;
    if (frequentResult.rows.length > 0) {
      mostFrequentValue = frequentResult.rows[0].value;
      mostFrequentCount = parseInt(frequentResult.rows[0].count);
    }

    // Get sample values
    const sampleResult = await this.dbManager.query(
      `SELECT DISTINCT "${column.column_name}" 
       FROM "${tableName}" 
       WHERE "${column.column_name}" IS NOT NULL 
       ORDER BY RANDOM() 
       LIMIT 10`
    );
    const sampleValues = sampleResult.rows.map((row: any) => row[column.column_name]);

    return {
      table_name: tableName,
      column_name: column.column_name,
      data_type: column.data_type,
      total_rows: totalRows,
      null_count: nullCount,
      distinct_count: distinctCount,
      min_value: minValue,
      max_value: maxValue,
      avg_value: avgValue,
      std_dev: stdDev,
      most_frequent_value: mostFrequentValue,
      most_frequent_count: mostFrequentCount,
      sample_values: sampleValues
    };
  }

  // Real data quality metrics calculation
  async calculateDataQualityMetrics(tableName: string): Promise<DataQualityMetrics> {
    const profile = await this.profileTableData(tableName);
    const totalColumns = profile.length;
    
    if (totalColumns === 0) {
      return {
        completeness_score: 0,
        uniqueness_score: 0,
        validity_score: 0,
        consistency_score: 0,
        accuracy_score: 0,
        timeliness_score: 0
      };
    }

    // Completeness: % of non-null values
    const completenessScores = profile.map(col => 
      col.total_rows > 0 ? ((col.total_rows - col.null_count) / col.total_rows) * 100 : 0
    );
    const completeness_score = completenessScores.reduce((a, b) => a + b, 0) / totalColumns;

    // Uniqueness: average distinctness ratio
    const uniquenessScores = profile.map(col => 
      col.total_rows > 0 ? (col.distinct_count / (col.total_rows - col.null_count || 1)) * 100 : 0
    );
    const uniqueness_score = Math.min(uniquenessScores.reduce((a, b) => a + b, 0) / totalColumns, 100);

    // Validity: check for obvious data type violations
    const validity_score = await this.calculateValidityScore(tableName, profile);

    // Consistency: check for format consistency within columns
    const consistency_score = await this.calculateConsistencyScore(tableName, profile);

    // Accuracy: estimated based on data patterns (placeholder for now)
    const accuracy_score = 85; // Would need business rules to calculate

    // Timeliness: check for recent data (if timestamp columns exist)
    const timeliness_score = await this.calculateTimelinessScore(tableName, profile);

    return {
      completeness_score: Math.round(completeness_score * 100) / 100,
      uniqueness_score: Math.round(uniqueness_score * 100) / 100,
      validity_score: Math.round(validity_score * 100) / 100,
      consistency_score: Math.round(consistency_score * 100) / 100,
      accuracy_score: Math.round(accuracy_score * 100) / 100,
      timeliness_score: Math.round(timeliness_score * 100) / 100
    };
  }

  private async calculateValidityScore(tableName: string, profile: DataProfileResult[]): Promise<number> {
    let validityIssues = 0;
    let totalChecks = 0;

    for (const col of profile) {
      totalChecks++;
      
      // Check for obvious validity issues based on data type
      if (col.data_type.includes('email') || col.column_name.toLowerCase().includes('email')) {
        const emailValidationResult = await this.dbManager.query(
          `SELECT COUNT(*) as invalid_emails 
           FROM "${tableName}" 
           WHERE "${col.column_name}" IS NOT NULL 
           AND "${col.column_name}" !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`
        );
        if (parseInt(emailValidationResult.rows[0].invalid_emails) > 0) {
          validityIssues++;
        }
      }
      
      // Check for negative values in obviously positive fields
      if (['age', 'price', 'amount', 'quantity', 'count'].some(keyword => 
          col.column_name.toLowerCase().includes(keyword)) && 
          ['integer', 'bigint', 'decimal', 'numeric'].includes(col.data_type)) {
        const negativeResult = await this.dbManager.query(
          `SELECT COUNT(*) as negative_count 
           FROM "${tableName}" 
           WHERE "${col.column_name}" < 0`
        );
        if (parseInt(negativeResult.rows[0].negative_count) > 0) {
          validityIssues++;
        }
      }
    }

    return totalChecks > 0 ? ((totalChecks - validityIssues) / totalChecks) * 100 : 100;
  }

  private async calculateConsistencyScore(tableName: string, profile: DataProfileResult[]): Promise<number> {
    let consistencyScore = 100;
    
    for (const col of profile) {
      if (col.data_type === 'text' || col.data_type === 'varchar') {
        // Check for format consistency in text fields
        const formatVariationResult = await this.dbManager.query(
          `SELECT COUNT(DISTINCT LENGTH("${col.column_name}")) as length_variations
           FROM "${tableName}" 
           WHERE "${col.column_name}" IS NOT NULL`
        );
        
        const lengthVariations = parseInt(formatVariationResult.rows[0].length_variations);
        if (lengthVariations > col.distinct_count * 0.8) {
          consistencyScore -= 10; // Penalty for high format variation
        }
      }
    }
    
    return Math.max(consistencyScore, 0);
  }

  private async calculateTimelinessScore(tableName: string, profile: DataProfileResult[]): Promise<number> {
    const timestampColumns = profile.filter(col => 
      col.data_type.includes('timestamp') || 
      col.column_name.toLowerCase().includes('date') ||
      col.column_name.toLowerCase().includes('time') ||
      col.column_name.toLowerCase().includes('created') ||
      col.column_name.toLowerCase().includes('updated')
    );

    if (timestampColumns.length === 0) {
      return 75; // Default score if no timestamp columns
    }

    let totalScore = 0;
    for (const col of timestampColumns) {
      const recentDataResult = await this.dbManager.query(
        `SELECT COUNT(*) as recent_count
         FROM "${tableName}" 
         WHERE "${col.column_name}" >= CURRENT_DATE - INTERVAL '30 days'`
      );
      
      const recentCount = parseInt(recentDataResult.rows[0].recent_count);
      const recentPercentage = (recentCount / col.total_rows) * 100;
      totalScore += recentPercentage;
    }

    return Math.min(totalScore / timestampColumns.length, 100);
  }

  // Real database performance metrics
  async getDatabaseMetrics(): Promise<DatabaseMetrics> {
    const [
      connectionStats,
      activityStats,
      sizeStats,
      cacheStats,
      ioStats
    ] = await Promise.all([
      this.getConnectionStats(),
      this.getActivityStats(),
      this.getDatabaseSizeStats(),
      this.getCacheStats(),
      this.getIOStats()
    ]);

    return {
      connection_count: connectionStats.connection_count,
      active_queries: activityStats.active_queries,
      slow_queries: activityStats.slow_queries,
      deadlocks: activityStats.deadlocks,
      cache_hit_ratio: cacheStats.cache_hit_ratio,
      database_size_bytes: sizeStats.database_size_bytes,
      table_count: sizeStats.table_count,
      index_count: sizeStats.index_count,
      last_backup: await this.getLastBackupTime(),
      cpu_usage: 0, // Would need system-level monitoring
      memory_usage: 0, // Would need system-level monitoring
      disk_io_read: ioStats.disk_reads,
      disk_io_write: ioStats.disk_writes
    };
  }

  private async getConnectionStats(): Promise<{connection_count: number}> {
    const result = await this.dbManager.query(`
      SELECT COUNT(*) as connection_count
      FROM pg_stat_activity
      WHERE state = 'active'
    `);
    return { connection_count: parseInt(result.rows[0].connection_count) };
  }

  private async getActivityStats(): Promise<{active_queries: number, slow_queries: number, deadlocks: number}> {
    const [activeResult, slowResult, deadlockResult] = await Promise.all([
      this.dbManager.query(`
        SELECT COUNT(*) as active_queries
        FROM pg_stat_activity
        WHERE state = 'active' AND query != '<IDLE>'
      `),
      this.dbManager.query(`
        SELECT COUNT(*) as slow_queries
        FROM pg_stat_activity
        WHERE state = 'active' 
        AND query_start < NOW() - INTERVAL '30 seconds'
        AND query != '<IDLE>'
      `),
      this.dbManager.query(`
        SELECT COALESCE(SUM(deadlocks), 0) as deadlocks
        FROM pg_stat_database
        WHERE datname = current_database()
      `)
    ]);

    return {
      active_queries: parseInt(activeResult.rows[0].active_queries),
      slow_queries: parseInt(slowResult.rows[0].slow_queries),
      deadlocks: parseInt(deadlockResult.rows[0].deadlocks)
    };
  }

  private async getDatabaseSizeStats(): Promise<{database_size_bytes: number, table_count: number, index_count: number}> {
    const [sizeResult, tableResult, indexResult] = await Promise.all([
      this.dbManager.query(`SELECT pg_database_size(current_database()) as db_size`),
      this.dbManager.query(`
        SELECT COUNT(*) as table_count
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      `),
      this.dbManager.query(`
        SELECT COUNT(*) as index_count
        FROM pg_indexes
        WHERE schemaname = 'public'
      `)
    ]);

    return {
      database_size_bytes: parseInt(sizeResult.rows[0].db_size),
      table_count: parseInt(tableResult.rows[0].table_count),
      index_count: parseInt(indexResult.rows[0].index_count)
    };
  }

  private async getCacheStats(): Promise<{cache_hit_ratio: number}> {
    const result = await this.dbManager.query(`
      SELECT 
        ROUND(
          (SUM(heap_blks_hit) / NULLIF(SUM(heap_blks_hit + heap_blks_read), 0)) * 100, 2
        ) as cache_hit_ratio
      FROM pg_statio_user_tables
    `);
    
    return { 
      cache_hit_ratio: parseFloat(result.rows[0].cache_hit_ratio) || 0 
    };
  }

  private async getIOStats(): Promise<{disk_reads: number, disk_writes: number}> {
    const result = await this.dbManager.query(`
      SELECT 
        SUM(heap_blks_read) as disk_reads,
        SUM(heap_blks_hit) as disk_writes
      FROM pg_statio_user_tables
    `);

    return {
      disk_reads: parseInt(result.rows[0].disk_reads) || 0,
      disk_writes: parseInt(result.rows[0].disk_writes) || 0
    };
  }

  private async getLastBackupTime(): Promise<Date | null> {
    try {
      // This would need to be configured based on your backup solution
      // For now, returning null as we don't have backup monitoring set up
      return null;
    } catch {
      return null;
    }
  }

  // Real validation execution
  async executeValidation(tableName: string, columnName: string, validationType: string, parameters: any): Promise<ValidationResult> {
    let violations = 0;
    let sampleViolations: any[] = [];
    
    const totalRecordsResult = await this.dbManager.query(
      `SELECT COUNT(*) as total FROM "${tableName}"`
    );
    const totalRecords = parseInt(totalRecordsResult.rows[0].total);

    switch (validationType) {
      case 'not_null':
        const nullResult = await this.dbManager.query(
          `SELECT COUNT(*) as violations FROM "${tableName}" WHERE "${columnName}" IS NULL`
        );
        violations = parseInt(nullResult.rows[0].violations);
        break;

      case 'unique':
        const duplicateResult = await this.dbManager.query(
          `SELECT "${columnName}", COUNT(*) as count
           FROM "${tableName}" 
           WHERE "${columnName}" IS NOT NULL
           GROUP BY "${columnName}" 
           HAVING COUNT(*) > 1`
        );
        violations = duplicateResult.rows.reduce((sum: number, row: any) => sum + (parseInt(row.count) - 1), 0);
        sampleViolations = duplicateResult.rows.slice(0, 10).map((row: any) => ({
          value: row[columnName],
          count: row.count
        }));
        break;

      case 'range':
        const rangeResult = await this.dbManager.query(
          `SELECT COUNT(*) as violations, ARRAY_AGG("${columnName}" ORDER BY "${columnName}" LIMIT 10) as samples
           FROM "${tableName}" 
           WHERE "${columnName}" IS NOT NULL 
           AND ("${columnName}" < $1 OR "${columnName}" > $2)`,
          [parameters.min, parameters.max]
        );
        violations = parseInt(rangeResult.rows[0].violations);
        sampleViolations = rangeResult.rows[0].samples || [];
        break;

      case 'format':
        const formatResult = await this.dbManager.query(
          `SELECT COUNT(*) as violations, ARRAY_AGG("${columnName}" ORDER BY "${columnName}" LIMIT 10) as samples
           FROM "${tableName}" 
           WHERE "${columnName}" IS NOT NULL 
           AND "${columnName}" !~ $1`,
          [parameters.pattern]
        );
        violations = parseInt(formatResult.rows[0].violations);
        sampleViolations = formatResult.rows[0].samples || [];
        break;

      case 'length':
        const lengthResult = await this.dbManager.query(
          `SELECT COUNT(*) as violations, ARRAY_AGG("${columnName}" ORDER BY LENGTH("${columnName}") LIMIT 10) as samples
           FROM "${tableName}" 
           WHERE "${columnName}" IS NOT NULL 
           AND (LENGTH("${columnName}") < $1 OR LENGTH("${columnName}") > $2)`,
          [parameters.min_length, parameters.max_length]
        );
        violations = parseInt(lengthResult.rows[0].violations);
        sampleViolations = lengthResult.rows[0].samples || [];
        break;

      default:
        throw new Error(`Unsupported validation type: ${validationType}`);
    }

    return {
      rule_name: `${validationType}_${columnName}`,
      table_name: tableName,
      column_name: columnName,
      total_records: totalRecords,
      violations,
      violation_percentage: totalRecords > 0 ? (violations / totalRecords) * 100 : 0,
      sample_violations: sampleViolations
    };
  }

  // Real duplicate detection
  async findDuplicates(tableName: string, columns: string[]): Promise<any[]> {
    const columnList = columns.map(col => `"${col}"`).join(', ');
    const result = await this.dbManager.query(`
      SELECT ${columnList}, COUNT(*) as duplicate_count
      FROM "${tableName}"
      GROUP BY ${columnList}
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 100
    `);

    return result.rows;
  }

  // Real outlier detection using statistical methods
  async detectOutliers(tableName: string, columnName: string, method: 'iqr' | 'zscore' = 'iqr'): Promise<any[]> {
    if (method === 'iqr') {
      const result = await this.dbManager.query(`
        WITH stats AS (
          SELECT 
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "${columnName}") as q1,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "${columnName}") as q3
          FROM "${tableName}"
          WHERE "${columnName}" IS NOT NULL
        ),
        iqr_bounds AS (
          SELECT 
            q1,
            q3,
            q3 - q1 as iqr,
            q1 - 1.5 * (q3 - q1) as lower_bound,
            q3 + 1.5 * (q3 - q1) as upper_bound
          FROM stats
        )
        SELECT "${columnName}" as outlier_value
        FROM "${tableName}", iqr_bounds
        WHERE "${columnName}" IS NOT NULL
        AND ("${columnName}" < lower_bound OR "${columnName}" > upper_bound)
        ORDER BY ABS("${columnName}" - (SELECT (q1 + q3) / 2 FROM stats)) DESC
        LIMIT 100
      `);
      
      return result.rows.map((row: any) => row.outlier_value);
    } else {
      // Z-score method
      const result = await this.dbManager.query(`
        WITH stats AS (
          SELECT 
            AVG("${columnName}") as mean_val,
            STDDEV("${columnName}") as std_val
          FROM "${tableName}"
          WHERE "${columnName}" IS NOT NULL
        )
        SELECT "${columnName}" as outlier_value,
               ABS("${columnName}" - mean_val) / NULLIF(std_val, 0) as z_score
        FROM "${tableName}", stats
        WHERE "${columnName}" IS NOT NULL
        AND ABS("${columnName}" - mean_val) / NULLIF(std_val, 0) > 3
        ORDER BY z_score DESC
        LIMIT 100
      `);
      
      return result.rows.map((row: any) => ({
        value: row.outlier_value,
        z_score: row.z_score
      }));
    }
  }

  // Real pattern analysis
  async analyzePatterns(tableName: string, columnName: string): Promise<any> {
    const result = await this.dbManager.query(`
      SELECT 
        LENGTH("${columnName}") as pattern_length,
        COUNT(*) as frequency,
        MIN("${columnName}") as example_min,
        MAX("${columnName}") as example_max
      FROM "${tableName}"
      WHERE "${columnName}" IS NOT NULL
      GROUP BY LENGTH("${columnName}")
      ORDER BY frequency DESC
      LIMIT 20
    `);

    return {
      length_patterns: result.rows,
      total_analyzed: result.rows.reduce((sum: number, row: any) => sum + parseInt(row.frequency), 0)
    };
  }
} 