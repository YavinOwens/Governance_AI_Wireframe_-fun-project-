'use client';

import React, { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';

interface DataQualityMetrics {
  completeness: number;
  accuracy: number;
  consistency: number;
  validity: number;
  uniqueness: number;
  timeliness: number;
}

interface QualityIssue {
  type: string;
  field?: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  count: number;
  examples?: string[];
}

interface QualityRecommendation {
  issue_type: string;
  recommendation: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  effort_estimate: string;
  expected_impact: string;
}

interface DataQualityAssessment {
  id: string;
  data_source_id: string;
  table_name: string;
  assessment_type: string;
  metrics: DataQualityMetrics;
  overall_score: number;
  issues: QualityIssue[];
  recommendations: QualityRecommendation[];
  status: 'completed' | 'failed' | 'in_progress';
  assessed_at: Date;
  total_records: number;
  columns_analyzed: number;
}

interface DataQualityDashboardProps {
  socket: Socket | null;
}

export default function DataQualityDashboard({ socket }: DataQualityDashboardProps) {
  const [assessments, setAssessments] = useState<DataQualityAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<DataQualityAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'recommendations' | 'trends'>('overview');

  useEffect(() => {
    if (socket) {
      socket.on('assessment-completed', (data: any) => {
        // Handle multi-table assessment results
        if (data.type === 'multi-table-assessment' && data.individual_assessments) {
          // Add each individual table assessment
          const newAssessments = data.individual_assessments
            .filter((assessment: any) => assessment.status !== 'failed')
            .map((assessment: any) => ({
              ...assessment,
              id: assessment.id || `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              table_name: assessment.table_name || 'Unknown Table',
              data_source_id: assessment.data_source_id || assessment.table_name || 'unknown',
              issues: Array.isArray(assessment.issues) ? assessment.issues : [],
              recommendations: Array.isArray(assessment.recommendations) ? assessment.recommendations : [],
              metrics: assessment.metrics || {
                completeness: 0,
                accuracy: 0,
                consistency: 0,
                validity: 0,
                uniqueness: 0,
                timeliness: 0
              },
              total_records: assessment.total_records || 0,
              columns_analyzed: assessment.columns_analyzed || 0,
              overall_score: assessment.overall_score || 0
            }));
          
          setAssessments(prev => [...newAssessments, ...prev].slice(0, 20)); // Keep last 20 assessments
        } else {
          // Handle single table assessment
          const sanitizedData = {
            ...data,
            id: data.id || `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            table_name: data.table_name || 'Unknown Table',
            data_source_id: data.data_source_id || 'unknown',
            issues: Array.isArray(data.issues) ? data.issues : [],
            recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
            metrics: data.metrics || {
              completeness: 0,
              accuracy: 0,
              consistency: 0,
              validity: 0,
              uniqueness: 0,
              timeliness: 0
            },
            total_records: data.total_records || 0,
            columns_analyzed: data.columns_analyzed || 0,
            overall_score: data.overall_score || 0
          };
          setAssessments(prev => [sanitizedData, ...prev.slice(0, 19)]); // Keep last 19 + this one = 20
        }
      });

      socket.on('assessment-progress', (data: { progress: number; stage: string }) => {
        setIsLoading(data.progress < 100);
      });

      return () => {
        socket.off('assessment-completed');
        socket.off('assessment-progress');
      };
    }
  }, [socket]);

  const runAssessment = (dataSourceId: string, tableName?: string) => {
    if (socket) {
      setIsLoading(true);
      socket.emit('agent-message', {
        to: 'data-quality-agent',
        type: 'task',
        payload: {
          task: 'assess-data-quality',
          parameters: {
            dataSourceId,
            tableName,
            assessmentType: 'comprehensive',
            includeTableInfo: true
          }
        }
      });
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-100';
    if (score >= 75) return 'text-yellow-600 bg-yellow-100';
    if (score >= 60) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Data Quality Dashboard</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => runAssessment('users')}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              🧪 Assess Users Table
            </button>
            <button
              onClick={() => runAssessment('agents')}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              🤖 Assess Agents Table
            </button>
            <button
              onClick={() => runAssessment('all')}
              disabled={isLoading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
            >
              🔍 Assess All Tables
            </button>
          </div>
        </div>
        
        {isLoading && (
          <div className="mt-4">
            <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                Running data quality assessment...
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-6">
        {/* Recent Assessments List */}
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Assessments</h3>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">📊</div>
              <p>No assessments run yet. Click one of the buttons above to start.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments.map((assessment, assessmentIndex) => (
                <div
                  key={`assessment-${assessment.id || assessmentIndex}-${assessment.table_name || 'unknown'}`}
                  onClick={() => setSelectedAssessment(assessment)}
                  className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{assessment.table_name || 'Multiple Tables'}</h4>
                      <p className="text-sm text-gray-600">Data Source: {assessment.data_source_id}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getScoreColor(assessment.overall_score)}`}>
                      {assessment.overall_score}/100
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mb-2">
                    <div>📊 {assessment.total_records?.toLocaleString() || 'N/A'} records</div>
                    <div>🏛️ {assessment.columns_analyzed || 'N/A'} columns</div>
                    <div>⚠️ {assessment.issues?.length || 0} issues</div>
                    <div>💡 {assessment.recommendations?.length || 0} recommendations</div>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {assessment.assessed_at ? new Date(assessment.assessed_at).toLocaleString() : 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detailed Assessment View */}
        {selectedAssessment && (
          <div className="border-t border-gray-200 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Assessment Details: {selectedAssessment.table_name || 'Multiple Tables'}
              </h3>
              <button
                onClick={() => setSelectedAssessment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8">
                {[
                  { id: 'overview', label: '📊 Overview', count: null },
                  { id: 'details', label: '🔍 Quality Metrics', count: null },
                  { id: 'recommendations', label: '💡 Recommendations', count: selectedAssessment?.recommendations?.length || 0 },
                  { id: 'trends', label: '📈 Issues', count: selectedAssessment?.issues?.length || 0 }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                    {tab.count !== null && tab.count > 0 && (
                      <span className="ml-2 bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(selectedAssessment?.overall_score || 0)} rounded-lg p-4`}>
                        {selectedAssessment?.overall_score || 0}
                      </div>
                      <p className="text-sm text-gray-600 mt-2">Overall Score</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedAssessment?.total_records?.toLocaleString() || 'N/A'}
                      </div>
                      <p className="text-sm text-gray-600">Total Records</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedAssessment?.columns_analyzed || 'N/A'}
                      </div>
                      <p className="text-sm text-gray-600">Columns Analyzed</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">
                        {selectedAssessment?.issues?.length || 0}
                      </div>
                      <p className="text-sm text-gray-600">Issues Found</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Assessment Information</h4>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <dl className="divide-y divide-gray-200">
                      <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Table Name</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {selectedAssessment?.table_name || 'Multiple Tables'}
                        </dd>
                      </div>
                      <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Data Source</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {selectedAssessment?.data_source_id || 'N/A'}
                        </dd>
                      </div>
                      <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Assessment Type</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {selectedAssessment?.assessment_type || 'N/A'}
                        </dd>
                      </div>
                      <div className="px-4 py-3 sm:grid sm:grid-cols-3 sm:gap-4">
                        <dt className="text-sm font-medium text-gray-500">Completed At</dt>
                        <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                          {selectedAssessment?.assessed_at ? new Date(selectedAssessment.assessed_at).toLocaleString() : 'N/A'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'details' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedAssessment?.metrics ? Object.entries(selectedAssessment.metrics).map(([key, value]) => (
                    <div key={`metric-${key}`} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </p>
                          <p className={`text-2xl font-bold ${getScoreColor(value)}`}>
                            {typeof value === 'number' ? value.toFixed(1) : value}%
                          </p>
                        </div>
                        <div className={`w-12 h-12 rounded-full ${getScoreColor(value)} flex items-center justify-center`}>
                          {key === 'completeness' && '📊'}
                          {key === 'accuracy' && '🎯'}
                          {key === 'consistency' && '🔄'}
                          {key === 'validity' && '✅'}
                          {key === 'uniqueness' && '🔢'}
                          {key === 'timeliness' && '⏰'}
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${value >= 90 ? 'bg-green-500' : value >= 75 ? 'bg-yellow-500' : value >= 60 ? 'bg-orange-500' : 'bg-red-500'}`}
                            style={{ width: `${value}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      <p>No metrics data available</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'recommendations' && (
              <div className="space-y-4">
                {!selectedAssessment?.recommendations || selectedAssessment.recommendations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">🎉</div>
                    <p>No recommendations needed. Data quality looks great!</p>
                  </div>
                ) : (
                  selectedAssessment.recommendations.map((rec, index) => (
                    <div key={`recommendation-${index}-${rec.issue_type}`} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900">{rec.recommendation}</h4>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">Issue Type: {rec.issue_type.replace(/_/g, ' ')}</p>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Effort Estimate:</span>
                          <span className="ml-2 text-gray-600">{rec.effort_estimate}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Expected Impact:</span>
                          <span className="ml-2 text-gray-600">{rec.expected_impact}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-4">
                {!selectedAssessment?.issues || selectedAssessment.issues.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">✨</div>
                    <p>No issues found. Your data quality is excellent!</p>
                  </div>
                ) : (
                  selectedAssessment.issues.map((issue, index) => (
                    <div key={`issue-${index}-${issue.type}`} className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)}`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium">{issue.description}</h4>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {issue.count.toLocaleString()} occurrences
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(issue.severity)}`}>
                            {issue.severity}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm opacity-90">
                        <p><strong>Type:</strong> {issue.type.replace(/_/g, ' ')}</p>
                        {issue.field && <p><strong>Field:</strong> {issue.field}</p>}
                        {issue.examples && issue.examples.length > 0 && (
                          <div className="mt-2">
                            <p><strong>Examples:</strong></p>
                            <ul className="list-disc list-inside ml-4">
                              {issue.examples.slice(0, 3).map((example, exampleIndex) => (
                                <li key={`example-${index}-${exampleIndex}-${String(example).substring(0, 10)}`} className="text-xs">{String(example)}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 