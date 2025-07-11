import { NextRequest, NextResponse } from 'next/server';
import { AgentManager } from '@/lib/agents/AgentManager';
import { WorkshopPlannerAgent } from '@/lib/agents/WorkshopPlannerAgent';
import { DatabaseManagerAgent } from '@/lib/agents/DatabaseManagerAgent';

// Global agent manager instance
let agentManager: AgentManager;

if (!agentManager) {
  agentManager = new AgentManager();
  
  // Register default agents
  const workshopPlanner = new WorkshopPlannerAgent();
  const databaseManager = new DatabaseManagerAgent();
  
  agentManager.registerAgent(workshopPlanner);
  agentManager.registerAgent(databaseManager);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const statuses = agentManager.getAllAgentStatuses();
        return NextResponse.json({ success: true, data: statuses });

      case 'teams':
        const teams = agentManager.getAllTeamStatuses();
        return NextResponse.json({ success: true, data: teams });

      case 'messages':
        const messages = agentManager.getMessageHistory();
        return NextResponse.json({ success: true, data: messages });

      default:
        return NextResponse.json({ 
          success: true, 
          data: {
            agents: agentManager.getAllAgentStatuses(),
            teams: agentManager.getAllTeamStatuses(),
          }
        });
    }
  } catch (error) {
    console.error('Error in agents API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case 'register':
        // Register a new agent
        if (data.agent) {
          agentManager.registerAgent(data.agent);
          return NextResponse.json({ success: true, message: 'Agent registered successfully' });
        }
        break;

      case 'message':
        // Route a message between agents
        if (data.message) {
          await agentManager.routeMessage(data.message);
          return NextResponse.json({ success: true, message: 'Message routed successfully' });
        }
        break;

      case 'workflow':
        // Create or manage workflows
        if (data.workflow) {
          const workflowId = await agentManager.createWorkflow(data.workflow);
          return NextResponse.json({ success: true, workflowId });
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request data' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in agents API POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 