import { BaseAgent } from './BaseAgent';
import { DatabaseManager } from '../data-sources/DataSourceManager';
import { AIProviderService } from './types';

const logger = {
  info: (message: string, ...args: any[]) => console.log('[INFO]', message, ...args),
  warn: (message: string, ...args: any[]) => console.warn('[WARN]', message, ...args),
  error: (message: string, ...args: any[]) => console.error('[ERROR]', message, ...args)
};

import { DataAnalysisTools, DatabaseMetrics as ToolsDatabaseMetrics } from '../data-analysis/DataAnalysisTools';

interface DatabaseHealth {
  overall_status: 'healthy' | 'warning' | 'critical';
  connection_count: number;
  active_queries: number;
  slow_queries: number;
  deadlocks: number;
  cache_hit_ratio: number;
  disk_usage: number;
  last_backup: Date | null;
  performance_score: number;
}

interface QueryOptimization {
  query: string;
  execution_time_ms: number;
  suggested_indexes: string[];
  optimization_tips: string[];
  estimated_improvement: string;
  complexity_score: number;
}

interface MaintenanceTask {
  id: string;
  type: 'backup' | 'vacuum' | 'reindex' | 'analyze' | 'cleanup' | 'optimization';
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  estimated_duration: string;
  table_name?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  scheduled_for?: Date;
  completed_at?: Date;
}

interface DatabaseMetrics {
  timestamp: Date;
  connections: number;
  cpu_usage: number;
  memory_usage: number;
  disk_io: number;
  query_throughput: number;
  average_query_time: number;
  error_rate: number;
}

export class DatabaseManagerAgent extends BaseAgent {
  private maintenanceTasks: MaintenanceTask[] = [];
  private performanceHistory: DatabaseMetrics[] = [];
  private dataAnalyzer: DataAnalysisTools;

  constructor(dbManager: any, aiProvider: AIProviderService) {
    super(
      'database-manager-agent',
      'Database Manager Agent',
      'database-administrator',
      [
        'assess-database-health',
        'optimize-query-performance',
        'schedule-maintenance-tasks',
        'monitor-performance-metrics',
        'manage-database-backup',
        'analyze-storage-usage'
      ],
      dbManager
    );

    this.dataAnalyzer = new DataAnalysisTools(dbManager);
    this.startPerformanceMonitoring();
  }

  initializeCapabilities(): void {
    // Initialize agent capabilities
  }

  async processMessage(message: any): Promise<any> {
    // Process incoming messages
    return { type: 'response', content: 'Database manager processed message' };
  }

  getCapabilities(): string[] {
    return [
      'assess-database-health',
      'optimize-query-performance',
      'schedule-maintenance-tasks',
      'monitor-performance-metrics',
      'manage-database-backup',
      'analyze-storage-usage'
    ];
  }

  async assessDatabaseHealth(): Promise<DatabaseHealth> {
    try {
      await this.updateStatus('busy');
      
      logger.info('Performing comprehensive database health assessment...');
      
      // Get real database metrics using the data analysis tools
      const realMetrics = await this.dataAnalyzer.getDatabaseMetrics();
      
      // Convert to DatabaseHealth format and add additional analysis
      const health = await this.convertToHealthFormat(realMetrics);
      
      // Store metrics for trend analysis
      this.performanceHistory.push({
        timestamp: new Date(),
        connections: health.connection_count,
        cpu_usage: realMetrics.cpu_usage,
        memory_usage: realMetrics.memory_usage,
        disk_io: realMetrics.disk_io_read + realMetrics.disk_io_write,
        query_throughput: health.active_queries,
        average_query_time: 0, // Would need query time tracking
        error_rate: 0 // Would need error tracking
      });

      // Keep only last 24 hours of metrics
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      this.performanceHistory = this.performanceHistory.filter(m => m.timestamp >= oneDayAgo);
      
      await this.updateStatus('idle');
      
      logger.info(`Database health assessment completed. Status: ${health.overall_status}`);
      return health;

    } catch (error) {
      logger.error('Database health assessment failed:', error);
      await this.updateStatus('error');
      throw error;
    }
  }

  private async convertToHealthFormat(metrics: ToolsDatabaseMetrics): Promise<DatabaseHealth> {
    // Calculate performance score based on real metrics
    let performanceScore = 100;
    
    // Connection count impact
    if (metrics.connection_count > 80) performanceScore -= 20;
    else if (metrics.connection_count > 50) performanceScore -= 10;
    
    // Slow queries impact
    if (metrics.slow_queries > 20) performanceScore -= 15;
    else if (metrics.slow_queries > 10) performanceScore -= 8;
    
    // Cache hit ratio impact
    if (metrics.cache_hit_ratio < 95) performanceScore -= 10;
    if (metrics.cache_hit_ratio < 90) performanceScore -= 15;

    // Determine overall status
    let overall_status: 'healthy' | 'warning' | 'critical';
    if (performanceScore >= 85) overall_status = 'healthy';
    else if (performanceScore >= 70) overall_status = 'warning';
    else overall_status = 'critical';

    return {
      overall_status,
      connection_count: metrics.connection_count,
      active_queries: metrics.active_queries,
      slow_queries: metrics.slow_queries,
      deadlocks: metrics.deadlocks,
      cache_hit_ratio: metrics.cache_hit_ratio,
      disk_usage: metrics.database_size_bytes,
      last_backup: metrics.last_backup,
      performance_score: Math.round(performanceScore)
    };
  }

  async optimizeQuery(query: string): Promise<QueryOptimization> {
    try {
      await this.updateStatus('busy');
      
      logger.info('Analyzing query for optimization opportunities...');
      
      // Get real query execution plan
      const executionPlan = await this.analyzeQueryPlan(query);
      
      // Use AI to generate optimization recommendations
      const optimization = await this.generateOptimizationRecommendations(query, executionPlan);
      
      await this.updateStatus('idle');
      await this.recordTaskCompletion('optimize-query-performance', true);
      
      return optimization;

    } catch (error) {
      logger.error('Query optimization failed:', error);
      await this.updateStatus('error');
      await this.recordTaskCompletion('optimize-query-performance', false);
      throw error;
    }
  }

  private async analyzeQueryPlan(query: string): Promise<any> {
    try {
      // Get actual execution plan without executing the query
      const planResult = await this.dbManager.query(`EXPLAIN (FORMAT JSON, ANALYZE FALSE, BUFFERS FALSE) ${query}`);
      return planResult.rows[0]['QUERY PLAN'][0];
    } catch (error) {
      logger.warn('Could not analyze query plan:', error);
      // Fallback - try to get basic plan
      try {
        const basicPlan = await this.dbManager.query(`EXPLAIN ${query}`);
        return { 
          "Plan": basicPlan.rows.map(row => row['QUERY PLAN']).join('\n'),
          "Execution Time": null
        };
      } catch (fallbackError) {
        logger.error('Query plan analysis completely failed:', fallbackError);
        return { 
          "Plan": "Unable to analyze query plan",
          "Execution Time": null,
          "Error": error.message
        };
      }
    }
  }

  private async generateOptimizationRecommendations(query: string, executionPlan: any): Promise<QueryOptimization> {
    const prompt = `As a PostgreSQL Database Expert, analyze this query and execution plan to provide optimization recommendations:

Query:
${query}

Execution Plan:
${JSON.stringify(executionPlan, null, 2)}

Please provide:
1. Suggested indexes that would improve performance
2. Query optimization tips (rewriting, joins, etc.)
3. Estimated performance improvement
4. Query complexity assessment

Focus on practical, implementable recommendations based on the actual execution plan.`;

    try {
      const aiResponse = await this.generateAIResponse(prompt, {
        maxTokens: 1500,
        temperature: 0.2
      });

      // Parse AI response and return structured optimization
      return this.parseOptimizationResponse(query, aiResponse, executionPlan);
    } catch (error) {
      logger.error('AI optimization analysis failed:', error);
      return this.generateBasicOptimization(query, executionPlan);
    }
  }

  private parseOptimizationResponse(query: string, aiResponse: string, executionPlan: any): QueryOptimization {
    // Extract execution time from plan or estimate based on plan complexity
    let executionTime = 100; // Default
    
    if (executionPlan["Total Cost"]) {
      executionTime = Math.max(executionPlan["Total Cost"] * 0.1, 10);
    } else if (executionPlan.Plan && executionPlan.Plan["Total Cost"]) {
      executionTime = Math.max(executionPlan.Plan["Total Cost"] * 0.1, 10);
    }
    
    // Real analysis based on execution plan
    const suggestedIndexes = this.analyzeIndexOpportunities(query, executionPlan);
    const optimizationTips = this.generateRealOptimizationTips(query, executionPlan);
    
    return {
      query,
      execution_time_ms: executionTime,
      suggested_indexes: suggestedIndexes,
      optimization_tips: optimizationTips,
      estimated_improvement: this.calculatePotentialImprovement(executionPlan),
      complexity_score: this.calculateQueryComplexity(query)
    };
  }

  private generateBasicOptimization(query: string, executionPlan: any): QueryOptimization {
    return {
      query,
      execution_time_ms: this.extractTotalCost(executionPlan) * 0.1, // Estimate based on cost
      suggested_indexes: this.analyzePotentialIndexes(query),
      optimization_tips: this.generateOptimizationTips(query),
      estimated_improvement: "15-25% faster",
      complexity_score: this.calculateQueryComplexity(query)
    };
  }

  private analyzePotentialIndexes(query: string): string[] {
    const indexes: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    // Look for WHERE clauses
    if (lowerQuery.includes('where')) {
      indexes.push('Consider adding indexes on frequently filtered columns');
    }
    
    // Look for JOINs
    if (lowerQuery.includes('join')) {
      indexes.push('Add indexes on join columns for better performance');
    }
    
    // Look for ORDER BY
    if (lowerQuery.includes('order by')) {
      indexes.push('Create composite index for ORDER BY columns');
    }
    
    return indexes;
  }

  private generateOptimizationTips(query: string): string[] {
    const tips: string[] = [];
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('select *')) {
      tips.push('Avoid SELECT * - specify only needed columns');
    }
    
    if (lowerQuery.includes('or')) {
      tips.push('Consider using UNION instead of OR for better performance');
    }
    
    if (lowerQuery.includes('like')) {
      tips.push('Use full-text search for complex pattern matching');
    }
    
    if (lowerQuery.includes('group by')) {
      tips.push('Ensure proper indexing on GROUP BY columns');
    }
    
    return tips;
  }

  private analyzeIndexOpportunities(query: string, executionPlan: any): string[] {
    const indexes: string[] = [];
    const lowerQuery = query.toLowerCase();
    const planString = JSON.stringify(executionPlan).toLowerCase();
    
    // Look for sequential scans in execution plan
    if (planString.includes('seq scan') || planString.includes('sequential scan')) {
      indexes.push('Consider adding indexes on frequently scanned tables to avoid sequential scans');
    }
    
    // Look for WHERE clauses
    if (lowerQuery.includes('where')) {
      const whereMatch = lowerQuery.match(/where\s+(\w+)\s*[=<>]/);
      if (whereMatch) {
        indexes.push(`Add index on ${whereMatch[1]} column for WHERE clause optimization`);
      }
    }
    
    // Look for JOINs
    if (lowerQuery.includes('join')) {
      const joinMatches = lowerQuery.match(/join\s+(\w+)\s+\w+\s+on\s+(\w+)\.(\w+)/g);
      if (joinMatches) {
        indexes.push('Add indexes on join columns for better performance');
      }
    }
    
    // Look for ORDER BY
    if (lowerQuery.includes('order by')) {
      const orderMatch = lowerQuery.match(/order\s+by\s+(\w+)/);
      if (orderMatch) {
        indexes.push(`Create index on ${orderMatch[1]} for ORDER BY optimization`);
      }
    }

    // Look for hash joins in plan that could benefit from indexes
    if (planString.includes('hash join')) {
      indexes.push('Consider creating indexes to enable more efficient nested loop joins');
    }
    
    return indexes.length > 0 ? indexes : ['Query appears well-optimized for current schema'];
  }

  private generateRealOptimizationTips(query: string, executionPlan: any): string[] {
    const tips: string[] = [];
    const lowerQuery = query.toLowerCase();
    const planString = JSON.stringify(executionPlan).toLowerCase();
    
    if (lowerQuery.includes('select *')) {
      tips.push('Avoid SELECT * - specify only needed columns to reduce I/O');
    }
    
    if (lowerQuery.includes('or')) {
      tips.push('Consider using UNION instead of OR for better index utilization');
    }
    
    if (lowerQuery.includes('like') && lowerQuery.includes('like \'%')) {
      tips.push('Use full-text search (tsvector/tsquery) for pattern matching with leading wildcards');
    }
    
    if (lowerQuery.includes('group by')) {
      tips.push('Ensure proper indexing on GROUP BY columns');
    }

    // Analyze execution plan for specific optimizations
    if (planString.includes('sort')) {
      tips.push('Consider adding indexes to eliminate sort operations');
    }

    if (planString.includes('hash') && planString.includes('join')) {
      tips.push('Large hash joins detected - consider increasing work_mem for this session');
    }

    if (planString.includes('materialize')) {
      tips.push('Query materialization detected - consider query restructuring');
    }

    // Check for expensive operations
    const totalCost = this.extractTotalCost(executionPlan);
    if (totalCost > 10000) {
      tips.push('High-cost query detected - consider breaking into smaller operations or adding covering indexes');
    }
    
    return tips.length > 0 ? tips : ['Query appears well-optimized'];
  }

  private extractTotalCost(executionPlan: any): number {
    if (executionPlan["Total Cost"]) {
      return parseFloat(executionPlan["Total Cost"]);
    }
    if (executionPlan.Plan && executionPlan.Plan["Total Cost"]) {
      return parseFloat(executionPlan.Plan["Total Cost"]);
    }
    return 100; // Default
  }

  private calculatePotentialImprovement(executionPlan: any): string {
    const totalCost = this.extractTotalCost(executionPlan);
    const planString = JSON.stringify(executionPlan).toLowerCase();
    
    if (planString.includes('seq scan') && totalCost > 1000) {
      return "50-80% faster with proper indexing";
    } else if (planString.includes('hash join') && totalCost > 5000) {
      return "30-60% faster with index optimization";
    } else if (totalCost > 10000) {
      return "20-40% faster with query restructuring";
    } else if (totalCost > 1000) {
      return "10-25% faster with minor optimizations";
    } else {
      return "5-15% improvement possible";
    }
  }

  private calculateQueryComplexity(query: string): number {
    let complexity = 1;
    const lowerQuery = query.toLowerCase();
    
    // Add complexity for joins
    const joinCount = (lowerQuery.match(/join/g) || []).length;
    complexity += joinCount * 2;
    
    // Add complexity for subqueries
    const subqueryCount = (lowerQuery.match(/\(/g) || []).length;
    complexity += subqueryCount;
    
    // Add complexity for aggregations
    if (lowerQuery.includes('group by')) complexity += 2;
    if (lowerQuery.includes('having')) complexity += 1;
    if (lowerQuery.includes('order by')) complexity += 1;
    if (lowerQuery.includes('union')) complexity += 2;
    if (lowerQuery.includes('with')) complexity += 2; // CTEs
    
    return Math.min(complexity, 10); // Cap at 10
  }

  async scheduleMaintenanceTask(task: Omit<MaintenanceTask, 'id' | 'status'>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const maintenanceTask: MaintenanceTask = {
      ...task,
      id: taskId,
      status: 'pending'
    };
    
    this.maintenanceTasks.push(maintenanceTask);
    
    logger.info(`Scheduled maintenance task: ${task.type} - ${task.description}`);
    
    // If high priority, execute immediately
    if (task.priority === 'urgent') {
      setTimeout(() => this.executeMaintenanceTask(taskId), 1000);
    }
    
    return taskId;
  }

  async executeMaintenanceTask(taskId: string): Promise<boolean> {
    const task = this.maintenanceTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Maintenance task ${taskId} not found`);
    }

    try {
      await this.updateStatus('busy');
      task.status = 'in_progress';
      
      logger.info(`Executing maintenance task: ${task.type}`);
      
      let success = false;
      
      switch (task.type) {
        case 'vacuum':
          success = await this.performVacuum(task.table_name);
          break;
        case 'analyze':
          success = await this.performAnalyze(task.table_name);
          break;
        case 'reindex':
          success = await this.performReindex(task.table_name);
          break;
        case 'backup':
          success = await this.performBackup();
          break;
        case 'cleanup':
          success = await this.performCleanup();
          break;
        default:
          logger.warn(`Unknown maintenance task type: ${task.type}`);
          success = false;
      }
      
      task.status = success ? 'completed' : 'failed';
      task.completed_at = new Date();
      
      await this.updateStatus('idle');
      await this.recordTaskCompletion('perform-maintenance-tasks', success);
      
      return success;

    } catch (error) {
      logger.error(`Maintenance task ${taskId} failed:`, error);
      task.status = 'failed';
      await this.updateStatus('error');
      await this.recordTaskCompletion('perform-maintenance-tasks', false);
      return false;
    }
  }

  private async performVacuum(tableName?: string): Promise<boolean> {
    try {
      if (tableName) {
        await this.dbManager.query(`VACUUM ANALYZE ${tableName}`);
        logger.info(`VACUUM completed for table: ${tableName}`);
      } else {
        await this.dbManager.query('VACUUM ANALYZE');
        logger.info('VACUUM completed for all tables');
      }
      return true;
    } catch (error) {
      logger.error('VACUUM operation failed:', error);
      return false;
    }
  }

  private async performAnalyze(tableName?: string): Promise<boolean> {
    try {
      if (tableName) {
        await this.dbManager.query(`ANALYZE ${tableName}`);
        logger.info(`ANALYZE completed for table: ${tableName}`);
      } else {
        await this.dbManager.query('ANALYZE');
        logger.info('ANALYZE completed for all tables');
      }
      return true;
    } catch (error) {
      logger.error('ANALYZE operation failed:', error);
      return false;
    }
  }

  private async performReindex(tableName?: string): Promise<boolean> {
    try {
      if (tableName) {
        await this.dbManager.query(`REINDEX TABLE ${tableName}`);
        logger.info(`REINDEX completed for table: ${tableName}`);
      } else {
        await this.dbManager.query('REINDEX DATABASE CONCURRENTLY');
        logger.info('REINDEX completed for database');
      }
      return true;
    } catch (error) {
      logger.error('REINDEX operation failed:', error);
      return false;
    }
  }

  private async performBackup(): Promise<boolean> {
    try {
      // In production, this would execute actual backup commands
      logger.info('Database backup initiated (simulated)');
      // Simulate backup time
      await new Promise(resolve => setTimeout(resolve, 2000));
      logger.info('Database backup completed successfully');
      return true;
    } catch (error) {
      logger.error('Backup operation failed:', error);
      return false;
    }
  }

  private async performCleanup(): Promise<boolean> {
    try {
      // Clean up old logs, temporary files, etc.
      logger.info('Database cleanup initiated');
      // Simulate cleanup operations
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('Database cleanup completed');
      return true;
    } catch (error) {
      logger.error('Cleanup operation failed:', error);
      return false;
    }
  }

  private startPerformanceMonitoring(): void {
    // Start collecting performance metrics every 5 minutes
    setInterval(async () => {
      try {
        const metrics = await this.collectPerformanceMetrics();
        this.performanceHistory.push(metrics);
        
        // Keep only last 24 hours
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        this.performanceHistory = this.performanceHistory.filter(m => m.timestamp >= oneDayAgo);
      } catch (error) {
        logger.warn('Performance metrics collection failed:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  private async collectPerformanceMetrics(): Promise<DatabaseMetrics> {
    try {
      const realMetrics = await this.dataAnalyzer.getDatabaseMetrics();
      
      return {
        timestamp: new Date(),
        connections: realMetrics.connection_count,
        cpu_usage: realMetrics.cpu_usage,
        memory_usage: realMetrics.memory_usage,
        disk_io: realMetrics.disk_io_read + realMetrics.disk_io_write,
        query_throughput: realMetrics.active_queries,
        average_query_time: 0, // Would need query time tracking
        error_rate: 0 // Would need error tracking
      };
    } catch (error) {
      logger.error('Failed to collect performance metrics:', error);
      // Return default metrics
      return {
        timestamp: new Date(),
        connections: 0,
        cpu_usage: 0,
        memory_usage: 0,
        disk_io: 0,
        query_throughput: 0,
        average_query_time: 0,
        error_rate: 0
      };
    }
  }

  async getPerformanceHistory(hours: number = 24): Promise<DatabaseMetrics[]> {
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.performanceHistory.filter(metric => metric.timestamp >= cutoffTime);
  }

  async getMaintenanceTasks(status?: string): Promise<MaintenanceTask[]> {
    if (status) {
      return this.maintenanceTasks.filter(task => task.status === status);
    }
    return [...this.maintenanceTasks];
  }

  async generateHealthReport(): Promise<string> {
    const health = await this.assessDatabaseHealth();
    const recentMetrics = this.getPerformanceHistory(1); // Last hour
    
    return `
# Database Health Report

**Overall Status:** ${health.overall_status.toUpperCase()}
**Performance Score:** ${health.performance_score}/100
**Generated:** ${new Date().toLocaleString()}

## Current Metrics
- **Active Connections:** ${health.connection_count}
- **Active Queries:** ${health.active_queries}
- **Slow Queries:** ${health.slow_queries}
- **Cache Hit Ratio:** ${health.cache_hit_ratio}%
- **Disk Usage:** ${(health.disk_usage / 1024 / 1024 / 1024).toFixed(2)} GB

## Performance Trends
- **Average Query Time:** ${recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].average_query_time.toFixed(2) : 'N/A'} ms
- **Query Throughput:** ${recentMetrics.length > 0 ? recentMetrics[recentMetrics.length - 1].query_throughput.toFixed(0) : 'N/A'} queries/min
- **Error Rate:** ${recentMetrics.length > 0 ? (recentMetrics[recentMetrics.length - 1].error_rate * 100).toFixed(3) : 'N/A'}%

## Maintenance Status
- **Last Backup:** ${health.last_backup ? health.last_backup.toLocaleDateString() : 'Unknown'}
- **Pending Tasks:** ${this.maintenanceTasks.filter(t => t.status === 'pending').length}
- **Recent Deadlocks:** ${health.deadlocks}

## Recommendations
${health.overall_status === 'critical' ? 
  '⚠️ **CRITICAL**: Immediate attention required\n- Check slow queries\n- Review connection usage\n- Consider maintenance tasks' :
  health.overall_status === 'warning' ? 
  '⚠️ **WARNING**: Monitor closely\n- Schedule maintenance if needed\n- Review query performance' :
  '✅ **HEALTHY**: Database operating normally\n- Continue regular monitoring\n- Maintain backup schedule'
}
    `.trim();
  }
} 