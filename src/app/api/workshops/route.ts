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
        name,
        description,
        duration,
        participants,
        objectives,
        steps,
        status,
        workshop_type,
        source_data,
        ai_generated_plan,
        created_at,
        updated_at
      FROM workshops 
      ORDER BY created_at DESC
    `);

    const workshops = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      duration: row.duration,
      participants: row.participants,
      objectives: row.objectives || [],
      steps: row.steps || [],
      status: row.status,
      workshopType: row.workshop_type,
      sourceData: row.source_data,
      aiGeneratedPlan: row.ai_generated_plan,
      createdAt: new Date(row.created_at),
      updatedAt: row.updated_at ? new Date(row.updated_at) : null
    }));

    return NextResponse.json({
      success: true,
      workshops
    });
  } catch (error) {
    console.error('Error fetching workshops:', error);
    return NextResponse.json(
      { error: 'Failed to fetch workshops' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const workshopData = await request.json();
    
    const {
      id,
      name,
      description,
      duration,
      participants,
      objectives,
      steps,
      status,
      workshop_type,
      source_data,
      ai_generated_plan
    } = workshopData;

    // Insert workshop into database
    const result = await pool.query(`
      INSERT INTO workshops (
        id,
        name,
        description,
        duration,
        participants,
        objectives,
        steps,
        status,
        workshop_type,
        source_data,
        ai_generated_plan,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      ON CONFLICT (id) 
      DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        duration = EXCLUDED.duration,
        participants = EXCLUDED.participants,
        objectives = EXCLUDED.objectives,
        steps = EXCLUDED.steps,
        status = EXCLUDED.status,
        workshop_type = EXCLUDED.workshop_type,
        source_data = EXCLUDED.source_data,
        ai_generated_plan = EXCLUDED.ai_generated_plan,
        updated_at = NOW()
      RETURNING *
    `, [
      id,
      name,
      description,
      duration,
      participants,
      JSON.stringify(objectives || []),
      JSON.stringify(steps || []),
      status || 'draft',
      workshop_type || 'standard',
      JSON.stringify(source_data || {}),
      ai_generated_plan
    ]);

    console.log(`✅ Workshop saved to database: ${name} (${id})`);

    return NextResponse.json({
      success: true,
      workshop: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving workshop:', error);
    return NextResponse.json(
      { error: 'Failed to save workshop' },
      { status: 500 }
    );
  }
} 