import { Pool, PoolClient, PoolConfig } from 'pg';
import winston from 'winston';

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/database.log' })
  ]
});

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export class DatabaseManager {
  private pool: Pool | null = null;
  private config: DatabaseConfig;
  private isConnected: boolean = false;

  constructor(config?: DatabaseConfig) {
    this.config = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'future_thought_db',
      user: process.env.DB_USER || 'admin',
      password: process.env.DB_PASSWORD || 'password',
      ssl: process.env.NODE_ENV === 'production' ? true : false,
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }

  async connect(): Promise<void> {
    try {
      logger.info('Establishing database connection...', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user
      });

      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max || 20,
        min: this.config.min || 5,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis || 5000,
        ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
        query_timeout: 30000,
      };

      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.isConnected = true;
      logger.info('Database connection established successfully');

      // Set up error handling
      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('Failed to establish database connection:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
        this.isConnected = false;
        logger.info('Database connection closed');
      } catch (error) {
        logger.error('Error closing database connection:', error);
        throw error;
      }
    }
  }

  async query(sql: string, params?: any[]): Promise<any> {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const start = Date.now();
    let client: PoolClient | null = null;

    try {
      client = await this.pool.connect();
      const result = await client.query(sql, params);
      
      const duration = Date.now() - start;
      logger.debug('Query executed', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        duration,
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('Query failed', {
        sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
        duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.isConnected || !this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return false;
    }
  }

  async getTableList(): Promise<string[]> {
    try {
      const result = await this.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'pg_%'
        ORDER BY table_name
      `);
      
      return result.rows.map((row: any) => row.table_name);
    } catch (error) {
      logger.error('Failed to get table list:', error);
      throw error;
    }
  }

  async getTableInfo(tableName: string): Promise<any> {
    try {
      const [tableStats, columnInfo] = await Promise.all([
        this.query(`
          SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
          FROM pg_stats 
          WHERE tablename = $1
          LIMIT 1
        `, [tableName]),
        
        this.query(`
          SELECT 
            column_name,
            data_type,
            is_nullable,
            column_default,
            character_maximum_length,
            numeric_precision,
            numeric_scale
          FROM information_schema.columns 
          WHERE table_name = $1 
          AND table_schema = 'public'
          ORDER BY ordinal_position
        `, [tableName])
      ]);

      const recordCount = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`);

      return {
        tableName,
        recordCount: recordCount.rows[0]?.count || 0,
        columns: columnInfo.rows,
        stats: tableStats.rows[0] || {}
      };
    } catch (error) {
      logger.error(`Failed to get table info for ${tableName}:`, error);
      throw error;
    }
  }

  async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )
      `, [tableName]);
      
      return result.rows[0]?.exists || false;
    } catch (error) {
      logger.error(`Failed to check if table ${tableName} exists:`, error);
      return false;
    }
  }

  isConnectionHealthy(): boolean {
    return this.isConnected && this.pool !== null;
  }

  getConnectionInfo(): any {
    return {
      isConnected: this.isConnected,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      poolInfo: this.pool ? {
        totalCount: this.pool.totalCount,
        idleCount: this.pool.idleCount,
        waitingCount: this.pool.waitingCount
      } : null
    };
  }
} 