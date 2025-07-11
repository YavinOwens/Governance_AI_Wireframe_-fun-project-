import { AgentMessage, AgentStatus } from './types';
import { AgentManager } from './AgentManager';

export interface TaskCapability {
  name: string;
  complexity: number;
  requiredResources: string[];
  estimatedDuration: number;
  dependencies: string[];
}

export interface TaskRequest {
  id: string;
  task: string;
  parameters: any;
  priority: 'low' | 'medium' | 'high' | 'critical';
  deadline?: Date;
  requiredCapabilities: string[];
  requesterId: string;
  timestamp: Date;
}

export interface AgentCapabilityScore {
  agentId: string;
  score: number;
  capabilities: string[];
  availability: number;
  performance: number;
  specialization: number;
  loadFactor: number;
}

export interface TaskAssignment {
  taskId: string;
  agentId: string;
  assignedAt: Date;
  estimatedCompletion: Date;
  status: 'assigned' | 'in_progress' | 'completed' | 'failed' | 'reassigned';
  actualCompletion?: Date;
  performance?: number;
}

export class TaskDistributor {
  private agentManager: AgentManager;
  private taskQueue: Map<string, TaskRequest> = new Map();
  private activeAssignments: Map<string, TaskAssignment> = new Map();
  private capabilityRegistry: Map<string, TaskCapability> = new Map();
  private agentPerformanceHistory: Map<string, any[]> = new Map();
  private distributionMetrics: Map<string, number> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.initializeCapabilityRegistry();
    this.startTaskDistribution();
  }

  private initializeCapabilityRegistry(): void {
    console.log('🎯 Initializing Task Distribution System...');

    // Register known task capabilities
    this.registerCapability({
      name: 'workshop-planning',
      complexity: 0.8,
      requiredResources: ['planning', 'facilitation'],
      estimatedDuration: 30,
      dependencies: []
    });

    this.registerCapability({
      name: 'data-quality-assessment',
      complexity: 0.7,
      requiredResources: ['analysis', 'statistics'],
      estimatedDuration: 15,
      dependencies: []
    });

    this.registerCapability({
      name: 'database-management',
      complexity: 0.6,
      requiredResources: ['database', 'sql'],
      estimatedDuration: 10,
      dependencies: []
    });

    this.registerCapability({
      name: 'report-generation',
      complexity: 0.5,
      requiredResources: ['analysis', 'reporting'],
      estimatedDuration: 20,
      dependencies: ['data-quality-assessment']
    });

    // Initialize metrics
    this.distributionMetrics.set('tasks_distributed', 0);
    this.distributionMetrics.set('successful_assignments', 0);
    this.distributionMetrics.set('failed_assignments', 0);
    this.distributionMetrics.set('average_completion_time', 0);
    this.distributionMetrics.set('load_balance_score', 1.0);
  }

  public registerCapability(capability: TaskCapability): void {
    this.capabilityRegistry.set(capability.name, capability);
    console.log(`📋 Registered capability: ${capability.name}`);
  }

  public async submitTask(request: TaskRequest): Promise<string> {
    console.log(`📥 Task submitted: ${request.task} (Priority: ${request.priority})`);
    
    this.taskQueue.set(request.id, request);
    
    // Immediate distribution for high priority tasks
    if (request.priority === 'critical' || request.priority === 'high') {
      await this.distributeTask(request);
    }

    return request.id;
  }

  private startTaskDistribution(): void {
    // Continuous task distribution every 3 seconds
    setInterval(() => {
      this.distributeQueuedTasks();
    }, 3000);

    // Load balancing every 10 seconds
    setInterval(() => {
      this.rebalanceLoad();
    }, 10000);

    // Performance analysis every 30 seconds
    setInterval(() => {
      this.analyzeDistributionPerformance();
    }, 30000);
  }

  private async distributeQueuedTasks(): Promise<void> {
    const tasks = Array.from(this.taskQueue.values())
      .sort((a, b) => this.calculateTaskPriority(b) - this.calculateTaskPriority(a));

    for (const task of tasks) {
      const assigned = await this.distributeTask(task);
      if (assigned) {
        this.taskQueue.delete(task.id);
      }
    }
  }

  private calculateTaskPriority(task: TaskRequest): number {
    const priorityScores = { low: 1, medium: 2, high: 3, critical: 4 };
    let priority = priorityScores[task.priority];

    // Boost priority for overdue tasks
    if (task.deadline && task.deadline.getTime() < Date.now()) {
      priority += 2;
    }

    // Boost priority for time-sensitive tasks
    if (task.deadline && task.deadline.getTime() - Date.now() < 300000) { // 5 minutes
      priority += 1;
    }

    return priority;
  }

  private async distributeTask(task: TaskRequest): Promise<boolean> {
    console.log(`🎯 Distributing task: ${task.task}`);

    // Find optimal agent for this task
    const optimalAgent = await this.findOptimalAgent(task);
    
    if (!optimalAgent) {
      console.warn(`⚠️ No suitable agent found for task: ${task.task}`);
      return false;
    }

    // Create assignment
    const assignment: TaskAssignment = {
      taskId: task.id,
      agentId: optimalAgent.agentId,
      assignedAt: new Date(),
      estimatedCompletion: new Date(Date.now() + (optimalAgent.score * 60000)), // Score-based duration
      status: 'assigned'
    };

    this.activeAssignments.set(task.id, assignment);

    // Send task to agent
    const message: AgentMessage = {
      id: `task_${Date.now()}_${optimalAgent.agentId}`,
      from: 'task-distributor',
      to: optimalAgent.agentId,
      type: 'task',
      payload: {
        task: this.mapTaskToAgentAction(task),
        parameters: {
          ...task.parameters,
          taskId: task.id,
          priority: task.priority,
          deadline: task.deadline
        }
      },
      timestamp: new Date(),
      priority: task.priority,
      correlationId: task.id
    };

    await this.agentManager.routeMessage(message);

    // Update metrics
    this.distributionMetrics.set('tasks_distributed', 
      (this.distributionMetrics.get('tasks_distributed') || 0) + 1);

    console.log(`✅ Task assigned: ${task.task} → ${optimalAgent.agentId} (Score: ${optimalAgent.score.toFixed(2)})`);

    // Monitor task execution
    this.monitorTaskExecution(task.id);

    return true;
  }

  private async findOptimalAgent(task: TaskRequest): Promise<AgentCapabilityScore | null> {
    const agents = this.agentManager.getAllAgentStatuses();
    const candidates: AgentCapabilityScore[] = [];

    for (const agent of agents) {
      if (agent.status === 'offline') continue;

      const score = await this.calculateAgentScore(agent, task);
      
      if (score.score > 0.3) { // Minimum capability threshold
        candidates.push(score);
      }
    }

    if (candidates.length === 0) return null;

    // Sort by score and select the best candidate
    candidates.sort((a, b) => b.score - a.score);

    // Apply load balancing - prefer less loaded agents among top candidates
    const topCandidates = candidates.slice(0, Math.min(3, candidates.length));
    return this.selectWithLoadBalancing(topCandidates);
  }

  private async calculateAgentScore(agent: AgentStatus, task: TaskRequest): Promise<AgentCapabilityScore> {
    // 1. Capability matching
    const capabilityScore = this.calculateCapabilityMatch(agent.capabilities, task.requiredCapabilities);
    
    // 2. Availability assessment
    const availability = this.calculateAvailability(agent);
    
    // 3. Performance history
    const performance = this.calculatePerformanceScore(agent.id, task.task);
    
    // 4. Specialization bonus
    const specialization = this.calculateSpecializationScore(agent, task);
    
    // 5. Current load factor
    const loadFactor = this.calculateLoadFactor(agent.id);

    // Weighted score calculation
    const score = (
      capabilityScore * 0.35 +
      availability * 0.25 +
      performance * 0.2 +
      specialization * 0.15 +
      (1 - loadFactor) * 0.05 // Lower load = higher score
    );

    return {
      agentId: agent.id,
      score,
      capabilities: agent.capabilities,
      availability,
      performance,
      specialization,
      loadFactor
    };
  }

  private calculateCapabilityMatch(agentCapabilities: string[], requiredCapabilities: string[]): number {
    if (requiredCapabilities.length === 0) return 0.7; // Default score for general tasks

    let matches = 0;
    let partialMatches = 0;

    for (const required of requiredCapabilities) {
      let found = false;
      
      for (const agentCap of agentCapabilities) {
        if (agentCap === required) {
          matches++;
          found = true;
          break;
        } else if (agentCap.includes(required) || required.includes(agentCap)) {
          partialMatches++;
          found = true;
          break;
        }
      }
    }

    const exactMatchScore = matches / requiredCapabilities.length;
    const partialMatchScore = partialMatches / requiredCapabilities.length * 0.5;

    return Math.min(exactMatchScore + partialMatchScore, 1.0);
  }

  private calculateAvailability(agent: AgentStatus): number {
    switch (agent.status) {
      case 'idle': return 1.0;
      case 'busy': return 0.3;
      case 'error': return 0.1;
      case 'offline': return 0.0;
      default: return 0.5;
    }
  }

  private calculatePerformanceScore(agentId: string, taskType: string): number {
    const history = this.agentPerformanceHistory.get(agentId) || [];
    
    if (history.length === 0) return 0.8; // Default score for new agents

    // Filter relevant task history
    const relevantHistory = history.filter((h: any) => 
      h.taskType === taskType || h.taskType.includes(taskType.split('-')[0])
    );

    if (relevantHistory.length === 0) return 0.7; // Reduced score for unfamiliar tasks

    // Calculate success rate and average completion time
    const successRate = relevantHistory.filter((h: any) => h.success).length / relevantHistory.length;
    const avgCompletionTime = relevantHistory.reduce((sum: number, h: any) => sum + h.completionTime, 0) / relevantHistory.length;

    // Normalize completion time (assume target is 15 seconds)
    const timeScore = Math.max(0, 1 - (avgCompletionTime / 15000));

    return (successRate * 0.7) + (timeScore * 0.3);
  }

  private calculateSpecializationScore(agent: AgentStatus, task: TaskRequest): number {
    const taskCategory = this.categorizeTask(task.task);
    const agentSpecialization = this.categorizeAgent(agent.capabilities);

    if (taskCategory === agentSpecialization) {
      return 1.0; // Perfect match
    }

    // Check for related specializations
    const relatedCategories: Record<string, string[]> = {
      'workshop': ['planning', 'facilitation'],
      'data': ['analysis', 'quality'],
      'database': ['management', 'query'],
      'reporting': ['analysis', 'documentation']
    };

    const related = relatedCategories[taskCategory] || [];
    if (related.includes(agentSpecialization)) {
      return 0.7; // Good match
    }

    return 0.5; // Neutral
  }

  private categorizeTask(task: string): string {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes('workshop') || taskLower.includes('plan')) return 'workshop';
    if (taskLower.includes('data') || taskLower.includes('quality')) return 'data';
    if (taskLower.includes('database') || taskLower.includes('table')) return 'database';
    if (taskLower.includes('report') || taskLower.includes('generate')) return 'reporting';
    
    return 'general';
  }

  private categorizeAgent(capabilities: string[]): string {
    const capabilityStr = capabilities.join(' ').toLowerCase();
    
    if (capabilityStr.includes('workshop') || capabilityStr.includes('facilitate')) return 'workshop';
    if (capabilityStr.includes('data') || capabilityStr.includes('assess')) return 'data';
    if (capabilityStr.includes('database') || capabilityStr.includes('query')) return 'database';
    if (capabilityStr.includes('report') || capabilityStr.includes('generate')) return 'reporting';
    
    return 'general';
  }

  private calculateLoadFactor(agentId: string): number {
    const activeAssignments = Array.from(this.activeAssignments.values())
      .filter(a => a.agentId === agentId && (a.status === 'assigned' || a.status === 'in_progress'));

    // Consider both number of tasks and their complexity
    let loadScore = activeAssignments.length * 0.3;

    for (const assignment of activeAssignments) {
      const task = this.taskQueue.get(assignment.taskId);
      if (task) {
        const capability = this.capabilityRegistry.get(task.task);
        if (capability) {
          loadScore += capability.complexity * 0.2;
        }
      }
    }

    return Math.min(loadScore, 1.0);
  }

  private selectWithLoadBalancing(candidates: AgentCapabilityScore[]): AgentCapabilityScore {
    if (candidates.length === 1) return candidates[0];

    // Among top candidates, prefer the one with lowest load
    const topScore = candidates[0].score;
    const topCandidates = candidates.filter(c => c.score >= topScore * 0.9); // Within 10% of top score

    return topCandidates.reduce((best, current) => 
      current.loadFactor < best.loadFactor ? current : best
    );
  }

  private mapTaskToAgentAction(task: TaskRequest): string {
    // Map distributor task types to agent-specific actions
    const taskMappings: Record<string, string> = {
      'plan governance workshop': 'create-workshop-plan',
      'assess data quality': 'assess-data-quality',
      'create database table': 'create-table',
      'generate report': 'generate-report',
      'optimize performance': 'optimize-performance',
      'facilitate workshop': 'facilitate-workshop'
    };

    return taskMappings[task.task.toLowerCase()] || task.task.toLowerCase().replace(/\s+/g, '-');
  }

  private monitorTaskExecution(taskId: string): void {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) return;

    // Set up timeout for task completion
    const timeout = setTimeout(() => {
      this.handleTaskTimeout(taskId);
    }, 60000); // 1 minute timeout

    // Store timeout reference for cleanup
    (assignment as any).timeoutId = timeout;
  }

  private handleTaskTimeout(taskId: string): void {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment || assignment.status === 'completed') return;

    console.warn(`⏰ Task timeout: ${taskId} assigned to ${assignment.agentId}`);

    // Mark as failed and attempt reassignment
    assignment.status = 'failed';
    this.distributionMetrics.set('failed_assignments', 
      (this.distributionMetrics.get('failed_assignments') || 0) + 1);

    // Record poor performance
    this.recordTaskPerformance(assignment.agentId, taskId, false, 60000);

    // Attempt reassignment
    const task = this.taskQueue.get(taskId);
    if (task) {
      task.priority = 'high'; // Boost priority for reassignment
      this.taskQueue.set(taskId, task);
    }
  }

  public handleTaskCompletion(taskId: string, success: boolean, completionTime: number): void {
    const assignment = this.activeAssignments.get(taskId);
    if (!assignment) return;

    assignment.status = success ? 'completed' : 'failed';
    assignment.actualCompletion = new Date();
    assignment.performance = success ? 1.0 : 0.0;

    // Clear timeout
    if ((assignment as any).timeoutId) {
      clearTimeout((assignment as any).timeoutId);
    }

    // Record performance
    this.recordTaskPerformance(assignment.agentId, taskId, success, completionTime);

    // Update metrics
    const metricKey = success ? 'successful_assignments' : 'failed_assignments';
    this.distributionMetrics.set(metricKey, 
      (this.distributionMetrics.get(metricKey) || 0) + 1);

    console.log(`${success ? '✅' : '❌'} Task ${success ? 'completed' : 'failed'}: ${taskId} by ${assignment.agentId}`);
  }

  private recordTaskPerformance(agentId: string, taskId: string, success: boolean, completionTime: number): void {
    const history = this.agentPerformanceHistory.get(agentId) || [];
    
    const task = this.taskQueue.get(taskId);
    const taskType = task ? task.task : 'unknown';

    history.push({
      taskId,
      taskType,
      success,
      completionTime,
      timestamp: Date.now()
    });

    // Keep only recent history (last 50 tasks)
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }

    this.agentPerformanceHistory.set(agentId, history);
  }

  private async rebalanceLoad(): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    const loadFactors = new Map<string, number>();

    // Calculate current load factors
    for (const agent of agents) {
      const loadFactor = this.calculateLoadFactor(agent.id);
      loadFactors.set(agent.id, loadFactor);
    }

    // Find overloaded and underloaded agents
    const overloaded = Array.from(loadFactors.entries()).filter(([_, load]) => load > 0.8);
    const underloaded = Array.from(loadFactors.entries()).filter(([_, load]) => load < 0.3);

    // Redistribute tasks if necessary
    for (const [overloadedAgent, _] of overloaded) {
      if (underloaded.length === 0) break;

      await this.redistributeTasks(overloadedAgent, underloaded.map(([id]) => id));
    }

    // Calculate load balance score
    const avgLoad = Array.from(loadFactors.values()).reduce((sum, load) => sum + load, 0) / loadFactors.size;
    const variance = Array.from(loadFactors.values()).reduce((sum, load) => sum + Math.pow(load - avgLoad, 2), 0) / loadFactors.size;
    const balanceScore = Math.max(0, 1 - variance);

    this.distributionMetrics.set('load_balance_score', balanceScore);

    if (balanceScore < 0.7) {
      console.log(`⚖️ Load rebalancing: score ${(balanceScore * 100).toFixed(1)}%`);
    }
  }

  private async redistributeTasks(overloadedAgent: string, underloadedAgents: string[]): Promise<void> {
    const reassignableTask = Array.from(this.activeAssignments.values())
      .find(a => a.agentId === overloadedAgent && a.status === 'assigned');

    if (!reassignableTask) return;

    // Find best underloaded agent for this task
    const task = this.taskQueue.get(reassignableTask.taskId);
    if (!task) return;

    let bestAgent = null;
    let bestScore = 0;

    for (const agentId of underloadedAgents) {
      const agent = this.agentManager.getAgentStatus(agentId);
      if (!agent) continue;

      const score = await this.calculateAgentScore(agent, task);
      if (score.score > bestScore) {
        bestScore = score.score;
        bestAgent = agent;
      }
    }

    if (bestAgent && bestScore > 0.5) {
      // Reassign task
      reassignableTask.agentId = bestAgent.id;
      reassignableTask.status = 'reassigned';

      console.log(`🔄 Task reassigned: ${reassignableTask.taskId} from ${overloadedAgent} to ${bestAgent.id}`);

      // Send new assignment message
      const message: AgentMessage = {
        id: `reassign_${Date.now()}_${bestAgent.id}`,
        from: 'task-distributor',
        to: bestAgent.id,
        type: 'task',
        payload: {
          task: this.mapTaskToAgentAction(task),
          parameters: {
            ...task.parameters,
            taskId: task.id,
            priority: task.priority,
            reassigned: true
          }
        },
        timestamp: new Date(),
        priority: task.priority,
        correlationId: task.id
      };

      await this.agentManager.routeMessage(message);
    }
  }

  private analyzeDistributionPerformance(): void {
    const completedAssignments = Array.from(this.activeAssignments.values())
      .filter(a => a.status === 'completed' && a.actualCompletion);

    if (completedAssignments.length > 0) {
      const avgCompletionTime = completedAssignments.reduce((sum, a) => {
        const duration = a.actualCompletion!.getTime() - a.assignedAt.getTime();
        return sum + duration;
      }, 0) / completedAssignments.length;

      this.distributionMetrics.set('average_completion_time', avgCompletionTime);
    }

    // Log performance summary
    const metrics = this.getDistributionMetrics();
    console.log(`📊 Distribution Performance - Success Rate: ${metrics.successRate.toFixed(1)}%, Avg Time: ${(metrics.averageCompletionTime/1000).toFixed(1)}s, Balance: ${(metrics.loadBalanceScore*100).toFixed(1)}%`);
  }

  public getDistributionMetrics(): {
    tasksDistributed: number;
    successfulAssignments: number;
    failedAssignments: number;
    successRate: number;
    averageCompletionTime: number;
    loadBalanceScore: number;
    queueLength: number;
    activeAssignments: number;
  } {
    const distributed = this.distributionMetrics.get('tasks_distributed') || 0;
    const successful = this.distributionMetrics.get('successful_assignments') || 0;
    const failed = this.distributionMetrics.get('failed_assignments') || 0;

    return {
      tasksDistributed: distributed,
      successfulAssignments: successful,
      failedAssignments: failed,
      successRate: distributed > 0 ? (successful / distributed) * 100 : 0,
      averageCompletionTime: this.distributionMetrics.get('average_completion_time') || 0,
      loadBalanceScore: this.distributionMetrics.get('load_balance_score') || 1.0,
      queueLength: this.taskQueue.size,
      activeAssignments: Array.from(this.activeAssignments.values())
        .filter(a => a.status === 'assigned' || a.status === 'in_progress').length
    };
  }

  public getAgentPerformance(agentId: string): {
    totalTasks: number;
    successRate: number;
    averageCompletionTime: number;
    specializations: string[];
    currentLoad: number;
  } {
    const history = this.agentPerformanceHistory.get(agentId) || [];
    
    if (history.length === 0) {
      return {
        totalTasks: 0,
        successRate: 0,
        averageCompletionTime: 0,
        specializations: [],
        currentLoad: 0
      };
    }

    const successCount = history.filter((h: any) => h.success).length;
    const avgTime = history.reduce((sum: number, h: any) => sum + h.completionTime, 0) / history.length;
    
    // Analyze specializations
    const taskTypes = history.map((h: any) => h.taskType);
    const typeCounts = new Map<string, number>();
    taskTypes.forEach(type => {
      typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    });
    
    const specializations = Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type);

    return {
      totalTasks: history.length,
      successRate: (successCount / history.length) * 100,
      averageCompletionTime: avgTime,
      specializations,
      currentLoad: this.calculateLoadFactor(agentId)
    };
  }

  public getActiveAssignments(): TaskAssignment[] {
    return Array.from(this.activeAssignments.values())
      .filter(a => a.status === 'assigned' || a.status === 'in_progress');
  }

  public getTaskQueue(): TaskRequest[] {
    return Array.from(this.taskQueue.values())
      .sort((a, b) => this.calculateTaskPriority(b) - this.calculateTaskPriority(a));
  }
} 