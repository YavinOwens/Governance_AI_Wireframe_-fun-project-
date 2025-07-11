import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { AgentMessage } from '../agents/types';
import { AgentManager } from '../agents/AgentManager';

export class WebSocketServer {
  private io: SocketIOServer;
  private agentManager: AgentManager;

  constructor(httpServer: HTTPServer, agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.agentManager.setSocketServer(this.io);
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle agent message routing
      socket.on('agent-message', async (message: AgentMessage) => {
        try {
          await this.agentManager.routeMessage(message);
        } catch (error) {
          console.error('Error routing agent message:', error);
          socket.emit('error', {
            type: 'agent-message-error',
            message: 'Failed to route agent message',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle agent status requests
      socket.on('get-agent-status', () => {
        try {
          const statuses = this.agentManager.getAllAgentStatuses();
          socket.emit('agent-statuses', statuses);
        } catch (error) {
          console.error('Error getting agent statuses:', error);
          socket.emit('error', {
            type: 'agent-status-error',
            message: 'Failed to get agent statuses',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle team status requests
      socket.on('get-team-status', () => {
        try {
          const teamStatuses = this.agentManager.getAllTeamStatuses();
          socket.emit('team-statuses', teamStatuses);
        } catch (error) {
          console.error('Error getting team statuses:', error);
          socket.emit('error', {
            type: 'team-status-error',
            message: 'Failed to get team statuses',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle workflow operations
      socket.on('create-workflow', async (workflowData) => {
        try {
          const workflowId = await this.agentManager.createWorkflow(workflowData);
          socket.emit('workflow-created', { workflowId, success: true });
        } catch (error) {
          console.error('Error creating workflow:', error);
          socket.emit('error', {
            type: 'workflow-creation-error',
            message: 'Failed to create workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('execute-workflow', async (workflowId) => {
        try {
          await this.agentManager.executeWorkflow(workflowId);
          socket.emit('workflow-executed', { workflowId, success: true });
        } catch (error) {
          console.error('Error executing workflow:', error);
          socket.emit('error', {
            type: 'workflow-execution-error',
            message: 'Failed to execute workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('pause-workflow', async (workflowId) => {
        try {
          await this.agentManager.pauseWorkflow(workflowId);
          socket.emit('workflow-paused', { workflowId, success: true });
        } catch (error) {
          console.error('Error pausing workflow:', error);
          socket.emit('error', {
            type: 'workflow-pause-error',
            message: 'Failed to pause workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('resume-workflow', async (workflowId) => {
        try {
          await this.agentManager.resumeWorkflow(workflowId);
          socket.emit('workflow-resumed', { workflowId, success: true });
        } catch (error) {
          console.error('Error resuming workflow:', error);
          socket.emit('error', {
            type: 'workflow-resume-error',
            message: 'Failed to resume workflow',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle data source operations
      socket.on('connect-data-source', async (data) => {
        try {
          const { sourceId, config } = data;
          // This would integrate with DataSourceManager
          socket.emit('data-source-connected', { sourceId, success: true });
        } catch (error) {
          console.error('Error connecting data source:', error);
          socket.emit('error', {
            type: 'data-source-connection-error',
            message: 'Failed to connect data source',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('sync-data-source', async (sourceId) => {
        try {
          // This would integrate with DataSourceManager
          socket.emit('data-source-synced', { sourceId, success: true });
        } catch (error) {
          console.error('Error syncing data source:', error);
          socket.emit('error', {
            type: 'data-source-sync-error',
            message: 'Failed to sync data source',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle human intervention requests
      socket.on('human-intervention-request', (interventionData) => {
        try {
          // This would create a human intervention request
          socket.emit('human-intervention-created', { 
            interventionId: `intervention_${Date.now()}`,
            success: true 
          });
        } catch (error) {
          console.error('Error creating human intervention:', error);
          socket.emit('error', {
            type: 'human-intervention-error',
            message: 'Failed to create human intervention',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('resolve-human-intervention', async (data) => {
        try {
          const { interventionId, resolution } = data;
          // This would resolve the human intervention
          socket.emit('human-intervention-resolved', { 
            interventionId, 
            resolution,
            success: true 
          });
        } catch (error) {
          console.error('Error resolving human intervention:', error);
          socket.emit('error', {
            type: 'human-intervention-resolution-error',
            message: 'Failed to resolve human intervention',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle document operations
      socket.on('upload-document', async (fileData) => {
        try {
          // This would integrate with DataSourceManager
          socket.emit('document-uploaded', { 
            documentId: `doc_${Date.now()}`,
            success: true 
          });
        } catch (error) {
          console.error('Error uploading document:', error);
          socket.emit('error', {
            type: 'document-upload-error',
            message: 'Failed to upload document',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      socket.on('delete-document', async (documentId) => {
        try {
          // This would integrate with DataSourceManager
          socket.emit('document-deleted', { documentId, success: true });
        } catch (error) {
          console.error('Error deleting document:', error);
          socket.emit('error', {
            type: 'document-deletion-error',
            message: 'Failed to delete document',
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      });

      // Handle room joining for specific workflows
      socket.on('join-workflow-room', (workflowId) => {
        socket.join(`workflow_${workflowId}`);
        socket.emit('joined-workflow-room', { workflowId });
      });

      socket.on('leave-workflow-room', (workflowId) => {
        socket.leave(`workflow_${workflowId}`);
        socket.emit('left-workflow-room', { workflowId });
      });

      // Handle client disconnection
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  public broadcastToWorkflow(workflowId: string, event: string, data: any): void {
    this.io.to(`workflow_${workflowId}`).emit(event, data);
  }

  public broadcastToAll(event: string, data: any): void {
    this.io.emit(event, data);
  }

  public getConnectedClients(): number {
    return this.io.engine.clientsCount;
  }

  public close(): void {
    this.io.close();
  }
} 