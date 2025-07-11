import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/ai.log' })
  ]
});

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  provider: string;
  processing_time_ms: number;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic';
  model: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export class AIProviderService {
  private openai: OpenAI | null = null;
  private anthropic: Anthropic | null = null;

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        logger.info('OpenAI provider initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize OpenAI provider:', error);
      }
    } else {
      logger.warn('OPENAI_API_KEY not found in environment variables');
    }

    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        logger.info('Anthropic provider initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize Anthropic provider:', error);
      }
    } else {
      logger.warn('ANTHROPIC_API_KEY not found in environment variables');
    }
  }

  async generateResponse(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      if (config.provider === 'openai') {
        return await this.generateOpenAIResponse(messages, config, startTime);
      } else if (config.provider === 'anthropic') {
        return await this.generateAnthropicResponse(messages, config, startTime);
      } else {
        throw new Error(`Unsupported AI provider: ${config.provider}`);
      }
    } catch (error) {
      logger.error('AI response generation failed:', { config, error });
      throw error;
    }
  }

  private async generateOpenAIResponse(
    messages: AIMessage[],
    config: AIProviderConfig,
    startTime: number
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error('OpenAI provider not initialized');
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: config.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 4000,
        top_p: config.top_p || 1,
      });

      const processing_time_ms = Date.now() - startTime;

      if (!response.choices || response.choices.length === 0) {
        throw new Error('No response generated from OpenAI');
      }

      const content = response.choices[0].message?.content || '';

      logger.info('OpenAI response generated successfully', {
        model: config.model,
        processing_time_ms,
        usage: response.usage
      });

      return {
        content,
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens
        } : undefined,
        model: config.model,
        provider: 'openai',
        processing_time_ms
      };

    } catch (error) {
      logger.error('OpenAI API error:', error);
      throw error;
    }
  }

  private async generateAnthropicResponse(
    messages: AIMessage[],
    config: AIProviderConfig,
    startTime: number
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error('Anthropic provider not initialized');
    }

    try {
      // Convert messages for Anthropic format
      const systemMessage = messages.find(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');

      const response = await this.anthropic.messages.create({
        model: config.model,
        system: systemMessage?.content || '',
        messages: conversationMessages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        temperature: config.temperature || 0.7,
        max_tokens: config.max_tokens || 4000,
      });

      const processing_time_ms = Date.now() - startTime;

      if (!response.content || response.content.length === 0) {
        throw new Error('No response generated from Anthropic');
      }

      const content = response.content
        .filter(block => block.type === 'text')
        .map(block => (block as any).text)
        .join('');

      logger.info('Anthropic response generated successfully', {
        model: config.model,
        processing_time_ms,
        usage: response.usage
      });

      return {
        content,
        usage: response.usage ? {
          prompt_tokens: response.usage.input_tokens,
          completion_tokens: response.usage.output_tokens,
          total_tokens: response.usage.input_tokens + response.usage.output_tokens
        } : undefined,
        model: config.model,
        provider: 'anthropic',
        processing_time_ms
      };

    } catch (error) {
      logger.error('Anthropic API error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) {
      throw new Error('OpenAI provider not initialized (required for embeddings)');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-ada-002',
        input: text,
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding generated');
      }

      return response.data[0].embedding;

    } catch (error) {
      logger.error('Embedding generation failed:', error);
      throw error;
    }
  }

  async validateConfiguration(config: AIProviderConfig): Promise<boolean> {
    try {
      const testMessages: AIMessage[] = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Say "Configuration test successful"' }
      ];

      const response = await this.generateResponse(testMessages, {
        ...config,
        max_tokens: 50
      });

      return response.content.toLowerCase().includes('configuration test successful');

    } catch (error) {
      logger.error('AI configuration validation failed:', { config, error });
      return false;
    }
  }

  getAvailableProviders(): { provider: string; models: string[]; available: boolean }[] {
    return [
      {
        provider: 'openai',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        available: !!this.openai
      },
      {
        provider: 'anthropic',
        models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
        available: !!this.anthropic
      }
    ];
  }

  async healthCheck(): Promise<{ openai: boolean; anthropic: boolean }> {
    const health = {
      openai: false,
      anthropic: false
    };

    // Test OpenAI
    if (this.openai) {
      try {
        await this.openai.models.list();
        health.openai = true;
      } catch (error) {
        logger.error('OpenAI health check failed:', error);
      }
    }

    // Test Anthropic
    if (this.anthropic) {
      try {
        const testMessages: AIMessage[] = [
          { role: 'user', content: 'Hello' }
        ];
        await this.generateAnthropicResponse(testMessages, {
          provider: 'anthropic',
          model: 'claude-3-haiku',
          max_tokens: 10
        }, Date.now());
        health.anthropic = true;
      } catch (error) {
        logger.error('Anthropic health check failed:', error);
      }
    }

    return health;
  }
}

// Singleton instance
const aiProvider = new AIProviderService();
export default aiProvider; 