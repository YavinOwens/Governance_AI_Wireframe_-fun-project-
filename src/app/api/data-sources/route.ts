import { NextRequest, NextResponse } from 'next/server';
import { DataSourceManager } from '@/lib/data-sources/DataSourceManager';

// Global data source manager instance
let dataSourceManager: DataSourceManager;

if (!dataSourceManager) {
  dataSourceManager = new DataSourceManager();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'sources':
        const sources = dataSourceManager.getDataSources();
        return NextResponse.json({ success: true, data: sources });

      case 'documents':
        const documents = dataSourceManager.getDocuments();
        return NextResponse.json({ success: true, data: documents });

      case 'source':
        const sourceId = searchParams.get('id');
        if (sourceId) {
          const source = dataSourceManager.getDataSource(sourceId);
          if (source) {
            return NextResponse.json({ success: true, data: source });
          } else {
            return NextResponse.json(
              { success: false, error: 'Data source not found' },
              { status: 404 }
            );
          }
        }
        return NextResponse.json(
          { success: false, error: 'id parameter is required' },
          { status: 400 }
        );

      case 'document':
        const documentId = searchParams.get('id');
        if (documentId) {
          const document = dataSourceManager.getDocument(documentId);
          if (document) {
            return NextResponse.json({ success: true, data: document });
          } else {
            return NextResponse.json(
              { success: false, error: 'Document not found' },
              { status: 404 }
            );
          }
        }
        return NextResponse.json(
          { success: false, error: 'id parameter is required' },
          { status: 400 }
        );

      default:
        return NextResponse.json({ 
          success: true, 
          data: {
            sources: dataSourceManager.getDataSources(),
            documents: dataSourceManager.getDocuments(),
          }
        });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in data-sources API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: 'action is required' },
        { status: 400 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'data is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'connect':
        // Connect to a data source
        if (data.sourceId) {
          const success = await dataSourceManager.connectDataSource(data.sourceId, data.config || {});
          return NextResponse.json({ 
            success, 
            message: success ? 'Data source connected successfully' : 'Failed to connect data source' 
          });
        }
        return NextResponse.json(
          { success: false, error: 'sourceId is required' },
          { status: 400 }
        );

      case 'sync':
        // Synchronize a data source
        if (data.sourceId) {
          const documents = await dataSourceManager.syncDataSource(data.sourceId);
          return NextResponse.json({ 
            success: true, 
            data: documents,
            message: `Synced ${documents.length} documents` 
          });
        }
        return NextResponse.json(
          { success: false, error: 'sourceId is required' },
          { status: 400 }
        );

      case 'upload':
        // Handle file upload
        if (data.file && data.sourceId) {
          // In a real implementation, you would handle the file upload here
          // For now, we'll simulate it
          const document = await dataSourceManager.uploadFile(data.file, data.sourceId);
          return NextResponse.json({ 
            success: true, 
            data: document,
            message: 'File uploaded successfully' 
          });
        }
        return NextResponse.json(
          { success: false, error: 'file and sourceId are required' },
          { status: 400 }
        );

      case 'delete':
        // Delete a document
        if (data.documentId) {
          const success = await dataSourceManager.deleteDocument(data.documentId);
          return NextResponse.json({ 
            success, 
            message: success ? 'Document deleted successfully' : 'Failed to delete document' 
          });
        }
        return NextResponse.json(
          { success: false, error: 'documentId is required' },
          { status: 400 }
        );

      case 'update':
        // Update document metadata
        if (data.documentId && data.updates) {
          const document = await dataSourceManager.updateDocument(data.documentId, data.updates);
          if (document) {
            return NextResponse.json({ 
              success: true, 
              data: document,
              message: 'Document updated successfully' 
            });
          } else {
            return NextResponse.json(
              { success: false, error: 'Document not found' },
              { status: 404 }
            );
          }
        }
        return NextResponse.json(
          { success: false, error: 'documentId and updates are required' },
          { status: 400 }
        );

      default:
        return NextResponse.json(
          { success: false, error: 'Unknown action' },
          { status: 400 }
        );
    }

    return NextResponse.json(
      { success: false, error: 'Invalid request data' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in data-sources API POST:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 