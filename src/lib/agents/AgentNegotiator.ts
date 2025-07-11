import { AgentMessage, AgentStatus } from './types';
import { AgentManager } from './AgentManager';

export interface NegotiationRequest {
  id: string;
  type: 'resource' | 'collaboration' | 'priority' | 'delegation';
  initiator: string;
  participants: string[];
  subject: string;
  proposal: any;
  constraints: any;
  deadline: Date;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'timeout';
  timestamp: Date;
}

export interface NegotiationOffer {
  id: string;
  negotiationId: string;
  from: string;
  to: string[];
  proposal: any;
  conditions: string[];
  benefits: string[];
  costs: number;
  priority: number;
  timestamp: Date;
  status: 'pending' | 'accepted' | 'rejected' | 'countered';
}

export interface ResourceConflict {
  id: string;
  resource: string;
  conflictingAgents: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  resolutionMethod: 'negotiation' | 'priority' | 'scheduling' | 'resource_expansion';
}

export interface CollaborationAgreement {
  id: string;
  participants: string[];
  objective: string;
  roles: Map<string, string>;
  responsibilities: Map<string, string[]>;
  timeline: Map<string, Date>;
  success_criteria: string[];
  status: 'draft' | 'active' | 'completed' | 'terminated';
  createdAt: Date;
  updatedAt: Date;
}

export class AgentNegotiator {
  private agentManager: AgentManager;
  private activeNegotiations: Map<string, NegotiationRequest> = new Map();
  private pendingOffers: Map<string, NegotiationOffer> = new Map();
  private resourceConflicts: Map<string, ResourceConflict> = new Map();
  private collaborationAgreements: Map<string, CollaborationAgreement> = new Map();
  private negotiationHistory: Map<string, any[]> = new Map();
  private negotiationMetrics: Map<string, number> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.initializeNegotiationSystem();
  }

  private initializeNegotiationSystem(): void {
    console.log('🤝 Initializing Agent Negotiation System...');

    // Initialize metrics
    this.negotiationMetrics.set('total_negotiations', 0);
    this.negotiationMetrics.set('successful_negotiations', 0);
    this.negotiationMetrics.set('failed_negotiations', 0);
    this.negotiationMetrics.set('resource_conflicts_resolved', 0);
    this.negotiationMetrics.set('collaboration_agreements', 0);
    this.negotiationMetrics.set('average_negotiation_time', 0);

    // Start negotiation monitoring
    this.startNegotiationMonitoring();
    this.startConflictDetection();
  }

  public async initiateNegotiation(request: {
    type: 'resource' | 'collaboration' | 'priority' | 'delegation';
    initiator: string;
    participants: string[];
    subject: string;
    proposal: any;
    constraints?: any;
    deadline?: Date;
  }): Promise<string> {
    const negotiationId = `negotiation_${Date.now()}`;
    
    const negotiation: NegotiationRequest = {
      id: negotiationId,
      type: request.type,
      initiator: request.initiator,
      participants: request.participants,
      subject: request.subject,
      proposal: request.proposal,
      constraints: request.constraints || {},
      deadline: request.deadline || new Date(Date.now() + 300000), // 5 minute default
      status: 'pending',
      timestamp: new Date()
    };

    this.activeNegotiations.set(negotiationId, negotiation);
    this.negotiationMetrics.set('total_negotiations', 
      (this.negotiationMetrics.get('total_negotiations') || 0) + 1);

    console.log(`🎯 Negotiation initiated: ${request.subject} by ${request.initiator}`);

    // Broadcast negotiation to participants
    await this.broadcastNegotiation(negotiation);

    return negotiationId;
  }

  private async broadcastNegotiation(negotiation: NegotiationRequest): Promise<void> {
    for (const participantId of negotiation.participants) {
      const message: AgentMessage = {
        id: `negotiation_${Date.now()}_${participantId}`,
        from: 'agent-negotiator',
        to: participantId,
        type: 'negotiation',
        payload: {
          negotiationId: negotiation.id,
          type: negotiation.type,
          initiator: negotiation.initiator,
          subject: negotiation.subject,
          proposal: negotiation.proposal,
          constraints: negotiation.constraints,
          deadline: negotiation.deadline
        },
        timestamp: new Date(),
        priority: 'medium',
        correlationId: negotiation.id
      };

      await this.agentManager.routeMessage(message);
    }

    negotiation.status = 'active';
  }

  public async submitOffer(offer: {
    negotiationId: string;
    from: string;
    to: string[];
    proposal: any;
    conditions: string[];
    benefits: string[];
    costs: number;
    priority: number;
  }): Promise<string> {
    const offerId = `offer_${Date.now()}`;
    
    const negotiationOffer: NegotiationOffer = {
      id: offerId,
      negotiationId: offer.negotiationId,
      from: offer.from,
      to: offer.to,
      proposal: offer.proposal,
      conditions: offer.conditions,
      benefits: offer.benefits,
      costs: offer.costs,
      priority: offer.priority,
      timestamp: new Date(),
      status: 'pending'
    };

    this.pendingOffers.set(offerId, negotiationOffer);

    console.log(`💼 Offer submitted: ${offer.from} → ${offer.to.join(', ')} for ${offer.negotiationId}`);

    // Evaluate offer automatically
    await this.evaluateOffer(negotiationOffer);

    return offerId;
  }

  private async evaluateOffer(offer: NegotiationOffer): Promise<void> {
    const negotiation = this.activeNegotiations.get(offer.negotiationId);
    if (!negotiation) return;

    // Broadcast offer to target agents
    for (const targetAgent of offer.to) {
      const message: AgentMessage = {
        id: `offer_${Date.now()}_${targetAgent}`,
        from: 'agent-negotiator',
        to: targetAgent,
        type: 'negotiation_offer',
        payload: {
          offerId: offer.id,
          negotiationId: offer.negotiationId,
          from: offer.from,
          proposal: offer.proposal,
          conditions: offer.conditions,
          benefits: offer.benefits,
          costs: offer.costs,
          priority: offer.priority
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await this.agentManager.routeMessage(message);
    }

    // Set timeout for offer response
    setTimeout(() => {
      this.handleOfferTimeout(offer.id);
    }, 60000); // 1 minute timeout
  }

  public async respondToOffer(response: {
    offerId: string;
    agentId: string;
    decision: 'accept' | 'reject' | 'counter';
    counterProposal?: any;
    reasoning?: string;
  }): Promise<void> {
    const offer = this.pendingOffers.get(response.offerId);
    if (!offer) return;

    console.log(`📝 Offer response: ${response.agentId} ${response.decision}s offer ${response.offerId}`);

    if (response.decision === 'accept') {
      offer.status = 'accepted';
      await this.finalizeAgreement(offer);
    } else if (response.decision === 'reject') {
      offer.status = 'rejected';
      await this.handleRejection(offer, response.reasoning);
    } else if (response.decision === 'counter' && response.counterProposal) {
      offer.status = 'countered';
      await this.handleCounterOffer(offer, response.counterProposal, response.agentId);
    }

    // Record negotiation history
    this.recordNegotiationEvent(offer.negotiationId, {
      type: 'offer_response',
      offerId: response.offerId,
      agent: response.agentId,
      decision: response.decision,
      timestamp: new Date(),
      reasoning: response.reasoning
    });
  }

  private async finalizeAgreement(offer: NegotiationOffer): Promise<void> {
    const negotiation = this.activeNegotiations.get(offer.negotiationId);
    if (!negotiation) return;

    negotiation.status = 'completed';

    // Create collaboration agreement if applicable
    if (negotiation.type === 'collaboration') {
      await this.createCollaborationAgreement(negotiation, offer);
    }

    // Resolve resource conflicts if applicable
    if (negotiation.type === 'resource') {
      await this.resolveResourceConflict(negotiation, offer);
    }

    this.negotiationMetrics.set('successful_negotiations', 
      (this.negotiationMetrics.get('successful_negotiations') || 0) + 1);

    console.log(`✅ Agreement finalized: ${negotiation.subject}`);

    // Notify all participants
    await this.broadcastAgreement(negotiation, offer);
  }

  private async createCollaborationAgreement(negotiation: NegotiationRequest, offer: NegotiationOffer): Promise<void> {
    const agreementId = `agreement_${Date.now()}`;
    
    const agreement: CollaborationAgreement = {
      id: agreementId,
      participants: [negotiation.initiator, offer.from, ...offer.to],
      objective: negotiation.subject,
      roles: new Map(),
      responsibilities: new Map(),
      timeline: new Map(),
      success_criteria: offer.benefits,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Assign roles based on agent capabilities
    await this.assignCollaborationRoles(agreement);

    this.collaborationAgreements.set(agreementId, agreement);
    this.negotiationMetrics.set('collaboration_agreements', 
      (this.negotiationMetrics.get('collaboration_agreements') || 0) + 1);

    console.log(`🤝 Collaboration agreement created: ${agreementId}`);
  }

  private async assignCollaborationRoles(agreement: CollaborationAgreement): Promise<void> {
    for (const participantId of agreement.participants) {
      const agent = this.agentManager.getAgentStatus(participantId);
      if (!agent) continue;

      // Assign role based on capabilities
      let role = 'contributor';
      let responsibilities: string[] = ['general_support'];

      if (agent.capabilities.includes('create-workshop-plan')) {
        role = 'planner';
        responsibilities = ['strategic_planning', 'resource_coordination'];
      } else if (agent.capabilities.includes('assess-data-quality')) {
        role = 'analyst';
        responsibilities = ['data_analysis', 'quality_assessment'];
      } else if (agent.capabilities.includes('create-table')) {
        role = 'architect';
        responsibilities = ['infrastructure_setup', 'data_management'];
      }

      agreement.roles.set(participantId, role);
      agreement.responsibilities.set(participantId, responsibilities);
    }
  }

  private async resolveResourceConflict(negotiation: NegotiationRequest, offer: NegotiationOffer): Promise<void> {
    const conflictId = `conflict_${negotiation.subject}_${Date.now()}`;
    
    const conflict: ResourceConflict = {
      id: conflictId,
      resource: negotiation.subject,
      conflictingAgents: [negotiation.initiator, offer.from, ...offer.to],
      severity: 'medium',
      detectedAt: new Date(),
      resolvedAt: new Date(),
      resolution: offer.proposal.resolution || 'resource_sharing',
      resolutionMethod: 'negotiation'
    };

    this.resourceConflicts.set(conflictId, conflict);
    this.negotiationMetrics.set('resource_conflicts_resolved', 
      (this.negotiationMetrics.get('resource_conflicts_resolved') || 0) + 1);

    console.log(`⚖️ Resource conflict resolved: ${negotiation.subject}`);
  }

  private async handleRejection(offer: NegotiationOffer, reasoning?: string): Promise<void> {
    const negotiation = this.activeNegotiations.get(offer.negotiationId);
    if (!negotiation) return;

    console.log(`❌ Offer rejected: ${offer.id} - ${reasoning || 'No reason provided'}`);

    // Check if negotiation should continue or fail
    const allOffers = Array.from(this.pendingOffers.values())
      .filter(o => o.negotiationId === offer.negotiationId);
    
    const rejectedOffers = allOffers.filter(o => o.status === 'rejected');
    const pendingOffers = allOffers.filter(o => o.status === 'pending');

    if (pendingOffers.length === 0 && rejectedOffers.length === allOffers.length) {
      // All offers rejected, fail negotiation
      negotiation.status = 'failed';
      this.negotiationMetrics.set('failed_negotiations', 
        (this.negotiationMetrics.get('failed_negotiations') || 0) + 1);
      
      console.log(`💥 Negotiation failed: ${negotiation.subject}`);
    }
  }

  private async handleCounterOffer(offer: NegotiationOffer, counterProposal: any, counteringAgent: string): Promise<void> {
    console.log(`🔄 Counter-offer from ${counteringAgent} for ${offer.id}`);

    // Create new offer with counter-proposal
    await this.submitOffer({
      negotiationId: offer.negotiationId,
      from: counteringAgent,
      to: [offer.from],
      proposal: counterProposal,
      conditions: offer.conditions,
      benefits: offer.benefits,
      costs: offer.costs * 0.9, // Slightly reduced cost
      priority: offer.priority
    });
  }

  private handleOfferTimeout(offerId: string): void {
    const offer = this.pendingOffers.get(offerId);
    if (!offer || offer.status !== 'pending') return;

    console.log(`⏰ Offer timeout: ${offerId}`);
    offer.status = 'rejected';
    
    this.handleRejection(offer, 'timeout');
  }

  private async broadcastAgreement(negotiation: NegotiationRequest, offer: NegotiationOffer): Promise<void> {
    const allParticipants = [negotiation.initiator, ...negotiation.participants, offer.from, ...offer.to];
    const uniqueParticipants = [...new Set(allParticipants)];

    for (const participantId of uniqueParticipants) {
      const message: AgentMessage = {
        id: `agreement_${Date.now()}_${participantId}`,
        from: 'agent-negotiator',
        to: participantId,
        type: 'negotiation_complete',
        payload: {
          negotiationId: negotiation.id,
          result: 'agreement_reached',
          finalProposal: offer.proposal,
          participants: uniqueParticipants,
          benefits: offer.benefits,
          responsibilities: offer.conditions
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await this.agentManager.routeMessage(message);
    }
  }

  private startNegotiationMonitoring(): void {
    setInterval(() => {
      this.monitorActiveNegotiations();
    }, 10000); // Check every 10 seconds
  }

  private monitorActiveNegotiations(): void {
    const currentTime = Date.now();

    for (const [negotiationId, negotiation] of this.activeNegotiations) {
      if (negotiation.status === 'active' && negotiation.deadline.getTime() < currentTime) {
        console.log(`⏰ Negotiation timeout: ${negotiationId}`);
        
        negotiation.status = 'timeout';
        this.negotiationMetrics.set('failed_negotiations', 
          (this.negotiationMetrics.get('failed_negotiations') || 0) + 1);

        // Attempt automatic resolution
        this.attemptAutomaticResolution(negotiation);
      }
    }
  }

  private async attemptAutomaticResolution(negotiation: NegotiationRequest): Promise<void> {
    console.log(`🤖 Attempting automatic resolution for: ${negotiation.subject}`);

    if (negotiation.type === 'resource') {
      // For resource conflicts, try scheduling or resource expansion
      await this.autoResolveResourceConflict(negotiation);
    } else if (negotiation.type === 'priority') {
      // For priority conflicts, use agent performance metrics
      await this.autoResolvePriorityConflict(negotiation);
    }
  }

  private async autoResolveResourceConflict(negotiation: NegotiationRequest): Promise<void> {
    const conflictId = `auto_conflict_${Date.now()}`;
    
    const conflict: ResourceConflict = {
      id: conflictId,
      resource: negotiation.subject,
      conflictingAgents: negotiation.participants,
      severity: 'medium',
      detectedAt: negotiation.timestamp,
      resolvedAt: new Date(),
      resolution: 'time_sharing_schedule',
      resolutionMethod: 'scheduling'
    };

    this.resourceConflicts.set(conflictId, conflict);

    // Create time-sharing schedule
    const schedule = this.createTimeSharing(negotiation.participants);
    
    // Notify agents of the automatic resolution
    for (const agentId of negotiation.participants) {
      const message: AgentMessage = {
        id: `auto_resolution_${Date.now()}_${agentId}`,
        from: 'agent-negotiator',
        to: agentId,
        type: 'auto_resolution',
        payload: {
          negotiationId: negotiation.id,
          resolution: 'time_sharing',
          schedule: schedule.get(agentId),
          resource: negotiation.subject
        },
        timestamp: new Date(),
        priority: 'high'
      };

      await this.agentManager.routeMessage(message);
    }

    console.log(`⏰ Automatic time-sharing resolution applied for: ${negotiation.subject}`);
  }

  private createTimeSharing(agents: string[]): Map<string, any> {
    const schedule = new Map();
    const timeSlotDuration = 1800000; // 30 minutes
    let startTime = Date.now();

    for (let i = 0; i < agents.length; i++) {
      const agentId = agents[i];
      schedule.set(agentId, {
        startTime: new Date(startTime + (i * timeSlotDuration)),
        endTime: new Date(startTime + ((i + 1) * timeSlotDuration)),
        priority: i === 0 ? 'high' : 'medium'
      });
    }

    return schedule;
  }

  private async autoResolvePriorityConflict(negotiation: NegotiationRequest): Promise<void> {
    const agents = negotiation.participants.map(id => this.agentManager.getAgentStatus(id)).filter(Boolean);
    
    // Sort by performance and assign priorities
    agents.sort((a, b) => {
      const aPerf = a!.performance.averageResponseTime;
      const bPerf = b!.performance.averageResponseTime;
      return aPerf - bPerf; // Lower response time = higher priority
    });

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i]!;
      const priority = i === 0 ? 'high' : i === 1 ? 'medium' : 'low';

      const message: AgentMessage = {
        id: `priority_resolution_${Date.now()}_${agent.id}`,
        from: 'agent-negotiator',
        to: agent.id,
        type: 'priority_assignment',
        payload: {
          negotiationId: negotiation.id,
          assignedPriority: priority,
          reason: 'performance_based_automatic_resolution'
        },
        timestamp: new Date(),
        priority: 'high'
      };

      await this.agentManager.routeMessage(message);
    }

    console.log(`🎯 Automatic priority resolution applied for: ${negotiation.subject}`);
  }

  private startConflictDetection(): void {
    setInterval(() => {
      this.detectResourceConflicts();
    }, 15000); // Check every 15 seconds
  }

  private async detectResourceConflicts(): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    const resourceUsage = new Map<string, string[]>();

    // Analyze current resource usage patterns
    for (const agent of agents) {
      if (agent.status === 'busy') {
        // Simplified resource detection - in real implementation,
        // this would analyze actual resource utilization
        const resources = this.inferResourceUsage(agent);
        
        for (const resource of resources) {
          const users = resourceUsage.get(resource) || [];
          users.push(agent.id);
          resourceUsage.set(resource, users);
        }
      }
    }

    // Detect conflicts (multiple agents using same resource)
    for (const [resource, users] of resourceUsage) {
      if (users.length > 1) {
        const conflictId = `conflict_${resource}_${Date.now()}`;
        
        if (!this.resourceConflicts.has(conflictId)) {
          await this.initiateConflictResolution(resource, users);
        }
      }
    }
  }

  private inferResourceUsage(agent: AgentStatus): string[] {
    const resources: string[] = [];

    // Infer resources based on agent capabilities and status
    if (agent.capabilities.includes('create-table') || agent.capabilities.includes('query-database')) {
      resources.push('database_connection');
    }
    
    if (agent.capabilities.includes('assess-data-quality')) {
      resources.push('analysis_engine');
    }
    
    if (agent.capabilities.includes('generate-report')) {
      resources.push('reporting_system');
    }

    return resources;
  }

  private async initiateConflictResolution(resource: string, conflictingAgents: string[]): Promise<void> {
    console.log(`⚠️ Resource conflict detected: ${resource} used by ${conflictingAgents.join(', ')}`);

    // Automatically initiate negotiation for resource sharing
    await this.initiateNegotiation({
      type: 'resource',
      initiator: 'system',
      participants: conflictingAgents,
      subject: resource,
      proposal: {
        type: 'resource_sharing',
        resource: resource,
        conflictingAgents: conflictingAgents,
        proposedSolution: 'time_sharing'
      },
      constraints: {
        maxResolutionTime: 120000 // 2 minutes
      }
    });
  }

  private recordNegotiationEvent(negotiationId: string, event: any): void {
    const history = this.negotiationHistory.get(negotiationId) || [];
    history.push(event);
    this.negotiationHistory.set(negotiationId, history);
  }

  public getNegotiationMetrics(): {
    totalNegotiations: number;
    successfulNegotiations: number;
    failedNegotiations: number;
    successRate: number;
    resourceConflictsResolved: number;
    collaborationAgreements: number;
    averageNegotiationTime: number;
    activeNegotiations: number;
  } {
    const total = this.negotiationMetrics.get('total_negotiations') || 0;
    const successful = this.negotiationMetrics.get('successful_negotiations') || 0;
    const failed = this.negotiationMetrics.get('failed_negotiations') || 0;

    return {
      totalNegotiations: total,
      successfulNegotiations: successful,
      failedNegotiations: failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      resourceConflictsResolved: this.negotiationMetrics.get('resource_conflicts_resolved') || 0,
      collaborationAgreements: this.negotiationMetrics.get('collaboration_agreements') || 0,
      averageNegotiationTime: this.negotiationMetrics.get('average_negotiation_time') || 0,
      activeNegotiations: Array.from(this.activeNegotiations.values())
        .filter(n => n.status === 'active').length
    };
  }

  public getActiveNegotiations(): NegotiationRequest[] {
    return Array.from(this.activeNegotiations.values())
      .filter(n => n.status === 'active' || n.status === 'pending');
  }

  public getCollaborationAgreements(): CollaborationAgreement[] {
    return Array.from(this.collaborationAgreements.values())
      .filter(a => a.status === 'active');
  }

  public getResourceConflicts(): ResourceConflict[] {
    return Array.from(this.resourceConflicts.values())
      .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  public getNegotiationHistory(negotiationId: string): any[] {
    return this.negotiationHistory.get(negotiationId) || [];
  }
} 