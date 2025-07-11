'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { useDropzone } from 'react-dropzone';
import { DataSource, DocumentMetadata } from '@/lib/agents/types';

interface DataSourceManagerProps {
  socket: Socket | null;
}

export default function DataSourceManager({ socket }: DataSourceManagerProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([
    // Fallback data to prevent empty state when API fails
    {
      id: 'local-upload',
      name: 'Local File Upload',
      type: 'local',
      config: {},
      status: 'connected',
      lastSync: new Date(),
    }
  ]);
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    fetchDataSources();
    fetchDocuments();
  }, []);

  const fetchDataSources = async () => {
    try {
      const response = await fetch('/api/data-sources?action=sources');
      if (!response.ok) {
        console.error('Failed to fetch data sources:', response.status, response.statusText);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setDataSources(data.data);
      }
    } catch (error) {
      console.error('Error fetching data sources:', error);
    }
  };

  const fetchDocuments = async () => {
    try {
      const response = await fetch('/api/data-sources?action=documents');
      if (!response.ok) {
        console.error('Failed to fetch documents:', response.status, response.statusText);
        return;
      }
      const data = await response.json();
      if (data.success) {
        setDocuments(data.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
    }
  };

  const connectDataSource = async (sourceId: string, config?: Record<string, any>) => {
    setIsConnecting(true);
    try {
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'connect',
          data: { sourceId, config },
        }),
      });
      if (!response.ok) {
        console.error('Failed to connect data source:', response.status, response.statusText);
        return;
      }
      const data = await response.json();
      if (data.success) {
        fetchDataSources();
      }
    } catch (error) {
      console.error('Error connecting data source:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const syncDataSource = async (sourceId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'sync',
          data: { sourceId },
        }),
      });
      if (!response.ok) {
        console.error('Failed to sync data source:', response.status, response.statusText);
        return;
      }
      const data = await response.json();
      if (data.success) {
        fetchDocuments();
      }
    } catch (error) {
      console.error('Error syncing data source:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      for (const file of acceptedFiles) {
        try {
          const response = await fetch('/api/data-sources', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'upload',
              data: { file, sourceId: 'local-upload' },
            }),
          });
          if (!response.ok) {
            console.error('Failed to upload file:', response.status, response.statusText);
            continue;
          }
          const data = await response.json();
          if (data.success) {
            fetchDocuments();
          }
        } catch (error) {
          console.error('Error uploading file:', error);
        }
      }
    },
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/plain': ['.txt'],
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-gray-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'error': return 'Error';
      default: return 'Unknown';
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'presentation': return '📊';
      case 'document': return '📄';
      case 'spreadsheet': return '📈';
      case 'pdf': return '📋';
      default: return '📄';
    }
  };

  return (
    <div className="space-y-6">
      {/* Data Sources */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Data Sources</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataSources.map((source) => (
              <div
                key={source.id}
                className={`border rounded-lg p-4 ${
                  selectedSource === source.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{source.name}</h4>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(source.status)}`} />
                    <span className="text-xs text-gray-600">{getStatusText(source.status)}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Type: {source.type === 'database' ? 'Database' : source.type} • Last sync: {new Date(source.lastSync).toLocaleDateString()}
                </p>
                <div className="space-y-2">
                  {source.status === 'disconnected' && (
                    <button
                      onClick={() => connectDataSource(source.id)}
                      disabled={isConnecting}
                      className="w-full px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isConnecting ? 'Connecting...' : 'Connect'}
                    </button>
                  )}
                  {source.status === 'connected' && (
                    <button
                      onClick={() => syncDataSource(source.id)}
                      disabled={isSyncing}
                      className="w-full px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync'}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSource(source.id)}
                    className="w-full px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* File Upload */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Upload Files</h3>
        </div>
        <div className="p-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-2">
              <div className="text-4xl">📁</div>
              <p className="text-lg font-medium text-gray-900">
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </p>
              <p className="text-sm text-gray-600">
                or click to select files
              </p>
              <p className="text-xs text-gray-500">
                Supports: PDF, PowerPoint, Word, Excel, Text files
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Documents</h3>
        </div>
        <div className="p-6">
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-600">No documents uploaded yet</p>
              <p className="text-sm text-gray-500">Upload files or connect data sources to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((document) => (
                <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getDocumentIcon(document.type)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900">{document.name}</h4>
                        <p className="text-xs text-gray-500">
                          {document.type} • {(document.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      document.source === 'upload' ? 'bg-blue-100 text-blue-800' :
                      document.source === 'sharepoint' ? 'bg-purple-100 text-purple-800' :
                      document.source === 'cloud' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {document.source}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1">
                      {document.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Modified: {new Date(document.lastModified).toLocaleDateString()}
                    </p>
                    <div className="flex space-x-2">
                      <button className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200">
                        View
                      </button>
                      <button className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Data Source Details */}
      {selectedSource && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {dataSources.find(s => s.id === selectedSource)?.name} Details
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Configuration</h4>
                <pre className="bg-gray-100 p-4 rounded text-sm overflow-x-auto text-gray-800">
                  {JSON.stringify(dataSources.find(s => s.id === selectedSource)?.config, null, 2)}
                </pre>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Actions</h4>
                <div className="flex space-x-2">
                  <button
                    onClick={() => {
                      const source = dataSources.find(s => s.id === selectedSource);
                      if (source && source.status === 'disconnected') {
                        connectDataSource(source.id);
                      } else if (source && source.status === 'connected') {
                        syncDataSource(source.id);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                  >
                    {dataSources.find(s => s.id === selectedSource)?.status === 'connected' ? 'Sync' : 'Connect'}
                  </button>
                  <button
                    onClick={() => setSelectedSource(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 