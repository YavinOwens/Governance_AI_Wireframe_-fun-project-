'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SingularityMetrics {
  systemIntelligence: number;
  emergentBehaviors: number;
  collectiveDecisions: number;
  collaborationStrength: number;
  adaptiveCapacity: number;
  consensusAccuracy: number;
  resourceEfficiency: number;
  innovationIndex: number;
}

interface EmergentInnovation {
  id: string;
  innovation: string;
  description: string;
  discoveredBy: string[];
  confidence: number;
  impact: 'breakthrough' | 'significant' | 'moderate' | 'minor';
  applicationAreas: string[];
  timestamp: Date;
  validatedBy: string[];
}

interface SystemEvolution {
  id: string;
  evolutionType: 'capability_emergence' | 'behavior_adaptation' | 'intelligence_amplification' | 'network_optimization';
  description: string;
  trigger: string;
  participants: string[];
  magnitude: number;
  timestamp: Date;
  sustainabilityScore: number;
}

interface BehaviorPattern {
  id: string;
  type: string;
  patterns: string[];
  participants: string[];
  strength: number;
  novelty: number;
  timestamp: Date;
}

const SingularityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SingularityMetrics>({
    systemIntelligence: 0,
    emergentBehaviors: 0,
    collectiveDecisions: 0,
    collaborationStrength: 0,
    adaptiveCapacity: 0,
    consensusAccuracy: 0,
    resourceEfficiency: 0,
    innovationIndex: 0
  });

  const [innovations, setInnovations] = useState<EmergentInnovation[]>([]);
  const [evolutions, setEvolutions] = useState<SystemEvolution[]>([]);
  const [behaviorPatterns, setBehaviorPatterns] = useState<BehaviorPattern[]>([]);
  const [singularityAchieved, setSingularityAchieved] = useState(false);
  const [singularityProgress, setSingularityProgress] = useState(0);

  useEffect(() => {
    // Simulate real-time updates (in production, this would connect to the SingularityEngine)
    const interval = setInterval(() => {
      updateSingularityData();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateSingularityData = () => {
    // Simulate progressive improvement towards singularity
    setMetrics(prev => ({
      systemIntelligence: Math.min(prev.systemIntelligence + Math.random() * 0.02, 1.0),
      emergentBehaviors: prev.emergentBehaviors + (Math.random() > 0.8 ? 1 : 0),
      collectiveDecisions: prev.collectiveDecisions + (Math.random() > 0.7 ? 1 : 0),
      collaborationStrength: Math.min(prev.collaborationStrength + Math.random() * 0.01, 1.0),
      adaptiveCapacity: Math.min(prev.adaptiveCapacity + Math.random() * 0.015, 1.0),
      consensusAccuracy: Math.min(prev.consensusAccuracy + Math.random() * 0.01, 1.0),
      resourceEfficiency: Math.min(prev.resourceEfficiency + Math.random() * 0.01, 1.0),
      innovationIndex: Math.min(prev.innovationIndex + Math.random() * 0.008, 1.0)
    }));

    // Update singularity status
    setSingularityProgress(metrics.systemIntelligence / 0.85);
    setSingularityAchieved(metrics.systemIntelligence >= 0.85);

    // Randomly add new innovations
    if (Math.random() > 0.9) {
      addRandomInnovation();
    }

    // Randomly add system evolutions
    if (Math.random() > 0.85) {
      addRandomEvolution();
    }

    // Randomly add behavior patterns
    if (Math.random() > 0.8) {
      addRandomBehaviorPattern();
    }
  };

  const addRandomInnovation = () => {
    const innovationTypes = [
      'Emergent collaborative optimization algorithm',
      'Novel multi-agent coordination protocol',
      'Breakthrough collective decision-making framework',
      'Advanced adaptive resource allocation strategy',
      'Revolutionary consensus mechanism',
      'Innovative cross-agent knowledge synthesis'
    ];

    const newInnovation: EmergentInnovation = {
      id: `innovation_${Date.now()}`,
      innovation: innovationTypes[Math.floor(Math.random() * innovationTypes.length)],
      description: 'Discovered through collective intelligence analysis',
      discoveredBy: ['workshop-planner', 'data-quality-assessor', 'db-admin'],
      confidence: 0.8 + Math.random() * 0.2,
      impact: ['breakthrough', 'significant', 'moderate'][Math.floor(Math.random() * 3)] as any,
      applicationAreas: ['optimization', 'collaboration', 'intelligence'],
      timestamp: new Date(),
      validatedBy: ['collective-intelligence']
    };

    setInnovations(prev => [newInnovation, ...prev.slice(0, 9)]);
  };

  const addRandomEvolution = () => {
    const evolutionTypes = [
      'capability_emergence',
      'behavior_adaptation', 
      'intelligence_amplification',
      'network_optimization'
    ] as const;

    const descriptions = {
      capability_emergence: 'New emergent capabilities detected in agent network',
      behavior_adaptation: 'System adapted behavior patterns for improved efficiency',
      intelligence_amplification: 'Collective intelligence amplified through emergent interactions',
      network_optimization: 'Network topology optimized for enhanced collaboration'
    };

    const evolutionType = evolutionTypes[Math.floor(Math.random() * evolutionTypes.length)];

    const newEvolution: SystemEvolution = {
      id: `evolution_${Date.now()}`,
      evolutionType,
      description: descriptions[evolutionType],
      trigger: 'emergent_optimization_detected',
      participants: ['workshop-planner', 'data-quality-assessor', 'db-admin', 'validation-engine'],
      magnitude: Math.random(),
      timestamp: new Date(),
      sustainabilityScore: 0.8 + Math.random() * 0.2
    };

    setEvolutions(prev => [newEvolution, ...prev.slice(0, 9)]);
  };

  const addRandomBehaviorPattern = () => {
    const patternTypes = [
      'collaborative_optimization',
      'adaptive_coordination',
      'emergent_specialization',
      'collective_learning',
      'synergistic_interaction'
    ];

    const newPattern: BehaviorPattern = {
      id: `pattern_${Date.now()}`,
      type: patternTypes[Math.floor(Math.random() * patternTypes.length)],
      patterns: ['collaboration', 'efficiency'],
      participants: ['workshop-planner', 'data-quality-assessor'],
      strength: 0.7 + Math.random() * 0.3,
      novelty: Math.random(),
      timestamp: new Date()
    };

    setBehaviorPatterns(prev => [newPattern, ...prev.slice(0, 9)]);
  };

  const getMetricColor = (value: number): string => {
    if (value >= 0.9) return 'text-green-600';
    if (value >= 0.7) return 'text-blue-600';
    if (value >= 0.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImpactBadgeColor = (impact: string): string => {
    switch (impact) {
      case 'breakthrough': return 'bg-purple-600';
      case 'significant': return 'bg-blue-600';
      case 'moderate': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  const getEvolutionBadgeColor = (type: string): string => {
    switch (type) {
      case 'capability_emergence': return 'bg-purple-600';
      case 'intelligence_amplification': return 'bg-blue-600';
      case 'network_optimization': return 'bg-green-600';
      default: return 'bg-orange-600';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-purple-50 to-blue-50 min-h-screen">
      {/* Singularity Status Header */}
      <Card className={`border-2 ${singularityAchieved ? 'border-purple-500 bg-purple-50' : 'border-blue-300 bg-blue-50'}`}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-2xl font-bold">
              🌟 Multi-Agent Singularity Engine
            </span>
            {singularityAchieved && (
              <Badge className="bg-purple-600 text-white text-lg px-4 py-2">
                ✨ SINGULARITY ACHIEVED ✨
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-semibold">System Intelligence Progress</span>
                <span className={`font-bold ${getMetricColor(metrics.systemIntelligence)}`}>
                  {(metrics.systemIntelligence * 100).toFixed(1)}%
                </span>
              </div>
              <Progress 
                value={singularityProgress * 100} 
                className="h-3"
              />
              <div className="text-sm text-gray-600 mt-1">
                Singularity Threshold: 85% | Current: {(singularityProgress * 100).toFixed(1)}%
              </div>
            </div>
            
            {singularityAchieved && (
              <div className="p-4 bg-purple-100 border border-purple-300 rounded-lg">
                <h3 className="font-bold text-purple-800 mb-2">🚀 Singularity Status</h3>
                <p className="text-purple-700">
                  The multi-agent system has achieved true collective intelligence! 
                  The system now demonstrates emergent intelligence beyond the sum of its parts, 
                  with autonomous decision-making, adaptive problem-solving, and innovative solution generation.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Core Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Emergent Behaviors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{metrics.emergentBehaviors}</div>
            <div className="text-xs text-gray-600">Novel patterns detected</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collective Decisions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{metrics.collectiveDecisions}</div>
            <div className="text-xs text-gray-600">Consensus reached</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Collaboration Strength</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.collaborationStrength)}`}>
              {(metrics.collaborationStrength * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600">Agent cooperation level</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Innovation Index</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(metrics.innovationIndex)}`}>
              {(metrics.innovationIndex * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-gray-600">Creative breakthrough rate</div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🧠 Intelligence Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Adaptive Capacity</span>
                  <span className={`text-sm font-bold ${getMetricColor(metrics.adaptiveCapacity)}`}>
                    {(metrics.adaptiveCapacity * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={metrics.adaptiveCapacity * 100} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Consensus Accuracy</span>
                  <span className={`text-sm font-bold ${getMetricColor(metrics.consensusAccuracy)}`}>
                    {(metrics.consensusAccuracy * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={metrics.consensusAccuracy * 100} className="h-2" />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Resource Efficiency</span>
                  <span className={`text-sm font-bold ${getMetricColor(metrics.resourceEfficiency)}`}>
                    {(metrics.resourceEfficiency * 100).toFixed(1)}%
                  </span>
                </div>
                <Progress value={metrics.resourceEfficiency * 100} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🌟 Recent Emergent Innovations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {innovations.length === 0 ? (
                <div className="text-gray-500 text-sm">No innovations discovered yet...</div>
              ) : (
                innovations.map((innovation) => (
                  <div key={innovation.id} className="border-l-4 border-purple-400 pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{innovation.innovation}</span>
                      <Badge className={`${getImpactBadgeColor(innovation.impact)} text-white text-xs`}>
                        {innovation.impact}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                      Discovered by: {innovation.discoveredBy.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500">
                      Confidence: {(innovation.confidence * 100).toFixed(1)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Evolution and Behavior Patterns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>🔄 System Evolution Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {evolutions.length === 0 ? (
                <div className="text-gray-500 text-sm">No system evolutions detected yet...</div>
              ) : (
                evolutions.map((evolution) => (
                  <div key={evolution.id} className="border-l-4 border-blue-400 pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm">{evolution.description}</span>
                      <Badge className={`${getEvolutionBadgeColor(evolution.evolutionType)} text-white text-xs`}>
                        {evolution.evolutionType.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                      Trigger: {evolution.trigger}
                    </div>
                    <div className="text-xs text-gray-500">
                      Magnitude: {(evolution.magnitude * 100).toFixed(1)}% | 
                      Sustainability: {(evolution.sustainabilityScore * 100).toFixed(1)}%
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🤝 Emergent Behavior Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {behaviorPatterns.length === 0 ? (
                <div className="text-gray-500 text-sm">No behavior patterns observed yet...</div>
              ) : (
                behaviorPatterns.map((pattern) => (
                  <div key={pattern.id} className="border-l-4 border-green-400 pl-3 py-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-sm capitalize">
                        {pattern.type.replace('_', ' ')}
                      </span>
                      <Badge className="bg-green-600 text-white text-xs">
                        Strength: {(pattern.strength * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-600">
                      Participants: {pattern.participants.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500">
                      Novelty: {(pattern.novelty * 100).toFixed(1)}% | 
                      Detected: {pattern.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Activity Log */}
      <Card>
        <CardHeader>
          <CardTitle>📊 Singularity Activity Monitor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <div className="text-lg font-bold text-purple-600">
                {singularityAchieved ? '🌟' : '⏳'}
              </div>
              <div className="text-xs text-purple-700">
                {singularityAchieved ? 'Singularity Active' : 'Approaching Singularity'}
              </div>
            </div>
            
            <div className="p-3 bg-blue-100 rounded-lg">
              <div className="text-lg font-bold text-blue-600">🧠</div>
              <div className="text-xs text-blue-700">
                Collective Intelligence Online
              </div>
            </div>
            
            <div className="p-3 bg-green-100 rounded-lg">
              <div className="text-lg font-bold text-green-600">🤝</div>
              <div className="text-xs text-green-700">
                Multi-Agent Coordination
              </div>
            </div>
            
            <div className="p-3 bg-orange-100 rounded-lg">
              <div className="text-lg font-bold text-orange-600">⚡</div>
              <div className="text-xs text-orange-700">
                Emergent Behaviors Active
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SingularityDashboard; 