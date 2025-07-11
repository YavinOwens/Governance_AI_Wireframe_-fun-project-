import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'future_thought_db',
  user: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || '',
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { finding_ids } = await request.json();
    const workshopId = (await params).id;

    if (!finding_ids || !Array.isArray(finding_ids)) {
      return NextResponse.json(
        { error: 'finding_ids must be an array' },
        { status: 400 }
      );
    }

    // Insert workshop-finding relationships
    const insertPromises = finding_ids.map(findingId =>
      pool.query(`
        INSERT INTO workshop_findings (workshop_id, finding_id)
        VALUES ($1, $2)
        ON CONFLICT (workshop_id, finding_id) DO NOTHING
      `, [workshopId, findingId])
    );

    await Promise.all(insertPromises);

    console.log(`✅ Linked ${finding_ids.length} findings to workshop ${workshopId}`);

    return NextResponse.json({
      success: true,
      message: `Linked ${finding_ids.length} findings to workshop`
    });
  } catch (error) {
    console.error('Error linking findings to workshop:', error);
    return NextResponse.json(
      { error: 'Failed to link findings to workshop' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const workshopId = (await params).id;

    // Get all findings linked to this workshop
    const result = await pool.query(`
      SELECT 
        af.id,
        af.agent_id,
        af.team_id,
        af.task,
        af.finding,
        af.impact,
        af.category,
        af.recommendations,
        af.status,
        af.created_at,
        af.updated_at
      FROM agent_findings af
      JOIN workshop_findings wf ON af.id = wf.finding_id
      WHERE wf.workshop_id = $1
      ORDER BY af.created_at DESC
    `, [workshopId]);

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
    console.error('Error fetching workshop findings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshop findings' },
      { status: 500 }
    );
  }
} 