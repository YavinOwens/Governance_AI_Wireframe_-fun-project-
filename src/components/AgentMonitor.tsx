'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { AgentStatus, AgentTeam, AgentMessage } from '@/lib/agents/types';
import DataQualityDashboard from './DataQualityDashboard';

interface AgentMonitorProps {
  agents: AgentStatus[];
  teams: AgentTeam[];
  socket: Socket | null;
}

export default function AgentMonitor({ agents, teams, socket }: AgentMonitorProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'teams' | 'agents' | 'quality-dashboard'>('teams');
  const [agentResults, setAgentResults] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    if (socket) {
      socket.on('agent-message', (message: AgentMessage) => {
        setMessages(prev => [...prev, message]);
        
        // Handle responses from agents
        if (message.type === 'response' && message.payload?.result) {
          setAgentResults(prev => ({
            ...prev,
            [message.from]: message.payload.result
          }));
          setIsLoading(prev => ({
            ...prev,
            [message.from]: false
          }));
        }
      });

      socket.on('assessment-completed', (result: any) => {
        console.log('📊 Assessment completed:', result);
        setAgentResults(prev => ({
          ...prev,
          'data-quality-agent': result
        }));
        setIsLoading(prev => ({
          ...prev,
          'data-quality-agent': false
        }));
      });

      socket.on('assessment-progress', (progress: any) => {
        console.log('📈 Assessment progress:', progress);
      });

      return () => {
        socket.off('agent-message');
        socket.off('assessment-completed');
        socket.off('assessment-progress');
      };
    }
  }, [socket]);

  const sendMessage = (to: string, payload: any) => {
    if (socket) {
      const message: AgentMessage = {
        id: `msg_${Date.now()}`,
        from: 'human',
        to,
        type: 'task',
        payload,
        timestamp: new Date(),
        priority: 'medium',
      };
      
      // Set loading state for this agent
      setIsLoading(prev => ({
        ...prev,
        [to]: true
      }));
      
      socket.emit('agent-message', message);
      setMessages(prev => [...prev, message]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'busy': return 'bg-yellow-500';
      case 'idle': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'busy': return 'Available';
      case 'idle': return 'Available';
      case 'error': return 'Error';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  // Helper function to determine agent type based on name or capabilities
  const getAgentType = (agent: AgentStatus): string => {
    const name = agent.name.toLowerCase();
    if (name.includes('data quality') || name.includes('quality assessment')) {
      return 'data-quality-assessor';
    }
    if (name.includes('database') || name.includes('db manager')) {
      return 'database-manager';
    }
    if (name.includes('validation') || name.includes('validation engine')) {
      return 'validation-engine';
    }
    if (name.includes('workshop') || name.includes('planner')) {
      return 'workshop-planner';
    }
    return 'unknown';
  };

  // Helper function to render formatted results based on task type
  const renderAgentResult = (agentId: string, result: any): JSX.Element | null => {
    if (!result) return null;

    // Quality Report Display
    if (result.data?.executive_summary || result.data?.type?.includes('report')) {
      const report = result.data;
      return (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-indigo-900">📋 {report.title}</h3>
            <div className="text-right">
              <span className="text-xs text-indigo-600">{new Date(report.generated_at).toLocaleString()}</span>
              {result.download_url && (
                <a href={result.download_url} className="ml-2 text-xs text-blue-600 hover:text-blue-800">
                  📥 Download {report.format?.toUpperCase()}
                </a>
              )}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Executive Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className={`text-3xl font-bold ${
                  report.executive_summary.overall_health === 'Excellent' ? 'text-green-600' :
                  report.executive_summary.overall_health === 'Good' ? 'text-blue-600' :
                  report.executive_summary.overall_health === 'Fair' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {report.executive_summary.score}%
                </div>
                <div className="text-sm text-gray-600">{report.executive_summary.overall_health} Health</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{report.executive_summary.total_tables}</div>
                <div className="text-sm text-gray-600">Tables Analyzed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{report.executive_summary.critical_issues}</div>
                <div className="text-sm text-gray-600">Critical Issues</div>
              </div>
            </div>
            <div className="border-t pt-3">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Key Findings:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                {report.executive_summary.key_findings?.map((finding: string, index: number) => (
                  <li key={index}>• {finding}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Detailed Findings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3">Issue Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Critical</span>
                  <span className="text-sm font-bold text-red-600">
                    {report.detailed_findings?.issue_summary?.by_severity?.critical || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">High</span>
                  <span className="text-sm font-bold text-orange-600">
                    {report.detailed_findings?.issue_summary?.by_severity?.high || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Medium</span>
                  <span className="text-sm font-bold text-yellow-600">
                    {report.detailed_findings?.issue_summary?.by_severity?.medium || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Low</span>
                  <span className="text-sm font-bold text-blue-600">
                    {report.detailed_findings?.issue_summary?.by_severity?.low || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
              <div className="space-y-2">
                <div>
                  <h5 className="text-xs font-medium text-red-700 uppercase">Immediate</h5>
                  <ul className="text-sm text-gray-600">
                    {report.recommendations?.immediate_actions?.slice(0, 2).map((action: string, index: number) => (
                      <li key={index} className="truncate">• {action}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="text-xs font-medium text-yellow-700 uppercase">Short Term</h5>
                  <ul className="text-sm text-gray-600">
                    {report.recommendations?.short_term?.slice(0, 2).map((action: string, index: number) => (
                      <li key={index} className="truncate">• {action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-2">Next Steps</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {report.next_steps?.map((step: string, index: number) => (
                <div key={index} className="flex items-start space-x-2">
                  <span className="text-green-600">✓</span>
                  <span className="text-sm text-gray-700">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Data Integrity Validation Display
    if (result.data?.integrity_score !== undefined) {
      const integrity = result.data;
      return (
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-cyan-900">✅ Data Integrity Validation</h3>
            <span className="text-xs text-cyan-600">
              {new Date(integrity.checked_at).toLocaleString()}
            </span>
          </div>

          {/* Integrity Score */}
          <div className="bg-white rounded-lg p-6 shadow-sm mb-4 text-center">
            <div className="mb-2">
              <div className={`text-5xl font-bold ${
                integrity.status === 'excellent' ? 'text-green-600' :
                integrity.status === 'good' ? 'text-blue-600' :
                integrity.status === 'fair' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {integrity.integrity_score}%
              </div>
              <div className="text-lg text-gray-600 capitalize">{integrity.status} Integrity</div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 mt-4">
              <div 
                className={`h-3 rounded-full transition-all duration-500 ${
                  integrity.status === 'excellent' ? 'bg-green-500' :
                  integrity.status === 'good' ? 'bg-blue-500' :
                  integrity.status === 'fair' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${integrity.integrity_score}%` }}
              ></div>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-xl font-bold text-gray-800">{integrity.summary.tables_checked}</div>
              <div className="text-xs text-gray-600">Tables Checked</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-xl font-bold text-red-600">{integrity.summary.total_violations}</div>
              <div className="text-xs text-gray-600">Total Violations</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-xl font-bold text-red-800">{integrity.summary.critical_violations}</div>
              <div className="text-xs text-gray-600">Critical</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-xl font-bold text-orange-600">{integrity.summary.anomalies_detected}</div>
              <div className="text-xs text-gray-600">Anomalies</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm text-center">
              <div className="text-xl font-bold text-blue-600">
                {integrity.summary.constraints_checked ? '✓' : '✗'}
              </div>
              <div className="text-xs text-gray-600">Constraints</div>
            </div>
          </div>

          {/* Integrity Checks */}
          {integrity.integrity_checks?.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
              <h4 className="font-medium text-gray-900 mb-3">Integrity Issues Found</h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {integrity.integrity_checks.map((check: any, index: number) => (
                  <div key={index} className={`p-3 rounded-lg border ${
                    check.severity === 'critical' ? 'bg-red-50 border-red-200' :
                    check.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                    'bg-yellow-50 border-yellow-200'
                  }`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{check.issue}</span>
                      <span className={`text-xs px-2 py-1 rounded ${
                        check.severity === 'critical' ? 'bg-red-100 text-red-800' :
                        check.severity === 'high' ? 'bg-orange-100 text-orange-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {check.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Table: {check.table} • {check.count} violations
                    </div>
                    <div className="text-xs text-blue-700 mt-1">
                      💡 {check.recommendation}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {integrity.anomalies?.length > 0 && (
            <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
              <h4 className="font-medium text-gray-900 mb-3">Anomalies Detected</h4>
              <div className="space-y-2">
                {integrity.anomalies.map((anomaly: any, index: number) => (
                  <div key={index} className="flex items-start space-x-2 text-sm">
                    <span className="text-amber-600">⚠️</span>
                    <div>
                      <span className="font-medium">{anomaly.description}</span>
                      <span className="text-gray-600"> ({anomaly.count} instances)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              {integrity.recommendations?.slice(0, 5).map((rec: string, index: number) => (
                <li key={index}>• {rec}</li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    // Quality Scorecard Display
    if (result.data?.title?.includes('Quality Scorecard') || result.data?.overview) {
      const scorecard = result.data;
      return (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-blue-900">📊 {scorecard.title}</h3>
            <span className="text-xs text-blue-600">
              {new Date(scorecard.generated_at).toLocaleString()}
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Overall Score</div>
              <div className="text-2xl font-bold text-blue-600">{scorecard.overview.overall_score}%</div>
              <div className="text-sm text-gray-500">{scorecard.overview.status}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Total Tables</div>
              <div className="text-2xl font-bold text-green-600">{scorecard.overview.total_tables}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Total Records</div>
              <div className="text-2xl font-bold text-purple-600">{scorecard.overview.total_records?.toLocaleString()}</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Columns Analyzed</div>
              <div className="text-2xl font-bold text-orange-600">{scorecard.overview.total_columns}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3">Quality Metrics</h4>
              <div className="space-y-2">
                {Object.entries(scorecard.metrics || {}).map(([metric, value]) => (
                  <div key={metric} className="flex justify-between items-center">
                    <span className="text-sm capitalize">{metric.replace('_', ' ')}</span>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full" 
                          style={{ width: `${value}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{value}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3">Top Issues ({scorecard.top_issues?.length || 0})</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {scorecard.top_issues?.slice(0, 5).map((issue: any, index: number) => (
                  <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                    <div className="font-medium text-red-800">{issue.issue}</div>
                    <div className="text-red-600">Table: {issue.table_name}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-3">Table Scores</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-40 overflow-y-auto">
              {scorecard.table_scores?.map((table: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <div>
                    <div className="text-sm font-medium">{table.table}</div>
                    <div className="text-xs text-gray-500">{table.records} records</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{table.score}%</div>
                    <div className="text-xs text-red-500">{table.issues} issues</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Quality Trends Display
    if (result.data?.completeness_trend || result.data?.analysis_period) {
      const trends = result.data;
      return (
        <div className="bg-gradient-to-r from-green-50 to-teal-50 border border-green-200 rounded-lg p-6 mt-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-green-900">📈 Quality Trends Analysis</h3>
            <div className="text-right">
              <span className="text-xs text-green-600">Analysis Period</span>
              <div className="text-sm font-medium text-green-800">{trends.analysis_period}</div>
            </div>
          </div>
          
          {/* Main Trend Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {Object.entries(trends).filter(([key]) => key.endsWith('_trend')).map(([key, trend]: [string, any]) => {
              const metricName = key.replace('_trend', '').replace('_', ' ');
              const isImproving = trend.direction === 'improving';
              const isStable = trend.direction === 'stable';
              
              return (
                <div key={key} className="bg-white rounded-lg p-6 shadow-sm border">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-600 capitalize">{metricName}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      isImproving ? 'bg-green-100 text-green-800' :
                      isStable ? 'bg-blue-100 text-blue-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {trend.direction}
                    </span>
                  </div>
                  
                  <div className="mb-4">
                    <div className="text-3xl font-bold text-gray-900 mb-1">{trend.current}%</div>
                    <div className={`text-sm font-medium ${
                      isImproving ? 'text-green-600' :
                      isStable ? 'text-blue-600' :
                      'text-red-600'
                    }`}>
                      {trend.change} from previous period
                    </div>
                  </div>
                  
                  {/* Mini Trend Chart */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-2">Last 5 periods</div>
                    <div className="flex items-end space-x-1 h-12">
                      {trend.data_points?.map((point: number, index: number) => {
                        const height = (point / Math.max(...trend.data_points)) * 100;
                        return (
                          <div key={index} className="flex-1 bg-gray-100 rounded-sm relative">
                            <div 
                              className={`rounded-sm transition-all duration-300 ${
                                isImproving ? 'bg-green-500' :
                                isStable ? 'bg-blue-500' :
                                'bg-red-500'
                              }`}
                              style={{ height: `${height}%` }}
                            ></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        isImproving ? 'bg-green-500' :
                        isStable ? 'bg-blue-500' :
                        'bg-red-500'
                      }`}
                      style={{ width: `${trend.current}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Volume Trends Section */}
          {trends.volume_trend && (
            <div className="bg-white rounded-lg p-6 shadow-sm border mb-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">📊 Data Volume Trends</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{trends.volume_trend.records_added?.toLocaleString()}</div>
                  <div className="text-sm text-green-700">Records Added</div>
                  <div className="text-xs text-green-600 mt-1">↗️ New data</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{trends.volume_trend.records_modified?.toLocaleString()}</div>
                  <div className="text-sm text-blue-700">Records Modified</div>
                  <div className="text-xs text-blue-600 mt-1">✏️ Updates</div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{trends.volume_trend.records_deleted?.toLocaleString()}</div>
                  <div className="text-sm text-red-700">Records Deleted</div>
                  <div className="text-xs text-red-600 mt-1">🗑️ Removals</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{trends.volume_trend.net_change}</div>
                  <div className="text-sm text-purple-700">Net Change</div>
                  <div className="text-xs text-purple-600 mt-1">📈 Overall</div>
                </div>
              </div>
            </div>
          )}

          {/* Predictions Section */}
          {trends.predictions && (
            <div className="bg-white rounded-lg p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">🔮 Predictive Analysis</h4>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  trends.predictions.confidence === 'high' ? 'bg-green-100 text-green-800' :
                  trends.predictions.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {trends.predictions.confidence} confidence
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(trends.predictions.next_30_days).map(([metric, predicted]: [string, any]) => {
                  const currentValue = trends[`${metric}_trend`]?.current || 0;
                  const change = predicted - currentValue;
                  const isPositive = change > 0;
                  
                  return (
                    <div key={metric} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 capitalize mb-2">{metric}</div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-500">Current</span>
                        <span className="text-lg font-medium">{currentValue}%</span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-500">Predicted</span>
                        <span className="text-lg font-bold text-blue-600">{predicted}%</span>
                      </div>
                      <div className={`text-center text-sm font-medium ${
                        isPositive ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isPositive ? '↗️' : '↘️'} {change > 0 ? '+' : ''}{change.toFixed(1)}% expected
                      </div>
                    </div>
                  );
                })}
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <div className="text-sm text-blue-800">
                  <strong>Insight:</strong> Predictions are based on historical trends and current patterns. 
                  {trends.predictions.confidence === 'high' ? ' High confidence indicates stable trend patterns.' :
                   trends.predictions.confidence === 'medium' ? ' Medium confidence suggests some variability in trends.' :
                   ' Low confidence indicates high variability - monitor closely.'}
                </div>
              </div>
            </div>
          )}

          {/* Key Insights */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <h5 className="font-medium text-gray-900 mb-2">🎯 Key Insights</h5>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Overall data quality showing {
                  Object.values(trends).filter((trend: any) => trend?.direction === 'improving').length > 
                  Object.values(trends).filter((trend: any) => trend?.direction === 'declining').length ? 
                  'positive trends' : 'mixed results'
                }</li>
                <li>• {trends.volume_trend?.net_change?.startsWith('+') ? 'Growing' : 'Stable'} data volume</li>
                {trends.predictions && <li>• Future outlook: {trends.predictions.confidence} confidence</li>}
              </ul>
            </div>
            
            <div className="bg-white rounded-lg p-4 shadow-sm border">
              <h5 className="font-medium text-gray-900 mb-2">💡 Recommendations</h5>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Continue monitoring weekly trends</li>
                <li>• Focus on metrics showing decline</li>
                <li>• Set up automated alerts for threshold breaches</li>
                {trends.predictions && trends.predictions.confidence === 'low' && 
                  <li>• Investigate trend volatility causes</li>
                }
              </ul>
            </div>
          </div>
        </div>
      );
    }

    // Improvement Roadmap Display
    if (result.data?.phases) {
      const roadmap = result.data;
      return (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6 mt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-purple-900">🗺️ {roadmap.title}</h3>
            <span className="text-xs text-purple-600">Timeline: {roadmap.timeline}</span>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Current Score</div>
              <div className="text-2xl font-bold text-purple-600">{roadmap.current_score}%</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-sm text-gray-600">Target Score</div>
              <div className="text-2xl font-bold text-green-600">{roadmap.target_score}%</div>
            </div>
          </div>

          <div className="space-y-3">
            {roadmap.phases?.map((phase: any, index: number) => (
              <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">Phase {phase.phase}: {phase.title}</h4>
                  <span className={`px-2 py-1 text-xs rounded ${
                    phase.priority === 'high' ? 'bg-red-100 text-red-800' :
                    phase.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {phase.priority}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-2">{phase.duration} • {phase.expected_improvement}</div>
                <div className="text-sm">
                  {phase.tasks?.slice(0, 3).map((task: string, taskIndex: number) => (
                    <div key={taskIndex} className="text-gray-700">• {task}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Data Issues Display
    if (result.data?.total_issues !== undefined) {
      const issues = result.data;
      return (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-6 mt-4">
          <h3 className="text-lg font-semibold text-red-900 mb-4">🔍 Data Issues Analysis</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-sm text-gray-600">Total Issues</div>
              <div className="text-xl font-bold text-red-600">{issues.total_issues}</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-sm text-gray-600">Critical</div>
              <div className="text-xl font-bold text-red-800">{issues.issues_by_severity?.critical || 0}</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-sm text-gray-600">High</div>
              <div className="text-xl font-bold text-orange-600">{issues.issues_by_severity?.high || 0}</div>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="text-sm text-gray-600">Medium/Low</div>
              <div className="text-xl font-bold text-yellow-600">
                {(issues.issues_by_severity?.medium || 0) + (issues.issues_by_severity?.low || 0)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 shadow-sm">
            <h4 className="font-medium text-gray-900 mb-3">Top Issues</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {issues.top_issues?.map((issue: any, index: number) => (
                <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                  <div className="font-medium text-red-800">{issue.issue}</div>
                  <div className="text-red-600">Table: {issue.table_name} • Severity: {issue.severity}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // Generic Result Display
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">📋 Agent Response</h3>
        <div className="text-sm text-gray-700">
          <div className="font-medium mb-2">Status: {result.success ? '✅ Success' : '❌ Failed'}</div>
          {result.message && <div className="mb-2">Message: {result.message}</div>}
          {result.data && (
            <details className="mt-2">
              <summary className="cursor-pointer text-blue-600 hover:text-blue-800">View Details</summary>
              <pre className="mt-2 p-2 bg-white rounded border text-xs overflow-auto max-h-40">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('teams')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'teams'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              👥 Agent Teams
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'agents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              🤖 Individual Agents
            </button>
            <button
              onClick={() => setActiveTab('quality-dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'quality-dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              📊 Data Quality Dashboard
            </button>
          </nav>
        </div>
      </div>

      {/* Data Quality Dashboard Tab */}
      {activeTab === 'quality-dashboard' && (
        <DataQualityDashboard socket={socket} />
      )}

      {/* Agent Teams */}
      {activeTab === 'teams' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Agent Teams</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {teams.map((team) => (
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
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      team.status === 'active' ? 'bg-green-100 text-green-800' :
                      team.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {team.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {team.agents.length} agents • {team.capabilities.length} capabilities
                  </p>
                  <div className="mt-2">
                    {team.capabilities.slice(0, 2).map((capability, index) => (
                      <span key={`team-${team.id}-capability-${index}-${(capability || '').substring(0, 10)}-${Math.random().toString(36).substr(2, 5)}`} className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1 mb-1">
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
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Individual Agents */}
      {activeTab === 'agents' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Individual Agents</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedAgent === agent.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedAgent(agent.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{agent.name}</h4>
                    <div className="flex items-center space-x-2">
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                      <span className="text-xs text-gray-600">{getStatusText(agent.status)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    {agent.currentTask || 'No current task'}
                  </p>
                  <div className="space-y-1">
                    {agent.capabilities.slice(0, 3).map((capability, index) => (
                      <span key={`agent-${agent.id}-capability-${index}-${capability.substring(0, 10)}-${Math.random().toString(36).substr(2, 5)}`} className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded mr-1 mb-1">
                        {capability}
                      </span>
                    ))}
                    {agent.capabilities.length > 3 && (
                      <span className="text-xs text-gray-500">
                        +{agent.capabilities.length - 3} more
                      </span>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    Last activity: {new Date(agent.lastActivity).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Agent Communication */}
      {selectedAgent && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Communicate with {agents.find(a => a.id === selectedAgent)?.name}
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => sendMessage(selectedAgent, {
                    task: 'get-status',
                    parameters: {}
                  })}
                  className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                >
                  Get Status
                </button>
                <button
                  onClick={() => sendMessage(selectedAgent, {
                    task: 'get-capabilities',
                    parameters: {}
                  })}
                  className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                >
                  Get Capabilities
                </button>
                <button
                  onClick={() => sendMessage(selectedAgent, {
                    task: 'ping',
                    parameters: {}
                  })}
                  className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200"
                >
                  Ping
                </button>
              </div>

              {/* Custom Message */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Send Custom Message
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Enter your message..."
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (newMessage.trim()) {
                        sendMessage(selectedAgent, {
                          task: 'custom-message',
                          parameters: { message: newMessage }
                        });
                        setNewMessage('');
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
              </div>

              {/* Message History */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Recent Messages
                </label>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {messages
                    .filter(msg => msg.from === selectedAgent || msg.to === selectedAgent)
                    .slice(-10)
                    .reverse()
                    .map((message, index) => (
                      <div key={`${selectedAgent}-message-${message.id}-${index}-${message.timestamp}`} className="text-sm p-2 bg-gray-50 rounded">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">
                            {message.from === selectedAgent ? message.from : 'You'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-gray-700 mt-1">
                          {message.type}: {(() => {
                            try {
                              const payloadStr = JSON.stringify(message.payload || {});
                              return payloadStr.substring(0, 100) + (payloadStr.length > 100 ? '...' : '');
                            } catch (error) {
                              return '[Unable to display payload]';
                            }
                          })()}
                        </p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Agent Results Display */}
              {agentResults[selectedAgent] && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">
                      Latest Results
                    </label>
                    <button
                      onClick={() => setAgentResults(prev => ({ ...prev, [selectedAgent]: null }))}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                  {renderAgentResult(selectedAgent, agentResults[selectedAgent])}
                </div>
              )}

              {/* Loading State */}
              {isLoading[selectedAgent] && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-blue-800">Processing request...</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Team Details */}
      {selectedTeam && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {teams.find(t => t.id === selectedTeam)?.name} Team Details
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Team Members</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {teams.find(t => t.id === selectedTeam)?.agents.map((agentId, index) => {
              const agent = agents.find(a => a.id === agentId);
              return agent ? (
                <div key={`${selectedTeam}-agent-${agentId}-${index}-${agent.name.substring(0, 5)}-${Math.random().toString(36).substr(2, 5)}`} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="text-sm font-medium">{agent.name}</span>
                  <span className="text-xs text-gray-500">({getStatusText(agent.status)})</span>
                </div>
              ) : null;
            })}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                                  {teams.find(t => t.id === selectedTeam)?.capabilities.map((capability, index) => (
                  <span key={`${selectedTeam}-team-capability-${index}-${capability.substring(0, 10)}-${Math.random().toString(36).substr(2, 5)}`} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                    {capability}
                  </span>
                ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Team Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => {
                      const team = teams.find(t => t.id === selectedTeam);
                      if (team && socket) {
                        team.agents.forEach(agentId => {
                          sendMessage(agentId, {
                            task: 'team-coordination',
                            parameters: { teamId: selectedTeam, action: 'sync' }
                          });
                        });
                      }
                    }}
                    className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                  >
                    🔄 Sync Team
                  </button>
                  <button
                    onClick={() => {
                      const team = teams.find(t => t.id === selectedTeam);
                      if (team && socket) {
                        team.agents.forEach(agentId => {
                          sendMessage(agentId, {
                            task: 'team-coordination',
                            parameters: { teamId: selectedTeam, action: 'status-report' }
                          });
                        });
                      }
                    }}
                    className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                  >
                    📊 Status Report
                  </button>
                  <button
                    onClick={() => {
                      const team = teams.find(t => t.id === selectedTeam);
                      if (team && socket) {
                        team.agents.forEach(agentId => {
                          sendMessage(agentId, {
                            task: 'team-coordination',
                            parameters: { teamId: selectedTeam, action: 'deploy' }
                          });
                        });
                      }
                    }}
                    className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                  >
                    🚀 Deploy Team
                  </button>
                  <button
                    onClick={() => {
                      const team = teams.find(t => t.id === selectedTeam);
                      if (team && socket) {
                        team.agents.forEach(agentId => {
                          sendMessage(agentId, {
                            task: 'team-coordination',
                            parameters: { teamId: selectedTeam, action: 'emergency-stop' }
                          });
                        });
                      }
                    }}
                    className="px-3 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
                  >
                    🛑 Emergency Stop
                  </button>
                </div>
              </div>

              {/* Team-Specific Actions */}
              {selectedTeam === 'governance-workshop' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Governance Workshop Team Actions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'workshop-planning',
                              parameters: { 
                                workshopType: 'governance-framework',
                                participants: 15,
                                duration: 180,
                                objectives: ['Define governance structure', 'Establish policies']
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded hover:bg-indigo-200"
                    >
                      🏗️ Plan Workshop
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'stakeholder-engagement',
                              parameters: { 
                                stakeholders: ['executives', 'managers', 'employees'],
                                engagementType: 'workshop-facilitation'
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-teal-100 text-teal-800 text-sm rounded hover:bg-teal-200"
                    >
                      👥 Engage Stakeholders
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'generate-materials',
                              parameters: { 
                                materialType: 'workshop-materials',
                                includeAI: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded hover:bg-orange-200"
                    >
                      📋 Generate Materials
                    </button>
                  </div>
                </div>
              )}

              {selectedTeam === 'tool-development' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Tool Development Team Actions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'create-tool',
                              parameters: { 
                                toolType: 'governance-assessment',
                                requirements: ['automated-analysis', 'reporting']
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-cyan-100 text-cyan-800 text-sm rounded hover:bg-cyan-200"
                    >
                      🛠️ Create Tool
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'test-tools',
                              parameters: { 
                                testType: 'integration-test',
                                scope: 'full-system'
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200"
                    >
                      🧪 Test Tools
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'deploy-tools',
                              parameters: { 
                                deploymentType: 'production',
                                environment: 'governance-platform'
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                    >
                      🚀 Deploy Tools
                    </button>
                  </div>
                </div>
              )}

              {selectedTeam === 'database-management' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Database Management Team Actions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'assess-database-health',
                              parameters: { 
                                includePerformanceMetrics: true,
                                generateReport: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                    >
                      🏥 Health Check
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'optimize-query-performance',
                              parameters: { 
                                analyzeSlowQueries: true,
                                suggestIndexes: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                    >
                      ⚡ Optimize Queries
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'schedule-maintenance',
                              parameters: { 
                                maintenanceType: 'vacuum-analyze',
                                priority: 'medium',
                                scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours from now
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                    >
                      🔧 Schedule Maintenance
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'perform-backup',
                              parameters: { 
                                backupType: 'full',
                                compress: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded hover:bg-indigo-200"
                    >
                      💾 Backup Database
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'analyze-performance-metrics',
                              parameters: { 
                                timeRange: 'last-24-hours',
                                includeCharts: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-cyan-100 text-cyan-800 text-sm rounded hover:bg-cyan-200"
                    >
                      📊 Performance Report
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'connection-management',
                              parameters: { 
                                action: 'monitor-connections',
                                alertThreshold: 80
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200"
                    >
                      🔗 Monitor Connections
                    </button>
                  </div>
                </div>
              )}

              {/* Data Quality Analytics Team Actions */}
              {selectedTeam === 'data-quality-analytics' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Data Quality Analytics Team Actions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'assess-data-quality',
                              parameters: { 
                                dataSourceId: 'all',
                                assessmentType: 'comprehensive',
                                generateScorecard: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-emerald-100 text-emerald-800 text-sm rounded hover:bg-emerald-200"
                    >
                      🎯 Quality Assessment
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'identify-data-issues',
                              parameters: { 
                                includeRecommendations: true,
                                severityFilter: 'high',
                                autoFixSuggestions: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
                    >
                      🔍 Identify Issues
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'monitor-quality-trends',
                              parameters: { 
                                timeRange: 'last-30-days',
                                trendAnalysis: true,
                                alertOnDegradation: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                    >
                      📈 Monitor Trends
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'generate-quality-report',
                              parameters: { 
                                reportType: 'executive-summary',
                                includeVisualization: true,
                                format: 'pdf'
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                    >
                      📋 Generate Report
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'validate-data-integrity',
                              parameters: { 
                                validationType: 'cross-source',
                                checkConstraints: true,
                                detectAnomalies: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded hover:bg-orange-200"
                    >
                      ✅ Validate Integrity
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'recommend-improvements',
                              parameters: { 
                                prioritize: true,
                                includeImplementationGuide: true,
                                estimateEffort: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-teal-100 text-teal-800 text-sm rounded hover:bg-teal-200"
                    >
                      💡 Improvement Plans
                    </button>
                  </div>
                </div>
              )}

              {/* Validation Engine Team Actions */}
              {selectedTeam === 'validation-engine' && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Validation Engine Team Actions</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'create-validation-rules',
                              parameters: { 
                                ruleType: 'business-logic',
                                autoGenerateFromSchema: true,
                                includeAISuggestions: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-violet-100 text-violet-800 text-sm rounded hover:bg-violet-200"
                    >
                      📏 Create Rules
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'execute-validation-checks',
                              parameters: { 
                                scope: 'all-active-rules',
                                generateViolationReport: true,
                                includeRemediation: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                    >
                      ✅ Run Validations
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'detect-data-anomalies',
                              parameters: { 
                                analysisType: 'statistical',
                                confidenceThreshold: 0.8,
                                includePatternAnalysis: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-amber-100 text-amber-800 text-sm rounded hover:bg-amber-200"
                    >
                      🔍 Detect Anomalies
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'pattern-recognition',
                              parameters: { 
                                patternType: 'quality-degradation',
                                timeWindow: 'last-7-days',
                                generateAlerts: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-pink-100 text-pink-800 text-sm rounded hover:bg-pink-200"
                    >
                      🎭 Pattern Analysis
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'statistical-analysis',
                              parameters: { 
                                analysisType: 'distribution-analysis',
                                includeBaseline: true,
                                detectDrift: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-cyan-100 text-cyan-800 text-sm rounded hover:bg-cyan-200"
                    >
                      📊 Statistical Analysis
                    </button>
                    <button
                      onClick={() => {
                        const team = teams.find(t => t.id === selectedTeam);
                        if (team && socket) {
                          team.agents.forEach(agentId => {
                            sendMessage(agentId, {
                              task: 'generate-validation-report',
                              parameters: { 
                                includeMetrics: true,
                                violationSummary: true,
                                actionableInsights: true
                              }
                            });
                          });
                        }
                      }}
                      className="px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded hover:bg-indigo-200"
                    >
                      📋 Validation Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Agent Specific Actions */}
      {selectedAgent && (
        <div className="bg-white rounded-lg shadow mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              Advanced Actions for {agents.find(a => a.id === selectedAgent)?.name}
            </h3>
          </div>
          <div className="p-6">
            {/* Data Quality Assessment Agent Actions */}
            {getAgentType(agents.find(a => a.id === selectedAgent)!) === 'data-quality-assessor' && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Data Quality Assessment Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'assess-specific-source',
                      parameters: { 
                        dataSourceId: 'future-thought-db',
                        assessmentType: 'deep-dive',
                        generateDetailedReport: true
                      }
                    })}
                    className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                  >
                    🎯 Assess Future Thought DB
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'quality-scorecard',
                      parameters: { 
                        includeHistoricalData: true,
                        compareWithBaseline: true
                      }
                    })}
                    className="px-3 py-2 bg-blue-100 text-blue-800 text-sm rounded hover:bg-blue-200"
                  >
                    📊 Generate Scorecard
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'quality-trends',
                      parameters: { 
                        analysisWindow: '30-days',
                        predictFutureTrends: true
                      }
                    })}
                    className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                  >
                    📈 Trend Analysis
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'improvement-roadmap',
                      parameters: { 
                        prioritizeByImpact: true,
                        includeTimeEstimates: true
                      }
                    })}
                    className="px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded hover:bg-orange-200"
                  >
                    🗺️ Improvement Roadmap
                  </button>
                </div>
              </div>
            )}

            {/* Database Manager Agent Actions */}
            {agents.find(a => a.id === selectedAgent)?.capabilities.includes('database-management') && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Database Management Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'health-assessment',
                      parameters: { 
                        includePerformanceMetrics: true,
                        checkIndexHealth: true,
                        analyzeSchemaDrift: true
                      }
                    })}
                    className="px-3 py-2 bg-emerald-100 text-emerald-800 text-sm rounded hover:bg-emerald-200"
                  >
                    🏥 Full Health Check
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'query-optimization',
                      parameters: { 
                        analyzeSlowQueries: true,
                        generateIndexSuggestions: true,
                        estimatePerformanceGains: true
                      }
                    })}
                    className="px-3 py-2 bg-yellow-100 text-yellow-800 text-sm rounded hover:bg-yellow-200"
                  >
                    ⚡ Query Optimizer
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'maintenance-scheduler',
                      parameters: { 
                        maintenanceType: 'comprehensive',
                        schedulingStrategy: 'minimal-impact',
                        notifyBeforeExecution: true
                      }
                    })}
                    className="px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded hover:bg-indigo-200"
                  >
                    🔧 Schedule Maintenance
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'performance-dashboard',
                      parameters: { 
                        timeRange: 'real-time',
                        includeAlerts: true,
                        generateInsights: true
                      }
                    })}
                    className="px-3 py-2 bg-cyan-100 text-cyan-800 text-sm rounded hover:bg-cyan-200"
                  >
                    📊 Performance Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* Validation Engine Agent Actions */}
            {agents.find(a => a.id === selectedAgent)?.capabilities.includes('validation-engine') && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Validation Engine Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'smart-rule-creation',
                      parameters: { 
                        useAIRecommendations: true,
                        analyzeDataPatterns: true,
                        createBusinessRules: true
                      }
                    })}
                    className="px-3 py-2 bg-violet-100 text-violet-800 text-sm rounded hover:bg-violet-200"
                  >
                    🧠 Smart Rule Builder
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'comprehensive-validation',
                      parameters: { 
                        validateAllSources: true,
                        crossReferenceValidation: true,
                        generateViolationHeatmap: true
                      }
                    })}
                    className="px-3 py-2 bg-red-100 text-red-800 text-sm rounded hover:bg-red-200"
                  >
                    ✅ Full Validation Suite
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'anomaly-detection',
                      parameters: { 
                        useMLAlgorithms: true,
                        confidenceThreshold: 0.85,
                        includeSeasonalAdjustment: true
                      }
                    })}
                    className="px-3 py-2 bg-amber-100 text-amber-800 text-sm rounded hover:bg-amber-200"
                  >
                    🔍 ML Anomaly Detection
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'validation-insights',
                      parameters: { 
                        generateExecutiveSummary: true,
                        includeActionablePlan: true,
                        predictValidationTrends: true
                      }
                    })}
                    className="px-3 py-2 bg-pink-100 text-pink-800 text-sm rounded hover:bg-pink-200"
                  >
                    📋 Insights Report
                  </button>
                </div>
              </div>
            )}

            {/* Workshop Planner Agent Actions */}
            {agents.find(a => a.id === selectedAgent)?.capabilities.includes('workshop-planner') && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Workshop Planning Actions</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'create-workshop-plan',
                      parameters: { 
                        workshopType: 'data-governance',
                        duration: 240,
                        participantCount: 20,
                        includeAIFacilitation: true
                      }
                    })}
                    className="px-3 py-2 bg-indigo-100 text-indigo-800 text-sm rounded hover:bg-indigo-200"
                  >
                    🏗️ Plan Data Governance Workshop
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'generate-materials',
                      parameters: { 
                        materialType: 'comprehensive',
                        includeInteractiveElements: true,
                        customizeForAudience: true
                      }
                    })}
                    className="px-3 py-2 bg-green-100 text-green-800 text-sm rounded hover:bg-green-200"
                  >
                    📋 Generate Materials
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'facilitate-session',
                      parameters: { 
                        sessionType: 'strategy-planning',
                        enableRealTimeInsights: true,
                        recordOutcomes: true
                      }
                    })}
                    className="px-3 py-2 bg-purple-100 text-purple-800 text-sm rounded hover:bg-purple-200"
                  >
                    🎤 Facilitate Session
                  </button>
                  <button
                    onClick={() => sendMessage(selectedAgent, {
                      task: 'synthesize-outcomes',
                      parameters: { 
                        includeActionItems: true,
                        generateFollowUpPlan: true,
                        createExecutiveSummary: true
                      }
                    })}
                    className="px-3 py-2 bg-orange-100 text-orange-800 text-sm rounded hover:bg-orange-200"
                  >
                    📊 Synthesize Outcomes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 