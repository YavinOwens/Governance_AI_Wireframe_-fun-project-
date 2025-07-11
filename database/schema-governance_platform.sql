-- Governance Workshop Platform Database Schema (governance_platform schema)
-- PostgreSQL with pgvector extension for document embeddings

CREATE SCHEMA IF NOT EXISTS governance_platform;

-- Enable pgvector extension (must be in public, but used in this schema)
CREATE EXTENSION IF NOT EXISTS vector;

SET search_path TO governance_platform;

-- Agent Management
CREATE TABLE governance_platform.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'error', 'offline')),
    capabilities TEXT[] DEFAULT '{}',
    current_task TEXT,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performance_metrics JSONB DEFAULT '{}',
    ai_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.agent_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    coordinator_agent_id UUID REFERENCES governance_platform.agents(id),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    capabilities TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.team_members (
    team_id UUID REFERENCES governance_platform.agent_teams(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES governance_platform.agents(id) ON DELETE CASCADE,
    role VARCHAR(100) DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (team_id, agent_id)
);

-- Workshop Management
CREATE TABLE governance_platform.workshops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(100) NOT NULL,
    duration_minutes INTEGER NOT NULL,
    participants_count INTEGER DEFAULT 0,
    objectives TEXT[] DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    ai_generated_plan TEXT,
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE governance_platform.workshop_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID REFERENCES governance_platform.workshops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    step_type VARCHAR(50) CHECK (step_type IN ('introduction', 'main', 'break', 'conclusion')),
    duration_minutes INTEGER NOT NULL,
    order_index INTEGER NOT NULL,
    materials TEXT[] DEFAULT '{}',
    agent_tasks TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.workshop_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workshop_id UUID REFERENCES governance_platform.workshops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(100),
    stakeholder_type VARCHAR(100),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Document Management
CREATE TABLE governance_platform.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    document_type VARCHAR(50) CHECK (document_type IN ('presentation', 'document', 'spreadsheet', 'pdf', 'image', 'video')),
    source VARCHAR(50) DEFAULT 'upload' CHECK (source IN ('upload', 'sharepoint', 'cloud', 'local')),
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    content_text TEXT,
    ai_analysis TEXT,
    analysis_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.document_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES governance_platform.documents(id) ON DELETE CASCADE,
    embedding vector(1536),
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES governance_platform.documents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    changes_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Sources
CREATE TABLE governance_platform.data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sharepoint', 'onedrive', 'google_drive', 'dropbox', 'local', 'api')),
    connection_config JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
    last_sync_at TIMESTAMP,
    sync_frequency_minutes INTEGER DEFAULT 60,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.data_source_documents (
    data_source_id UUID REFERENCES governance_platform.data_sources(id) ON DELETE CASCADE,
    document_id UUID REFERENCES governance_platform.documents(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (data_source_id, document_id)
);

-- Agent Communication & Messages
CREATE TABLE governance_platform.agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_agent_id UUID REFERENCES governance_platform.agents(id),
    to_agent_id UUID REFERENCES governance_platform.agents(id),
    message_type VARCHAR(50) NOT NULL CHECK (message_type IN ('task', 'response', 'notification', 'error')),
    payload JSONB NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    correlation_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP
);

CREATE TABLE governance_platform.team_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES governance_platform.agent_teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    assigned_agents UUID[] DEFAULT '{}',
    parameters JSONB DEFAULT '{}',
    ai_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

-- Human Interventions
CREATE TABLE governance_platform.human_interventions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intervention_type VARCHAR(100) NOT NULL CHECK (intervention_type IN ('decision_gate', 'quality_review', 'exception_handling', 'configuration_oversight')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'resolved', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    requested_by_agent_id UUID REFERENCES governance_platform.agents(id),
    assigned_to VARCHAR(255),
    context_data JSONB DEFAULT '{}',
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP
);

-- AI Operations & Analytics
CREATE TABLE governance_platform.ai_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type VARCHAR(100) NOT NULL CHECK (operation_type IN ('workshop_planning', 'document_analysis', 'recommendation_generation', 'embedding_generation')),
    target_entity_type VARCHAR(50),
    target_entity_id UUID,
    input_data JSONB,
    output_data JSONB,
    ai_model VARCHAR(100),
    tokens_used INTEGER,
    cost_estimate DECIMAL(10,4),
    processing_time_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE governance_platform.analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,4),
    metric_unit VARCHAR(50),
    entity_type VARCHAR(50),
    entity_id UUID,
    time_period VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workflows
CREATE TABLE governance_platform.workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    workflow_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
    definition JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE governance_platform.workflow_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID REFERENCES governance_platform.workflows(id) ON DELETE CASCADE,
    execution_status VARCHAR(50) DEFAULT 'running' CHECK (execution_status IN ('running', 'completed', 'failed', 'cancelled')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Enhanced Agent Team Permissions
CREATE TABLE governance_platform.agent_team_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES governance_platform.agent_teams(id) ON DELETE CASCADE,
    permission_type VARCHAR(100) NOT NULL CHECK (permission_type IN ('database_read', 'database_write', 'database_admin', 'schema_modify', 'report_generate', 'report_approve')),
    resource_scope VARCHAR(255) NOT NULL, -- table name, '*' for all, or specific resource
    restrictions JSONB DEFAULT '{}', -- row_level_security, column_masking, time_based_access
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Data Quality Metrics
CREATE TABLE governance_platform.data_quality_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    metric_type VARCHAR(100) NOT NULL CHECK (metric_type IN ('completeness', 'uniqueness', 'validity', 'consistency', 'accuracy', 'timeliness')),
    metric_value DECIMAL(10,4) NOT NULL,
    threshold_min DECIMAL(10,4),
    threshold_max DECIMAL(10,4),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pass', 'warning', 'fail', 'unknown')),
    score DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- 0-100 quality score
    measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    measured_by UUID REFERENCES governance_platform.agents(id),
    context_data JSONB DEFAULT '{}',
    recommendations TEXT
);

-- Data Quality Rules
CREATE TABLE governance_platform.data_quality_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(255) NOT NULL,
    rule_type VARCHAR(100) NOT NULL CHECK (rule_type IN ('not_null', 'unique', 'range', 'pattern', 'reference', 'custom')),
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    rule_definition JSONB NOT NULL, -- rule parameters and conditions
    severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES governance_platform.agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Quality Violations
CREATE TABLE governance_platform.data_quality_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID REFERENCES governance_platform.data_quality_rules(id),
    table_name VARCHAR(255) NOT NULL,
    row_identifier VARCHAR(255), -- primary key or row identifier
    violation_details JSONB NOT NULL,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detected_by UUID REFERENCES governance_platform.agents(id),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'false_positive')),
    resolution_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255)
);

-- Report Templates
CREATE TABLE governance_platform.report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL CHECK (category IN ('governance', 'data-quality', 'workshop', 'analysis', 'compliance')),
    description TEXT,
    html_template TEXT NOT NULL,
    css_styles TEXT NOT NULL,
    template_variables JSONB DEFAULT '{}', -- variable definitions and types
    metadata JSONB NOT NULL DEFAULT '{}',
    version VARCHAR(50) NOT NULL DEFAULT '1.0',
    author VARCHAR(255) NOT NULL,
    accessibility_compliant BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Generated Reports
CREATE TABLE governance_platform.generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES governance_platform.report_templates(id),
    title VARCHAR(500) NOT NULL,
    html_content TEXT NOT NULL,
    pdf_path VARCHAR(500), -- path to generated PDF file
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'published', 'archived')),
    generated_by UUID REFERENCES governance_platform.agents(id),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    approved_by VARCHAR(255),
    approved_at TIMESTAMP,
    metadata JSONB NOT NULL DEFAULT '{}', -- word count, read time, etc.
    share_permissions JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}'
);

-- Anomaly Detection Results
CREATE TABLE governance_platform.anomaly_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detection_type VARCHAR(100) NOT NULL CHECK (detection_type IN ('statistical', 'pattern', 'rule_based', 'ml_model')),
    table_name VARCHAR(255) NOT NULL,
    column_name VARCHAR(255),
    anomaly_description TEXT NOT NULL,
    confidence_score DECIMAL(5,2) NOT NULL, -- 0-100 confidence level
    severity VARCHAR(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    affected_rows INTEGER DEFAULT 0,
    detection_method VARCHAR(255), -- specific algorithm or method used
    context_data JSONB DEFAULT '{}',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detected_by UUID REFERENCES governance_platform.agents(id),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'investigating', 'confirmed', 'false_positive', 'resolved')),
    investigation_notes TEXT,
    resolved_at TIMESTAMP
);

-- Data Lineage Tracking
CREATE TABLE governance_platform.data_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_table VARCHAR(255) NOT NULL,
    source_column VARCHAR(255),
    target_table VARCHAR(255) NOT NULL,
    target_column VARCHAR(255),
    transformation_type VARCHAR(100) NOT NULL CHECK (transformation_type IN ('direct_copy', 'calculation', 'aggregation', 'join', 'filter', 'custom')),
    transformation_logic TEXT,
    data_flow_direction VARCHAR(50) DEFAULT 'forward' CHECK (data_flow_direction IN ('forward', 'backward', 'bidirectional')),
    created_by UUID REFERENCES governance_platform.agents(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Report Template Versions
CREATE TABLE governance_platform.report_template_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES governance_platform.report_templates(id) ON DELETE CASCADE,
    version_number VARCHAR(50) NOT NULL,
    html_template TEXT NOT NULL,
    css_styles TEXT NOT NULL,
    change_description TEXT,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_agents_status ON governance_platform.agents(status);
CREATE INDEX idx_agents_type ON governance_platform.agents(type);
CREATE INDEX idx_agents_ai_enabled ON governance_platform.agents(ai_enabled);
CREATE INDEX idx_workshops_status ON governance_platform.workshops(status);
CREATE INDEX idx_workshops_type ON governance_platform.workshops(type);
CREATE INDEX idx_workshops_scheduled_at ON governance_platform.workshops(scheduled_at);
CREATE INDEX idx_documents_type ON governance_platform.documents(document_type);
CREATE INDEX idx_documents_source ON governance_platform.documents(source);
CREATE INDEX idx_documents_tags ON governance_platform.documents USING GIN(tags);
CREATE INDEX idx_documents_metadata ON governance_platform.documents USING GIN(metadata);
CREATE INDEX idx_document_embeddings_embedding ON governance_platform.document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_agent_messages_from ON governance_platform.agent_messages(from_agent_id);
CREATE INDEX idx_agent_messages_to ON governance_platform.agent_messages(to_agent_id);
CREATE INDEX idx_agent_messages_type ON governance_platform.agent_messages(message_type);
CREATE INDEX idx_agent_messages_created_at ON governance_platform.agent_messages(created_at);
CREATE INDEX idx_team_tasks_status ON governance_platform.team_tasks(status);
CREATE INDEX idx_team_tasks_team_id ON governance_platform.team_tasks(team_id);
CREATE INDEX idx_team_tasks_priority ON governance_platform.team_tasks(priority);
CREATE INDEX idx_ai_operations_type ON governance_platform.ai_operations(operation_type);
CREATE INDEX idx_ai_operations_success ON governance_platform.ai_operations(success);
CREATE INDEX idx_ai_operations_created_at ON governance_platform.ai_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_data_quality_metrics_table ON governance_platform.data_quality_metrics(table_name, measured_at);
CREATE INDEX IF NOT EXISTS idx_data_quality_violations_status ON governance_platform.data_quality_violations(status, detected_at);
CREATE INDEX IF NOT EXISTS idx_anomaly_detections_severity ON governance_platform.anomaly_detections(severity, detected_at);
CREATE INDEX IF NOT EXISTS idx_generated_reports_status ON governance_platform.generated_reports(status, generated_at);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_team ON governance_platform.agent_team_permissions(team_id, permission_type);

-- Triggers and Functions
CREATE OR REPLACE FUNCTION governance_platform.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON governance_platform.agents FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_agent_teams_updated_at BEFORE UPDATE ON governance_platform.agent_teams FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_workshops_updated_at BEFORE UPDATE ON governance_platform.workshops FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON governance_platform.documents FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON governance_platform.data_sources FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_team_tasks_updated_at BEFORE UPDATE ON governance_platform.team_tasks FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_human_interventions_updated_at BEFORE UPDATE ON governance_platform.human_interventions FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON governance_platform.workflows FOR EACH ROW EXECUTE FUNCTION governance_platform.update_updated_at_column();

-- Sample Data
INSERT INTO governance_platform.agents (name, type, status, capabilities, ai_enabled) VALUES
('Workshop Planner Agent', 'workshop-planner', 'idle', ARRAY['create-workshop-plan', 'facilitate-workshop', 'generate-materials', 'ai-workshop-planning'], true),
('Database Manager Agent', 'db-admin', 'busy', ARRAY['create-table', 'execute-query', 'optimize-performance', 'ai-document-analysis'], true),
('Tool Creator Agent', 'tool-creator', 'idle', ARRAY['create-tool', 'test-tool', 'deploy-tool'], false),
('Content Creator Agent', 'content-creator', 'idle', ARRAY['generate-content', 'edit-content', 'format-content'], false);

INSERT INTO governance_platform.agent_teams (name, description, status, capabilities) VALUES
('Governance Workshop Team', 'Specialized team for governance workshop facilitation and planning', 'active', ARRAY['workshop-planning', 'co-design', 'data-analysis', 'content-creation']),
('Tool Development Team', 'Team responsible for creating and maintaining governance tools', 'active', ARRAY['tool-creation', 'library-management', 'api-integration', 'testing']),
('Database Management Team', 'Team managing database operations and optimization', 'active', ARRAY['database-administration', 'schema-management', 'performance-optimization', 'backup-recovery']);

INSERT INTO governance_platform.team_members (team_id, agent_id, role) VALUES
((SELECT id FROM governance_platform.agent_teams WHERE name = 'Governance Workshop Team'), (SELECT id FROM governance_platform.agents WHERE name = 'Workshop Planner Agent'), 'coordinator'),
((SELECT id FROM governance_platform.agent_teams WHERE name = 'Database Management Team'), (SELECT id FROM governance_platform.agents WHERE name = 'Database Manager Agent'), 'coordinator'),
((SELECT id FROM governance_platform.agent_teams WHERE name = 'Tool Development Team'), (SELECT id FROM governance_platform.agents WHERE name = 'Tool Creator Agent'), 'coordinator');

UPDATE governance_platform.agent_teams SET coordinator_agent_id = (SELECT id FROM governance_platform.agents WHERE name = 'Workshop Planner Agent') WHERE name = 'Governance Workshop Team';
UPDATE governance_platform.agent_teams SET coordinator_agent_id = (SELECT id FROM governance_platform.agents WHERE name = 'Database Manager Agent') WHERE name = 'Database Management Team';
UPDATE governance_platform.agent_teams SET coordinator_agent_id = (SELECT id FROM governance_platform.agents WHERE name = 'Tool Creator Agent') WHERE name = 'Tool Development Team'; 

-- Insert default data quality team permissions
INSERT INTO governance_platform.agent_team_permissions (team_id, permission_type, resource_scope, restrictions, granted_by)
SELECT 
    at.id,
    'database_read',
    '*',
    '{"row_level_security": true, "column_masking": ["sensitive_data", "personal_info"], "time_based_access": true}'::jsonb,
    'system'
FROM governance_platform.agent_teams at 
WHERE at.name = 'Database Management Team'; 