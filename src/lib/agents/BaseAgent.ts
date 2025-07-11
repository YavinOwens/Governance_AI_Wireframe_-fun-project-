import { AgentMessage, AgentStatus, AgentCapability } from './types';
import aiProvider, { AIMessage, AIProviderConfig } from './ai/AIProvider';
import dbManager from '../database/connection';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/agents.log' })
  ]
});

export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected type: string;
  protected status: AgentStatus['status'] = 'idle';
  protected capabilities: AgentCapability[] = [];
  protected messageQueue: AgentMessage[] = [];
  protected isProcessing = false;
  protected systemPrompt: string;
  protected aiConfig: AIProviderConfig;
  protected conversationHistory: AIMessage[] = [];
  protected performanceMetrics = {
    tasksCompleted: 0,
    totalResponseTime: 0,
    errorCount: 0,
    totalMessages: 0
  };
  private messageCounter = 0;

  constructor(
    id: string, 
    name: string, 
    type: string, 
    systemPrompt: string,
    aiConfig: AIProviderConfig
  ) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.systemPrompt = systemPrompt;
    this.aiConfig = aiConfig;
    this.initializeCapabilities();
    this.loadFromDatabase();
  }

  abstract initializeCapabilities(): void;
  abstract processMessage(message: AgentMessage): Promise<AgentMessage | null>;
  abstract getCapabilities(): string[];

  /**
   * Load agent configuration from database
   */
  protected async loadFromDatabase(): Promise<void> {
    try {
      const query = `
        SELECT * FROM agents 
        WHERE id = $1
      `;
      const result = await dbManager.query(query, [this.id]);
      
      if (result.rows.length > 0) {
        const agentData = result.rows[0];
        this.status = agentData.status;
        this.aiConfig = {
          ...this.aiConfig,
          ...agentData.configuration
        };
        if (agentData.system_prompt) {
          this.systemPrompt = agentData.system_prompt;
        }
      }
    } catch (error) {
      logger.error(`Failed to load agent ${this.id} from database:`, error);
    }
  }

  /**
   * Save agent state to database
   */
  protected async saveToDatabase(): Promise<void> {
    try {
      const query = `
        UPDATE agents 
        SET status = $1, configuration = $2, last_activity = CURRENT_TIMESTAMP
        WHERE id = $3
      `;
      await dbManager.query(query, [
        this.status,
        JSON.stringify(this.aiConfig),
        this.id
      ]);
    } catch (error) {
      logger.error(`Failed to save agent ${this.id} to database:`, error);
    }
  }

  /**
   * Update performance metrics
   */
  protected async updatePerformanceMetrics(responseTime: number, success: boolean): Promise<void> {
    this.performanceMetrics.totalMessages++;
    this.performanceMetrics.totalResponseTime += responseTime;
    
    if (success) {
      this.performanceMetrics.tasksCompleted++;
    } else {
      this.performanceMetrics.errorCount++;
    }

    try {
      const averageResponseTime = Math.round(this.performanceMetrics.totalResponseTime / this.performanceMetrics.totalMessages);
      const errorRate = this.performanceMetrics.errorCount / this.performanceMetrics.totalMessages;
      const successRate = this.performanceMetrics.tasksCompleted / this.performanceMetrics.totalMessages;

      const query = `
        INSERT INTO agent_performance (agent_id, tasks_completed, average_response_time, error_rate, total_messages, success_rate)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (agent_id, date) 
        DO UPDATE SET 
          tasks_completed = $2,
          average_response_time = $3,
          error_rate = $4,
          total_messages = $5,
          success_rate = $6,
          created_at = CURRENT_TIMESTAMP
      `;
      
      await dbManager.query(query, [
        this.id,
        this.performanceMetrics.tasksCompleted,
        averageResponseTime,
        errorRate,
        this.performanceMetrics.totalMessages,
        successRate
      ]);
    } catch (error) {
      logger.error(`Failed to update performance metrics for agent ${this.id}:`, error);
    }
  }

  /**
   * Generate AI response using the agent's configuration
   */
  protected async generateAIResponse(userMessage: string, context?: any): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Build conversation with system prompt and history
      const messages: AIMessage[] = [
        { role: 'system', content: this.systemPrompt }
      ];

      // Add recent conversation history (last 10 messages)
      const recentHistory = this.conversationHistory.slice(-10);
      messages.push(...recentHistory);

      // Add current user message with context
      let contextualMessage = userMessage;
      if (context) {
        contextualMessage = `Context: ${JSON.stringify(context)}\n\nUser Request: ${userMessage}`;
      }
      
      messages.push({ role: 'user', content: contextualMessage });

      // Generate AI response
      const response = await aiProvider.generateResponse(messages, this.aiConfig);
      
      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: userMessage },
        { role: 'assistant', content: response.content }
      );

      // Keep only last 20 messages in history
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      const responseTime = Date.now() - startTime;
      await this.updatePerformanceMetrics(responseTime, true);
      
      logger.info(`AI response generated for agent ${this.id}:`, {
        model: response.model,
        provider: response.provider,
        processing_time_ms: response.processing_time_ms,
        usage: response.usage
      });

      return response.content;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      await this.updatePerformanceMetrics(responseTime, false);
      
      logger.error(`AI response generation failed for agent ${this.id}:`, error);
      throw error;
    }
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getStatus(): AgentStatus {
    const averageResponseTime = this.performanceMetrics.totalMessages > 0 
      ? Math.round(this.performanceMetrics.totalResponseTime / this.performanceMetrics.totalMessages)
      : 0;
    
    const errorRate = this.performanceMetrics.totalMessages > 0
      ? this.performanceMetrics.errorCount / this.performanceMetrics.totalMessages
      : 0;

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      capabilities: this.getCapabilities(),
      currentTask: this.isProcessing ? 'Processing message' : undefined,
      lastActivity: new Date(),
      performance: {
        tasksCompleted: this.performanceMetrics.tasksCompleted,
        averageResponseTime,
        errorRate,
        totalMessages: this.performanceMetrics.totalMessages,
      },
    };
  }

  public async receiveMessage(message: AgentMessage): Promise<void> {
    this.messageQueue.push(message);
    if (!this.isProcessing) {
      await this.processQueue();
    }
  }

  protected async processQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    this.isProcessing = true;
    this.status = 'busy';
    await this.saveToDatabase();

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        try {
          const response = await this.processMessage(message);
          if (response) {
            await this.sendMessage(response);
          }
        } catch (error) {
          logger.error(`Error processing message in agent ${this.id}:`, error);
          const errorMessage: AgentMessage = {
            id: this.generateUniqueId('error'),
            from: this.id,
            to: message.from,
            type: 'error',
            payload: {
              originalMessage: message,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
            timestamp: new Date(),
            priority: 'high',
            correlationId: message.correlationId,
          };
          await this.sendMessage(errorMessage);
        }
      }
    }

    this.isProcessing = false;
    this.status = 'idle';
    await this.saveToDatabase();
  }

  protected async sendMessage(message: AgentMessage): Promise<void> {
    // This will be implemented by the agent manager
    // For now, we'll emit to a global event system
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('agent-message', { detail: message }));
    }
  }

  protected async broadcastMessage(message: Omit<AgentMessage, 'to'>): Promise<void> {
    const broadcastMessage: AgentMessage = {
      ...message,
      to: 'broadcast',
      from: this.id,
    };
    await this.sendMessage(broadcastMessage);
  }

  protected updateStatus(newStatus: AgentStatus['status']): void {
    this.status = newStatus;
  }

  protected addCapability(capability: AgentCapability): void {
    this.capabilities.push(capability);
  }

  protected async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${this.id}] [${level.toUpperCase()}]: ${message}`);
  }

  protected generateUniqueId(prefix: string = 'msg'): string {
    this.messageCounter++;
    return `${prefix}_${this.id}_${Date.now()}_${this.messageCounter}`;
  }
} 