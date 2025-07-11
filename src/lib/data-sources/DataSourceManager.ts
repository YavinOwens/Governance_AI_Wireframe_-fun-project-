import { DataSource, DocumentMetadata } from '../agents/types';
import { AgentMessage } from '../agents/types';
import { Pool } from 'pg';

export class DataSourceManager {
  private dataSources: Map<string, DataSource> = new Map();
  private documents: Map<string, DocumentMetadata> = new Map();
  private pool: Pool;
  private isConnected = false;

  constructor() {
    this.initializeDatabase();
    this.initializeDefaultSources();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'future_thought_db',
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD || '',
      });

      const client = await this.pool.connect();
      
      // Create data_sources table
      await client.query(`
        CREATE TABLE IF NOT EXISTS data_sources (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          config JSONB,
          status VARCHAR(50) DEFAULT 'disconnected',
          last_sync TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create documents table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documents (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          type VARCHAR(50) NOT NULL,
          size BIGINT,
          last_modified TIMESTAMP,
          tags TEXT[] DEFAULT '{}',
          source VARCHAR(255),
          path VARCHAR(500),
          source_id VARCHAR(255) REFERENCES data_sources(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      client.release();
      this.isConnected = true;
      console.log('✅ DataSourceManager database connection established');
    } catch (error) {
      console.error('❌ DataSourceManager database connection failed:', error);
      this.isConnected = false;
    }
  }

  private initializeDefaultSources(): void {
    // Initialize with default data sources
    this.dataSources.set('local-upload', {
      id: 'local-upload',
      name: 'Local File Upload',
      type: 'local',
      config: {
        allowedTypes: ['pdf', 'docx', 'pptx', 'xlsx', 'txt'],
        maxFileSize: 50 * 1024 * 1024, // 50MB
      },
      status: 'connected',
      lastSync: new Date(),
    });

    this.dataSources.set('sharepoint', {
      id: 'sharepoint',
      name: 'SharePoint Integration',
      type: 'sharepoint',
      config: {
        siteUrl: process.env.SHAREPOINT_SITE_URL,
        clientId: process.env.SHAREPOINT_CLIENT_ID,
        clientSecret: process.env.SHAREPOINT_CLIENT_SECRET,
        tenantId: process.env.SHAREPOINT_TENANT_ID,
      },
      status: 'disconnected',
      lastSync: new Date(),
    });

    this.dataSources.set('cloud-storage', {
      id: 'cloud-storage',
      name: 'Cloud Storage',
      type: 'cloud',
      config: {
        provider: 'aws-s3',
        bucket: process.env.AWS_S3_BUCKET,
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
      status: 'disconnected',
      lastSync: new Date(),
    });

    this.dataSources.set('database', {
      id: 'database',
      name: 'PostgreSQL Database',
      type: 'database',
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || '5432',
        database: process.env.DB_NAME || 'future_thought_db',
        user: process.env.DB_USER || 'admin',
      },
      status: 'disconnected',
      lastSync: new Date(),
    });
  }

  public async connectDataSource(sourceId: string, config?: Record<string, any>): Promise<boolean> {
    const source = this.dataSources.get(sourceId);
    if (!source) {
      throw new Error(`Data source not found: ${sourceId}`);
    }

    try {
      switch (source.type) {
        case 'sharepoint':
          return await this.connectSharePoint(source, config);
        case 'cloud':
          return await this.connectCloudStorage(source, config);
        case 'local':
          return await this.connectLocalStorage(source, config);
        case 'database':
          return await this.connectDatabase(source, config);
        default:
          throw new Error(`Unsupported data source type: ${source.type}`);
      }
    } catch (error) {
      console.error(`Failed to connect to data source ${sourceId}:`, error);
      source.status = 'error';
      return false;
    }
  }

  private async connectSharePoint(source: DataSource, config?: Record<string, any>): Promise<boolean> {
    // Simulate SharePoint connection
    await this.delay(2000);
    
    if (config) {
      source.config = { ...source.config, ...config };
    }

    // Validate SharePoint configuration
    if (!source.config.siteUrl || !source.config.clientId) {
      source.status = 'error';
      return false;
    }

    source.status = 'connected';
    source.lastSync = new Date();
    return true;
  }

  private async connectCloudStorage(source: DataSource, config?: Record<string, any>): Promise<boolean> {
    // Simulate cloud storage connection
    await this.delay(1500);
    
    if (config) {
      source.config = { ...source.config, ...config };
    }

    // Validate cloud storage configuration
    if (!source.config.bucket || !source.config.accessKeyId) {
      source.status = 'error';
      return false;
    }

    source.status = 'connected';
    source.lastSync = new Date();
    return true;
  }

  private async connectLocalStorage(source: DataSource, config?: Record<string, any>): Promise<boolean> {
    // Local storage is always available
    if (config) {
      source.config = { ...source.config, ...config };
    }

    source.status = 'connected';
    source.lastSync = new Date();
    return true;
  }

  private async connectDatabase(source: DataSource, config?: Record<string, any>): Promise<boolean> {
    // Simulate database connection
    await this.delay(1000);
    if (config) {
      source.config = { ...source.config, ...config };
    }
    // In a real implementation, test DB connection here
    source.status = 'connected';
    source.lastSync = new Date();
    return true;
  }

  public async uploadFile(file: File, sourceId: string = 'local-upload'): Promise<DocumentMetadata> {
    const source = this.dataSources.get(sourceId);
    if (!source || source.status !== 'connected') {
      throw new Error(`Data source not available: ${sourceId}`);
    }

    // Validate file type and size
    const allowedTypes = source.config.allowedTypes || [];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (allowedTypes.length > 0 && !allowedTypes.includes(fileExtension || '')) {
      throw new Error(`File type not allowed: ${fileExtension}`);
    }

    if (file.size > (source.config.maxFileSize || 50 * 1024 * 1024)) {
      throw new Error(`File too large: ${file.size} bytes`);
    }

    // Simulate file upload
    await this.delay(1000);

    const document: DocumentMetadata = {
      id: `doc_${Date.now()}`,
      name: file.name,
      type: this.getDocumentType(file.name),
      size: file.size,
      lastModified: new Date(),
      tags: [],
      source: 'upload',
      path: `/uploads/${file.name}`,
    };

    this.documents.set(document.id, document);
    return document;
  }

  public async syncDataSource(sourceId: string): Promise<DocumentMetadata[]> {
    const source = this.dataSources.get(sourceId);
    if (!source || source.status !== 'connected') {
      throw new Error(`Data source not available: ${sourceId}`);
    }

    // Simulate data source synchronization
    await this.delay(3000);

    const documents: DocumentMetadata[] = [];
    
    switch (source.type) {
      case 'sharepoint':
        documents.push(...await this.syncSharePoint(source));
        break;
      case 'cloud':
        documents.push(...await this.syncCloudStorage(source));
        break;
      case 'local':
        documents.push(...await this.syncLocalStorage(source));
        break;
      case 'database':
        documents.push(...await this.syncDatabase(source));
        break;
    }

    // Update documents map
    documents.forEach(doc => this.documents.set(doc.id, doc));
    
    source.lastSync = new Date();
    return documents;
  }

  private async syncSharePoint(source: DataSource): Promise<DocumentMetadata[]> {
    // Simulate SharePoint document sync
    return [
      {
        id: `sp_doc_${Date.now()}_1`,
        name: 'Governance Framework.pptx',
        type: 'presentation',
        size: 2048576,
        lastModified: new Date(),
        tags: ['governance', 'framework'],
        source: 'sharepoint',
        path: '/sites/Governance/Documents/Framework.pptx',
      },
      {
        id: `sp_doc_${Date.now()}_2`,
        name: 'Workshop Guidelines.docx',
        type: 'document',
        size: 512000,
        lastModified: new Date(),
        tags: ['workshop', 'guidelines'],
        source: 'sharepoint',
        path: '/sites/Governance/Documents/Guidelines.docx',
      },
    ];
  }

  private async syncCloudStorage(source: DataSource): Promise<DocumentMetadata[]> {
    // Simulate cloud storage sync
    return [
      {
        id: `cloud_doc_${Date.now()}_1`,
        name: 'Data Analysis Report.pdf',
        type: 'pdf',
        size: 1536000,
        lastModified: new Date(),
        tags: ['analysis', 'report'],
        source: 'cloud',
        path: 's3://governance-bucket/reports/analysis.pdf',
      },
    ];
  }

  private async syncLocalStorage(source: DataSource): Promise<DocumentMetadata[]> {
    // Simulate local storage sync
    return [
      {
        id: `local_doc_${Date.now()}_1`,
        name: 'Local Workshop Notes.txt',
        type: 'document',
        size: 25600,
        lastModified: new Date(),
        tags: ['workshop', 'notes'],
        source: 'local',
        path: '/local/workshop-notes.txt',
      },
    ];
  }

  private async syncDatabase(source: DataSource): Promise<DocumentMetadata[]> {
    // Simulate database sync (could fetch table list, etc.)
    return [
      {
        id: `db_doc_${Date.now()}_1`,
        name: 'Database Table: documents',
        type: 'document',
        size: 0,
        lastModified: new Date(),
        tags: ['database', 'table'],
        source: 'database',
        path: 'db://future_thought_db/governance_platform.documents',
      },
    ];
  }

  public getDataSources(): DataSource[] {
    if (!this.isConnected) {
      return Array.from(this.dataSources.values());
    }

    try {
      const client = this.pool.connect();
      const result = client.then(async (client) => {
        const query = await client.query('SELECT * FROM data_sources ORDER BY name');
        client.release();
        return query.rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          config: row.config,
          status: row.status,
          lastSync: row.last_sync ? new Date(row.last_sync) : new Date(),
        }));
      });
      return result;
    } catch (error) {
      console.error('Error getting data sources from database, falling back to memory:', error);
      return Array.from(this.dataSources.values());
    }
  }

  public getDataSource(sourceId: string): DataSource | null {
    if (!this.isConnected) {
      return this.dataSources.get(sourceId) || null;
    }

    try {
      const client = this.pool.connect();
      const result = client.then(async (client) => {
        const query = await client.query('SELECT * FROM data_sources WHERE id = $1', [sourceId]);
        client.release();
        if (query.rows.length === 0) return null;
        const row = query.rows[0];
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          config: row.config,
          status: row.status,
          lastSync: row.last_sync ? new Date(row.last_sync) : new Date(),
        };
      });
      return result;
    } catch (error) {
      console.error('Error getting data source from database, falling back to memory:', error);
      return this.dataSources.get(sourceId) || null;
    }
  }

  public getDocuments(): DocumentMetadata[] {
    if (!this.isConnected) {
      return Array.from(this.documents.values());
    }

    try {
      const client = this.pool.connect();
      const result = client.then(async (client) => {
        const query = await client.query('SELECT * FROM documents ORDER BY last_modified DESC');
        client.release();
        return query.rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          size: row.size,
          lastModified: row.last_modified ? new Date(row.last_modified) : new Date(),
          tags: row.tags || [],
          source: row.source,
          path: row.path,
        }));
      });
      return result;
    } catch (error) {
      console.error('Error getting documents from database, falling back to memory:', error);
      return Array.from(this.documents.values());
    }
  }

  public getDocument(documentId: string): DocumentMetadata | null {
    if (!this.isConnected) {
      return this.documents.get(documentId) || null;
    }

    try {
      const client = this.pool.connect();
      const result = client.then(async (client) => {
        const query = await client.query('SELECT * FROM documents WHERE id = $1', [documentId]);
        client.release();
        if (query.rows.length === 0) return null;
        const row = query.rows[0];
        return {
          id: row.id,
          name: row.name,
          type: row.type,
          size: row.size,
          lastModified: row.last_modified ? new Date(row.last_modified) : new Date(),
          tags: row.tags || [],
          source: row.source,
          path: row.path,
        };
      });
      return result;
    } catch (error) {
      console.error('Error getting document from database, falling back to memory:', error);
      return this.documents.get(documentId) || null;
    }
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    const document = this.documents.get(documentId);
    if (!document) {
      return false;
    }

    // Simulate document deletion
    await this.delay(500);
    this.documents.delete(documentId);
    return true;
  }

  public async updateDocument(documentId: string, updates: Partial<DocumentMetadata>): Promise<DocumentMetadata | null> {
    const document = this.documents.get(documentId);
    if (!document) {
      return null;
    }

    const updatedDocument = { ...document, ...updates, lastModified: new Date() };
    this.documents.set(documentId, updatedDocument);
    return updatedDocument;
  }

  private getDocumentType(filename: string): DocumentMetadata['type'] {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    switch (extension) {
      case 'pptx':
      case 'ppt':
        return 'presentation';
      case 'docx':
      case 'doc':
        return 'document';
      case 'xlsx':
      case 'xls':
        return 'spreadsheet';
      case 'pdf':
        return 'pdf';
      default:
        return 'document';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public createAgentMessage(message: AgentMessage): void {
    // This would be used to send messages to agents about data source events
    console.log('Data source event:', message);
  }
} 