import { BaseAgent } from './BaseAgent';
import { AgentMessage, AgentTeam, AgentStatus } from './types';
import { Server as SocketIOServer } from 'socket.io';
import { Pool } from 'pg';

export class AgentManager {
  private agents: Map<string, BaseAgent> = new Map();
  private teams: Map<string, AgentTeam> = new Map();
  private messageHistory: AgentMessage[] = [];
  private io?: SocketIOServer;
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.initializeDatabase();
    this.initializeTeams();
  }

  public setSocketServer(io: SocketIOServer): void {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      socket.on('agent-message', async (message: AgentMessage) => {
        await this.routeMessage(message);
      });

      socket.on('get-agent-status', () => {
        const statuses = Array.from(this.agents.values()).map(agent => agent.getStatus());
        socket.emit('agent-statuses', statuses);
      });

      socket.on('get-team-status', () => {
        const teamStatuses = Array.from(this.teams.values());
        socket.emit('team-statuses', teamStatuses);
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'future_thought_db',
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD || '',
      });

      const client = await this.pool.connect();
      
      // Create agent_states table
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_states (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          status VARCHAR(50) DEFAULT 'idle',
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          current_task VARCHAR(500),
          performance_metrics JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create team_states table
      await client.query(`
        CREATE TABLE IF NOT EXISTS team_states (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          agents TEXT[] DEFAULT '{}',
          coordinator VARCHAR(255),
          capabilities TEXT[] DEFAULT '{}',
          status VARCHAR(50) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create agent_messages table
      await client.query(`
        CREATE TABLE IF NOT EXISTS agent_messages (
          id VARCHAR(255) PRIMARY KEY,
          from_agent VARCHAR(255) NOT NULL,
          to_agent VARCHAR(255) NOT NULL,
          message_type VARCHAR(50) NOT NULL,
          content TEXT,
          metadata JSONB DEFAULT '{}',
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(50) DEFAULT 'sent'
        )
      `);

      client.release();
      this.isConnected = true;
      console.log('✅ AgentManager database connection established');
    } catch (error) {
      console.error('❌ AgentManager database connection failed:', error);
      this.isConnected = false;
    }
  }

  public registerAgent(agent: BaseAgent): void {
    this.agents.set(agent.getId(), agent);
    this.persistAgentState(agent);
    this.log(`Agent registered: ${agent.getName()} (${agent.getId()})`);
  }

  public unregisterAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      this.log(`Agent unregistered: ${agent.getName()} (${agentId})`);
    }
  }

  public async routeMessage(message: AgentMessage): Promise<void> {
    this.messageHistory.push(message);
    
    // Store message in database
    await this.storeMessage(message);

    if (message.to === 'broadcast') {
      // Broadcast to all agents
      for (const agent of this.agents.values()) {
        await agent.receiveMessage(message);
        this.persistAgentState(agent);
      }
    } else {
      // Route to specific agent
      const targetAgent = this.agents.get(message.to);
      if (targetAgent) {
        await targetAgent.receiveMessage(message);
        this.persistAgentState(targetAgent);
      } else {
        this.log(`Target agent not found: ${message.to}`, 'error');
      }
    }

    // Emit to connected clients
    if (this.io) {
      this.io.emit('agent-message', message);
    }
  }

  public getAgentStatus(agentId: string): AgentStatus | null {
    const agent = this.agents.get(agentId);
    return agent ? agent.getStatus() : null;
  }

  public getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agents.values()).map(agent => agent.getStatus());
  }

  public getTeamStatus(teamId: string): AgentTeam | null {
    return this.teams.get(teamId) || null;
  }

  public getAllTeamStatuses(): AgentTeam[] {
    return Array.from(this.teams.values());
  }

  public getMessageHistory(): AgentMessage[] {
    return this.messageHistory;
  }

  private async storeMessage(message: AgentMessage): Promise<void> {
    if (!this.isConnected) {
      console.log('Database not connected, storing message in memory only');
      return;
    }

    try {
      const client = await this.pool.connect();
      await client.query(
        `INSERT INTO agent_messages (id, from_agent, to_agent, message_type, content, metadata, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          message.from,
          message.to,
          message.type,
          message.content,
          JSON.stringify(message.metadata || {}),
          new Date(),
        ]
      );
      client.release();
      console.log('✅ Message stored in database');
    } catch (error) {
      console.error('❌ Error storing message in database:', error);
    }
  }

  private async persistAgentState(agent: BaseAgent): Promise<void> {
    if (!this.isConnected) return;

    try {
      const status = agent.getStatus();
      const client = await this.pool.connect();
      await client.query(
        `INSERT INTO agent_states (id, name, status, last_activity, current_task, performance_metrics, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           last_activity = EXCLUDED.last_activity,
           current_task = EXCLUDED.current_task,
           performance_metrics = EXCLUDED.performance_metrics,
           updated_at = CURRENT_TIMESTAMP`,
        [
          status.id,
          status.name,
          status.status,
          status.lastActivity,
          status.currentTask,
          JSON.stringify(status.performanceMetrics || {}),
        ]
      );
      client.release();
    } catch (error) {
      console.error('Error persisting agent state:', error);
    }
  }

  private async persistTeamState(team: AgentTeam): Promise<void> {
    if (!this.isConnected) return;

    try {
      const client = await this.pool.connect();
      await client.query(
        `INSERT INTO team_states (id, name, agents, coordinator, capabilities, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           agents = EXCLUDED.agents,
           coordinator = EXCLUDED.coordinator,
           capabilities = EXCLUDED.capabilities,
           status = EXCLUDED.status,
           updated_at = CURRENT_TIMESTAMP`,
        [
          team.id,
          team.name,
          team.agents,
          team.coordinator,
          team.capabilities,
          team.status,
        ]
      );
      client.release();
    } catch (error) {
      console.error('Error persisting team state:', error);
    }
  }

  private async initializeTeams(): Promise<void> {
    // Governance Workshop Team
    const governanceTeam: AgentTeam = {
      id: 'governance-workshop',
      name: 'Governance Workshop Team',
      agents: ['workshop-planner', 'co-design-specialist', 'data-analyst', 'content-creator'],
      coordinator: 'workshop-planner',
      capabilities: ['workshop-planning', 'co-design', 'data-analysis', 'content-creation'],
      status: 'active',
    };
    this.teams.set('governance-workshop', governanceTeam);
    await this.persistTeamState(governanceTeam);

    // Tool Development Team
    const toolTeam: AgentTeam = {
      id: 'tool-development',
      name: 'Tool Development Team',
      agents: ['tool-creator', 'library-manager', 'api-specialist', 'qa-tester'],
      coordinator: 'tool-creator',
      capabilities: ['tool-creation', 'library-management', 'api-integration', 'testing'],
      status: 'active',
    };
    this.teams.set('tool-development', toolTeam);
    await this.persistTeamState(toolTeam);

    // Database Management Team
    const dbTeam: AgentTeam = {
      id: 'database-management',
      name: 'Database Management Team',
      agents: ['db-admin', 'schema-manager', 'performance-optimizer', 'backup-manager'],
      coordinator: 'db-admin',
      capabilities: ['database-administration', 'schema-management', 'performance-optimization', 'backup-recovery'],
      status: 'active',
    };
    this.teams.set('database-management', dbTeam);
    await this.persistTeamState(dbTeam);

    // Data Validation and Quality Analytics Team
    const qualityTeam: AgentTeam = {
      id: 'data-quality-analytics',
      name: 'Data Validation and Quality Analytics Team',
      agents: ['data-quality-assessor', 'validation-rule-engine', 'anomaly-detector', 'data-lineage-tracker', 'compliance-monitor'],
      coordinator: 'data-quality-assessor',
      capabilities: ['data-quality-assessment', 'validation-rule-management', 'anomaly-detection', 'data-lineage-tracking', 'compliance-monitoring', 'data-profiling'],
      status: 'active',
    };
    this.teams.set('data-quality-analytics', qualityTeam);
    await this.persistTeamState(qualityTeam);

    // Database Management Team Agents
    this.agents.set('db-admin', new (await import('./DatabaseManagerAgent')).DatabaseManagerAgent());
    this.agents.set('schema-manager', new BaseAgent('schema-manager', 'Schema Manager Agent'));
    this.agents.set('performance-optimizer', new BaseAgent('performance-optimizer', 'Performance Optimizer Agent'));
    this.agents.set('backup-manager', new BaseAgent('backup-manager', 'Backup Manager Agent'));

    // Data Quality Analytics Team Agents
    this.agents.set('data-quality-assessor', new (await import('./DataQualityAssessmentAgent')).DataQualityAssessmentAgent());
    this.agents.set('validation-rule-engine', new BaseAgent('validation-rule-engine', 'Validation Rule Engine Agent'));
    this.agents.set('anomaly-detector', new BaseAgent('anomaly-detector', 'Anomaly Detection Agent'));
    this.agents.set('data-lineage-tracker', new BaseAgent('data-lineage-tracker', 'Data Lineage Tracker Agent'));
    this.agents.set('compliance-monitor', new BaseAgent('compliance-monitor', 'Compliance Monitor Agent'));
  }

  public async createWorkflow(workflow: any): Promise<string> {
    // TODO: Implement workflow creation
    const workflowId = `workflow_${Date.now()}`;
    this.log(`Workflow created: ${workflowId}`);
    return workflowId;
  }

  public async executeWorkflow(workflowId: string): Promise<void> {
    // TODO: Implement workflow execution
    this.log(`Executing workflow: ${workflowId}`);
  }

  public async pauseWorkflow(workflowId: string): Promise<void> {
    // TODO: Implement workflow pausing
    this.log(`Pausing workflow: ${workflowId}`);
  }

  public async resumeWorkflow(workflowId: string): Promise<void> {
    // TODO: Implement workflow resuming
    this.log(`Resuming workflow: ${workflowId}`);
  }

  private log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [AgentManager] [${level.toUpperCase()}]: ${message}`);
  }
} 