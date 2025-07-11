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
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM interventions 
        ORDER BY created_at DESC
      `);
      
      client.release();
      
      return NextResponse.json({
        success: true,
        interventions: result.rows
      });
    } catch (error) {
      client.release();
      throw error;
    }
  } catch (error) {
    console.error('Error loading interventions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load interventions',
      interventions: []
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      workflow_id,
      step_id,
      type,
      message,
      options,
      status = 'pending'
    } = body;

    if (!id || !workflow_id || !step_id || !type || !message) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        INSERT INTO interventions (
          id, workflow_id, step_id, type, message, options, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
        RETURNING *
      `, [id, workflow_id, step_id, type, message, JSON.stringify(options), status]);
      
      client.release();
      
      return NextResponse.json({
        success: true,
        intervention: result.rows[0]
      });
    } catch (error) {
      client.release();
      throw error;
    }
  } catch (error) {
    console.error('Error creating intervention:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create intervention'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, resolved_by } = body;

    if (!id || !status) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        UPDATE interventions 
        SET status = $1, resolved_by = $2, resolved_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `, [status, resolved_by, id]);
      
      client.release();
      
      return NextResponse.json({
        success: true,
        intervention: result.rows[0]
      });
    } catch (error) {
      client.release();
      throw error;
    }
  } catch (error) {
    console.error('Error updating intervention:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update intervention'
    }, { status: 500 });
  }
} 