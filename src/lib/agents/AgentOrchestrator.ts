import { AgentMessage, AgentStatus, AgentTeam, Workflow, WorkflowStep } from './types';
import { AgentManager } from './AgentManager';

export interface TaskDecomposition {
  id: string;
  originalTask: string;
  subtasks: SubTask[];
  dependencies: TaskDependency[];
  estimatedDuration: number;
  requiredCapabilities: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SubTask {
  id: string;
  name: string;
  description: string;
  assignedAgent?: string;
  requiredCapabilities: string[];
  estimatedDuration: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
  result?: any;
}

export interface TaskDependency {
  prerequisite: string;
  dependent: string;
  type: 'sequential' | 'parallel' | 'conditional';
}

export interface ResourceAllocation {
  agentId: string;
  taskId: string;
  priority: number;
  allocatedTime: number;
  conflictScore: number;
}

export class AgentOrchestrator {
  private agentManager: AgentManager;
  private activeWorkflows: Map<string, Workflow> = new Map();
  private taskDecompositions: Map<string, TaskDecomposition> = new Map();
  private resourceAllocations: Map<string, ResourceAllocation[]> = new Map();
  private performanceMetrics: Map<string, any> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  public async orchestrateTask(request: {
    task: string;
    parameters: any;
    priority: 'low' | 'medium' | 'high' | 'critical';
    requesterId: string;
  }): Promise<{
    workflowId: string;
    decomposition: TaskDecomposition;
    estimatedCompletion: Date;
  }> {
    console.log(`🎯 Orchestrating task: ${request.task}`);

    // 1. Intelligent task decomposition
    const decomposition = await this.decomposeTask(request);
    
    // 2. Analyze agent capabilities and availability
    const agentCapabilities = await this.analyzeAgentCapabilities();
    
    // 3. Optimize resource allocation
    const allocation = await this.optimizeResourceAllocation(decomposition, agentCapabilities);
    
    // 4. Create coordinated workflow
    const workflow = await this.createCoordinatedWorkflow(decomposition, allocation);
    
    // 5. Initiate execution with monitoring
    await this.initiateExecution(workflow);

    return {
      workflowId: workflow.id,
      decomposition,
      estimatedCompletion: new Date(Date.now() + decomposition.estimatedDuration * 60000)
    };
  }

  private async decomposeTask(request: any): Promise<TaskDecomposition> {
    const taskId = `task_${Date.now()}`;
    
    // AI-powered task decomposition based on task type
    const decomposition = await this.intelligentDecomposition(request);
    
    this.taskDecompositions.set(taskId, decomposition);
    return decomposition;
  }

  private async intelligentDecomposition(request: any): Promise<TaskDecomposition> {
    // Workshop planning decomposition logic
    if (request.task.includes('workshop') || request.task.includes('governance')) {
      return {
        id: `decomp_${Date.now()}`,
        originalTask: request.task,
        subtasks: [
          {
            id: 'subtask_data_analysis',
            name: 'Data Quality Assessment',
            description: 'Analyze existing data quality for workshop planning',
            requiredCapabilities: ['assess-data-quality', 'generate-quality-scorecard'],
            estimatedDuration: 15,
            status: 'pending',
            dependencies: []
          },
          {
            id: 'subtask_infrastructure',
            name: 'Database Preparation',
            description: 'Prepare database infrastructure for workshop data',
            requiredCapabilities: ['create-table', 'optimize-performance'],
            estimatedDuration: 10,
            status: 'pending',
            dependencies: []
          },
          {
            id: 'subtask_planning',
            name: 'Workshop Plan Creation',
            description: 'Create comprehensive workshop plan with materials',
            requiredCapabilities: ['create-workshop-plan', 'generate-workshop-materials'],
            estimatedDuration: 30,
            status: 'pending',
            dependencies: ['subtask_data_analysis', 'subtask_infrastructure']
          },
          {
            id: 'subtask_coordination',
            name: 'Multi-Agent Coordination',
            description: 'Coordinate all agents for workshop execution',
            requiredCapabilities: ['facilitate-workshop'],
            estimatedDuration: 20,
            status: 'pending',
            dependencies: ['subtask_planning']
          }
        ],
        dependencies: [
          { prerequisite: 'subtask_data_analysis', dependent: 'subtask_planning', type: 'sequential' },
          { prerequisite: 'subtask_infrastructure', dependent: 'subtask_planning', type: 'sequential' },
          { prerequisite: 'subtask_planning', dependent: 'subtask_coordination', type: 'sequential' }
        ],
        estimatedDuration: 75,
        requiredCapabilities: ['workshop-planning', 'data-quality-assessment', 'database-management'],
        priority: request.priority
      };
    }

    // Default decomposition for other tasks
    return {
      id: `decomp_${Date.now()}`,
      originalTask: request.task,
      subtasks: [{
        id: 'subtask_default',
        name: request.task,
        description: `Execute ${request.task}`,
        requiredCapabilities: [],
        estimatedDuration: 30,
        status: 'pending',
        dependencies: []
      }],
      dependencies: [],
      estimatedDuration: 30,
      requiredCapabilities: [],
      priority: request.priority
    };
  }

  private async analyzeAgentCapabilities(): Promise<Map<string, any>> {
    const agents = this.agentManager.getAllAgentStatuses();
    const capabilities = new Map();

    for (const agent of agents) {
      const performance = this.performanceMetrics.get(agent.id) || {
        successRate: 0.95,
        averageTime: agent.performance.averageResponseTime,
        loadFactor: agent.status === 'busy' ? 1.0 : 0.0,
        specialization: this.calculateSpecialization(agent.capabilities)
      };

      capabilities.set(agent.id, {
        ...agent,
        performance,
        availability: agent.status === 'idle' ? 1.0 : 0.3,
        capabilities: agent.capabilities
      });
    }

    return capabilities;
  }

  private calculateSpecialization(capabilities: string[]): Record<string, number> {
    const specialization: Record<string, number> = {};
    
    // Workshop specialization
    const workshopCaps = capabilities.filter(cap => 
      cap.includes('workshop') || cap.includes('facilitate') || cap.includes('plan')
    );
    specialization['workshop'] = workshopCaps.length / capabilities.length;

    // Data specialization
    const dataCaps = capabilities.filter(cap => 
      cap.includes('data') || cap.includes('quality') || cap.includes('assess')
    );
    specialization['data'] = dataCaps.length / capabilities.length;

    // Database specialization
    const dbCaps = capabilities.filter(cap => 
      cap.includes('database') || cap.includes('query') || cap.includes('table')
    );
    specialization['database'] = dbCaps.length / capabilities.length;

    return specialization;
  }

  private async optimizeResourceAllocation(
    decomposition: TaskDecomposition, 
    agentCapabilities: Map<string, any>
  ): Promise<Map<string, ResourceAllocation[]>> {
    const allocations = new Map<string, ResourceAllocation[]>();

    for (const subtask of decomposition.subtasks) {
      const candidates = this.findOptimalAgents(subtask, agentCapabilities);
      const bestAgent = this.selectBestAgent(candidates, subtask);
      
      if (bestAgent) {
        const allocation: ResourceAllocation = {
          agentId: bestAgent.id,
          taskId: subtask.id,
          priority: this.calculatePriority(decomposition.priority, subtask),
          allocatedTime: subtask.estimatedDuration,
          conflictScore: this.calculateConflictScore(bestAgent.id, subtask)
        };

        const agentAllocations = allocations.get(bestAgent.id) || [];
        agentAllocations.push(allocation);
        allocations.set(bestAgent.id, agentAllocations);

        subtask.assignedAgent = bestAgent.id;
      }
    }

    this.resourceAllocations.set(decomposition.id, Array.from(allocations.values()).flat());
    return allocations;
  }

  private findOptimalAgents(subtask: SubTask, agentCapabilities: Map<string, any>): any[] {
    const candidates = [];

    for (const [agentId, agentInfo] of agentCapabilities) {
      const matchScore = this.calculateCapabilityMatch(subtask.requiredCapabilities, agentInfo.capabilities);
      
      if (matchScore > 0) {
        candidates.push({
          ...agentInfo,
          matchScore,
          suitabilityScore: this.calculateSuitabilityScore(agentInfo, subtask)
        });
      }
    }

    return candidates.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
  }

  private calculateCapabilityMatch(required: string[], available: string[]): number {
    if (required.length === 0) return 0.5; // Default match for tasks without specific requirements
    
    const matches = required.filter(req => 
      available.some(avail => avail.includes(req) || req.includes(avail))
    );
    
    return matches.length / required.length;
  }

  private calculateSuitabilityScore(agent: any, subtask: SubTask): number {
    const capabilityScore = this.calculateCapabilityMatch(subtask.requiredCapabilities, agent.capabilities);
    const availabilityScore = agent.availability;
    const performanceScore = agent.performance.successRate;
    const specializationScore = this.getRelevantSpecialization(agent.performance.specialization, subtask);

    return (capabilityScore * 0.4) + (availabilityScore * 0.3) + (performanceScore * 0.2) + (specializationScore * 0.1);
  }

  private getRelevantSpecialization(specialization: Record<string, number>, subtask: SubTask): number {
    if (subtask.name.includes('Workshop') || subtask.name.includes('Plan')) {
      return specialization['workshop'] || 0;
    }
    if (subtask.name.includes('Data') || subtask.name.includes('Quality')) {
      return specialization['data'] || 0;
    }
    if (subtask.name.includes('Database') || subtask.name.includes('Infrastructure')) {
      return specialization['database'] || 0;
    }
    return 0.5; // Neutral for unclear tasks
  }

  private selectBestAgent(candidates: any[], subtask: SubTask): any | null {
    if (candidates.length === 0) return null;
    
    // Apply load balancing
    const loadBalanced = candidates.filter(c => c.performance.loadFactor < 0.8);
    
    return loadBalanced.length > 0 ? loadBalanced[0] : candidates[0];
  }

  private calculatePriority(basePriority: string, subtask: SubTask): number {
    const baseScore = { low: 1, medium: 2, high: 3, critical: 4 }[basePriority] || 2;
    
    // Boost priority for blocking tasks
    const hasNoDependents = !subtask.dependencies || subtask.dependencies.length === 0;
    const priorityBoost = hasNoDependents ? 0.5 : 0;
    
    return baseScore + priorityBoost;
  }

  private calculateConflictScore(agentId: string, subtask: SubTask): number {
    const existingAllocations = this.resourceAllocations.get(agentId) || [];
    return existingAllocations.length * 0.1; // Simple conflict scoring
  }

  private async createCoordinatedWorkflow(
    decomposition: TaskDecomposition, 
    allocations: Map<string, ResourceAllocation[]>
  ): Promise<Workflow> {
    const workflowId = `workflow_${Date.now()}`;
    
    const steps: WorkflowStep[] = decomposition.subtasks.map(subtask => ({
      id: subtask.id,
      name: subtask.name,
      agentId: subtask.assignedAgent || 'unassigned',
      input: {
        task: subtask.name,
        description: subtask.description,
        parameters: {}
      },
      status: 'pending',
      dependencies: subtask.dependencies,
      humanApprovalRequired: false
    }));

    const workflow: Workflow = {
      id: workflowId,
      name: `Orchestrated: ${decomposition.originalTask}`,
      steps,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'agent-orchestrator'
    };

    this.activeWorkflows.set(workflowId, workflow);
    return workflow;
  }

  private async initiateExecution(workflow: Workflow): Promise<void> {
    console.log(`🚀 Initiating coordinated execution for workflow: ${workflow.id}`);
    
    workflow.status = 'active';
    
    // Start with steps that have no dependencies
    const readySteps = workflow.steps.filter(step => 
      step.dependencies.length === 0 && step.status === 'pending'
    );

    for (const step of readySteps) {
      await this.executeStep(workflow.id, step);
    }
  }

  private async executeStep(workflowId: string, step: WorkflowStep): Promise<void> {
    console.log(`⚡ Executing step: ${step.name} with agent: ${step.agentId}`);
    
    step.status = 'in_progress';
    
    const message: AgentMessage = {
      id: `orchestrated_${Date.now()}`,
      from: 'agent-orchestrator',
      to: step.agentId,
      type: 'task',
      payload: {
        task: this.mapStepToAgentTask(step),
        parameters: {
          ...step.input.parameters,
          workflowId,
          stepId: step.id,
          orchestrated: true
        }
      },
      timestamp: new Date(),
      priority: 'high',
      correlationId: workflowId
    };

    // Route message through AgentManager
    await this.agentManager.routeMessage(message);
    
    // Set up monitoring for step completion
    this.monitorStepExecution(workflowId, step);
  }

  private mapStepToAgentTask(step: WorkflowStep): string {
    // Map orchestrator step names to specific agent tasks
    const taskMappings: Record<string, string> = {
      'Data Quality Assessment': 'assess-data-quality',
      'Database Preparation': 'create-table',
      'Workshop Plan Creation': 'create-workshop-plan',
      'Multi-Agent Coordination': 'facilitate-workshop'
    };

    return taskMappings[step.name] || step.name.toLowerCase().replace(/\s+/g, '-');
  }

  private monitorStepExecution(workflowId: string, step: WorkflowStep): void {
    // Simulate step completion for demo purposes
    setTimeout(() => {
      step.status = 'completed';
      step.output = { success: true, result: `${step.name} completed successfully` };
      
      console.log(`✅ Step completed: ${step.name}`);
      
      // Check for next steps that can be executed
      this.checkForReadySteps(workflowId);
    }, Math.random() * 10000 + 5000); // 5-15 second random completion
  }

  private checkForReadySteps(workflowId: string): void {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const readySteps = workflow.steps.filter(step => {
      if (step.status !== 'pending') return false;
      
      // Check if all dependencies are completed
      return step.dependencies.every(depId => {
        const depStep = workflow.steps.find(s => s.id === depId);
        return depStep?.status === 'completed';
      });
    });

    // Execute newly ready steps
    for (const step of readySteps) {
      this.executeStep(workflowId, step);
    }

    // Check if workflow is complete
    const allCompleted = workflow.steps.every(step => 
      step.status === 'completed' || step.status === 'failed'
    );

    if (allCompleted) {
      workflow.status = 'completed';
      console.log(`🎉 Workflow completed: ${workflow.id}`);
    }
  }

  public getActiveWorkflows(): Workflow[] {
    return Array.from(this.activeWorkflows.values());
  }

  public getWorkflowStatus(workflowId: string): Workflow | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  public updatePerformanceMetrics(agentId: string, taskResult: any): void {
    const existing = this.performanceMetrics.get(agentId) || {
      successRate: 0.95,
      averageTime: 2000,
      loadFactor: 0.0,
      specialization: {}
    };

    // Update metrics based on task result
    const success = taskResult.success !== false;
    existing.successRate = (existing.successRate * 0.9) + (success ? 0.1 : 0);
    
    this.performanceMetrics.set(agentId, existing);
  }
} 