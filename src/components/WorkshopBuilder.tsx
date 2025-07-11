'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface WorkshopBuilderProps {
  socket: Socket | null;
}

interface WorkshopStep {
  id: string;
  name: string;
  duration: number;
  type: 'introduction' | 'main' | 'break' | 'conclusion';
  description: string;
  materials: string[];
  agentTasks: string[];
}

interface Workshop {
  id: string;
  name: string;
  description: string;
  duration: number;
  participants: number;
  objectives: string[];
  steps: WorkshopStep[];
  status: 'draft' | 'active' | 'completed';
  createdAt: Date;
}

export default function WorkshopBuilder({ socket }: WorkshopBuilderProps) {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Workshop | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingFromOversight, setIsCreatingFromOversight] = useState(false);
  const [newWorkshop, setNewWorkshop] = useState({
    name: '',
    description: '',
    duration: 120,
    participants: 10,
    objectives: [''],
  });
  const [oversightWorkshopData, setOversightWorkshopData] = useState<any>(null);

  // Helper function for safe date formatting
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return 'Unknown';
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      return dateObj.toLocaleDateString();
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid Date';
    }
  };

  // Load workshops from database
  const loadWorkshops = async () => {
    try {
      const response = await fetch('/api/workshops');
      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Loaded ${result.workshops.length} workshops from database`);
        // Convert string dates to Date objects and ensure proper structure
        const processedWorkshops = result.workshops.map((workshop: any) => ({
          id: workshop.id,
          name: workshop.name,
          description: workshop.description,
          duration: workshop.duration,
          participants: workshop.participants,
          objectives: Array.isArray(workshop.objectives) ? workshop.objectives : [],
          steps: Array.isArray(workshop.steps) ? workshop.steps : [],
          status: workshop.status,
          createdAt: new Date(workshop.createdAt || workshop.created_at),
          workshopType: workshop.workshopType || workshop.workshop_type,
          sourceData: workshop.sourceData || workshop.source_data,
          aiGeneratedPlan: workshop.aiGeneratedPlan || workshop.ai_generated_plan
        }));
        setWorkshops(processedWorkshops);
      } else {
        console.error('Failed to load workshops:', result.error);
        // Fallback to sample workshop if database loading fails
        setWorkshops([
          {
            id: 'workshop_1',
            name: 'Governance Framework Workshop',
            description: 'A comprehensive workshop to establish governance frameworks and policies.',
            duration: 180,
            participants: 15,
            objectives: [
              'Define governance structure',
              'Establish policies and procedures',
              'Create accountability mechanisms',
            ],
            steps: [
              {
                id: 'step_1',
                name: 'Introduction and Icebreaker',
                duration: 15,
                type: 'introduction',
                description: 'Welcome participants and set workshop expectations',
                materials: ['presentation', 'name-tags'],
                agentTasks: ['create-presentation', 'generate-icebreaker'],
              },
              {
                id: 'step_2',
                name: 'Current State Assessment',
                duration: 45,
                type: 'main',
                description: 'Analyze current governance practices and identify gaps',
                materials: ['assessment-tool', 'whiteboard'],
                agentTasks: ['analyze-data', 'generate-assessment'],
              },
            ],
            status: 'draft',
            createdAt: new Date(),
          },
        ]);
      }
    } catch (error) {
      console.error('Error loading workshops:', error);
      // Fallback to sample workshop on error
      setWorkshops([]);
    }
  };

  useEffect(() => {
    loadWorkshops();
  }, []);

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedPlan, setAiGeneratedPlan] = useState<string | null>(null);

  // Timeout ID to clear fallback data
  const [findingsRequestTimeout, setFindingsRequestTimeout] = useState<NodeJS.Timeout | null>(null);

  // Listen for oversight workshop creation requests
  useEffect(() => {
    console.log('🔍 WorkshopBuilder: Setting up socket listeners, socket available:', !!socket);
    
    if (socket) {      
      // Remove any existing listeners to prevent duplicates
      socket.off('create-oversight-workshop');
      socket.off('selected-findings-response');
      
      socket.on('create-oversight-workshop', (data) => {
        console.log('🔍 WorkshopBuilder: Received oversight workshop data:', data);
        
        // Use setTimeout to ensure state updates are processed
        setTimeout(() => {
          setOversightWorkshopData(data.data);
          setIsCreatingFromOversight(true);
          console.log('🔍 WorkshopBuilder: Set isCreatingFromOversight to true');
        }, 100);
      });

      socket.on('selected-findings-response', (data) => {
        console.log('🧪 WorkshopBuilder: Received selected findings:', data);
        
        // Clear any pending timeout
        if (findingsRequestTimeout) {
          clearTimeout(findingsRequestTimeout);
          setFindingsRequestTimeout(null);
        }
        
        // Handle response even if no findings are selected to provide better user feedback
        if (data.selectedFindings && data.selectedFindings.length > 0) {
          // Use the actual selected findings from Human Oversight
          const workshopData = {
            type: 'oversight-driven',
            findings: data.selectedFindings,
            categories: [...new Set(data.selectedFindings.map((f: any) => f.category))],
            impactLevels: [...new Set(data.selectedFindings.map((f: any) => f.impact))],
            recommendations: data.selectedFindings.flatMap((f: any) => f.recommendations)
          };
          console.log('🧪 Setting oversight data from selected findings:', workshopData);
          setOversightWorkshopData(workshopData);
          setIsCreatingFromOversight(true);
          
          // Store in sessionStorage immediately
          sessionStorage.setItem('workshopBuilder_oversightData', JSON.stringify(workshopData));
          sessionStorage.setItem('workshopBuilder_isCreatingFromOversight', 'true');
        } else {
          console.log(`🧪 No findings selected - response details:`, {
            selectedCount: data.count || 0,
            availableCount: data.availableFindings || 0,
            selectedIds: data.selectedIds || [],
            requestTime: data.requestTime
          });
          
          // Provide more specific feedback based on the response
          if (data.availableFindings === 0) {
            alert('No agent findings are available. Please run "Refresh Findings" in the Human Oversight panel first.');
          } else if (data.selectedIds?.length === 0) {
            alert(`There are ${data.availableFindings} agent findings available, but none are selected. Please select findings in the Human Oversight panel first.`);
          } else {
            alert('Please select some agent findings in the Human Oversight panel first.');
          }
        }
      });

      // Add connection status listener
      socket.on('connect', () => {
        console.log('🔍 WorkshopBuilder: Socket connected');
      });

      socket.on('disconnect', () => {
        console.log('🔍 WorkshopBuilder: Socket disconnected');
      });

      // Listen for workshop creation events from Human Oversight panel
      socket.on('workshop-created', (data) => {
        console.log('🔍 WorkshopBuilder: Workshop created from Human Oversight:', data);
        // Refresh workshops list to show the new workshop
        loadWorkshops();
      });

      return () => {
        console.log('🔍 WorkshopBuilder: Cleaning up socket listeners');
        socket.off('create-oversight-workshop');
        socket.off('selected-findings-response');
        socket.off('connect');
        socket.off('disconnect');
        socket.off('workshop-created');
        if (findingsRequestTimeout) {
          clearTimeout(findingsRequestTimeout);
        }
      };
    }
  }, [socket]); // Remove findingsRequestTimeout from dependencies to prevent re-running

  // State management safeguard to ensure proper updates
  useEffect(() => {
    console.log('🔍 WorkshopBuilder State Update:');
    console.log('  - isCreatingFromOversight:', isCreatingFromOversight);
    console.log('  - oversightWorkshopData:', oversightWorkshopData);
    console.log('  - findings count:', oversightWorkshopData?.findings?.length || 0);
    
    // If we have oversight data but not creating flag, something went wrong
    if (oversightWorkshopData && oversightWorkshopData.findings && oversightWorkshopData.findings.length > 0 && !isCreatingFromOversight) {
      console.log('🔍 Detected oversight data without creation flag, correcting state');
      setIsCreatingFromOversight(true);
    }
  }, [isCreatingFromOversight, oversightWorkshopData]);

  // Ensure component doesn't lose state on re-render
  useEffect(() => {
    // Store state in sessionStorage as backup
    if (oversightWorkshopData) {
      sessionStorage.setItem('workshopBuilder_oversightData', JSON.stringify(oversightWorkshopData));
    }
    if (isCreatingFromOversight) {
      sessionStorage.setItem('workshopBuilder_isCreatingFromOversight', 'true');
    }
  }, [oversightWorkshopData, isCreatingFromOversight]);

  // Restore state from sessionStorage on mount (improved)
  useEffect(() => {
    console.log('🔍 WorkshopBuilder: Checking for saved state...');
    
    const savedOversightData = sessionStorage.getItem('workshopBuilder_oversightData');
    const savedIsCreating = sessionStorage.getItem('workshopBuilder_isCreatingFromOversight');
    
    console.log('🔍 Found saved oversight data:', savedOversightData);
    console.log('🔍 Found saved creating flag:', savedIsCreating);
    
    if (savedOversightData && !oversightWorkshopData) {
      try {
        const parsedData = JSON.parse(savedOversightData);
        console.log('🔍 Restoring oversight data from session storage:', parsedData);
        setOversightWorkshopData(parsedData);
        
        // Ensure we also set the creation flag
        if (parsedData && parsedData.findings && parsedData.findings.length > 0) {
          setIsCreatingFromOversight(true);
          sessionStorage.setItem('workshopBuilder_isCreatingFromOversight', 'true');
        }
      } catch (error) {
        console.error('Error parsing saved oversight data:', error);
        // Clear corrupted data
        sessionStorage.removeItem('workshopBuilder_oversightData');
      }
    }
    
    if (savedIsCreating === 'true' && !isCreatingFromOversight) {
      console.log('🔍 Restoring creation flag from session storage');
      setIsCreatingFromOversight(true);
    }
    
    // If we have neither saved data nor current data, clear the creation flag
    if (!savedOversightData && !oversightWorkshopData && isCreatingFromOversight) {
      console.log('🔍 No oversight data found, clearing creation flag');
      setIsCreatingFromOversight(false);
      sessionStorage.removeItem('workshopBuilder_isCreatingFromOversight');
    }
  }, []); // Run only once on mount

  // Debug state changes
  useEffect(() => {
    console.log('🔍 State update - isCreatingFromOversight:', isCreatingFromOversight);
    console.log('🔍 State update - oversightWorkshopData:', oversightWorkshopData);
  }, [isCreatingFromOversight, oversightWorkshopData]);

  // Function to clear oversight workshop state
  const clearOversightWorkshopState = () => {
    console.log('🔍 Clearing oversight workshop state');
    setIsCreatingFromOversight(false);
    setOversightWorkshopData(null);
    sessionStorage.removeItem('workshopBuilder_oversightData');
    sessionStorage.removeItem('workshopBuilder_isCreatingFromOversight');
  };

  const createOversightWorkshop = async () => {
    if (!socket || !oversightWorkshopData) return;

    // Generate workshop based on agent findings
    const categories = oversightWorkshopData.categories || [];
    const findings = oversightWorkshopData.findings || [];
    
    const workshopName = `${categories.join(' & ').replace(/\b\w/g, l => l.toUpperCase())} Action Workshop`;
    const description = `Workshop to address ${findings.length} critical findings from agent analysis: ${findings.map(f => f.finding).join('; ').substring(0, 100)}...`;
    
    const workshop: Workshop = {
      id: `oversight_workshop_${Date.now()}`,
      name: workshopName,
      description: description,
      duration: Math.max(120, findings.length * 20), // 20 minutes per finding, minimum 2 hours
      participants: oversightWorkshopData.impactLevels?.includes('high') ? 15 : 10,
      objectives: [
        `Address ${findings.length} agent findings`,
        ...categories.map((cat: string) => `Improve ${cat.replace('-', ' ')} practices`),
        'Create actionable improvement plans',
        'Establish monitoring and follow-up processes'
      ],
      steps: generateOversightWorkshopSteps(oversightWorkshopData),
      status: 'draft',
      createdAt: new Date(),
    };

    // Generate AI-powered workshop plan specifically for oversight findings
    setAiGenerating(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'generate-oversight-workshop-plan',
          data: {
            type: 'oversight-driven',
            findings: findings.map(f => f.finding),
            categories: categories,
            impactLevels: oversightWorkshopData.impactLevels,
            recommendations: oversightWorkshopData.recommendations,
            duration: workshop.duration,
            participants: workshop.participants,
          },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setAiGeneratedPlan(result.plan);
        
        // Send oversight workshop creation request to agents
        socket.emit('agent-message', {
          id: `msg_${Date.now()}`,
          from: 'human',
          to: 'workshop-planner',
          type: 'task',
          payload: {
            task: 'create-oversight-workshop-plan',
            parameters: {
              topic: workshop.name,
              findings: findings,
              categories: categories,
              duration: workshop.duration,
              participants: workshop.participants,
              objectives: workshop.objectives,
              aiPlan: result.plan,
            },
          },
          timestamp: new Date(),
          priority: 'urgent',
        });

        // Save oversight workshop to database
        try {
          const saveResponse = await fetch('/api/workshops', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...workshop,
              workshop_type: 'oversight',
              source_data: oversightWorkshopData,
              ai_generated_plan: result.plan
            }),
          });

          if (saveResponse.ok) {
            console.log('✅ Oversight workshop saved to database successfully');
            
            // Save findings to database and link to workshop
            try {
              for (const finding of findings) {
                // Save finding to database if it doesn't exist
                await fetch('/api/agent-findings', {
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
              }

              // Link findings to workshop
              await fetch(`/api/workshops/${workshop.id}/findings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  finding_ids: findings.map(f => f.id)
                }),
              });

              console.log('✅ Agent findings linked to workshop successfully');
            } catch (findingError) {
              console.error('Error saving findings:', findingError);
            }
          } else {
            console.error('Failed to save oversight workshop to database');
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
        }
      }
    } catch (error) {
      console.error('Error generating oversight workshop plan:', error);
    } finally {
      setAiGenerating(false);
    }

    // After successful save, reload workshops from database instead of local state update
    await loadWorkshops();
    // Find and select the newly created workshop
    const newlyCreatedWorkshop = workshops.find(w => w.id === workshop.id) || workshop;
    setSelectedWorkshop(newlyCreatedWorkshop);
    setIsCreatingFromOversight(false);
    setOversightWorkshopData(null);
  };

  const generateOversightWorkshopSteps = (data: any): WorkshopStep[] => {
    const findings = data.findings || [];
    const categories = data.categories || [];
    
    const steps: WorkshopStep[] = [
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

  const createWorkshop = async () => {
    if (!socket) return;

    const workshop: Workshop = {
      id: `workshop_${Date.now()}`,
      name: newWorkshop.name,
      description: newWorkshop.description,
      duration: newWorkshop.duration,
      participants: newWorkshop.participants,
      objectives: newWorkshop.objectives.filter(obj => obj.trim() !== ''),
      steps: [],
      status: 'draft',
      createdAt: new Date(),
    };

    // Generate AI-powered workshop plan
    setAiGenerating(true);
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'generate-workshop-plan',
          data: {
            type: workshop.name,
            duration: workshop.duration,
            participants: workshop.participants,
            objectives: workshop.objectives.join(', '),
            stakeholders: 'Governance team, stakeholders, and decision makers',
          },
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setAiGeneratedPlan(result.plan);
        
        // Send workshop creation request to agents with AI plan
        socket.emit('agent-message', {
          id: `msg_${Date.now()}`,
          from: 'human',
          to: 'workshop-planner',
          type: 'task',
          payload: {
            task: 'create-workshop-plan',
            parameters: {
              topic: workshop.name,
              duration: workshop.duration,
              participants: workshop.participants,
              objectives: workshop.objectives,
              aiPlan: result.plan,
            },
          },
          timestamp: new Date(),
          priority: 'high',
        });

        // Save workshop to database
        try {
          const saveResponse = await fetch('/api/workshops', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...workshop,
              workshop_type: 'standard',
              ai_generated_plan: result.plan
            }),
          });

          if (!saveResponse.ok) {
            console.error('Failed to save workshop to database');
          } else {
            console.log('✅ Workshop saved to database successfully');
          }
        } catch (dbError) {
          console.error('Database save error:', dbError);
        }
      }
    } catch (error) {
      console.error('Error generating AI workshop plan:', error);
    } finally {
      setAiGenerating(false);
    }

    // After successful save, reload workshops from database instead of local state update
    await loadWorkshops();
    // Find and select the newly created workshop
    const newlyCreatedWorkshop = workshops.find(w => w.id === workshop.id) || workshop;
    setSelectedWorkshop(newlyCreatedWorkshop);
    setIsCreating(false);
    setNewWorkshop({
      name: '',
      description: '',
      duration: 120,
      participants: 10,
      objectives: [''],
    });
  };

  const addObjective = () => {
    setNewWorkshop(prev => ({
      ...prev,
      objectives: [...prev.objectives, ''],
    }));
  };

  const updateObjective = (index: number, value: string) => {
    setNewWorkshop(prev => ({
      ...prev,
      objectives: prev.objectives.map((obj, i) => i === index ? value : obj),
    }));
  };

  const removeObjective = (index: number) => {
    setNewWorkshop(prev => ({
      ...prev,
      objectives: prev.objectives.filter((_, i) => i !== index),
    }));
  };

  const executeWorkshop = (workshopId: string) => {
    if (!socket) return;

    socket.emit('agent-message', {
      id: `msg_${Date.now()}`,
      from: 'human',
      to: 'workshop-planner',
      type: 'task',
      payload: {
        task: 'facilitate-workshop',
        parameters: {
          workshopId,
          sessionType: 'governance',
          participants: selectedWorkshop?.participants || 10,
        },
      },
      timestamp: new Date(),
      priority: 'high',
    });

    setWorkshops(prev => prev.map(w => 
      w.id === workshopId ? { ...w, status: 'active' as const } : w
    ));
  };

  return (
    <div className="space-y-6">
      {/* Workshop List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Workshops</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Create New Workshop
            </button>
            <button
              onClick={() => setIsCreatingFromOversight(true)}
              className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700"
              title="For oversight workshops, select findings in Human Oversight first"
            >
              🔍 Create Oversight Workshop
            </button>
            <button
              onClick={() => {
                console.log('🔍 Use Selected Findings button clicked');
                console.log('🔍 Current state check:');
                console.log('  - oversightWorkshopData:', oversightWorkshopData);
                console.log('  - isCreatingFromOversight:', isCreatingFromOversight);
                console.log('  - findings count:', oversightWorkshopData?.findings?.length);
                
                // Check if we already have oversight data from Human Intervention Panel
                if (oversightWorkshopData && oversightWorkshopData.findings && oversightWorkshopData.findings.length > 0) {
                  console.log('🔍 Using existing oversight data:', oversightWorkshopData);
                  // Data already exists, just trigger workshop creation
                  setIsCreatingFromOversight(true);
                  sessionStorage.setItem('workshopBuilder_isCreatingFromOversight', 'true');
                  return;
                }
                
                console.log('🔍 No existing data - requesting selected findings from Human Oversight panel');
                if (socket) {
                  console.log('🔍 Socket available, sending request-selected-findings event');
                  
                  // Request the selected findings from Human Intervention Panel
                  socket.emit('request-selected-findings');
                  
                  // Set a timeout to show error if no response within 5 seconds
                  const timeoutId = setTimeout(() => {
                    console.log('🔍 Timeout reached - checking if we received findings data...');
                    console.log('🔍 Current state after timeout:');
                    console.log('  - isCreatingFromOversight:', isCreatingFromOversight);
                    console.log('  - oversightWorkshopData:', oversightWorkshopData);
                    
                    if (!isCreatingFromOversight || !oversightWorkshopData || !oversightWorkshopData.findings?.length) {
                      console.log('❌ No findings received from Human Oversight panel within timeout');
                      alert('Request timed out. Please ensure you have selected findings in the Human Oversight panel and both components are properly connected.');
                    }
                    setFindingsRequestTimeout(null);
                  }, 5000);
                  setFindingsRequestTimeout(timeoutId);
                } else {
                  console.log('❌ No socket connection available');
                  alert('Socket connection not available. Please ensure the servers are running and try again.');
                }
              }}
              className="px-4 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
              title="Create workshop from selected findings in Human Oversight panel"
            >
              {oversightWorkshopData && oversightWorkshopData.findings?.length > 0 
                ? `🔍 Use ${oversightWorkshopData.findings.length} Selected Findings` 
                : '🔍 Use Selected Findings'}
            </button>
          </div>
        </div>
        <div className="p-6">
          {workshops.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🏗️</div>
              <p className="text-gray-600">No workshops created yet</p>
              <p className="text-sm text-gray-500">Create your first governance workshop</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workshops.map((workshop) => (
                <div
                  key={workshop.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedWorkshop?.id === workshop.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedWorkshop(workshop)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{workshop.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      workshop.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                      workshop.status === 'active' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {workshop.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{workshop.description}</p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <p>Duration: {workshop.duration} minutes</p>
                    <p>Participants: {workshop.participants}</p>
                    <p>Steps: {workshop.steps.length}</p>
                  </div>
                  <div className="mt-3 flex space-x-2">
                    {workshop.status === 'draft' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executeWorkshop(workshop.id);
                        }}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded hover:bg-green-200"
                      >
                        Execute
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Edit workshop
                      }}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Workshop Form */}
      {isCreating && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Create New Workshop</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Workshop Name
                </label>
                <input
                  type="text"
                  value={newWorkshop.name}
                  onChange={(e) => setNewWorkshop(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="Enter workshop name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newWorkshop.description}
                  onChange={(e) => setNewWorkshop(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  rows={3}
                  placeholder="Describe the workshop purpose and goals"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={newWorkshop.duration}
                    onChange={(e) => setNewWorkshop(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    min="30"
                    max="480"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Participants
                  </label>
                  <input
                    type="number"
                    value={newWorkshop.participants}
                    onChange={(e) => setNewWorkshop(prev => ({ ...prev, participants: parseInt(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    min="1"
                    max="50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Objectives
                </label>
                <div className="space-y-2">
                  {newWorkshop.objectives.map((objective, index) => (
                    <div key={index} className="flex space-x-2">
                      <input
                        type="text"
                        value={objective}
                        onChange={(e) => updateObjective(index, e.target.value)}
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                        placeholder="Enter workshop objective"
                      />
                      <button
                        onClick={() => removeObjective(index)}
                        className="px-3 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addObjective}
                    className="px-3 py-2 bg-green-100 text-green-800 rounded hover:bg-green-200"
                  >
                    Add Objective
                  </button>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={createWorkshop}
                  disabled={!newWorkshop.name.trim() || aiGenerating}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                >
                  {aiGenerating && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{aiGenerating ? 'Generating AI Plan...' : 'Create Workshop'}</span>
                </button>
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Panel - Remove after fixing */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 mb-4 text-xs">
        <strong>Debug Info:</strong><br/>
        isCreatingFromOversight: {String(isCreatingFromOversight)}<br/>
        oversightWorkshopData: {oversightWorkshopData ? 'NOT NULL' : 'NULL'}<br/>
        oversightWorkshopData findings count: {oversightWorkshopData?.findings?.length || 'undefined'}<br/>
        Should show form: {String(isCreatingFromOversight && oversightWorkshopData)}
      </div>

      {/* Create Oversight Workshop Form */}
      {isCreatingFromOversight && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <span className="mr-2">🔍</span>
              Create Oversight-Driven Workshop
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Generate a workshop to address agent findings and governance issues
            </p>
          </div>
          <div className="p-6">
            {oversightWorkshopData ? (
              <div className="space-y-6">
                {/* Agent Findings Summary */}
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                    <span className="mr-2">📊</span>
                    Agent Findings Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white rounded p-3">
                      <p className="text-sm font-medium text-gray-700">Total Findings</p>
                      <p className="text-2xl font-bold text-blue-600">{oversightWorkshopData.findings?.length || 0}</p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="text-sm font-medium text-gray-700">Categories</p>
                      <p className="text-2xl font-bold text-purple-600">{oversightWorkshopData.categories?.length || 0}</p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="text-sm font-medium text-gray-700">High Impact</p>
                      <p className="text-2xl font-bold text-red-600">
                        {oversightWorkshopData.findings?.filter((f: any) => f.impact === 'high').length || 0}
                      </p>
                    </div>
                  </div>
                  
                  {/* Categories */}
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Categories:</p>
                    <div className="flex flex-wrap gap-2">
                      {oversightWorkshopData.categories?.map((category: string, index: number) => (
                        <span
                          key={index}
                          className={`px-3 py-1 text-sm rounded-full ${
                            category === 'data-quality' ? 'bg-blue-100 text-blue-800' :
                            category === 'governance' ? 'bg-purple-100 text-purple-800' :
                            category === 'compliance' ? 'bg-green-100 text-green-800' :
                            'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Selected Findings */}
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Selected Findings:</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {oversightWorkshopData.findings?.map((finding: any, index: number) => (
                        <div key={index} className="bg-white border rounded p-3">
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">
                              {finding.agentId} • {finding.task}
                            </h5>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              finding.impact === 'high' ? 'bg-red-100 text-red-800' :
                              finding.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {finding.impact || 'low'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">{finding.finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Workshop Configuration */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workshop Name
                    </label>
                    <input
                      type="text"
                      value={oversightWorkshopData.name || ''}
                      onChange={(e) => setOversightWorkshopData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Enter workshop name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={oversightWorkshopData.description || ''}
                      onChange={(e) => setOversightWorkshopData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                      rows={3}
                      placeholder="Workshop description will be auto-generated based on findings"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration (minutes)
                      </label>
                      <input
                        type="number"
                        value={oversightWorkshopData.duration || 120}
                        onChange={(e) => setOversightWorkshopData(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        min="60"
                        max="480"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Participants
                      </label>
                      <input
                        type="number"
                        value={oversightWorkshopData.participants || 8}
                        onChange={(e) => setOversightWorkshopData(prev => ({ ...prev, participants: parseInt(e.target.value) }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2"
                        min="3"
                        max="20"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  <button
                    onClick={createOversightWorkshop}
                    disabled={!oversightWorkshopData.name?.trim() || aiGenerating}
                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {aiGenerating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    )}
                    <span>{aiGenerating ? 'Generating Workshop...' : 'Create Oversight Workshop'}</span>
                  </button>
                  <button
                    onClick={clearOversightWorkshopState}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-gray-600">No oversight data available</p>
                <p className="text-sm text-gray-500">Please select findings in the Human Oversight panel first</p>
                <button
                  onClick={clearOversightWorkshopState}
                  className="mt-4 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Workshop Details */}
      {selectedWorkshop && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Workshop Details: {selectedWorkshop.name}
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Information</h4>
                <div className="space-y-2 text-sm">
                  <p><span className="font-medium">Duration:</span> {selectedWorkshop.duration} minutes</p>
                  <p><span className="font-medium">Participants:</span> {selectedWorkshop.participants}</p>
                  <p><span className="font-medium">Status:</span> {selectedWorkshop.status}</p>
                  <p><span className="font-medium">Created:</span> {formatDate(selectedWorkshop.createdAt)}</p>
                </div>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Objectives</h4>
                <ul className="space-y-1 text-sm">
                  {selectedWorkshop.objectives.map((objective, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-2">•</span>
                      {objective}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-6">
              <h4 className="font-medium text-gray-900 mb-3">Workshop Steps</h4>
              <div className="space-y-3">
                {selectedWorkshop.steps.map((step, index) => (
                  <div key={step.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-gray-900">
                        Step {index + 1}: {step.name}
                      </h5>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        step.type === 'introduction' ? 'bg-blue-100 text-blue-800' :
                        step.type === 'main' ? 'bg-green-100 text-green-800' :
                        step.type === 'break' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {step.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                    <div className="text-xs text-gray-500">
                      <p>Duration: {step.duration} minutes</p>
                      {step.materials.length > 0 && (
                        <p>Materials: {step.materials.join(', ')}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}