#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'future_thought_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
});

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Initializing Governance Platform Database...');
    console.log(`📍 Using existing database: ${process.env.DB_NAME || 'future_thought_db'}`);
    
    // Check current tables
    const existingTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('📋 Existing tables in database:');
    existingTables.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Check if our new governance tables exist
    const governanceTables = ['users', 'agent_teams', 'workshop_sessions', 'data_sources', 'reports'];
    const existingGovernanceTables = existingTables.rows
      .map(row => row.table_name)
      .filter(name => governanceTables.includes(name));
    
    if (existingGovernanceTables.length > 0) {
      console.log('✅ Some governance platform tables already exist. Skipping schema creation.');
      await addSampleDataIfNeeded(client);
      return;
    }
    
    // Add only the new governance platform tables
    console.log('📋 Adding governance platform tables to existing database...');
    await createGovernanceTables(client);
    
    // Insert sample data
    console.log('📝 Inserting sample data...');
    await insertSampleData(client);
    
    console.log('🎉 Database initialization completed successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function createGovernanceTables(client) {
  // Create only the governance platform specific tables
  const governanceSchema = `
    -- Enable UUID extension if not exists
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Users and Authentication (NEW)
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        organization VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        email_verified BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
    );

    -- Agent Teams (NEW - different from existing agents table)
    CREATE TABLE IF NOT EXISTS agent_teams (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        capabilities JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'active',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add governance fields to existing agents table
    DO $$ 
    BEGIN
        -- Add team_id column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'team_id') THEN
            ALTER TABLE agents ADD COLUMN team_id UUID REFERENCES agent_teams(id);
        END IF;
        
        -- Add ai_provider column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'ai_provider') THEN
            ALTER TABLE agents ADD COLUMN ai_provider VARCHAR(50) DEFAULT 'openai';
        END IF;
        
        -- Add model_name column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'model_name') THEN
            ALTER TABLE agents ADD COLUMN model_name VARCHAR(100) DEFAULT 'gpt-4';
        END IF;
        
        -- Add system_prompt column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'system_prompt') THEN
            ALTER TABLE agents ADD COLUMN system_prompt TEXT;
        END IF;
    END $$;

    -- Agent Performance Metrics (NEW)
    CREATE TABLE IF NOT EXISTS agent_performance (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
        tasks_completed INTEGER DEFAULT 0,
        average_response_time INTEGER DEFAULT 0,
        error_rate DECIMAL(5,4) DEFAULT 0.0000,
        total_messages INTEGER DEFAULT 0,
        success_rate DECIMAL(5,4) DEFAULT 1.0000,
        date DATE DEFAULT CURRENT_DATE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agent_id, date)
    );

    -- Workshop Sessions (NEW)
    CREATE TABLE IF NOT EXISTS workshop_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'planned',
        facilitator_id UUID REFERENCES users(id),
        planned_start TIMESTAMP WITH TIME ZONE,
        planned_end TIMESTAMP WITH TIME ZONE,
        actual_start TIMESTAMP WITH TIME ZONE,
        actual_end TIMESTAMP WITH TIME ZONE,
        participants JSONB DEFAULT '[]',
        agenda JSONB DEFAULT '[]',
        outcomes JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Data Sources (NEW)
    CREATE TABLE IF NOT EXISTS data_sources (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        connection_string TEXT,
        configuration JSONB DEFAULT '{}',
        status VARCHAR(50) DEFAULT 'active',
        last_sync TIMESTAMP WITH TIME ZONE,
        sync_frequency VARCHAR(50),
        quality_score DECIMAL(3,2),
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Data Quality Assessments (NEW)
    CREATE TABLE IF NOT EXISTS data_quality_assessments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        data_source_id UUID REFERENCES data_sources(id),
        agent_id UUID REFERENCES agents(id),
        assessment_type VARCHAR(100) NOT NULL,
        metrics JSONB NOT NULL DEFAULT '{}',
        score DECIMAL(5,2) NOT NULL,
        issues JSONB DEFAULT '[]',
        recommendations JSONB DEFAULT '[]',
        status VARCHAR(50) DEFAULT 'completed',
        assessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Reports (NEW)
    CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        title VARCHAR(255) NOT NULL,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'draft',
        format VARCHAR(20) DEFAULT 'pdf',
        template_id UUID,
        generated_by UUID REFERENCES users(id),
        content JSONB DEFAULT '{}',
        file_path VARCHAR(500),
        parameters JSONB DEFAULT '{}',
        scheduled_for TIMESTAMP WITH TIME ZONE,
        generated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Report Templates (NEW)
    CREATE TABLE IF NOT EXISTS report_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(100) NOT NULL,
        template_content TEXT NOT NULL,
        css_styles TEXT,
        parameters JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- System Configuration (NEW)
    CREATE TABLE IF NOT EXISTS system_config (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        description TEXT,
        updated_by UUID REFERENCES users(id),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_id ON agent_performance(agent_id);
    CREATE INDEX IF NOT EXISTS idx_workshop_sessions_status ON workshop_sessions(status);
    CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
    CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

    -- Create update triggers
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

    DROP TRIGGER IF EXISTS update_agent_teams_updated_at ON agent_teams;
    CREATE TRIGGER update_agent_teams_updated_at BEFORE UPDATE ON agent_teams
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  `;

  await client.query(governanceSchema);
  console.log('✅ Governance platform tables created successfully');
}

async function addSampleDataIfNeeded(client) {
  // Check if sample data exists
  try {
    const userCheck = await client.query("SELECT COUNT(*) FROM users WHERE email = 'admin@governance-platform.com'");
    if (userCheck.rows[0].count === '0') {
      console.log('📝 Adding sample data to existing tables...');
      await insertSampleData(client);
    } else {
      console.log('✅ Sample data already exists. Database initialization complete!');
    }
  } catch (error) {
    console.log('📝 Users table may not exist yet, inserting sample data...');
    await insertSampleData(client);
  }
}

async function insertSampleData(client) {
  // Create default admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 12);
  await client.query(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization, is_active, email_verified)
    VALUES (
      uuid_generate_v4(),
      'admin@governance-platform.com',
      $1,
      'Platform',
      'Administrator',
      'admin',
      'Governance Platform Inc.',
      true,
      true
    ) ON CONFLICT (email) DO NOTHING;
  `, [adminPasswordHash]);
  
  // Create sample regular user
  const userPasswordHash = await bcrypt.hash('user123', 12);
  await client.query(`
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, organization, is_active, email_verified)
    VALUES (
      uuid_generate_v4(),
      'user@governance-platform.com',
      $1,
      'John',
      'Doe',
      'user',
      'Sample Corporation',
      true,
      true
    ) ON CONFLICT (email) DO NOTHING;
  `, [userPasswordHash]);
  
  // Get admin user ID for references
  const adminResult = await client.query('SELECT id FROM users WHERE email = $1', ['admin@governance-platform.com']);
  const adminId = adminResult.rows[0].id;
  
  // Create agent teams (check if they exist first)
  const existingTeams = await client.query('SELECT name FROM agent_teams WHERE name IN ($1, $2, $3)', 
    ['Governance Workshop Team', 'Data Quality Analytics Team', 'Database Management Team']);
  
  const existingTeamNames = existingTeams.rows.map(row => row.name);
  
  if (!existingTeamNames.includes('Governance Workshop Team')) {
    await client.query(`
      INSERT INTO agent_teams (name, description, capabilities, status, created_by) VALUES
      ('Governance Workshop Team', 'Specialized team for governance workshop facilitation and planning', '["workshop-planning", "facilitation", "content-creation"]', 'active', $1);
    `, [adminId]);
  }
  
  if (!existingTeamNames.includes('Data Quality Analytics Team')) {
    await client.query(`
      INSERT INTO agent_teams (name, description, capabilities, status, created_by) VALUES
      ('Data Quality Analytics Team', 'Team focused on data quality assessment and improvement', '["data-assessment", "quality-analysis", "anomaly-detection"]', 'active', $1);
    `, [adminId]);
  }
  
  if (!existingTeamNames.includes('Database Management Team')) {
    await client.query(`
      INSERT INTO agent_teams (name, description, capabilities, status, created_by) VALUES
      ('Database Management Team', 'Team managing database operations and optimization', '["database-admin", "performance-optimization", "backup-recovery"]', 'active', $1);
    `, [adminId]);
  }
  
  // Update existing agents with governance fields (if they exist)
  await client.query(`
    UPDATE agents 
    SET ai_provider = 'openai', 
        model_name = 'gpt-4',
        system_prompt = 'You are a helpful AI assistant specializing in governance and data management.'
    WHERE ai_provider IS NULL;
  `);
  
  // Create sample data sources (check if they exist first)
  const existingDataSources = await client.query('SELECT name FROM data_sources WHERE name IN ($1, $2, $3)', 
    ['Customer Database', 'Sales API', 'Financial Reports']);
  
  const existingDataSourceNames = existingDataSources.rows.map(row => row.name);
  
  if (!existingDataSourceNames.includes('Customer Database')) {
    await client.query(`
      INSERT INTO data_sources (name, type, connection_string, configuration, status, quality_score, created_by) VALUES
      ('Customer Database', 'database', 'postgresql://localhost:5432/customers', '{"schema": "public", "tables": ["customers", "orders"]}', 'active', 8.5, $1);
    `, [adminId]);
  }
  
  if (!existingDataSourceNames.includes('Sales API')) {
    await client.query(`
      INSERT INTO data_sources (name, type, connection_string, configuration, status, quality_score, created_by) VALUES
      ('Sales API', 'api', 'https://api.sales.company.com/v1', '{"auth_type": "bearer", "rate_limit": 1000}', 'active', 9.2, $1);
    `, [adminId]);
  }
  
  if (!existingDataSourceNames.includes('Financial Reports')) {
    await client.query(`
      INSERT INTO data_sources (name, type, connection_string, configuration, status, quality_score, created_by) VALUES
      ('Financial Reports', 'file', '/data/finance/', '{"format": "csv", "frequency": "daily"}', 'active', 7.8, $1);
    `, [adminId]);
  }
  
  // Create sample report templates (check if they exist first)
  const existingTemplates = await client.query('SELECT name FROM report_templates WHERE name IN ($1, $2)', 
    ['Data Quality Assessment Report', 'Workshop Summary Report']);
  
  const existingTemplateNames = existingTemplates.rows.map(row => row.name);
  
  if (!existingTemplateNames.includes('Data Quality Assessment Report')) {
    await client.query(`
      INSERT INTO report_templates (name, description, type, template_content, css_styles, parameters, created_by) VALUES
      (
        'Data Quality Assessment Report',
        'Comprehensive data quality analysis report template',
        'data-quality',
        '<html><head><title>{{title}}</title></head><body><h1>Data Quality Assessment</h1><p>Generated on: {{date}}</p><div class="metrics">{{metrics}}</div></body></html>',
        'body { font-family: Arial, sans-serif; } .metrics { border: 1px solid #ccc; padding: 20px; }',
        '{"title": "string", "date": "date", "metrics": "object"}',
        $1
      );
    `, [adminId]);
  }
  
  if (!existingTemplateNames.includes('Workshop Summary Report')) {
    await client.query(`
      INSERT INTO report_templates (name, description, type, template_content, css_styles, parameters, created_by) VALUES
      (
        'Workshop Summary Report',
        'Workshop session summary and outcomes report',
        'workshop-summary',
        '<html><head><title>{{title}}</title></head><body><h1>Workshop Summary</h1><h2>{{workshop_title}}</h2><div class="participants">{{participants}}</div><div class="outcomes">{{outcomes}}</div></body></html>',
        'body { font-family: Arial, sans-serif; } h1, h2 { color: #333; }',
        '{"title": "string", "workshop_title": "string", "participants": "array", "outcomes": "object"}',
        $1
      );
    `, [adminId]);
  }
  
  // Create system configuration (using INSERT ... ON CONFLICT for the primary key)
  await client.query(`
    INSERT INTO system_config (key, value, description, updated_by) VALUES
    ('ai_settings', '{"default_provider": "openai", "max_tokens": 4000, "temperature": 0.7}', 'AI service configuration', $1)
    ON CONFLICT (key) DO UPDATE SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP;
  `, [adminId]);
  
  await client.query(`
    INSERT INTO system_config (key, value, description, updated_by) VALUES
    ('data_quality_thresholds', '{"critical": 9.0, "warning": 7.0, "acceptable": 5.0}', 'Data quality score thresholds', $1)
    ON CONFLICT (key) DO UPDATE SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP;
  `, [adminId]);
  
  await client.query(`
    INSERT INTO system_config (key, value, description, updated_by) VALUES
    ('report_settings', '{"max_file_size": 52428800, "default_format": "pdf", "retention_days": 365}', 'Report generation settings', $1)
    ON CONFLICT (key) DO UPDATE SET 
      value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_by = EXCLUDED.updated_by,
      updated_at = CURRENT_TIMESTAMP;
  `, [adminId]);
  
  console.log('✅ Sample data inserted successfully');
  console.log('🔐 Default admin credentials: admin@governance-platform.com / admin123');
  console.log('👤 Default user credentials: user@governance-platform.com / user123');
}

// Run initialization
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeDatabase }; 