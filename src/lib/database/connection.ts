import { Pool, PoolClient, PoolConfig } from 'pg';
import { createClient } from 'redis';
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

// Database configuration
const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'future_thought_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  max: 20, // Maximum number of clients in the pool
  min: 5,  // Minimum number of clients in the pool
  idle: 30000, // Close & remove clients which have been idle > 30 seconds
  acquire: 60000, // Return error after 60 seconds if connection cannot be established
  evict: 1000, // Run eviction to close idle clients every 1 second
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  query_timeout: 30000, // Query timeout 30 seconds
  connectionTimeoutMillis: 5000, // Connection timeout 5 seconds
  idleTimeoutMillis: 30000, // Idle timeout 30 seconds
};

// Redis configuration
const redisConfig = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    connectTimeout: 5000,
    lazyConnect: true,
  },
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

class DatabaseManager {
  private pool: Pool;
  private redisClient: ReturnType<typeof createClient>;
  private isConnected: boolean = false;
  private isRedisConnected: boolean = false;

  constructor() {
    this.pool = new Pool(dbConfig);
    this.redisClient = createClient(redisConfig);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // PostgreSQL pool event handlers
    this.pool.on('connect', (client: PoolClient) => {
      logger.info('PostgreSQL client connected');
      this.isConnected = true;
    });

    this.pool.on('error', (err: Error) => {
      logger.error('PostgreSQL pool error:', err);
      this.isConnected = false;
    });

    this.pool.on('remove', () => {
      logger.info('PostgreSQL client removed from pool');
    });

    // Redis client event handlers
    this.redisClient.on('connect', () => {
      logger.info('Redis client connected');
      this.isRedisConnected = true;
    });

    this.redisClient.on('error', (err: Error) => {
      logger.error('Redis client error:', err);
      this.isRedisConnected = false;
    });

    this.redisClient.on('end', () => {
      logger.info('Redis client disconnected');
      this.isRedisConnected = false;
    });
  }

  async initialize(): Promise<void> {
    try {
      // Test PostgreSQL connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      logger.info('PostgreSQL connection established successfully');

      // Connect to Redis
      await this.redisClient.connect();
      logger.info('Redis connection established successfully');

    } catch (error) {
      logger.error('Failed to initialize database connections:', error);
      throw error;
    }
  }

  // PostgreSQL methods
  async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(`Query executed in ${duration}ms`, { text, duration });
      return result;
    } catch (error) {
      logger.error('Database query error:', { text, params, error });
      throw error;
    }
  }

  async getClient(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      logger.error('Failed to get database client:', error);
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction rolled back:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Redis methods
  async cacheGet(key: string): Promise<string | null> {
    try {
      if (!this.isRedisConnected) {
        logger.warn('Redis not connected, skipping cache get');
        return null;
      }
      return await this.redisClient.get(key);
    } catch (error) {
      logger.error('Redis GET error:', error);
      return null;
    }
  }

  async cacheSet(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (!this.isRedisConnected) {
        logger.warn('Redis not connected, skipping cache set');
        return;
      }
      if (ttl) {
        await this.redisClient.setEx(key, ttl, value);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error) {
      logger.error('Redis SET error:', error);
    }
  }

  async cacheDel(key: string): Promise<void> {
    try {
      if (!this.isRedisConnected) {
        logger.warn('Redis not connected, skipping cache delete');
        return;
      }
      await this.redisClient.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', error);
    }
  }

  async cacheExists(key: string): Promise<boolean> {
    try {
      if (!this.isRedisConnected) {
        return false;
      }
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Redis EXISTS error:', error);
      return false;
    }
  }

  // Health check methods
  async healthCheck(): Promise<{ postgresql: boolean; redis: boolean }> {
    const health = {
      postgresql: false,
      redis: false
    };

    // Check PostgreSQL
    try {
      await this.query('SELECT 1');
      health.postgresql = true;
    } catch (error) {
      logger.error('PostgreSQL health check failed:', error);
    }

    // Check Redis
    try {
      if (this.isRedisConnected) {
        await this.redisClient.ping();
        health.redis = true;
      }
    } catch (error) {
      logger.error('Redis health check failed:', error);
    }

    return health;
  }

  // Graceful shutdown
  async close(): Promise<void> {
    try {
      logger.info('Closing database connections...');
      await this.pool.end();
      await this.redisClient.quit();
      logger.info('Database connections closed successfully');
    } catch (error) {
      logger.error('Error closing database connections:', error);
    }
  }

  // Getters
  get isPostgreSQLConnected(): boolean {
    return this.isConnected;
  }

  get isRedisCacheConnected(): boolean {
    return this.isRedisConnected;
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

export default dbManager;
export { DatabaseManager }; 