'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import AgentMonitor from '@/components/AgentMonitor';
import WorkshopBuilder from '@/components/WorkshopBuilder';
import DataSourceManager from '@/components/DataSourceManager';
import DocumentManager from '@/components/DocumentManager';
import HumanInterventionPanel from '@/components/HumanInterventionPanel';
import SingularityDashboard from '@/components/SingularityDashboard';
import DataQualityDashboard from '@/components/DataQualityDashboard';
import ReportManager from '@/components/ReportManager';
import { AgentStatus, AgentTeam, DocumentMetadata } from '@/lib/agents/types';

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [activeTab, setActiveTab] = useState('singularity');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
    console.log('Attempting to connect to WebSocket server at:', wsUrl);

    // Initialize WebSocket connection
    const socketInstance = io(wsUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      forceNew: true,
    });

    socketInstance.on('connect', () => {
      console.log('✅ Connected to WebSocket server');
      setIsConnected(true);
      
      // Request initial data
      socketInstance.emit('get-agent-status');
      socketInstance.emit('get-team-status');
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('❌ Disconnected from WebSocket server:', reason);
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
      setIsConnected(false);
    });

    socketInstance.on('agent-statuses', (statuses: AgentStatus[]) => {
      console.log('📊 Received agent statuses:', statuses);
      setAgents(statuses);
    });

    socketInstance.on('team-statuses', (teamStatuses: AgentTeam[]) => {
      console.log('👥 Received team statuses:', teamStatuses);
      setTeams(teamStatuses);
    });

    socketInstance.on('agent-message', (message) => {
      console.log('📨 Received agent message:', message);
    });

    setSocket(socketInstance);

    // Cleanup function
    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const tabs = [
    { id: 'singularity', label: '🌟 Singularity Engine', icon: '🚀' },
    { id: 'workshop', label: 'Workshop Builder', icon: '🏗️' },
    { id: 'agents', label: 'Agent Monitor', icon: '👥' },
    { id: 'data', label: 'Data Sources', icon: '📊' },
    { id: 'quality', label: 'Data Quality', icon: '🔍' },
    { id: 'reports', label: 'Reports', icon: '📋' },
    { id: 'documents', label: 'Documents', icon: '📄' },
    { id: 'intervention', label: 'Human Oversight', icon: '👤' }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'singularity':
        return <SingularityDashboard />;
      case 'workshop':
        return <WorkshopBuilder socket={socket} />;
      case 'agents':
        return <AgentMonitor agents={agents} teams={teams} socket={socket} />;
      case 'data':
        return <DataSourceManager socket={socket} />;
      case 'quality':
        return <DataQualityDashboard socket={socket} />;
      case 'reports':
        return <ReportManager socket={socket} />;
      case 'documents':
        return <DocumentManager documents={documents} socket={socket} />;
      case 'intervention':
        return <HumanInterventionPanel socket={socket} />;
      default:
        return <SingularityDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Governance Workshop Platform
                </h1>
                <p className="text-sm text-gray-600">
                  Multi-Agent Singularity Edition
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                🤖 {agents.length} Agents Active
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-purple-600 font-medium">
                  Singularity Online
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap
                  transition-colors duration-200
                  ${activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.id === 'singularity' && (
                  <div className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full font-bold">
                    NEW
                  </div>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto">
        {renderContent()}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-gray-600">
              Governance Workshop Platform v2.0 - Multi-Agent Singularity Edition
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>🧠 Collective Intelligence</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span>🤝 Agent Coordination</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span>⚡ Emergent Behaviors</span>
              </div>
            </div>
          </div>
        </div>
             </footer>
    </div>
  );
}
