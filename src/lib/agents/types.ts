export interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'response' | 'broadcast' | 'error' | 'status';
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
  correlationId?: string;
  metadata?: Record<string, any>;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'busy' | 'error' | 'offline';
  capabilities: string[];
  currentTask?: string;
  lastActivity: Date;
  performance: {
    tasksCompleted: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

export interface AgentCapability {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returnType: string;
}

export interface AgentTeam {
  id: string;
  name: string;
  agents: string[];
  coordinator: string;
  capabilities: string[];
  status: 'active' | 'inactive' | 'error';
}

export interface WorkflowStep {
  id: string;
  name: string;
  agentId: string;
  input: any;
  output?: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  humanApprovalRequired: boolean;
  humanApproved?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  status: 'draft' | 'active' | 'completed' | 'paused';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface DocumentMetadata {
  id: string;
  name: string;
  type: 'presentation' | 'document' | 'spreadsheet' | 'pdf';
  size: number;
  lastModified: Date;
  tags: string[];
  source: 'upload' | 'sharepoint' | 'cloud' | 'local';
  path: string;
  content?: string;
  embeddings?: number[];
}

export interface DataSource {
  id: string;
  name: string;
  type: 'sharepoint' | 'cloud' | 'local' | 'database';
  config: Record<string, any>;
  status: 'connected' | 'disconnected' | 'error';
  lastSync: Date;
}

export interface HumanIntervention {
  id: string;
  workflowId: string;
  stepId: string;
  type: 'approval' | 'review' | 'decision' | 'exception';
  message: string;
  options?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}

// MCP (Model Context Protocol) interfaces
export interface MCPRequest {
  method: string;
  params: Record<string, any>;
  id: string;
}

export interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// ACP (Agent Communication Protocol) interfaces
export interface ACPMessage {
  protocol: 'ACP';
  version: '1.0';
  messageType: 'request' | 'response' | 'notification';
  sender: string;
  recipient: string;
  payload: any;
  timestamp: Date;
  messageId: string;
}

export interface DatabaseSchema {
  tables: {
    [tableName: string]: {
      columns: {
        [columnName: string]: {
          type: string;
          nullable: boolean;
          primaryKey?: boolean;
          foreignKey?: string;
        };
      };
      indexes?: string[];
    };
  };
} 