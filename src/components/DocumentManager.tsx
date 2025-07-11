'use client';

import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { DocumentMetadata } from '@/lib/agents/types';

interface DocumentManagerProps {
  documents: DocumentMetadata[];
  socket: Socket | null;
}

export default function DocumentManager({ documents, socket }: DocumentManagerProps) {
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentMetadata[]>(documents);
  const [selectedDocument, setSelectedDocument] = useState<DocumentMetadata | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);

  useEffect(() => {
    filterDocuments();
  }, [documents, searchTerm, filterType, filterSource, sortBy]);

  const filterDocuments = () => {
    let filtered = [...documents];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(doc => 
        doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(doc => doc.type === filterType);
    }

    // Source filter
    if (filterSource !== 'all') {
      filtered = filtered.filter(doc => doc.source === filterSource);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'size':
          return b.size - a.size;
        case 'date':
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        case 'type':
          return a.type.localeCompare(b.type);
        default:
          return 0;
      }
    });

    setFilteredDocuments(filtered);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const deleteDocument = async (documentId: string) => {
    try {
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          data: { documentId },
        }),
      });
      const data = await response.json();
      if (data.success) {
        // Refresh documents list
        window.location.reload();
      }
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const addTag = async (documentId: string, tag: string) => {
    try {
      const response = await fetch('/api/data-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          data: { 
            documentId, 
            updates: { 
              tags: [...(selectedDocument?.tags || []), tag] 
            } 
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        // Refresh documents list
        window.location.reload();
      }
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const analyzeDocumentWithAI = async (document: DocumentMetadata, analysisType: string) => {
    setAiAnalyzing(true);
    setAiAnalysis(null);
    
    try {
      // Simulate document content for demo purposes
      const documentContent = `This is a sample ${document.type} document titled "${document.name}". 
      It contains governance-related content and was created on ${new Date(document.lastModified).toLocaleDateString()}. 
      The document is ${formatFileSize(document.size)} in size and has tags: ${document.tags.join(', ')}.`;
      
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operation: 'analyze-document',
          data: {
            content: documentContent,
            analysisType: analysisType,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      const result = JSON.parse(text);
      
      if (result.success) {
        setAiAnalysis(result.analysis);
        
        // Send analysis to agents
        if (socket) {
          socket.emit('agent-message', {
            id: `msg_${Date.now()}`,
            from: 'human',
            to: 'db-admin',
            type: 'task',
            payload: {
              task: 'analyze-document',
              parameters: {
                documentId: document.id,
                analysisType: analysisType,
                aiAnalysis: result.analysis,
              },
            },
            timestamp: new Date(),
            priority: 'medium',
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing document with AI:', error);
    } finally {
      setAiAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Document Manager</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search documents..."
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Types</option>
                <option value="presentation">Presentation</option>
                <option value="document">Document</option>
                <option value="spreadsheet">Spreadsheet</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="all">All Sources</option>
                <option value="upload">Upload</option>
                <option value="sharepoint">SharePoint</option>
                <option value="cloud">Cloud</option>
                <option value="local">Local</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="name">Name</option>
                <option value="date">Date</option>
                <option value="size">Size</option>
                <option value="type">Type</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('all');
                  setFilterSource('all');
                  setSortBy('name');
                }}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Documents ({filteredDocuments.length})
            </h3>
            <div className="text-sm text-gray-500">
              {documents.length} total documents
            </div>
          </div>
        </div>
        <div className="p-6">
          {filteredDocuments.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-gray-600">No documents found</p>
              <p className="text-sm text-gray-500">Try adjusting your filters or upload new documents</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredDocuments.map((document) => (
                <div
                  key={document.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedDocument?.id === document.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setSelectedDocument(document)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{getDocumentIcon(document.type)}</span>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm truncate" title={document.name}>
                          {document.name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {document.type} • {formatFileSize(document.size)}
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
                      {document.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                          {tag}
                        </span>
                      ))}
                      {document.tags.length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{document.tags.length - 3} more
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      Modified: {new Date(document.lastModified).toLocaleDateString()}
                    </p>
                    <div className="flex space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // View document
                        }}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded hover:bg-blue-200"
                      >
                        View
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          analyzeDocumentWithAI(document, 'governance');
                        }}
                        disabled={aiAnalyzing}
                        className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded hover:bg-purple-200 disabled:opacity-50"
                      >
                        {aiAnalyzing ? '🤖' : 'AI'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDocument(document.id);
                        }}
                        className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded hover:bg-red-200"
                      >
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

      {/* Document Details */}
      {selectedDocument && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">{selectedDocument.name}</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-4">Document Information</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Type</label>
                    <p className="text-sm text-gray-600">{selectedDocument.type}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Size</label>
                    <p className="text-sm text-gray-600">{formatFileSize(selectedDocument.size)}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Source</label>
                    <p className="text-sm text-gray-600">{selectedDocument.source}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Path</label>
                    <p className="text-sm text-gray-600 font-mono">{selectedDocument.path}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Modified</label>
                    <p className="text-sm text-gray-600">
                      {new Date(selectedDocument.lastModified).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-4">Tags</h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.tags.map((tag) => (
                      <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Add Tag</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Enter new tag..."
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                            addTag(selectedDocument.id, e.currentTarget.value.trim());
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                          if (input.value.trim()) {
                            addTag(selectedDocument.id, input.value.trim());
                            input.value = '';
                          }
                        }}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Section */}
            {aiAnalysis && (
              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-4 flex items-center">
                  <span className="mr-2">🤖</span>
                  AI Analysis
                </h4>
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-white p-3 rounded border">
                      {aiAnalysis}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex space-x-2">
              <button
                onClick={() => {
                  // Download document
                }}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Download
              </button>
              <button
                onClick={() => {
                  // Share document
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Share
              </button>
              <button
                onClick={() => analyzeDocumentWithAI(selectedDocument, 'governance')}
                disabled={aiAnalyzing}
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {aiAnalyzing && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{aiAnalyzing ? 'Analyzing...' : 'AI Analysis'}</span>
              </button>
              <button
                onClick={() => deleteDocument(selectedDocument.id)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedDocument(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 