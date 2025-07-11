'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { AgentTeam, AgentStatus, AgentMessage } from '@/lib/agents/types';

interface TeamInteractionPanelProps {
  teams: AgentTeam[];
  agents: AgentStatus[];
  socket: Socket | null;
}

interface TeamTask {
  id: string;
  name: string;
  description: string;
  teamId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  createdAt: Date;
  assignedAgents: string[];
}

export default function TeamInteractionPanel({ teams, agents, socket }: TeamInteractionPanelProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    assignedAgents: [] as string[],
  });
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [teamMessages, setTeamMessages] = useState<AgentMessage[]>([]);
  const [teamActionResults, setTeamActionResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('agent-message', (message: AgentMessage) => {
        if (selectedTeam && teams.find(t => t.id === selectedTeam)?.agents.includes(message.from)) {
          setTeamMessages(prev => [...prev, message]);
        }
      });

      // Team Action Result Listeners
      const teamActionEvents = [
        'workshop-planning-completed',
        'stakeholder-facilitation-completed', 
        'materials-generated',
        'post-workshop-analysis-completed',
        'governance-tool-created',
        'tool-integration-tested',
        'tool-deployed',
        'database-optimized',
        'database-backed-up',
        'governance-data-analyzed',
        'team-synced',
        'team-status-report-generated',
        'team-deployed',
        'team-emergency-stopped'
      ];

      teamActionEvents.forEach(event => {
        socket.on(event, (result: any) => {
          console.log(`Received ${event}:`, result);
          setTeamActionResults(prev => [{
            event,
            result,
            timestamp: new Date().toISOString(),
            id: `result_${Date.now()}`
          }, ...prev.slice(0, 9)]); // Keep last 10 results
          setShowResults(true);
        });
      });

      // Error event listeners
      const errorEvents = [
        'workshop-planning-error',
        'stakeholder-facilitation-error',
        'materials-generation-error', 
        'post-workshop-analysis-error',
        'governance-tool-creation-error',
        'tool-integration-test-error',
        'tool-deployment-error',
        'database-optimization-error',
        'database-backup-error',
        'governance-data-analysis-error',
        'team-sync-error',
        'team-status-report-error',
        'team-deployment-error',
        'team-emergency-stop-error'
      ];

      errorEvents.forEach(event => {
        socket.on(event, (error: any) => {
          console.error(`Error in ${event}:`, error);
          setTeamActionResults(prev => [{
            event,
            result: error,
            isError: true,
            timestamp: new Date().toISOString(),
            id: `error_${Date.now()}`
          }, ...prev.slice(0, 9)]);
          setShowResults(true);
        });
      });

      return () => {
        socket.off('agent-message');
        [...teamActionEvents, ...errorEvents].forEach(event => {
          socket.off(event);
        });
      };
    }
  }, [socket, selectedTeam, teams]);

  const sendTeamMessage = (task: string, parameters: any) => {
    if (socket && selectedTeam) {
      // Send the team action directly to the server
      socket.emit(task, {
        ...parameters,
        teamId: selectedTeam,
      });
    }
  };

  const createTeamTask = () => {
    if (newTask.name.trim() && selectedTeam) {
      const task: TeamTask = {
        id: `task_${Date.now()}`,
        name: newTask.name,
        description: newTask.description,
        teamId: selectedTeam,
        status: 'pending',
        createdAt: new Date(),
        assignedAgents: newTask.assignedAgents,
      };

      setTeamTasks(prev => [...prev, task]);
      
      // Send task to assigned agents
      newTask.assignedAgents.forEach(agentId => {
        sendTeamMessage('team-task', {
          taskId: task.id,
          taskName: task.name,
          taskDescription: task.description,
          assignedAgent: agentId,
        });
      });

      setNewTask({ name: '', description: '', assignedAgents: [] });
      setShowTaskForm(false);
    }
  };

  const getTeamStatus = (teamId: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return 'unknown';

    const teamAgents = agents.filter(a => team.agents.includes(a.id));
    const busyAgents = teamAgents.filter(a => a.status === 'busy').length;
    const errorAgents = teamAgents.filter(a => a.status === 'error').length;

    if (errorAgents > 0) return 'error';
    if (busyAgents === teamAgents.length) return 'busy';
    if (busyAgents > 0) return 'partially-busy';
    return 'available';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'bg-green-500';
      case 'partially-busy': return 'bg-yellow-500';
      case 'busy': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getTeamSpecificActions = (teamId: string) => {
    switch (teamId) {
      case 'governance-workshop':
        return [
          {
            name: 'Plan Governance Workshop',
            action: 'workshop-planning',
            parameters: {
              workshopType: 'governance-framework',
              participants: 15,
              duration: 180,
              objectives: ['Define governance structure', 'Establish policies'],
              includeAI: true,
            },
            icon: '🏗️',
            color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
          },
          {
            name: 'Facilitate Stakeholder Session',
            action: 'stakeholder-facilitation',
            parameters: {
              sessionType: 'governance-workshop',
              stakeholders: ['executives', 'managers', 'employees'],
              duration: 120,
              includeAI: true,
            },
            icon: '👥',
            color: 'bg-teal-100 text-teal-800 hover:bg-teal-200',
          },
          {
            name: 'Generate Workshop Materials',
            action: 'generate-materials',
            parameters: {
              materialType: 'workshop-materials',
              includeAI: true,
              format: 'digital',
            },
            icon: '📋',
            color: 'bg-orange-100 text-orange-800 hover:bg-orange-200',
          },
          {
            name: 'Conduct Post-Workshop Analysis',
            action: 'post-workshop-analysis',
            parameters: {
              analysisType: 'governance-effectiveness',
              includeAI: true,
              generateReport: true,
            },
            icon: '📊',
            color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
          },
        ];
      case 'tool-development':
        return [
          {
            name: 'Create Governance Tool',
            action: 'create-governance-tool',
            parameters: {
              toolType: 'governance-assessment',
              requirements: ['automated-analysis', 'reporting', 'compliance-checking'],
              includeAI: true,
            },
            icon: '🛠️',
            color: 'bg-cyan-100 text-cyan-800 hover:bg-cyan-200',
          },
          {
            name: 'Test Tool Integration',
            action: 'test-tool-integration',
            parameters: {
              testType: 'integration-test',
              scope: 'full-system',
              includeAI: true,
            },
            icon: '🧪',
            color: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
          },
          {
            name: 'Deploy Tool to Production',
            action: 'deploy-tool',
            parameters: {
              deploymentType: 'production',
              environment: 'governance-platform',
              includeAI: true,
            },
            icon: '🚀',
            color: 'bg-green-100 text-green-800 hover:bg-green-200',
          },
        ];
      case 'database-management':
        return [
          {
            name: 'Optimize Database Performance',
            action: 'optimize-database',
            parameters: {
              optimizationType: 'performance',
              targetTables: ['workshops', 'documents', 'agents'],
              includeAI: true,
            },
            icon: '⚡',
            color: 'bg-blue-100 text-blue-800 hover:bg-blue-200',
          },
          {
            name: 'Backup Database',
            action: 'backup-database',
            parameters: {
              backupType: 'full',
              includeAI: true,
              compression: true,
            },
            icon: '💾',
            color: 'bg-purple-100 text-purple-800 hover:bg-purple-200',
          },
          {
            name: 'Analyze Governance Data',
            action: 'analyze-governance-data',
            parameters: {
              analysisType: 'governance-metrics',
              timeRange: 'last-30-days',
              includeAI: true,
            },
            icon: '📊',
            color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200',
          },
        ];
      default:
        return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Team Interaction Panel</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const status = getTeamStatus(team.id);
              return (
                <div
                  key={team.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedTeam === team.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedTeam(team.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{team.name}</h4>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(status)}`} />
                      <span className="text-xs text-gray-600 capitalize">{status.replace('-', ' ')}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">
                    {team.agents.length} agents • {team.capabilities.length} capabilities
                  </p>
                  <div className="mt-2">
                    {team.capabilities.slice(0, 2).map((capability) => (
                      <span key={capability} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                        {capability}
                      </span>
                    ))}
                    {team.capabilities.length > 2 && (
                      <span className="text-xs text-gray-500">
                        +{team.capabilities.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team Actions */}
      {selectedTeam && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {teams.find(t => t.id === selectedTeam)?.name} Team Actions
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {/* General Team Actions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">General Team Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => sendTeamMessage('team-sync', { action: 'sync' })}
                    className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                  >
                    🔄 Sync Team
                  </button>
                  <button
                    onClick={() => sendTeamMessage('team-status-report', { action: 'status-report' })}
                    className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                  >
                    📊 Status Report
                  </button>
                  <button
                    onClick={() => sendTeamMessage('team-deploy', { action: 'deploy' })}
                    className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                  >
                    🚀 Deploy Team
                  </button>
                  <button
                    onClick={() => sendTeamMessage('team-emergency-stop', { action: 'emergency-stop' })}
                    className="px-3 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
                  >
                    🛑 Emergency Stop
                  </button>
                </div>
              </div>

              {/* Team-Specific Actions */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Team-Specific Actions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {getTeamSpecificActions(selectedTeam).map((action) => (
                    <button
                      key={action.name}
                      onClick={() => sendTeamMessage(action.action, action.parameters)}
                      className={`px-3 py-2 text-sm rounded ${action.color}`}
                    >
                      {action.icon} {action.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Management */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-900">Team Tasks</h4>
                  <button
                    onClick={() => setShowTaskForm(!showTaskForm)}
                    className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    {showTaskForm ? 'Cancel' : 'Create Task'}
                  </button>
                </div>

                {showTaskForm && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Task Name</label>
                        <input
                          type="text"
                          value={newTask.name}
                          onChange={(e) => setNewTask(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          placeholder="Enter task name"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={newTask.description}
                          onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                          rows={3}
                          placeholder="Enter task description"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Agents</label>
                        <div className="space-y-2">
                          {teams.find(t => t.id === selectedTeam)?.agents.map((agentId) => {
                            const agent = agents.find(a => a.id === agentId);
                            return agent ? (
                              <label key={agentId} className="flex items-center space-x-2">
                                <input
                                  type="checkbox"
                                  checked={newTask.assignedAgents.includes(agentId)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewTask(prev => ({
                                        ...prev,
                                        assignedAgents: [...prev.assignedAgents, agentId]
                                      }));
                                    } else {
                                      setNewTask(prev => ({
                                        ...prev,
                                        assignedAgents: prev.assignedAgents.filter(id => id !== agentId)
                                      }));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <span className="text-sm">{agent.name}</span>
                              </label>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={createTeamTask}
                          disabled={!newTask.name.trim() || newTask.assignedAgents.length === 0}
                          className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          Create Task
                        </button>
                        <button
                          onClick={() => setShowTaskForm(false)}
                          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task List */}
                <div className="space-y-2">
                  {teamTasks
                    .filter(task => task.teamId === selectedTeam)
                    .map((task) => (
                      <div key={task.id} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-900">{task.name}</h5>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            task.status === 'completed' ? 'bg-green-100 text-green-800' :
                            task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' :
                            task.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {task.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                        <div className="text-xs text-gray-500">
                          Created: {new Date(task.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Team Action Results */}
              {showResults && teamActionResults.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900">Team Action Results</h4>
                    <button
                      onClick={() => setShowResults(false)}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Hide Results
                    </button>
                  </div>
                  <div className="max-h-96 overflow-y-auto space-y-3">
                    {teamActionResults.map((actionResult) => (
                      <div 
                        key={actionResult.id} 
                        className={`border rounded-lg p-4 ${
                          actionResult.isError ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`w-2 h-2 rounded-full ${
                              actionResult.isError ? 'bg-red-500' : 'bg-green-500'
                            }`} />
                            <h5 className="font-medium text-gray-900">
                              {actionResult.event.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </h5>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(actionResult.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        
                        {actionResult.isError ? (
                          <div className="text-red-800">
                            <p className="font-medium">Error:</p>
                            <p className="text-sm">{actionResult.result.error}</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* Workshop Planning Results */}
                            {actionResult.event === 'workshop-planning-completed' && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-800">Workshop Plan Generated</p>
                                <div className="text-sm text-green-700">
                                  <p>• Workshop Type: {actionResult.result.plan?.workshopType || 'Governance Framework'}</p>
                                  <p>• Duration: {actionResult.result.plan?.duration || 180} minutes</p>
                                  <p>• Participants: {actionResult.result.plan?.participants || 15}</p>
                                </div>
                              </div>
                            )}

                            {/* Stakeholder Facilitation Results */}
                            {actionResult.event === 'stakeholder-facilitation-completed' && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-800">Facilitation Plan Created</p>
                                <div className="text-sm text-green-700">
                                  <p>• Session Type: {actionResult.result.facilitationPlan?.sessionType}</p>
                                  <p>• Duration: {actionResult.result.facilitationPlan?.duration} minutes</p>
                                  <p>• Stakeholders: {actionResult.result.facilitationPlan?.stakeholders?.length} groups</p>
                                </div>
                              </div>
                            )}

                            {/* Materials Generation Results */}
                            {actionResult.event === 'materials-generated' && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-800">Workshop Materials Generated</p>
                                <div className="text-sm text-green-700">
                                  <p>• Components: {actionResult.result.materials?.components?.length}</p>
                                  <p>• Format: {actionResult.result.materials?.format}</p>
                                  <p>• Customization: Enabled</p>
                                </div>
                              </div>
                            )}

                            {/* Database Optimization Results */}
                            {actionResult.event === 'database-optimized' && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-800">Database Optimization Complete</p>
                                <div className="text-sm text-green-700">
                                  <p>• Tables Optimized: {actionResult.result.optimizationResult?.targetTables?.length}</p>
                                  <p>• Performance: {actionResult.result.optimizationResult?.performanceMetrics?.averageQueryTime}</p>
                                  <p>• Index Efficiency: {actionResult.result.optimizationResult?.performanceMetrics?.indexEfficiency}</p>
                                </div>
                              </div>
                            )}

                            {/* Tool Creation Results */}
                            {actionResult.event === 'governance-tool-created' && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium text-green-800">Governance Tool Specification Created</p>
                                <div className="text-sm text-green-700">
                                  <p>• Tool Type: {actionResult.result.toolSpec?.toolType}</p>
                                  <p>• Features: {actionResult.result.toolSpec?.features?.length}</p>
                                  <p>• Timeline: {actionResult.result.toolSpec?.timeline?.total}</p>
                                </div>
                              </div>
                            )}

                            {/* Generic Results Display */}
                            {!['workshop-planning-completed', 'stakeholder-facilitation-completed', 'materials-generated', 'database-optimized', 'governance-tool-created'].includes(actionResult.event) && (
                              <div className="text-sm text-green-700">
                                <p className="font-medium">Action completed successfully</p>
                                {actionResult.result.success && (
                                  <p>✓ Operation completed at {new Date(actionResult.timestamp).toLocaleString()}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Messages */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Team Messages</h4>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {teamMessages
                    .filter(msg => teams.find(t => t.id === selectedTeam)?.agents.includes(msg.from))
                    .slice(-10)
                    .reverse()
                    .map((message) => (
                      <div key={message.id} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">
                            {agents.find(a => a.id === message.from)?.name || message.from}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-700 mt-1">
                          {message.type}: {JSON.stringify(message.payload).substring(0, 100)}
                          {JSON.stringify(message.payload).length > 100 && '...'}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 