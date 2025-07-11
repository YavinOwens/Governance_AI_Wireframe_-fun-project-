import { Pool } from 'pg';
import crypto from 'crypto';

export interface ReportTemplate {
  id: string;
  name: string;
  category: 'governance' | 'data-quality' | 'workshop' | 'analysis' | 'compliance';
  description?: string;
  htmlTemplate: string;
  cssStyles: string;
  templateVariables: Record<string, any>;
  metadata: {
    version: string;
    author: string;
    lastModified: Date;
    accessibility_compliant: boolean;
    wordCount?: number;
    estimatedReadTime?: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GeneratedReport {
  id: string;
  templateId: string;
  title: string;
  htmlContent: string;
  pdfPath?: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  generatedBy: string;
  generatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
  metadata: {
    wordCount: number;
    estimatedReadTime: number;
    accessibility_score?: number;
  };
  sharePermissions: Record<string, any>;
  tags: string[];
}

export interface ReportData {
  title: string;
  organizationName?: string;
  organizationLogo?: string;
  generationDate: Date;
  version: string;
  executiveSummary?: string;
  keyFindings?: any[];
  recommendations?: any[];
  appendices?: any[];
  dataQualityMetrics?: any[];
  workshopOutcomes?: any[];
  customData?: Record<string, any>;
}

export class ReportTemplateManager {
  private pool: Pool;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    this.connectionPromise = this.initializeDatabase();
  }

  private async ensureConnection(): Promise<void> {
    if (this.connectionPromise) {
      try {
        await this.connectionPromise;
        this.connectionPromise = null;
      } catch (error) {
        console.warn('Database connection failed, falling back to mock data mode');
        this.connectionPromise = null;
        // Don't throw here, let methods handle fallback
      }
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      console.log('Initializing Report Template Manager database connection...');
      
      this.pool = new Pool({
        user: process.env.DB_USER || 'admin',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'future_thought_db',
        password: process.env.DB_PASSWORD || '',
        port: parseInt(process.env.DB_PORT || '5432'),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        options: '-c search_path=public',
      });

      // Test the connection
      const client = await this.pool.connect();
      
      // Test schema access
      await client.query('SELECT 1');
      
      // Check if tables exist and have correct schema
      const tableCheck = await client.query(`
        SELECT table_name, column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name IN ('report_templates', 'generated_reports')
        AND column_name IN ('id', 'template_id')
        ORDER BY table_name, column_name
      `);
      
      // If tables exist but have wrong data types, drop and recreate them
      if (tableCheck.rows.length > 0) {
        const hasIncompatibleSchema = tableCheck.rows.some(row => 
          (row.table_name === 'report_templates' && row.column_name === 'id' && row.data_type !== 'uuid') ||
          (row.table_name === 'generated_reports' && row.column_name === 'template_id' && row.data_type !== 'uuid')
        );
        
        if (hasIncompatibleSchema) {
          console.log('Detected incompatible schema, dropping and recreating tables...');
          await client.query('DROP TABLE IF EXISTS generated_reports CASCADE');
          await client.query('DROP TABLE IF EXISTS report_templates CASCADE');
        }
      }
      
      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS report_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          category VARCHAR(50) NOT NULL,
          description TEXT,
          html_template TEXT NOT NULL,
          css_styles TEXT NOT NULL,
          template_variables JSONB,
          metadata JSONB,
          is_active BOOLEAN DEFAULT true,
          author VARCHAR(255) DEFAULT 'system',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS generated_reports (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          template_id UUID REFERENCES report_templates(id),
          title VARCHAR(255) NOT NULL,
          html_content TEXT NOT NULL,
          pdf_path VARCHAR(500),
          status VARCHAR(50) DEFAULT 'draft',
          generated_by VARCHAR(255) NOT NULL,
          generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          reviewed_by VARCHAR(255),
          reviewed_at TIMESTAMP,
          approved_by VARCHAR(255),
          approved_at TIMESTAMP,
          metadata JSONB,
          share_permissions JSONB DEFAULT '{}',
          tags TEXT[] DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      
      // Verify the tables exist
      const tableCheckFinal = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('report_templates', 'generated_reports')
      `);
      
      if (tableCheckFinal.rows.length < 2) {
        console.warn('Report tables not found, but continuing with initialization');
      }
      
      client.release();
      this.isConnected = true;
      
      console.log('Database connection established for Report Template Manager');
      
      // Skip default template initialization for now to prevent hanging
      // TODO: Re-enable when template creation is optimized
      console.log('Skipping default template initialization to prevent API hanging');
      
      // Initialize default templates
      // try {
      //   await this.initializeDefaultTemplates();
      //   console.log('Default report templates initialized');
      // } catch (templateError) {
      //   console.warn('Warning: Could not initialize default templates:', templateError);
      //   // Don't fail the entire initialization if templates can't be created
      // }
      
    } catch (error) {
      console.error('Report Template Manager database connection failed:', error);
      this.isConnected = false;
      throw error; // Re-throw to make ensureConnection aware of the failure
    }
  }

  private async initializeDefaultTemplates(): Promise<void> {
    const defaultTemplates = [
      this.createGovernanceWorkshopTemplate(),
      this.createDataQualityReportTemplate(),
      this.createComplianceReportTemplate(),
      this.createAnalysisReportTemplate(),
    ];

    for (const template of defaultTemplates) {
      await this.createOrUpdateTemplate(template);
    }
  }

  private createGovernanceWorkshopTemplate(): Partial<ReportTemplate> {
    return {
      name: 'Governance Workshop Report',
      category: 'governance',
      description: 'Comprehensive report template for governance workshop outcomes and recommendations',
      htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{cssStyles}}</style>
</head>
<body>
    <header class="report-header">
        <div class="header-content">
            {{#if organizationLogo}}
            <img src="{{organizationLogo}}" alt="Organization Logo" class="org-logo">
            {{/if}}
            <div class="header-text">
                <h1 class="report-title">{{title}}</h1>
                <p class="report-meta">Generated: {{generationDate}} | Version: {{version}}</p>
            </div>
        </div>
    </header>

    <main class="report-content">
        <section class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="summary-content">
                {{executiveSummary}}
            </div>
        </section>

        {{#if workshopOutcomes}}
        <section class="workshop-outcomes">
            <h2>Workshop Outcomes</h2>
            {{#each workshopOutcomes}}
            <div class="outcome-item">
                <h3>{{this.title}}</h3>
                <p>{{this.description}}</p>
                {{#if this.participants}}
                <p><strong>Participants:</strong> {{this.participants}}</p>
                {{/if}}
            </div>
            {{/each}}
        </section>
        {{/if}}

        <section class="key-findings">
            <h2>Key Findings</h2>
            <div class="findings-grid">
                {{#each keyFindings}}
                <div class="finding-card">
                    <h4>{{this.title}}</h4>
                    <p>{{this.description}}</p>
                    {{#if this.priority}}
                    <span class="priority-badge priority-{{this.priority}}">{{this.priority}} Priority</span>
                    {{/if}}
                </div>
                {{/each}}
            </div>
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            <div class="recommendations-list">
                {{#each recommendations}}
                <div class="recommendation-item">
                    <div class="recommendation-header">
                        <h4>{{this.title}}</h4>
                        {{#if this.timeline}}
                        <span class="timeline">{{this.timeline}}</span>
                        {{/if}}
                    </div>
                    <p>{{this.description}}</p>
                    {{#if this.owner}}
                    <p class="owner"><strong>Owner:</strong> {{this.owner}}</p>
                    {{/if}}
                    {{#if this.impact}}
                    <p class="impact"><strong>Expected Impact:</strong> {{this.impact}}</p>
                    {{/if}}
                </div>
                {{/each}}
            </div>
        </section>

        {{#if appendices}}
        <section class="appendices">
            <h2>Appendices</h2>
            {{#each appendices}}
            <div class="appendix-item">
                <h3>Appendix {{@index}}: {{this.title}}</h3>
                <div class="appendix-content">{{this.content}}</div>
            </div>
            {{/each}}
        </section>
        {{/if}}
    </main>

    <footer class="report-footer">
        <div class="footer-content">
            <p>Generated by Future Thought AI Platform</p>
            <p>Confidential and Proprietary</p>
        </div>
    </footer>
</body>
</html>`,
      cssStyles: this.getGovernanceReportCSS(),
      templateVariables: {
        title: { type: 'string', required: true, description: 'Report title' },
        organizationName: { type: 'string', required: false, description: 'Organization name' },
        organizationLogo: { type: 'string', required: false, description: 'Organization logo URL' },
        executiveSummary: { type: 'string', required: true, description: 'Executive summary content' },
        workshopOutcomes: { type: 'array', required: false, description: 'Workshop outcomes and results' },
        keyFindings: { type: 'array', required: true, description: 'Key findings from the governance workshop' },
        recommendations: { type: 'array', required: true, description: 'Recommendations and action items' },
        appendices: { type: 'array', required: false, description: 'Additional supporting materials' },
      },
      metadata: {
        version: '1.0',
        author: 'system',
        lastModified: new Date(),
        accessibility_compliant: true,
      },
      isActive: true,
    };
  }

  private createDataQualityReportTemplate(): Partial<ReportTemplate> {
    return {
      name: 'Data Quality Assessment Report',
      category: 'data-quality',
      description: 'Professional template for data quality analysis and recommendations',
      htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{cssStyles}}</style>
</head>
<body>
    <header class="report-header">
        <div class="header-content">
            {{#if organizationLogo}}
            <img src="{{organizationLogo}}" alt="Organization Logo" class="org-logo">
            {{/if}}
            <div class="header-text">
                <h1 class="report-title">{{title}}</h1>
                <p class="report-meta">Generated: {{generationDate}} | Version: {{version}}</p>
            </div>
        </div>
    </header>

    <main class="report-content">
        <section class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="summary-content">
                {{executiveSummary}}
            </div>
        </section>

        {{#if dataQualityMetrics}}
        <section class="quality-metrics">
            <h2>Data Quality Metrics</h2>
            <div class="metrics-grid">
                {{#each dataQualityMetrics}}
                <div class="metric-card status-{{this.status}}">
                    <h4>{{this.tableName}}</h4>
                    <div class="metric-score">{{this.overallScore}}%</div>
                    <div class="metric-details">
                        <p>Total Metrics: {{this.totalMetrics}}</p>
                        <p>Passed: {{this.passedMetrics}} | Warnings: {{this.warningMetrics}} | Failed: {{this.failedMetrics}}</p>
                    </div>
                </div>
                {{/each}}
            </div>
        </section>
        {{/if}}

        <section class="key-findings">
            <h2>Quality Assessment Findings</h2>
            <div class="findings-grid">
                {{#each keyFindings}}
                <div class="finding-card severity-{{this.severity}}">
                    <h4>{{this.title}}</h4>
                    <p>{{this.description}}</p>
                    <span class="severity-badge">{{this.severity}}</span>
                </div>
                {{/each}}
            </div>
        </section>

        <section class="recommendations">
            <h2>Quality Improvement Recommendations</h2>
            <div class="recommendations-list">
                {{#each recommendations}}
                <div class="recommendation-item priority-{{this.priority}}">
                    <h4>{{this.title}}</h4>
                    <p>{{this.description}}</p>
                    {{#if this.impact}}
                    <p class="impact"><strong>Expected Impact:</strong> {{this.impact}}</p>
                    {{/if}}
                </div>
                {{/each}}
            </div>
        </section>
    </main>

    <footer class="report-footer">
        <div class="footer-content">
            <p>Generated by Future Thought AI Platform - Data Quality Analytics</p>
            <p>Confidential and Proprietary</p>
        </div>
    </footer>
</body>
</html>`,
      cssStyles: this.getDataQualityReportCSS(),
      templateVariables: {
        title: { type: 'string', required: true, description: 'Report title' },
        dataQualityMetrics: { type: 'array', required: true, description: 'Data quality assessment results' },
        keyFindings: { type: 'array', required: true, description: 'Quality issues and findings' },
        recommendations: { type: 'array', required: true, description: 'Quality improvement recommendations' },
      },
      metadata: {
        version: '1.0',
        author: 'system',
        lastModified: new Date(),
        accessibility_compliant: true,
      },
      isActive: true,
    };
  }

  private createComplianceReportTemplate(): Partial<ReportTemplate> {
    return {
      name: 'Compliance Assessment Report',
      category: 'compliance',
      description: 'Template for regulatory compliance and audit reports',
      htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{cssStyles}}</style>
</head>
<body>
    <header class="report-header">
        <div class="header-content">
            {{#if organizationLogo}}
            <img src="{{organizationLogo}}" alt="Organization Logo" class="org-logo">
            {{/if}}
            <div class="header-text">
                <h1 class="report-title">{{title}}</h1>
                <p class="report-meta">Generated: {{generationDate}} | Version: {{version}}</p>
            </div>
        </div>
    </header>

    <main class="report-content">
        <section class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="summary-content">
                {{executiveSummary}}
            </div>
        </section>

        <section class="compliance-status">
            <h2>Compliance Status Overview</h2>
            {{#each complianceAreas}}
            <div class="compliance-item status-{{this.status}}">
                <h4>{{this.area}}</h4>
                <div class="status-indicator">{{this.status}}</div>
                <p>{{this.description}}</p>
            </div>
            {{/each}}
        </section>

        <section class="findings">
            <h2>Audit Findings</h2>
            {{#each findings}}
            <div class="finding-item risk-{{this.riskLevel}}">
                <h4>{{this.title}}</h4>
                <p>{{this.description}}</p>
                <span class="risk-badge">{{this.riskLevel}} Risk</span>
            </div>
            {{/each}}
        </section>

        <section class="recommendations">
            <h2>Remediation Recommendations</h2>
            {{#each recommendations}}
            <div class="recommendation-item">
                <h4>{{this.title}}</h4>
                <p>{{this.description}}</p>
                <p><strong>Timeline:</strong> {{this.timeline}}</p>
                <p><strong>Owner:</strong> {{this.owner}}</p>
            </div>
            {{/each}}
        </section>
    </main>

    <footer class="report-footer">
        <div class="footer-content">
            <p>Generated by Future Thought AI Platform - Compliance Monitoring</p>
            <p>Confidential and Proprietary</p>
        </div>
    </footer>
</body>
</html>`,
      cssStyles: this.getComplianceReportCSS(),
      templateVariables: {
        title: { type: 'string', required: true, description: 'Compliance report title' },
        complianceAreas: { type: 'array', required: true, description: 'Compliance areas assessment' },
        findings: { type: 'array', required: true, description: 'Audit findings and issues' },
        recommendations: { type: 'array', required: true, description: 'Remediation recommendations' },
      },
      metadata: {
        version: '1.0',
        author: 'system',
        lastModified: new Date(),
        accessibility_compliant: true,
      },
      isActive: true,
    };
  }

  private createAnalysisReportTemplate(): Partial<ReportTemplate> {
    return {
      name: 'Analysis and Insights Report',
      category: 'analysis',
      description: 'General purpose template for analytical reports and insights',
      htmlTemplate: `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <style>{{cssStyles}}</style>
</head>
<body>
    <header class="report-header">
        <div class="header-content">
            {{#if organizationLogo}}
            <img src="{{organizationLogo}}" alt="Organization Logo" class="org-logo">
            {{/if}}
            <div class="header-text">
                <h1 class="report-title">{{title}}</h1>
                <p class="report-meta">Generated: {{generationDate}} | Version: {{version}}</p>
            </div>
        </div>
    </header>

    <main class="report-content">
        <section class="executive-summary">
            <h2>Executive Summary</h2>
            <div class="summary-content">
                {{executiveSummary}}
            </div>
        </section>

        <section class="analysis-results">
            <h2>Analysis Results</h2>
            {{#each analysisResults}}
            <div class="analysis-section">
                <h3>{{this.title}}</h3>
                <p>{{this.description}}</p>
                {{#if this.charts}}
                <div class="charts-container">
                    {{#each this.charts}}
                    <div class="chart-placeholder">Chart: {{this.title}}</div>
                    {{/each}}
                </div>
                {{/if}}
            </div>
            {{/each}}
        </section>

        <section class="insights">
            <h2>Key Insights</h2>
            <div class="insights-grid">
                {{#each insights}}
                <div class="insight-card">
                    <h4>{{this.title}}</h4>
                    <p>{{this.description}}</p>
                    {{#if this.confidence}}
                    <span class="confidence-score">Confidence: {{this.confidence}}%</span>
                    {{/if}}
                </div>
                {{/each}}
            </div>
        </section>

        <section class="recommendations">
            <h2>Recommendations</h2>
            {{#each recommendations}}
            <div class="recommendation-item">
                <h4>{{this.title}}</h4>
                <p>{{this.description}}</p>
                {{#if this.impact}}
                <p><strong>Expected Impact:</strong> {{this.impact}}</p>
                {{/if}}
            </div>
            {{/each}}
        </section>
    </main>

    <footer class="report-footer">
        <div class="footer-content">
            <p>Generated by Future Thought AI Platform - Analytics Engine</p>
            <p>Confidential and Proprietary</p>
        </div>
    </footer>
</body>
</html>`,
      cssStyles: this.getAnalysisReportCSS(),
      templateVariables: {
        title: { type: 'string', required: true, description: 'Analysis report title' },
        analysisResults: { type: 'array', required: true, description: 'Analysis results and data' },
        insights: { type: 'array', required: true, description: 'Key insights from analysis' },
        recommendations: { type: 'array', required: true, description: 'Action recommendations' },
      },
      metadata: {
        version: '1.0',
        author: 'system',
        lastModified: new Date(),
        accessibility_compliant: true,
      },
      isActive: true,
    };
  }

  private getGovernanceReportCSS(): string {
    return `
/* Professional Governance Report Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #fff;
}

.report-header {
    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
    color: white;
    padding: 2rem;
    border-bottom: 4px solid #1e40af;
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 2rem;
}

.org-logo {
    max-height: 80px;
    max-width: 200px;
    object-fit: contain;
}

.report-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.report-meta {
    font-size: 1.1rem;
    opacity: 0.9;
}

.report-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem 2rem;
}

section {
    margin-bottom: 3rem;
}

h2 {
    color: #1e40af;
    font-size: 2rem;
    margin-bottom: 1.5rem;
    border-bottom: 3px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

h3 {
    color: #374151;
    font-size: 1.5rem;
    margin-bottom: 1rem;
}

h4 {
    color: #4b5563;
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
}

.summary-content {
    background: #f8fafc;
    padding: 2rem;
    border-radius: 8px;
    border-left: 4px solid #3b82f6;
    font-size: 1.1rem;
}

.findings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
}

.finding-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: box-shadow 0.3s ease;
}

.finding-card:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.priority-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
}

.priority-high {
    background: #fee2e2;
    color: #dc2626;
}

.priority-medium {
    background: #fef3c7;
    color: #d97706;
}

.priority-low {
    background: #dcfce7;
    color: #16a34a;
}

.recommendations-list {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

.recommendation-item {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    border-left: 4px solid #10b981;
}

.recommendation-header {
    display: flex;
    justify-content: between;
    align-items: center;
    margin-bottom: 1rem;
}

.timeline {
    background: #ede9fe;
    color: #7c3aed;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
}

.owner, .impact {
    margin-top: 0.5rem;
    font-size: 0.9rem;
    color: #6b7280;
}

.outcome-item {
    background: #f0f9ff;
    border: 1px solid #bae6fd;
    border-radius: 8px;
    padding: 1.5rem;
    margin-bottom: 1rem;
}

.appendix-item {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #fafafa;
    border-radius: 8px;
}

.appendix-content {
    margin-top: 1rem;
    padding: 1rem;
    background: white;
    border-radius: 4px;
}

.report-footer {
    background: #374151;
    color: white;
    padding: 2rem;
    text-align: center;
    margin-top: 3rem;
}

.footer-content {
    max-width: 1200px;
    margin: 0 auto;
}

@media print {
    .report-header, .report-footer {
        background: #1e40af !important;
        -webkit-print-color-adjust: exact;
        color-adjust: exact;
    }
    
    .finding-card, .recommendation-item {
        break-inside: avoid;
        page-break-inside: avoid;
    }
}

@media (max-width: 768px) {
    .report-title {
        font-size: 1.8rem;
    }
    
    .findings-grid {
        grid-template-columns: 1fr;
    }
    
    .header-content {
        flex-direction: column;
        text-align: center;
    }
}`;
  }

  private getDataQualityReportCSS(): string {
    return `
/* Data Quality Report Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #fff;
}

.report-header {
    background: linear-gradient(135deg, #065f46 0%, #10b981 100%);
    color: white;
    padding: 2rem;
    border-bottom: 4px solid #047857;
}

.header-content {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    gap: 2rem;
}

.org-logo {
    max-height: 80px;
    max-width: 200px;
    object-fit: contain;
}

.report-title {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
}

.report-meta {
    font-size: 1.1rem;
    opacity: 0.9;
}

.report-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 3rem 2rem;
}

section {
    margin-bottom: 3rem;
}

h2 {
    color: #047857;
    font-size: 2rem;
    margin-bottom: 1.5rem;
    border-bottom: 3px solid #e5e7eb;
    padding-bottom: 0.5rem;
}

.metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
}

.metric-card {
    background: white;
    border: 2px solid #e5e7eb;
    border-radius: 12px;
    padding: 1.5rem;
    text-align: center;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.metric-card.status-pass {
    border-color: #10b981;
    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
}

.metric-card.status-warning {
    border-color: #f59e0b;
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
}

.metric-card.status-fail {
    border-color: #ef4444;
    background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
}

.metric-score {
    font-size: 3rem;
    font-weight: 700;
    color: #047857;
    margin: 1rem 0;
}

.metric-details {
    font-size: 0.9rem;
    color: #6b7280;
}

.severity-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
}

.severity-critical {
    background: #fee2e2;
    color: #dc2626;
}

.severity-high {
    background: #fef3c7;
    color: #d97706;
}

.severity-medium {
    background: #dbeafe;
    color: #2563eb;
}

.severity-low {
    background: #dcfce7;
    color: #16a34a;
}

.recommendation-item.priority-high {
    border-left: 4px solid #dc2626;
}

.recommendation-item.priority-medium {
    border-left: 4px solid #d97706;
}

.recommendation-item.priority-low {
    border-left: 4px solid #16a34a;
}

.report-footer {
    background: #374151;
    color: white;
    padding: 2rem;
    text-align: center;
    margin-top: 3rem;
}`;
  }

  private getComplianceReportCSS(): string {
    return `
/* Compliance Report Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #fff;
}

.report-header {
    background: linear-gradient(135deg, #7c2d12 0%, #dc2626 100%);
    color: white;
    padding: 2rem;
    border-bottom: 4px solid #991b1b;
}

.compliance-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}

.compliance-item.status-compliant {
    background: #ecfdf5;
    border-color: #10b981;
}

.compliance-item.status-non-compliant {
    background: #fef2f2;
    border-color: #ef4444;
}

.compliance-item.status-partial {
    background: #fffbeb;
    border-color: #f59e0b;
}

.status-indicator {
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.875rem;
}

.finding-item.risk-high {
    border-left: 4px solid #dc2626;
}

.finding-item.risk-medium {
    border-left: 4px solid #f59e0b;
}

.finding-item.risk-low {
    border-left: 4px solid #10b981;
}

.risk-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    text-transform: uppercase;
}`;
  }

  private getAnalysisReportCSS(): string {
    return `
/* Analysis Report Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333;
    background: #fff;
}

.report-header {
    background: linear-gradient(135deg, #581c87 0%, #8b5cf6 100%);
    color: white;
    padding: 2rem;
    border-bottom: 4px solid #6d28d9;
}

.analysis-section {
    margin-bottom: 2rem;
    padding: 1.5rem;
    background: #fafafa;
    border-radius: 8px;
    border: 1px solid #e5e7eb;
}

.charts-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
}

.chart-placeholder {
    height: 200px;
    background: #f3f4f6;
    border: 2px dashed #d1d5db;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    color: #6b7280;
    font-weight: 500;
}

.insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 1.5rem;
}

.insight-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 1.5rem;
    border-left: 4px solid #8b5cf6;
}

.confidence-score {
    display: inline-block;
    background: #ede9fe;
    color: #7c3aed;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 600;
    margin-top: 0.5rem;
}`;
  }

  // Template management methods
  public async createOrUpdateTemplate(template: Partial<ReportTemplate>): Promise<string> {
    await this.ensureConnection();

    try {
      const client = await this.pool.connect();
      
      // Check if template exists
      const existingTemplate = await client.query(
        'SELECT id FROM report_templates WHERE name = $1',
        [template.name]
      );

      let templateId: string;

      if (existingTemplate.rows.length > 0) {
        // Update existing template
        templateId = existingTemplate.rows[0].id;
        await client.query(
          `UPDATE report_templates 
           SET html_template = $1, css_styles = $2, template_variables = $3, 
               metadata = $4, updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            template.htmlTemplate,
            template.cssStyles,
            JSON.stringify(template.templateVariables),
            JSON.stringify(template.metadata),
            templateId,
          ]
        );
      } else {
        // Create new template
        const result = await client.query(
          `INSERT INTO report_templates 
           (name, category, description, html_template, css_styles, template_variables, metadata, author)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [
            template.name,
            template.category,
            template.description || '',
            template.htmlTemplate,
            template.cssStyles,
            JSON.stringify(template.templateVariables),
            JSON.stringify(template.metadata),
            template.metadata?.author || 'system',
          ]
        );
        templateId = result.rows[0].id;
      }

      client.release();
      console.log(`Template ${template.name} created/updated with ID: ${templateId}`);
      return templateId;
    } catch (error) {
      console.error('Error creating/updating template:', error);
      throw error;
    }
  }

  public async generateReport(templateId: string, data: ReportData, generatedBy: string): Promise<GeneratedReport> {
    await this.ensureConnection();

    try {
      const client = await this.pool.connect();
      
      // Get template
      const templateResult = await client.query(
        'SELECT * FROM report_templates WHERE id = $1 AND is_active = true',
        [templateId]
      );

      if (templateResult.rows.length === 0) {
        throw new Error(`Template ${templateId} not found or inactive`);
      }

      const template = templateResult.rows[0];
      
      // Generate HTML content using simple template substitution
      let htmlContent = template.html_template;
      
      // Replace CSS styles
      htmlContent = htmlContent.replace(/\{\{cssStyles\}\}/g, template.css_styles);
      
      // Replace basic variables
      htmlContent = htmlContent.replace(/\{\{title\}\}/g, data.title || 'Untitled Report');
      htmlContent = htmlContent.replace(/\{\{generationDate\}\}/g, data.generationDate.toLocaleDateString());
      htmlContent = htmlContent.replace(/\{\{version\}\}/g, data.version || '1.0');
      htmlContent = htmlContent.replace(/\{\{organizationName\}\}/g, data.organizationName || '');
      htmlContent = htmlContent.replace(/\{\{organizationLogo\}\}/g, data.organizationLogo || '');
      htmlContent = htmlContent.replace(/\{\{executiveSummary\}\}/g, data.executiveSummary || '');

      // Calculate metadata
      const wordCount = (htmlContent.match(/\b\w+\b/g) || []).length;
      const estimatedReadTime = Math.ceil(wordCount / 200); // Assuming 200 words per minute

      // Store generated report
      const reportResult = await client.query(
        `INSERT INTO generated_reports 
         (template_id, title, html_content, generated_by, metadata, tags)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          templateId,
          data.title,
          htmlContent,
          generatedBy,
          JSON.stringify({ wordCount, estimatedReadTime }),
          [], // Empty tags array
        ]
      );

      const reportId = reportResult.rows[0].id;
      client.release();

      const generatedReport: GeneratedReport = {
        id: reportId,
        templateId,
        title: data.title,
        htmlContent,
        status: 'draft',
        generatedBy,
        generatedAt: new Date(),
        metadata: {
          wordCount,
          estimatedReadTime,
        },
        sharePermissions: {},
        tags: [],
      };

      console.log(`Report generated with ID: ${reportId}`);
      return generatedReport;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  public async getTemplates(category?: string): Promise<ReportTemplate[]> {
    await this.ensureConnection();

    // If database is not connected, return empty array instead of mock data
    if (!this.isConnected) {
      console.log('Database not connected, returning empty templates array');
      return [];
    }

    try {
      const client = await this.pool.connect();
      
      let query = 'SELECT * FROM report_templates WHERE is_active = true';
      const params: any[] = [];
      
      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }
      
      query += ' ORDER BY name';
      
      const result = await client.query(query, params);
      client.release();

      return result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        description: row.description,
        htmlTemplate: row.html_template,
        cssStyles: row.css_styles,
        templateVariables: row.template_variables,
        metadata: row.metadata,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (error) {
      console.error('Error getting templates, returning empty array:', error);
      return [];
    }
  }

  public async getGeneratedReports(status?: string): Promise<GeneratedReport[]> {
    await this.ensureConnection();

    // If database is not connected, return empty array instead of mock data
    if (!this.isConnected) {
      console.log('Database not connected, returning empty reports array');
      return [];
    }

    try {
      const client = await this.pool.connect();
      
      let query = 'SELECT * FROM generated_reports';
      const params: any[] = [];
      
      if (status) {
        query += ' WHERE status = $1';
        params.push(status);
      }
      
      query += ' ORDER BY generated_at DESC';
      
      const result = await client.query(query, params);
      client.release();

      return result.rows.map(row => ({
        id: row.id,
        templateId: row.template_id,
        title: row.title,
        htmlContent: row.html_content,
        pdfPath: row.pdf_path,
        status: row.status,
        generatedBy: row.generated_by,
        generatedAt: row.generated_at,
        reviewedBy: row.reviewed_by,
        reviewedAt: row.reviewed_at,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        metadata: row.metadata,
        sharePermissions: row.share_permissions,
        tags: row.tags,
      }));
    } catch (error) {
      console.error('Error getting generated reports, returning empty array:', error);
      return [];
    }
  }

  public async closeConnection(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.isConnected = false;
      console.log('Report Template Manager database connection closed');
    }
  }
} 