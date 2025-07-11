import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'future_thought_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '',
});

export async function GET() {
  try {
    const result = await pool.query(`
      SELECT 
        id,
        agent_id,
        team_id,
        task,
        finding,
        impact,
        category,
        recommendations,
        status,
        created_at,
        updated_at
      FROM agent_findings 
      ORDER BY created_at DESC
    `);

    const findings = result.rows.map(row => ({
      id: row.id,
      agentId: row.agent_id,
      teamId: row.team_id,
      task: row.task,
      finding: row.finding,
      impact: row.impact,
      category: row.category,
      recommendations: row.recommendations || [],
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    }));

    return NextResponse.json({
      success: true,
      findings
    });
  } catch (error) {
    console.error('Error fetching agent findings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent findings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const findingData = await request.json();
    
    const {
      id,
      agent_id,
      team_id,
      task,
      finding,
      impact,
      category,
      recommendations,
      status
    } = findingData;

    // Validate required fields
    if (!id || !agent_id || !team_id || !task || !finding) {
      console.error('❌ Missing required fields:', { id, agent_id, team_id, task, finding });
      return NextResponse.json(
        { error: 'Missing required fields: id, agent_id, team_id, task, finding' },
        { status: 400 }
      );
    }

    // Insert agent finding into database
    const result = await pool.query(`
      INSERT INTO agent_findings (
        id,
        agent_id,
        team_id,
        task,
        finding,
        impact,
        category,
        recommendations,
        status,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      ON CONFLICT (id) 
      DO UPDATE SET
        agent_id = EXCLUDED.agent_id,
        team_id = EXCLUDED.team_id,
        task = EXCLUDED.task,
        finding = EXCLUDED.finding,
        impact = EXCLUDED.impact,
        category = EXCLUDED.category,
        recommendations = EXCLUDED.recommendations,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *
    `, [
      id,
      agent_id,
      team_id,
      task,
      finding,
      impact || 'medium',
      category || 'data-quality',
      JSON.stringify(recommendations || []),
      status || 'active'
    ]);

    console.log(`✅ Agent finding saved to database: ${finding.substring(0, 50)}... (${id})`);

    return NextResponse.json({
      success: true,
      finding: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving agent finding:', error);
    return NextResponse.json(
      { error: 'Failed to save agent finding' },
      { status: 500 }
    );
  }
} 