'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { HumanIntervention } from '@/lib/agents/types';

interface HumanInterventionPanelProps {
  socket: Socket | null;
}

interface AgentFinding {
  id: string;
  agentId: string;
  teamId: string;
  task: string;
  finding: string;
  impact: 'high' | 'medium' | 'low';
  category: 'data-quality' | 'governance' | 'compliance' | 'performance';
  recommendations: string[];
  timestamp: Date;
  status: 'new' | 'reviewed' | 'resolved' | 'workshop-ready';
}

export default function HumanInterventionPanel({ socket }: HumanInterventionPanelProps) {
  const [interventions, setInterventions] = useState<HumanIntervention[]>([]);
  // Start with empty findings - only populate from real data
  const [agentFindings, setAgentFindings] = useState<AgentFinding[]>([]);
  const [selectedIntervention, setSelectedIntervention] = useState<HumanIntervention | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [activeView, setActiveView] = useState<'interventions' | 'findings'>('findings'); // Default to findings view
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);
  const [isRefreshingFindings, setIsRefreshingFindings] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Persist selectedFindings in sessionStorage
  useEffect(() => {
    if (selectedFindings.length > 0) {
      sessionStorage.setItem('humanIntervention_selectedFindings', JSON.stringify(selectedFindings));
      console.log('💾 Saved selectedFindings to sessionStorage:', selectedFindings);
    } else {
      sessionStorage.removeItem('humanIntervention_selectedFindings');
    }
  }, [selectedFindings]);

  // Restore selectedFindings from sessionStorage on mount
  useEffect(() => {
    const savedSelectedFindings = sessionStorage.getItem('humanIntervention_selectedFindings');
    if (savedSelectedFindings) {
      try {
        const parsed = JSON.parse(savedSelectedFindings);
        console.log('💾 Restored selectedFindings from sessionStorage:', parsed);
        setSelectedFindings(parsed);
      } catch (error) {
        console.error('Error parsing saved selectedFindings:', error);
        sessionStorage.removeItem('humanIntervention_selectedFindings');
      }
    }
  }, []);

  // Load real agent findings from API on component mount
  useEffect(() => {
    const loadAgentFindings = async () => {
      try {
        const response = await fetch('/api/agent-findings');
        const result = await response.json();
        
        if (result.success && result.findings) {
          console.log('✅ Loaded real agent findings from database:', result.findings);
          setAgentFindings(result.findings.map((f: any) => ({
            id: f.id,
            agentId: f.agent_id,
            teamId: f.team_id,
            task: f.task,
            finding: f.finding,
            impact: f.impact,
            category: f.category,
            recommendations: Array.isArray(f.recommendations) ? f.recommendations : [],
            timestamp: new Date(f.created_at),
            status: f.status || 'new'
          })));
        } else {
          console.log('📋 No existing agent findings found in database');
        }
      } catch (error) {
        console.error('❌ Error loading agent findings:', error);
      }
    };

    loadAgentFindings();
  }, []);

  // Load real interventions from API on component mount
  useEffect(() => {
    const loadInterventions = async () => {
      try {
        const response = await fetch('/api/interventions');
        const result = await response.json();
        
        if (result.success && result.interventions) {
          console.log('✅ Loaded real interventions from database:', result.interventions);
          setInterventions(result.interventions.map((i: any) => ({
            id: i.id,
            workflowId: i.workflow_id,
            stepId: i.step_id,
            type: i.type,
            message: i.message,
            options: Array.isArray(i.options) ? i.options : [],
            status: i.status,
            createdAt: new Date(i.created_at),
            resolvedAt: i.resolved_at ? new Date(i.resolved_at) : undefined,
            resolvedBy: i.resolved_by
          })));
        } else {
          console.log('📋 No existing interventions found in database');
        }
      } catch (error) {
        console.error('❌ Error loading interventions:', error);
      }
    };

    loadInterventions();
  }, []);

  // Autonomous agent execution - runs assessments periodically
  useEffect(() => {
    if (!socket) return;

    const runAutonomousAssessments = () => {
      console.log('🤖 Running autonomous agent assessments...');
      
      // Trigger different types of assessments
      const assessments = [
        { agent: 'data-quality-agent', task: 'assess-data-quality', tables: ['users', 'orders', 'products'] },
        { agent: 'data-quality-agent', task: 'validate-data-integrity', tables: ['user_profiles', 'transactions'] },
        { agent: 'data-quality-agent', task: 'analyze-data-completeness', tables: ['customer_data', 'audit_logs'] }
      ];

      assessments.forEach((assessment, index) => {
        setTimeout(() => {
          const message = {
            id: `auto_assessment_${Date.now()}_${index}`,
            from: 'human-oversight',
            to: assessment.agent,
            type: 'task',
            payload: {
              task: assessment.task,
              parameters: {
                tables: assessment.tables,
                automated: true,
                comprehensive: true
              }
            },
            timestamp: new Date(),
            priority: 'medium'
          };
          
          socket.emit('agent-message', message);
          console.log(`🔍 Triggered autonomous ${assessment.task} on ${assessment.tables.join(', ')}`);
        }, index * 2000); // Stagger assessments by 2 seconds
      });
    };

    // Run assessments immediately on component mount
    const initialDelay = setTimeout(runAutonomousAssessments, 3000);

    // Set up periodic autonomous assessments (every 10 minutes)
    const autonomousInterval = setInterval(runAutonomousAssessments, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(autonomousInterval);
    };
  }, [socket]);

  useEffect(() => {
    if (socket) {
      console.log('🔌 HumanInterventionPanel: Setting up socket listeners');
      
      // Add catch-all event listener to see what events are being received
      const originalEmit = socket.emit;
      const originalOn = socket.on;
      
      socket.onAny((eventName, ...args) => {
        console.log(`📡 HumanInterventionPanel received event: ${eventName}`, args.length > 0 ? args[0] : '(no data)');
        
        // Specifically log agent-task-completed events
        if (eventName === 'agent-task-completed') {
          console.log('🎯🎯🎯 AGENT-TASK-COMPLETED EVENT RECEIVED:', JSON.stringify(args[0], null, 2));
        }
      });

      socket.on('human-intervention-created', (data) => {
        // Handle new intervention creation
        console.log('New intervention created:', data);
      });

      socket.on('human-intervention-resolved', (data) => {
        // Handle intervention resolution
        console.log('Intervention resolved:', data);
        setInterventions(prev => prev.map(intervention => 
          intervention.id === data.interventionId 
            ? { ...intervention, status: 'resolved', resolvedAt: new Date() }
            : intervention
        ));
      });

      // Listen for agent task completions that might require human oversight
      socket.on('agent-task-completed', async (data) => {
        console.log('🎯 AGENT TASK COMPLETED - Full data received:', JSON.stringify(data, null, 2));
        
        // Check if the task result indicates issues requiring attention
        if (data.payload?.result?.data) {
          const result = data.payload.result.data;
          console.log('🔍 EXTRACTED RESULT DATA:', JSON.stringify(result, null, 2));
          
          // Create agent finding if significant issues found
          if (shouldCreateFinding(data)) {
            console.log('✅ SHOULD CREATE FINDING - Criteria met');
            // Validate required fields before creating finding
            const agentId = data.payload?.agentId || 'unknown';
            const teamId = data.payload?.teamId || 'unknown';
            const task = data.payload?.task || 'unknown-task';
            
            // Only create finding if we have valid data
            if (agentId && teamId && task) {
              const finding: AgentFinding = {
                id: `finding_${Date.now()}`,
                agentId,
                teamId,
                task,
                finding: extractFindingFromResult(result),
                impact: determineFindingImpact(result),
                category: categorizeFinding(task),
                recommendations: extractRecommendations(result),
                timestamp: new Date(),
                status: 'new'
              };
              
              // Save finding to database via API
              try {
                const response = await fetch('/api/agent-findings', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    id: finding.id,
                    agent_id: finding.agentId,
                    team_id: finding.teamId,
                    task: finding.task,
                    finding: finding.finding,
                    impact: finding.impact,
                    category: finding.category,
                    recommendations: finding.recommendations,
                    status: finding.status
                  }),
                });

                if (response.ok) {
                  console.log('✅ Finding saved to database:', finding.id);
                  // Reload findings from database to ensure consistency
                  const loadResponse = await fetch('/api/agent-findings');
                  const loadResult = await loadResponse.json();
                  if (loadResult.success && loadResult.findings) {
                    setAgentFindings(loadResult.findings.map((f: any) => ({
                      id: f.id,
                      agentId: f.agent_id,
                      teamId: f.team_id,
                      task: f.task,
                      finding: f.finding,
                      impact: f.impact,
                      category: f.category,
                      recommendations: Array.isArray(f.recommendations) ? f.recommendations : [],
                      timestamp: new Date(f.created_at),
                      status: f.status || 'new'
                    })));
                  }
                } else {
                  console.error('❌ Failed to save finding to database');
                  // Fallback to local state if database save fails
                  setAgentFindings(prev => [finding, ...prev]);
                }
              } catch (error) {
                console.error('❌ Error saving finding to database:', error);
                // Fallback to local state if database save fails
                setAgentFindings(prev => [finding, ...prev]);
              }
              
              // Create intervention if critical
              if (finding.impact === 'high') {
                const intervention: HumanIntervention = {
                  id: `intervention_${Date.now()}`,
                  workflowId: `agent_finding_${finding.id}`,
                  stepId: finding.task,
                  type: 'review',
                  message: `Critical finding from ${finding.agentId}: ${finding.finding}`,
                  options: ['Review Immediately', 'Schedule Workshop', 'Create Action Plan', 'Acknowledge'],
                  status: 'pending',
                  createdAt: new Date()
                };
                
                // Save intervention to database via API
                try {
                  const response = await fetch('/api/interventions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      id: intervention.id,
                      workflow_id: intervention.workflowId,
                      step_id: intervention.stepId,
                      type: intervention.type,
                      message: intervention.message,
                      options: intervention.options,
                      status: intervention.status
                    }),
                  });

                  if (response.ok) {
                    console.log('✅ Intervention saved to database:', intervention.id);
                    // Reload interventions from database to ensure consistency
                    const loadResponse = await fetch('/api/interventions');
                    const loadResult = await loadResponse.json();
                    if (loadResult.success && loadResult.interventions) {
                      setInterventions(loadResult.interventions.map((i: any) => ({
                        id: i.id,
                        workflowId: i.workflow_id,
                        stepId: i.step_id,
                        type: i.type,
                        message: i.message,
                        options: Array.isArray(i.options) ? i.options : [],
                        status: i.status,
                        createdAt: new Date(i.created_at),
                        resolvedAt: i.resolved_at ? new Date(i.resolved_at) : undefined,
                        resolvedBy: i.resolved_by
                      })));
                    }
                  } else {
                    console.error('❌ Failed to save intervention to database');
                    // Fallback to local state if database save fails
                    setInterventions(prev => [intervention, ...prev]);
                  }
                } catch (error) {
                  console.error('❌ Error saving intervention to database:', error);
                  // Fallback to local state if database save fails
                  setInterventions(prev => [intervention, ...prev]);
                }
              }
            } else {
              console.log('❌ Skipping finding creation due to missing required fields:', { agentId, teamId, task });
            }
          }
        }
      });

      // Listen for requests for selected findings from Workshop Builder
      socket.on('request-selected-findings', () => {
        console.log('🧪 HumanIntervention: Received request for selected findings');
        console.log('🧪 HumanIntervention: Current selectedFindings:', selectedFindings);
        console.log('🧪 HumanIntervention: Current agentFindings count:', agentFindings.length);
        
        // Get current selectedFindings from both state and sessionStorage as fallback
        const currentSelectedFindings = selectedFindings.length > 0 
          ? selectedFindings 
          : (() => {
              const saved = sessionStorage.getItem('humanIntervention_selectedFindings');
              return saved ? JSON.parse(saved) : [];
            })();
        
        console.log('🧪 HumanIntervention: Final selectedFindings to use:', currentSelectedFindings);
        
        const selectedFindingObjects = agentFindings.filter(finding => 
          currentSelectedFindings.includes(finding.id)
        );
        
        console.log('🧪 HumanIntervention: Sending selected findings:', selectedFindingObjects);
        
        // Always respond, even if no findings are selected
        socket.emit('selected-findings-response', {
          selectedFindings: selectedFindingObjects,
          count: selectedFindingObjects.length,
          requestTime: new Date().toISOString(),
          availableFindings: agentFindings.length,
          selectedIds: currentSelectedFindings
        });
        
        // Update the selectedFindings state if we used sessionStorage fallback
        if (selectedFindings.length === 0 && currentSelectedFindings.length > 0) {
          setSelectedFindings(currentSelectedFindings);
        }
      });

      return () => {
        socket.off('human-intervention-created');
        socket.off('human-intervention-resolved');
        socket.off('agent-task-completed');
        socket.off('request-selected-findings');
      };
    }
  }, [socket, agentFindings, selectedFindings]);

  // Helper functions for processing agent findings
  const shouldCreateFinding = (data: any): boolean => {
    const result = data.payload?.result?.data;
    console.log('🤔 shouldCreateFinding called with result:', JSON.stringify(result, null, 2));
    
    if (!result) {
      console.log('❌ shouldCreateFinding: No result data found');
      return false;
    }
    
    // Handle the actual data structure we're receiving
    const task = data.payload?.task;
    const isDataQualityTask = task && (
      task.includes('assess-data-quality') ||
      task.includes('validate-data-integrity') ||
      task.includes('analyze-data-completeness') ||
      task.includes('detect-anomalies') ||
      task.includes('check-compliance')
    );
    
    // If it's a data quality related task that completed successfully, create a finding
    if (isDataQualityTask && result.status === 'completed') {
      console.log(`✅ shouldCreateFinding: Creating finding for data quality task: ${task}`);
      return true;
    }
    
    // Original logic for properly structured assessment data
    if (result.overall_score !== undefined || result.issues || result.recommendations) {
      const hasScore = result.overall_score !== undefined;
      const hasIssues = result.issues?.length > 0;
      const hasCriticalIssues = result.critical_issues?.length > 0;
      const hasHighPriorityRecs = result.recommendations?.some((r: any) => r.priority === 'high' || r.priority === 'urgent');
      
      console.log('🔍 shouldCreateFinding criteria check:');
      console.log(`  - overall_score: ${result.overall_score} (< 80? ${result.overall_score < 80})`);
      console.log(`  - issues count: ${result.issues?.length || 0} (> 0? ${hasIssues})`);
      console.log(`  - critical_issues count: ${result.critical_issues?.length || 0} (> 0? ${hasCriticalIssues})`);
      console.log(`  - high priority recommendations: ${hasHighPriorityRecs}`);
      
      const shouldCreate = (
        result.overall_score < 80 ||
        result.issues?.length > 0 ||
        result.critical_issues?.length > 0 ||
        result.recommendations?.some((r: any) => r.priority === 'high' || r.priority === 'urgent')
      );
      
      console.log(`🎯 shouldCreateFinding result: ${shouldCreate}`);
      return shouldCreate;
    }
    
    console.log('❌ shouldCreateFinding: No criteria met');
    return false;
  };

  const extractFindingFromResult = (result: any): string => {
    // Handle properly structured assessment data
    if (result.issues?.length > 0) {
      return `${result.issues.length} issues detected: ${result.issues[0].description || result.issues[0].issue}`;
    }
    if (result.overall_score < 80) {
      return `Quality score below threshold: ${result.overall_score}%`;
    }
    if (result.recommendations?.length > 0) {
      return `Critical recommendations available: ${result.recommendations[0].recommendation}`;
    }
    
    // Handle the current basic task completion data
    if (result.task && result.status === 'completed') {
      const taskDescriptions = {
        'check-compliance': 'Compliance assessment completed - governance rules validated',
        'validate-data-integrity': 'Data integrity validation completed - referential integrity checked',
        'analyze-data-completeness': 'Data completeness analysis completed - missing data patterns identified',
        'detect-anomalies': 'Anomaly detection completed - outlier patterns detected',
        'assess-data-quality': 'Data quality assessment completed - comprehensive analysis performed'
      };
      
      return taskDescriptions[result.task] || `${result.task} completed successfully - requires review`;
    }
    
    return 'Assessment completed - requires human review';
  };

  const determineFindingImpact = (result: any): 'high' | 'medium' | 'low' => {
    if (result.overall_score < 70 || result.critical_issues?.length > 0) return 'high';
    if (result.overall_score < 85 || result.issues?.length > 3) return 'medium';
    return 'low';
  };

  const categorizeFinding = (task: string): 'data-quality' | 'governance' | 'compliance' | 'performance' => {
    if (task.includes('quality') || task.includes('assessment')) return 'data-quality';
    if (task.includes('governance') || task.includes('policy')) return 'governance';
    if (task.includes('compliance') || task.includes('validation')) return 'compliance';
    return 'performance';
  };

  const extractRecommendations = (result: any): string[] => {
    if (result.recommendations) {
      return result.recommendations
        .slice(0, 3)
        .map((r: any) => r.recommendation || r.title || r);
    }
    return ['Review findings', 'Create action plan', 'Schedule follow-up'];
  };

  // Agent Findings Management
  const updateFindingStatus = (findingId: string, status: AgentFinding['status']) => {
    setAgentFindings(prev => prev.map(finding => 
      finding.id === findingId ? { ...finding, status } : finding
    ));
  };

  const toggleFindingSelection = (findingId: string) => {
    setSelectedFindings(prev => {
      const newSelection = prev.includes(findingId)
        ? prev.filter(id => id !== findingId)
        : [...prev, findingId];
      
      console.log(`🔄 Toggle finding ${findingId}: ${prev.includes(findingId) ? 'removed' : 'added'}`);
      console.log('🔄 New selectedFindings:', newSelection);
      
      return newSelection;
    });
  };

  const getFindingImpactColor = (impact: AgentFinding['impact']) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFindingCategoryIcon = (category: AgentFinding['category']) => {
    switch (category) {
      case 'data-quality': return '🔍';
      case 'governance': return '⚖️';
      case 'compliance': return '📋';
      case 'performance': return '⚡';
      default: return '📊';
    }
  };

  const getFindingStatusColor = (status: AgentFinding['status']) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-purple-100 text-purple-800';
      case 'acknowledged': return 'bg-green-100 text-green-800';
      case 'workshop-ready': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const refreshAgentFindings = async () => {
    if (!socket) {
      console.log('❌ No socket connection available');
      return;
    }

    setIsRefreshingFindings(true);
    console.log('🔄 Manually refreshing agent findings...');

    try {
      // Trigger comprehensive assessments on all available tables
      const comprehensiveAssessments = [
        { agent: 'data-quality-agent', task: 'assess-data-quality', scope: 'all-tables' },
        { agent: 'data-quality-agent', task: 'validate-data-integrity', scope: 'referential-integrity' },
        { agent: 'data-quality-agent', task: 'analyze-data-completeness', scope: 'missing-data-analysis' },
        { agent: 'data-quality-agent', task: 'detect-anomalies', scope: 'outlier-detection' },
        { agent: 'data-quality-agent', task: 'check-compliance', scope: 'governance-audit' }
      ];

      comprehensiveAssessments.forEach((assessment, index) => {
        setTimeout(() => {
          const message = {
            id: `manual_refresh_${Date.now()}_${index}`,
            from: 'human-oversight',
            to: assessment.agent,
            type: 'task',
            payload: {
              task: assessment.task,
              parameters: {
                scope: assessment.scope,
                manual: true,
                comprehensive: true,
                priority: 'high'
              }
            },
            timestamp: new Date(),
            priority: 'high'
          };
          
          socket.emit('agent-message', message);
          console.log(`🔍 Triggered manual ${assessment.task} - ${assessment.scope}`);
        }, index * 1000); // Stagger by 1 second for manual refresh
      });

      setLastRefresh(new Date());
      
      // Stop loading after all assessments are triggered
      setTimeout(() => {
        setIsRefreshingFindings(false);
        console.log('✅ Agent findings refresh completed');
      }, comprehensiveAssessments.length * 1000 + 2000);

    } catch (error) {
      console.error('❌ Error refreshing agent findings:', error);
      setIsRefreshingFindings(false);
    }
  };

  const createWorkshopFromFindings = async () => {
    console.log('🏗️ createWorkshopFromFindings called');
    console.log('🏗️ selectedFindings:', selectedFindings);
    console.log('🏗️ agentFindings:', agentFindings);
    
    const selectedFindingObjects = agentFindings.filter(finding => 
      selectedFindings.includes(finding.id)
    );

    console.log('🏗️ selectedFindingObjects:', selectedFindingObjects);

    if (selectedFindingObjects.length === 0) {
      console.log('🏗️ No findings selected, returning');
      alert('Please select at least one finding to create a workshop.');
      return;
    }

    // Show loading state
    const originalButton = document.querySelector('button[data-workshop-button]') as HTMLButtonElement;
    if (originalButton) {
      originalButton.disabled = true;
      originalButton.innerHTML = '<span>⏳</span><span>Creating Workshop...</span>';
    }

    try {
      // Prepare workshop data based on selected findings
      const categories = [...new Set(selectedFindingObjects.map(f => f.category))];
      const impactLevels = [...new Set(selectedFindingObjects.map(f => f.impact))];
      const recommendations = selectedFindingObjects.flatMap(f => f.recommendations);

      // Generate workshop name and description
      const workshopName = `${categories.map(cat => 
        cat.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())
      ).join(' & ')} Action Workshop`;
      
      const description = `Workshop to address ${selectedFindingObjects.length} critical findings from agent analysis. Categories: ${categories.join(', ')}. Impact levels: ${impactLevels.join(', ')}.`;

      // Create workshop object
      const workshop = {
        id: `oversight_workshop_${Date.now()}`,
        name: workshopName,
        description: description,
        duration: Math.max(120, selectedFindingObjects.length * 20), // 20 minutes per finding, minimum 2 hours
        participants: impactLevels.includes('high') ? 15 : 10,
        objectives: [
          `Address ${selectedFindingObjects.length} agent findings`,
          ...categories.map((cat: string) => `Improve ${cat.replace('-', ' ')} practices`),
          'Create actionable improvement plans',
          'Establish monitoring and follow-up processes'
        ],
        steps: generateWorkshopSteps(selectedFindingObjects, categories),
        status: 'draft',
        workshop_type: 'oversight',
        source_data: {
          type: 'oversight-driven',
          findings: selectedFindingObjects,
          categories: categories,
          impactLevels: impactLevels,
          recommendations: recommendations
        }
      };

      console.log('🏗️ Generated workshop:', workshop);

      // Save workshop to database
      const saveResponse = await fetch('/api/workshops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workshop),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save workshop to database');
      }

      const saveResult = await saveResponse.json();
      console.log('✅ Workshop saved to database:', saveResult);

      // Update finding statuses and save to database
      const updatePromises = selectedFindingObjects.map(async (finding) => {
        try {
          const response = await fetch('/api/agent-findings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: finding.id,
              agent_id: finding.agentId,
              team_id: finding.teamId,
              task: finding.task,
              finding: finding.finding,
              impact: finding.impact,
              category: finding.category,
              recommendations: finding.recommendations,
              status: 'workshop-ready'
            }),
          });
          
          if (response.ok) {
            console.log(`✅ Updated finding ${finding.id} status to workshop-ready`);
          }
        } catch (error) {
          console.error(`❌ Failed to update finding ${finding.id}:`, error);
        }
      });

      await Promise.all(updatePromises);

      // Link findings to workshop
      try {
        const linkResponse = await fetch(`/api/workshops/${workshop.id}/findings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            finding_ids: selectedFindingObjects.map(f => f.id)
          }),
        });

        if (linkResponse.ok) {
          console.log('✅ Agent findings linked to workshop successfully');
        }
      } catch (linkError) {
        console.error('❌ Error linking findings to workshop:', linkError);
      }

      // Update local state
      selectedFindings.forEach(findingId => 
        updateFindingStatus(findingId, 'workshop-ready')
      );

      // Clear selections
      setSelectedFindings([]);

      // Show success message
      alert(`✅ Workshop "${workshopName}" created successfully!\n\nWorkshop Details:\n- Duration: ${workshop.duration} minutes\n- Participants: ${workshop.participants}\n- Findings addressed: ${selectedFindingObjects.length}\n\nThe workshop is now available in the Workshop Builder tab.`);

      // Emit socket event for real-time updates
      if (socket) {
        socket.emit('workshop-created', {
          workshop: workshop,
          findings: selectedFindingObjects,
          timestamp: new Date()
        });
      }

    } catch (error) {
      console.error('❌ Error creating workshop:', error);
      alert('Failed to create workshop. Please try again or check the console for details.');
    } finally {
      // Reset button state
      if (originalButton) {
        originalButton.disabled = false;
        originalButton.innerHTML = '<span>🏗️</span><span>Create Workshop from ' + selectedFindings.length + ' Findings</span>';
      }
    }
  };

  // Helper function to generate workshop steps based on findings
  const generateWorkshopSteps = (findings: any[], categories: string[]) => {
    const steps = [
      {
        id: 'intro_oversight',
        name: 'Introduction & Findings Overview',
        duration: 15,
        type: 'introduction',
        description: 'Present agent findings and workshop objectives',
        materials: ['findings-summary', 'presentation'],
        agentTasks: ['create-findings-presentation', 'prepare-overview']
      },
      {
        id: 'analyze_findings',
        name: 'Analyze Agent Findings',
        duration: Math.min(60, findings.length * 10),
        type: 'main',
        description: 'Deep dive into each critical finding and its implications',
        materials: ['findings-data', 'analysis-tools'],
        agentTasks: ['analyze-finding-impact', 'prepare-recommendations']
      },
      {
        id: 'prioritize_actions',
        name: 'Prioritize Action Items',
        duration: 30,
        type: 'main',
        description: 'Rank findings by impact and create priority matrix',
        materials: ['priority-matrix', 'voting-tools'],
        agentTasks: ['calculate-impact-scores', 'generate-priority-matrix']
      }
    ];

    // Add category-specific sessions
    categories.forEach((category: string, index: number) => {
      steps.push({
        id: `category_${index}`,
        name: `${category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Action Planning`,
        duration: 25,
        type: 'main',
        description: `Create specific action plans for ${category} improvements`,
        materials: ['action-plan-template', 'category-guidelines'],
        agentTasks: ['generate-category-actions', 'create-implementation-plan']
      });
    });

    steps.push({
      id: 'create_roadmap',
      name: 'Create Implementation Roadmap',
      duration: 30,
      type: 'conclusion',
      description: 'Develop timeline and assign ownership for all action items',
      materials: ['roadmap-template', 'assignment-matrix'],
      agentTasks: ['create-timeline', 'assign-owners', 'generate-follow-up-plan']
    });

    return steps;
  };

  const filteredFindings = agentFindings.filter(finding => {
    // Add filtering logic here if needed
    return true;
  });

  const newFindingsCount = agentFindings.filter(f => f.status === 'new').length;
  const highImpactCount = agentFindings.filter(f => f.impact === 'high').length;

  const resolveIntervention = async (interventionId: string, resolution: string) => {
    if (!socket) return;

    socket.emit('resolve-human-intervention', {
      interventionId,
      resolution,
    });

    setInterventions(prev => prev.map(intervention => 
      intervention.id === interventionId 
        ? { ...intervention, status: 'resolved', resolvedAt: new Date() }
        : intervention
    ));

    setSelectedIntervention(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'expired': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'approval': return '✅';
      case 'review': return '👁️';
      case 'decision': return '🤔';
      case 'exception': return '⚠️';
      default: return '❓';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'approval': return 'bg-blue-100 text-blue-800';
      case 'review': return 'bg-purple-100 text-purple-800';
      case 'decision': return 'bg-orange-100 text-orange-800';
      case 'exception': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredInterventions = interventions.filter(intervention => {
    if (filterStatus !== 'all' && intervention.status !== filterStatus) return false;
    if (filterType !== 'all' && intervention.type !== filterType) return false;
    return true;
  });

  const pendingCount = interventions.filter(i => i.status === 'pending').length;
  const resolvedCount = interventions.filter(i => i.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveView('interventions')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'interventions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              👤 Human Interventions
            </button>
            <button
              onClick={() => setActiveView('findings')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeView === 'findings'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              🔍 Agent Findings {newFindingsCount > 0 && (
                <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                  {newFindingsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {activeView === 'interventions' ? (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <span className="text-2xl">⏳</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Resolved</p>
                  <p className="text-2xl font-bold text-gray-900">{resolvedCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{interventions.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <span className="text-2xl">⚡</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold text-gray-900">2.3h</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <span className="text-2xl">🆕</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">New Findings</p>
                  <p className="text-2xl font-bold text-gray-900">{newFindingsCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <span className="text-2xl">🚨</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">High Impact</p>
                  <p className="text-2xl font-bold text-gray-900">{highImpactCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <span className="text-2xl">✅</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Selected</p>
                  <p className="text-2xl font-bold text-gray-900">{selectedFindings.length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">{agentFindings.length}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Content based on active view */}
      {activeView === 'interventions' ? (
        <>
          {/* Filters */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Human Interventions</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="all">All Types</option>
                    <option value="approval">Approval</option>
                    <option value="review">Review</option>
                    <option value="decision">Decision</option>
                    <option value="exception">Exception</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setFilterStatus('all');
                      setFilterType('all');
                    }}
                    className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Interventions List */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Interventions ({filteredInterventions.length})
              </h3>
            </div>
            <div className="p-6">
              {filteredInterventions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👤</div>
                  <p className="text-gray-600">No interventions found</p>
                  <p className="text-sm text-gray-500">All workflows are running smoothly</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredInterventions.map((intervention) => (
                    <div
                      key={intervention.id}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedIntervention?.id === intervention.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedIntervention(intervention)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getTypeIcon(intervention.type)}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {intervention.type.charAt(0).toUpperCase() + intervention.type.slice(1)} Required
                            </h4>
                            <p className="text-sm text-gray-600">
                              Workflow: {intervention.workflowId} • Step: {intervention.stepId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(intervention.status)}`}>
                            {intervention.status}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(intervention.type)}`}>
                            {intervention.type}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-3">{intervention.message}</p>

                      <div className="flex items-center justify-between">
                        <div className="text-xs text-gray-500">
                          Created: {new Date(intervention.createdAt).toLocaleString()}
                          {intervention.resolvedAt && (
                            <span className="ml-2">
                              • Resolved: {new Date(intervention.resolvedAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        {intervention.status === 'pending' && (
                          <div className="flex space-x-2">
                            {intervention.options?.map((option) => (
                              <button
                                key={option}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolveIntervention(intervention.id, option);
                                }}
                                className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200"
                              >
                                {option}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Agent Findings Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium text-gray-900">Agent Findings ({agentFindings.length})</h3>
                <div className="flex items-center space-x-2">
                  {lastRefresh && (
                    <span className="text-xs text-gray-500">
                      Last refresh: {lastRefresh.toLocaleTimeString()}
                    </span>
                  )}
                  <button
                    onClick={refreshAgentFindings}
                    disabled={isRefreshingFindings}
                    className={`px-3 py-1.5 text-sm rounded transition-colors flex items-center space-x-1 ${
                      isRefreshingFindings
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                    title="Refresh agent findings by running comprehensive assessments"
                  >
                    <span>{isRefreshingFindings ? '⏳' : '🔄'}</span>
                    <span>{isRefreshingFindings ? 'Refreshing...' : 'Refresh Findings'}</span>
                  </button>
                </div>
              </div>
              {selectedFindings.length > 0 && (
                <button
                  onClick={createWorkshopFromFindings}
                  data-workshop-button
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 flex items-center space-x-2"
                >
                  <span>🏗️</span>
                  <span>Create Workshop from {selectedFindings.length} Findings</span>
                </button>
              )}
            </div>
            
            <div className="p-6">
              {filteredFindings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🔍</div>
                  <p className="text-gray-600">No agent findings yet</p>
                  <p className="text-sm text-gray-500">Agents will report findings from team actions</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredFindings.map((finding) => (
                    <div
                      key={finding.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        selectedFindings.includes(finding.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedFindings.includes(finding.id)}
                            onChange={() => toggleFindingSelection(finding.id)}
                            className="h-4 w-4 text-blue-600 rounded border-gray-300"
                          />
                          <span className="text-2xl">{getFindingCategoryIcon(finding.category)}</span>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {finding.agentId} • {finding.task}
                            </h4>
                            <p className="text-sm text-gray-600">
                              Team: {finding.teamId} • {new Date(finding.timestamp).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getFindingImpactColor(finding.impact)}`}>
                            {finding.impact}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full ${getFindingStatusColor(finding.status)}`}>
                            {finding.status}
                          </span>
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 mb-3">{finding.finding}</p>

                      <div className="space-y-2">
                        <h5 className="text-sm font-medium text-gray-900">Recommendations:</h5>
                        <ul className="list-disc list-inside space-y-1">
                          {finding.recommendations.map((rec, index) => (
                            <li key={index} className="text-sm text-gray-600">{rec}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            finding.category === 'data-quality' ? 'bg-blue-100 text-blue-800' :
                            finding.category === 'governance' ? 'bg-purple-100 text-purple-800' :
                            finding.category === 'compliance' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {finding.category}
                          </span>
                        </div>

                        <div className="flex space-x-2">
                          <button
                            onClick={() => updateFindingStatus(finding.id, 'reviewed')}
                            disabled={finding.status === 'reviewed'}
                            className="px-3 py-1 bg-purple-100 text-purple-800 text-xs rounded hover:bg-purple-200 disabled:opacity-50"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            onClick={() => updateFindingStatus(finding.id, 'acknowledged')}
                            disabled={finding.status === 'acknowledged'}
                            className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded hover:bg-green-200 disabled:opacity-50"
                          >
                            Acknowledge
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Intervention Details - only show in interventions view */}
      {activeView === 'interventions' && selectedIntervention && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {selectedIntervention.type.charAt(0).toUpperCase() + selectedIntervention.type.slice(1)} Details
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Message</h4>
                <p className="text-gray-700 bg-gray-50 p-4 rounded">{selectedIntervention.message}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Context</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Workflow ID:</span>
                      <span className="ml-2 text-gray-600">{selectedIntervention.workflowId}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Step ID:</span>
                      <span className="ml-2 text-gray-600">{selectedIntervention.stepId}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Type:</span>
                      <span className="ml-2 text-gray-600">{selectedIntervention.type}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Status:</span>
                      <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(selectedIntervention.status)}`}>
                        {selectedIntervention.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-700">Created:</span>
                      <span className="ml-2 text-gray-600">
                        {new Date(selectedIntervention.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {selectedIntervention.resolvedAt && (
                      <div>
                        <span className="font-medium text-gray-700">Resolved:</span>
                        <span className="ml-2 text-gray-600">
                          {new Date(selectedIntervention.resolvedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedIntervention.resolvedBy && (
                      <div>
                        <span className="font-medium text-gray-700">Resolved By:</span>
                        <span className="ml-2 text-gray-600">{selectedIntervention.resolvedBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedIntervention.options && selectedIntervention.status === 'pending' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Available Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIntervention.options.map((option) => (
                      <button
                        key={option}
                        onClick={() => resolveIntervention(selectedIntervention.id, option)}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedIntervention(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 