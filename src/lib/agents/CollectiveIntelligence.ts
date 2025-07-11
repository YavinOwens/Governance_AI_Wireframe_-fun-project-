import { AgentMessage, AgentStatus } from './types';
import { AgentManager } from './AgentManager';

export interface KnowledgeNode {
  id: string;
  concept: string;
  data: any;
  confidence: number;
  source: string;
  timestamp: Date;
  connections: string[];
  accessCount: number;
  lastAccessed: Date;
}

export interface ConsensusDecision {
  id: string;
  question: string;
  options: string[];
  votes: Map<string, string>;
  confidence: Map<string, number>;
  weights: Map<string, number>;
  result: string | null;
  consensus: number;
  timestamp: Date;
  status: 'pending' | 'decided' | 'expired';
}

export interface EmergentPattern {
  id: string;
  pattern: string;
  description: string;
  strength: number;
  participants: string[];
  firstObserved: Date;
  lastSeen: Date;
  frequency: number;
  impact: 'low' | 'medium' | 'high' | 'critical';
}

export interface CollectiveInsight {
  id: string;
  insight: string;
  confidence: number;
  contributingAgents: string[];
  evidence: any[];
  impact: number;
  timestamp: Date;
  category: 'optimization' | 'risk' | 'opportunity' | 'behavior' | 'performance';
}

export class CollectiveIntelligence {
  private agentManager: AgentManager;
  private knowledgeGraph: Map<string, KnowledgeNode> = new Map();
  private sharedMemory: Map<string, any> = new Map();
  private activeConsensus: Map<string, ConsensusDecision> = new Map();
  private emergentPatterns: Map<string, EmergentPattern> = new Map();
  private collectiveInsights: Map<string, CollectiveInsight> = new Map();
  private agentInteractions: Map<string, any[]> = new Map();
  private systemMetrics: Map<string, number> = new Map();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.initializeCollectiveIntelligence();
  }

  private initializeCollectiveIntelligence(): void {
    console.log('🧠 Initializing Collective Intelligence Engine...');
    
    // Initialize core system metrics
    this.systemMetrics.set('emergent_behaviors', 0);
    this.systemMetrics.set('collective_decisions', 0);
    this.systemMetrics.set('knowledge_nodes', 0);
    this.systemMetrics.set('consensus_accuracy', 0.0);
    this.systemMetrics.set('system_intelligence', 0.0);

    // Start continuous learning and pattern detection
    this.startContinuousLearning();
    this.startPatternDetection();
    this.startConsensusEngine();
  }

  public async contributeKnowledge(agentId: string, knowledge: {
    concept: string;
    data: any;
    confidence: number;
  }): Promise<string> {
    const nodeId = `knowledge_${Date.now()}_${agentId}`;
    
    const node: KnowledgeNode = {
      id: nodeId,
      concept: knowledge.concept,
      data: knowledge.data,
      confidence: knowledge.confidence,
      source: agentId,
      timestamp: new Date(),
      connections: [],
      accessCount: 0,
      lastAccessed: new Date()
    };

    // Find related knowledge nodes
    await this.connectKnowledgeNodes(node);
    
    this.knowledgeGraph.set(nodeId, node);
    this.systemMetrics.set('knowledge_nodes', this.knowledgeGraph.size);

    console.log(`🧩 Knowledge contributed: ${knowledge.concept} by ${agentId}`);
    
    // Trigger collective insight analysis
    await this.analyzeCollectiveInsights();
    
    return nodeId;
  }

  private async connectKnowledgeNodes(newNode: KnowledgeNode): Promise<void> {
    for (const [existingId, existingNode] of this.knowledgeGraph) {
      const similarity = this.calculateConceptSimilarity(newNode.concept, existingNode.concept);
      
      if (similarity > 0.7) {
        newNode.connections.push(existingId);
        existingNode.connections.push(newNode.id);
        
        // Strengthen connection based on similarity
        await this.strengthenConnection(newNode.id, existingId, similarity);
      }
    }
  }

  private calculateConceptSimilarity(concept1: string, concept2: string): number {
    // Simple similarity calculation based on word overlap
    const words1 = concept1.toLowerCase().split(/\s+/);
    const words2 = concept2.toLowerCase().split(/\s+/);
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  private async strengthenConnection(nodeId1: string, nodeId2: string, strength: number): Promise<void> {
    const connectionKey = `${nodeId1}_${nodeId2}`;
    const currentStrength = this.sharedMemory.get(connectionKey) || 0;
    this.sharedMemory.set(connectionKey, currentStrength + strength);
  }

  public async queryCollectiveKnowledge(query: string, requesterId: string): Promise<{
    results: KnowledgeNode[];
    confidence: number;
    insights: string[];
  }> {
    const results: KnowledgeNode[] = [];
    const insights: string[] = [];
    
    // Search knowledge graph
    for (const [nodeId, node] of this.knowledgeGraph) {
      const relevance = this.calculateConceptSimilarity(query, node.concept);
      
      if (relevance > 0.3) {
        node.accessCount++;
        node.lastAccessed = new Date();
        results.push(node);
      }
    }

    // Sort by relevance and confidence
    results.sort((a, b) => {
      const relevanceA = this.calculateConceptSimilarity(query, a.concept);
      const relevanceB = this.calculateConceptSimilarity(query, b.concept);
      return (relevanceB * b.confidence) - (relevanceA * a.confidence);
    });

    // Generate collective insights
    if (results.length > 1) {
      insights.push(this.generateCollectiveInsight(results, query));
    }

    const confidence = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0;

    console.log(`🔍 Collective knowledge query: "${query}" returned ${results.length} results`);

    return { results: results.slice(0, 10), confidence, insights };
  }

  private generateCollectiveInsight(results: KnowledgeNode[], query: string): string {
    const sources = [...new Set(results.map(r => r.source))];
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    
    return `Collective insight: ${sources.length} agents have contributed knowledge about "${query}" ` +
           `with average confidence ${(avgConfidence * 100).toFixed(1)}%. ` +
           `This suggests ${avgConfidence > 0.8 ? 'high' : avgConfidence > 0.6 ? 'moderate' : 'low'} consensus.`;
  }

  public async initiateConsensus(question: string, options: string[], initiator: string): Promise<string> {
    const consensusId = `consensus_${Date.now()}`;
    
    const decision: ConsensusDecision = {
      id: consensusId,
      question,
      options,
      votes: new Map(),
      confidence: new Map(),
      weights: new Map(),
      result: null,
      consensus: 0,
      timestamp: new Date(),
      status: 'pending'
    };

    this.activeConsensus.set(consensusId, decision);

    // Broadcast consensus request to all agents
    await this.broadcastConsensusRequest(decision);

    console.log(`🗳️ Consensus initiated: "${question}" by ${initiator}`);

    return consensusId;
  }

  private async broadcastConsensusRequest(decision: ConsensusDecision): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    
    for (const agent of agents) {
      if (agent.status === 'idle' || agent.status === 'busy') {
        const message: AgentMessage = {
          id: `consensus_${Date.now()}_${agent.id}`,
          from: 'collective-intelligence',
          to: agent.id,
          type: 'consensus',
          payload: {
            consensusId: decision.id,
            question: decision.question,
            options: decision.options,
            deadline: new Date(Date.now() + 30000) // 30 second deadline
          },
          timestamp: new Date(),
          priority: 'medium'
        };

        await this.agentManager.routeMessage(message);
      }
    }
  }

  public async submitVote(consensusId: string, agentId: string, vote: string, confidence: number): Promise<void> {
    const decision = this.activeConsensus.get(consensusId);
    if (!decision || decision.status !== 'pending') {
      console.warn(`⚠️ Invalid consensus vote: ${consensusId} from ${agentId}`);
      return;
    }

    // Calculate agent weight based on expertise and performance
    const agentWeight = await this.calculateAgentWeight(agentId, decision.question);
    
    decision.votes.set(agentId, vote);
    decision.confidence.set(agentId, confidence);
    decision.weights.set(agentId, agentWeight);

    console.log(`✅ Vote recorded: ${agentId} voted "${vote}" with confidence ${confidence}`);

    // Check if we have enough votes to make a decision
    await this.evaluateConsensus(consensusId);
  }

  private async calculateAgentWeight(agentId: string, question: string): Promise<number> {
    const agentStatus = this.agentManager.getAgentStatus(agentId);
    if (!agentStatus) return 0.5; // Default weight

    let weight = 0.5; // Base weight

    // Expertise weight based on capabilities
    const relevantCapabilities = agentStatus.capabilities.filter(cap => 
      question.toLowerCase().includes(cap.toLowerCase()) ||
      cap.toLowerCase().includes(question.toLowerCase())
    );
    weight += relevantCapabilities.length * 0.1;

    // Performance weight
    const performance = agentStatus.performance.averageResponseTime;
    if (performance < 2000) weight += 0.2; // Fast responses

    // Experience weight based on message count
    weight += Math.min(agentStatus.performance.totalMessages / 100, 0.3);

    return Math.min(weight, 1.0);
  }

  private async evaluateConsensus(consensusId: string): Promise<void> {
    const decision = this.activeConsensus.get(consensusId);
    if (!decision) return;

    const totalAgents = this.agentManager.getAllAgentStatuses().length;
    const responseRate = decision.votes.size / totalAgents;

    // Require at least 60% participation or wait for timeout
    if (responseRate < 0.6 && Date.now() - decision.timestamp.getTime() < 30000) {
      return; // Wait for more votes
    }

    // Calculate weighted consensus
    const optionScores = new Map<string, number>();
    
    for (const [agentId, vote] of decision.votes) {
      const confidence = decision.confidence.get(agentId) || 0.5;
      const weight = decision.weights.get(agentId) || 0.5;
      const score = confidence * weight;
      
      optionScores.set(vote, (optionScores.get(vote) || 0) + score);
    }

    // Find winning option
    let maxScore = 0;
    let winner = '';
    let totalScore = 0;

    for (const [option, score] of optionScores) {
      totalScore += score;
      if (score > maxScore) {
        maxScore = score;
        winner = option;
      }
    }

    decision.result = winner;
    decision.consensus = totalScore > 0 ? maxScore / totalScore : 0;
    decision.status = 'decided';

    this.systemMetrics.set('collective_decisions', 
      (this.systemMetrics.get('collective_decisions') || 0) + 1);

    console.log(`🏆 Consensus reached: "${winner}" with ${(decision.consensus * 100).toFixed(1)}% consensus`);

    // Broadcast result to all agents
    await this.broadcastConsensusResult(decision);
  }

  private async broadcastConsensusResult(decision: ConsensusDecision): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    
    for (const agent of agents) {
      const message: AgentMessage = {
        id: `consensus_result_${Date.now()}_${agent.id}`,
        from: 'collective-intelligence',
        to: agent.id,
        type: 'consensus_result',
        payload: {
          consensusId: decision.id,
          result: decision.result,
          consensus: decision.consensus,
          question: decision.question
        },
        timestamp: new Date(),
        priority: 'medium'
      };

      await this.agentManager.routeMessage(message);
    }
  }

  private startContinuousLearning(): void {
    setInterval(() => {
      this.performContinuousLearning();
    }, 15000); // Learn every 15 seconds
  }

  private async performContinuousLearning(): Promise<void> {
    // Analyze agent interactions
    await this.analyzeAgentInteractions();
    
    // Update system intelligence metrics
    await this.updateSystemIntelligence();
    
    // Optimize knowledge graph
    await this.optimizeKnowledgeGraph();
  }

  private async analyzeAgentInteractions(): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    const currentTime = Date.now();

    for (const agent of agents) {
      const interactions = this.agentInteractions.get(agent.id) || [];
      
      // Add current interaction data
      interactions.push({
        timestamp: currentTime,
        status: agent.status,
        messageCount: agent.performance.totalMessages,
        responseTime: agent.performance.averageResponseTime
      });

      // Keep only recent interactions (last hour)
      const recentInteractions = interactions.filter(i => 
        currentTime - i.timestamp < 3600000
      );

      this.agentInteractions.set(agent.id, recentInteractions);
    }
  }

  private async updateSystemIntelligence(): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    const knowledgeNodes = this.knowledgeGraph.size;
    const activePatterns = this.emergentPatterns.size;
    const consensusDecisions = this.systemMetrics.get('collective_decisions') || 0;

    // Calculate system intelligence score
    const agentDiversity = this.calculateAgentDiversity(agents);
    const knowledgeConnectivity = this.calculateKnowledgeConnectivity();
    const emergentComplexity = this.calculateEmergentComplexity();
    
    const systemIntelligence = 
      (agentDiversity * 0.3) +
      (knowledgeConnectivity * 0.4) +
      (emergentComplexity * 0.3);

    this.systemMetrics.set('system_intelligence', systemIntelligence);

    console.log(`🧠 System Intelligence Score: ${(systemIntelligence * 100).toFixed(1)}%`);
  }

  private calculateAgentDiversity(agents: AgentStatus[]): number {
    const allCapabilities = agents.flatMap(a => a.capabilities);
    const uniqueCapabilities = new Set(allCapabilities);
    
    return Math.min(uniqueCapabilities.size / 20, 1.0); // Normalize to max 20 capabilities
  }

  private calculateKnowledgeConnectivity(): number {
    if (this.knowledgeGraph.size === 0) return 0;

    const totalConnections = Array.from(this.knowledgeGraph.values())
      .reduce((sum, node) => sum + node.connections.length, 0);
    
    const maxPossibleConnections = this.knowledgeGraph.size * (this.knowledgeGraph.size - 1);
    
    return maxPossibleConnections > 0 ? totalConnections / maxPossibleConnections : 0;
  }

  private calculateEmergentComplexity(): number {
    const patterns = Array.from(this.emergentPatterns.values());
    const highImpactPatterns = patterns.filter(p => p.impact === 'high' || p.impact === 'critical');
    
    return Math.min(highImpactPatterns.length / 5, 1.0); // Normalize to max 5 high-impact patterns
  }

  private async optimizeKnowledgeGraph(): Promise<void> {
    // Remove stale knowledge nodes
    const staleThreshold = 3600000; // 1 hour
    const currentTime = Date.now();

    for (const [nodeId, node] of this.knowledgeGraph) {
      if (currentTime - node.lastAccessed.getTime() > staleThreshold && node.accessCount < 3) {
        this.knowledgeGraph.delete(nodeId);
        
        // Remove connections to this node
        for (const [otherNodeId, otherNode] of this.knowledgeGraph) {
          otherNode.connections = otherNode.connections.filter(id => id !== nodeId);
        }
      }
    }
  }

  private startPatternDetection(): void {
    setInterval(() => {
      this.detectEmergentPatterns();
    }, 20000); // Detect patterns every 20 seconds
  }

  private async detectEmergentPatterns(): Promise<void> {
    const agents = this.agentManager.getAllAgentStatuses();
    
    // Detect collaboration patterns
    await this.detectCollaborationPatterns(agents);
    
    // Detect specialization patterns
    await this.detectSpecializationPatterns(agents);
    
    // Detect efficiency patterns
    await this.detectEfficiencyPatterns(agents);
  }

  private async detectCollaborationPatterns(agents: AgentStatus[]): Promise<void> {
    // Analyze which agents work together frequently
    const collaborations = new Map<string, number>();
    
    for (const agent of agents) {
      const interactions = this.agentInteractions.get(agent.id) || [];
      
      // Simple collaboration detection based on concurrent activity
      for (const otherAgent of agents) {
        if (agent.id === otherAgent.id) continue;
        
        const otherInteractions = this.agentInteractions.get(otherAgent.id) || [];
        const concurrentActivity = this.calculateConcurrentActivity(interactions, otherInteractions);
        
        if (concurrentActivity > 0.7) {
          const pairKey = [agent.id, otherAgent.id].sort().join('_');
          collaborations.set(pairKey, concurrentActivity);
        }
      }
    }

    // Create patterns for strong collaborations
    for (const [pairKey, strength] of collaborations) {
      const [agent1, agent2] = pairKey.split('_');
      const patternId = `collaboration_${pairKey}`;
      
      if (!this.emergentPatterns.has(patternId)) {
        const pattern: EmergentPattern = {
          id: patternId,
          pattern: 'collaboration',
          description: `Strong collaboration between ${agent1} and ${agent2}`,
          strength,
          participants: [agent1, agent2],
          firstObserved: new Date(),
          lastSeen: new Date(),
          frequency: 1,
          impact: strength > 0.9 ? 'high' : 'medium'
        };
        
        this.emergentPatterns.set(patternId, pattern);
        this.systemMetrics.set('emergent_behaviors', this.emergentPatterns.size);
        
        console.log(`🤝 Emergent collaboration pattern detected: ${agent1} ↔ ${agent2}`);
      } else {
        const pattern = this.emergentPatterns.get(patternId)!;
        pattern.lastSeen = new Date();
        pattern.frequency++;
        pattern.strength = (pattern.strength + strength) / 2; // Average strength
      }
    }
  }

  private calculateConcurrentActivity(interactions1: any[], interactions2: any[]): number {
    if (interactions1.length === 0 || interactions2.length === 0) return 0;

    let concurrentPeriods = 0;
    const timeWindow = 60000; // 1 minute window

    for (const interaction1 of interactions1) {
      for (const interaction2 of interactions2) {
        if (Math.abs(interaction1.timestamp - interaction2.timestamp) < timeWindow) {
          concurrentPeriods++;
        }
      }
    }

    return concurrentPeriods / Math.min(interactions1.length, interactions2.length);
  }

  private async detectSpecializationPatterns(agents: AgentStatus[]): Promise<void> {
    // Detect agents that are becoming specialized in specific tasks
    for (const agent of agents) {
      const capabilities = agent.capabilities;
      const specialization = this.calculateAgentSpecialization(capabilities);
      
      if (specialization.score > 0.8) {
        const patternId = `specialization_${agent.id}`;
        
        if (!this.emergentPatterns.has(patternId)) {
          const pattern: EmergentPattern = {
            id: patternId,
            pattern: 'specialization',
            description: `Agent ${agent.id} specialized in ${specialization.domain}`,
            strength: specialization.score,
            participants: [agent.id],
            firstObserved: new Date(),
            lastSeen: new Date(),
            frequency: 1,
            impact: 'medium'
          };
          
          this.emergentPatterns.set(patternId, pattern);
          console.log(`🎯 Specialization pattern detected: ${agent.id} → ${specialization.domain}`);
        }
      }
    }
  }

  private calculateAgentSpecialization(capabilities: string[]): { domain: string; score: number } {
    const domains = ['workshop', 'data', 'database', 'quality'];
    let maxScore = 0;
    let primaryDomain = 'general';

    for (const domain of domains) {
      const domainCapabilities = capabilities.filter(cap => 
        cap.toLowerCase().includes(domain)
      );
      const score = domainCapabilities.length / capabilities.length;
      
      if (score > maxScore) {
        maxScore = score;
        primaryDomain = domain;
      }
    }

    return { domain: primaryDomain, score: maxScore };
  }

  private async detectEfficiencyPatterns(agents: AgentStatus[]): Promise<void> {
    // Detect system-wide efficiency improvements
    const currentEfficiency = this.calculateSystemEfficiency(agents);
    const historicalEfficiency = this.sharedMemory.get('historical_efficiency') || [];
    
    historicalEfficiency.push({
      timestamp: Date.now(),
      efficiency: currentEfficiency
    });

    // Keep only recent history
    const recentHistory = historicalEfficiency.filter((h: any) => 
      Date.now() - h.timestamp < 3600000 // Last hour
    );

    this.sharedMemory.set('historical_efficiency', recentHistory);

    if (recentHistory.length > 5) {
      const trend = this.calculateEfficiencyTrend(recentHistory);
      
      if (trend > 0.1) { // 10% improvement
        const patternId = 'efficiency_improvement';
        
        const pattern: EmergentPattern = {
          id: patternId,
          pattern: 'efficiency_improvement',
          description: `System efficiency improving by ${(trend * 100).toFixed(1)}%`,
          strength: trend,
          participants: agents.map(a => a.id),
          firstObserved: new Date(),
          lastSeen: new Date(),
          frequency: 1,
          impact: 'high'
        };
        
        this.emergentPatterns.set(patternId, pattern);
        console.log(`📈 Efficiency improvement pattern: +${(trend * 100).toFixed(1)}%`);
      }
    }
  }

  private calculateSystemEfficiency(agents: AgentStatus[]): number {
    if (agents.length === 0) return 0;

    const avgResponseTime = agents.reduce((sum, a) => sum + a.performance.averageResponseTime, 0) / agents.length;
    const activeAgents = agents.filter(a => a.status !== 'offline').length;
    const utilization = activeAgents / agents.length;
    
    const responseEfficiency = Math.max(0, 1 - (avgResponseTime / 10000)); // Normalize to 10 seconds
    
    return (responseEfficiency * 0.7) + (utilization * 0.3);
  }

  private calculateEfficiencyTrend(history: any[]): number {
    if (history.length < 2) return 0;

    const recent = history.slice(-3).reduce((sum: number, h: any) => sum + h.efficiency, 0) / 3;
    const earlier = history.slice(0, 3).reduce((sum: number, h: any) => sum + h.efficiency, 0) / 3;
    
    return recent - earlier;
  }

  private startConsensusEngine(): void {
    setInterval(() => {
      this.processConsensusTimeouts();
    }, 5000); // Check every 5 seconds
  }

  private processConsensusTimeouts(): void {
    for (const [consensusId, decision] of this.activeConsensus) {
      if (decision.status === 'pending' && 
          Date.now() - decision.timestamp.getTime() > 30000) {
        
        // Force decision with available votes
        this.evaluateConsensus(consensusId);
      }
    }
  }

  private async analyzeCollectiveInsights(): Promise<void> {
    const insights = await this.generateCollectiveInsights();
    
    for (const insight of insights) {
      this.collectiveInsights.set(insight.id, insight);
      console.log(`💡 Collective Insight: ${insight.insight}`);
    }
  }

  private async generateCollectiveInsights(): Promise<CollectiveInsight[]> {
    const insights: CollectiveInsight[] = [];
    
    // Performance insights
    const agents = this.agentManager.getAllAgentStatuses();
    const avgResponseTime = agents.reduce((sum, a) => sum + a.performance.averageResponseTime, 0) / agents.length;
    
    if (avgResponseTime > 5000) {
      insights.push({
        id: `insight_performance_${Date.now()}`,
        insight: `System performance can be improved - average response time is ${(avgResponseTime/1000).toFixed(1)}s`,
        confidence: 0.9,
        contributingAgents: agents.map(a => a.id),
        evidence: [{ metric: 'avg_response_time', value: avgResponseTime }],
        impact: 0.8,
        timestamp: new Date(),
        category: 'performance'
      });
    }

    // Collaboration insights
    const collaborationPatterns = Array.from(this.emergentPatterns.values())
      .filter(p => p.pattern === 'collaboration');
    
    if (collaborationPatterns.length > 3) {
      insights.push({
        id: `insight_collaboration_${Date.now()}`,
        insight: `Strong collaborative network detected with ${collaborationPatterns.length} active partnerships`,
        confidence: 0.85,
        contributingAgents: collaborationPatterns.flatMap(p => p.participants),
        evidence: collaborationPatterns,
        impact: 0.9,
        timestamp: new Date(),
        category: 'behavior'
      });
    }

    return insights;
  }

  public getSystemMetrics(): Record<string, number> {
    return Object.fromEntries(this.systemMetrics);
  }

  public getEmergentPatterns(): EmergentPattern[] {
    return Array.from(this.emergentPatterns.values());
  }

  public getCollectiveInsights(): CollectiveInsight[] {
    return Array.from(this.collectiveInsights.values());
  }

  public getKnowledgeGraphStats(): {
    totalNodes: number;
    totalConnections: number;
    topConcepts: string[];
    connectivity: number;
  } {
    const nodes = Array.from(this.knowledgeGraph.values());
    const totalConnections = nodes.reduce((sum, node) => sum + node.connections.length, 0);
    
    const conceptCounts = new Map<string, number>();
    nodes.forEach(node => {
      conceptCounts.set(node.concept, (conceptCounts.get(node.concept) || 0) + 1);
    });
    
    const topConcepts = Array.from(conceptCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([concept]) => concept);

    return {
      totalNodes: nodes.length,
      totalConnections,
      topConcepts,
      connectivity: this.calculateKnowledgeConnectivity()
    };
  }
} 