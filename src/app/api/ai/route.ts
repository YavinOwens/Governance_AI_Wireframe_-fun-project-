import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️ OPENAI_API_KEY not found in environment variables. AI features will be disabled.');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, data } = body;

    let result;

    switch (operation) {
      case 'generate-workshop-plan':
        result = await generateWorkshopPlan(data);
        break;
      case 'generate-oversight-workshop-plan':
        result = await generateOversightWorkshopPlan(data);
        break;
      case 'analyze-document':
        result = await analyzeDocument(data);
        break;
      case 'generate-recommendations':
        result = await generateRecommendations(data);
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function generateWorkshopPlan(workshopData: any) {
  const prompt = `Create a comprehensive governance workshop plan based on the following requirements:
    
    Workshop Type: ${workshopData.type}
    Duration: ${workshopData.duration}
    Participants: ${workshopData.participants}
    Objectives: ${workshopData.objectives}
    Stakeholders: ${workshopData.stakeholders}
    
    Please provide:
    1. Workshop agenda with time allocations
    2. Key discussion points and activities
    3. Required materials and resources
    4. Expected outcomes and deliverables
    5. Follow-up actions and next steps
    
    Format the response as a structured workshop plan.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an expert governance workshop facilitator with deep knowledge of organizational governance, stakeholder engagement, and participatory design methodologies."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  return {
    success: true,
    plan: completion.choices[0].message.content,
    metadata: {
      model: completion.model,
      usage: completion.usage,
      created: completion.created
    }
  };
}

async function analyzeDocument(documentData: any) {
  const prompt = `Analyze the following document for ${documentData.analysisType}:
    
    Document Content:
    ${documentData.content.substring(0, 4000)}
    
    Please provide:
    1. Key insights and findings
    2. Identified risks and opportunities
    3. Recommendations for improvement
    4. Compliance considerations
    5. Action items and next steps
    
    Format the response as a structured analysis report.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an expert governance analyst specializing in document review, compliance assessment, and strategic analysis."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.5,
    max_tokens: 1500
  });

  return {
    success: true,
    analysis: completion.choices[0].message.content,
    metadata: {
      model: completion.model,
      usage: completion.usage,
      analysisType: documentData.analysisType
    }
  };
}

async function generateRecommendations(recommendationData: any) {
  const prompt = `Based on the following context, generate ${recommendationData.recommendationType} recommendations:
    
    Context: ${recommendationData.context}
    
    Please provide:
    1. Strategic recommendations
    2. Implementation steps
    3. Risk mitigation strategies
    4. Success metrics
    5. Timeline considerations
    
    Format the response as actionable recommendations.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are a strategic governance advisor with expertise in organizational development, risk management, and strategic planning."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.6,
    max_tokens: 1800
  });

  return {
    success: true,
    recommendations: completion.choices[0].message.content,
    metadata: {
      model: completion.model,
      usage: completion.usage,
      recommendationType: recommendationData.recommendationType
    }
  };
}

async function generateOversightWorkshopPlan(workshopData: any) {
  const findings = workshopData.findings || [];
  const categories = workshopData.categories || [];
  const impactLevels = workshopData.impactLevels || [];
  const recommendations = workshopData.recommendations || [];

  const prompt = `Create a comprehensive oversight-driven governance workshop plan to address the following agent findings:

    Workshop Type: ${workshopData.type}
    Duration: ${workshopData.duration} minutes
    Participants: ${workshopData.participants}
    
    Agent Findings to Address:
    ${findings.map((finding: string, index: number) => `${index + 1}. ${finding}`).join('\n')}
    
    Categories Identified: ${categories.join(', ')}
    Impact Levels: ${impactLevels.join(', ')}
    
    Key Recommendations:
    ${recommendations.map((rec: string, index: number) => `${index + 1}. ${rec}`).join('\n')}
    
    Please provide a structured workshop plan that includes:
    1. Opening session to review agent findings and set context
    2. Deep-dive analysis sessions for each critical finding
    3. Category-specific breakout sessions for: ${categories.join(', ')}
    4. Priority ranking and impact assessment activities
    5. Action planning and responsibility assignment
    6. Implementation roadmap development
    7. Follow-up and monitoring framework
    
    For each session, include:
    - Time allocation
    - Specific activities and discussion points
    - Required materials and tools
    - Expected outcomes
    - Agent-supported tasks
    
    Format the response as a detailed, actionable workshop agenda.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: "You are an expert governance workshop facilitator specializing in oversight-driven workshops that address agent findings and data quality issues. You excel at creating structured, participatory sessions that turn technical findings into actionable governance improvements."
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: 2500
  });

  return {
    success: true,
    plan: completion.choices[0].message.content,
    metadata: {
      model: completion.model,
      usage: completion.usage,
      created: completion.created,
      workshopType: 'oversight-driven',
      findingsCount: findings.length,
      categoriesCount: categories.length
    }
  };
}