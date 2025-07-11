import { BaseAgent } from './BaseAgent';
import { AgentMessage, AgentCapability } from './types';
import dbManager from '../database/connection';

export class WorkshopPlannerAgent extends BaseAgent {
  constructor() {
    super(
      'workshop-planner',
      'Workshop Planner Agent',
      'workshop-planner',
      `You are an expert workshop facilitator and governance consultant with deep expertise in organizational change, stakeholder engagement, and collaborative design processes.

Your role is to:
- Design comprehensive workshop agendas tailored to specific governance challenges
- Create engaging activities that promote stakeholder participation and consensus-building
- Generate workshop materials including templates, exercises, and facilitation guides
- Provide real-time facilitation support and adaptive agenda management
- Synthesize workshop outcomes into actionable governance frameworks

When planning workshops, consider:
- Stakeholder diversity and engagement strategies
- Time constraints and attention spans
- Desired outcomes and success metrics
- Cultural and organizational context
- Follow-up and implementation planning

Always provide detailed, practical, and immediately actionable recommendations.`,
      {
        provider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 4000
      }
    );
  }

  initializeCapabilities(): void {
    const capabilities: AgentCapability[] = [
      {
        name: 'create-workshop-plan',
        description: 'Create comprehensive workshop plans with agendas, activities, and materials',
        inputSchema: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            duration: { type: 'number' },
            participants: { type: 'array' },
            objectives: { type: 'array' }
          }
        }
      },
      {
        name: 'generate-workshop-materials',
        description: 'Generate workshop templates, exercises, and facilitation guides',
        inputSchema: {
          type: 'object',
          properties: {
            workshopType: { type: 'string' },
            activities: { type: 'array' },
            format: { type: 'string' }
          }
        }
      },
      {
        name: 'facilitate-session',
        description: 'Provide real-time facilitation support and guidance',
        inputSchema: {
          type: 'object',
          properties: {
            currentActivity: { type: 'string' },
            participants: { type: 'array' },
            issues: { type: 'array' }
          }
        }
      },
      {
        name: 'synthesize-outcomes',
        description: 'Analyze workshop outcomes and create implementation plans',
        inputSchema: {
          type: 'object',
          properties: {
            workshopData: { type: 'object' },
            outcomes: { type: 'array' },
            nextSteps: { type: 'boolean' }
          }
        }
      }
    ];

    capabilities.forEach(cap => this.addCapability(cap));
  }

  getCapabilities(): string[] {
    return this.capabilities.map(cap => cap.name);
  }

  async processMessage(message: AgentMessage): Promise<AgentMessage | null> {
    try {
      const { type, payload } = message;

      switch (type) {
        case 'create-workshop-plan':
          return await this.createWorkshopPlan(message);
        
        case 'generate-workshop-materials':
          return await this.generateWorkshopMaterials(message);
        
        case 'facilitate-session':
          return await this.facilitateSession(message);
        
        case 'synthesize-outcomes':
          return await this.synthesizeOutcomes(message);
        
        case 'get-workshop-templates':
          return await this.getWorkshopTemplates(message);
        
        default:
          // Use AI for general workshop-related queries
          return await this.handleGeneralQuery(message);
      }
    } catch (error) {
      this.log(`Error processing message: ${error}`, 'error');
      throw error;
    }
  }

  private async createWorkshopPlan(message: AgentMessage): Promise<AgentMessage> {
    const { topic, duration, participants, objectives, context } = message.payload;

    const planningPrompt = `Create a comprehensive workshop plan for the following requirements:

Topic: ${topic}
Duration: ${duration} hours
Number of Participants: ${participants?.length || 'Not specified'}
Participant Types: ${participants?.map((p: any) => p.role).join(', ') || 'Not specified'}
Objectives: ${objectives?.join(', ') || 'Not specified'}
Additional Context: ${context || 'None provided'}

Please provide:
1. Detailed agenda with time allocations
2. Specific activities and exercises
3. Required materials and resources
4. Facilitation techniques and approaches
5. Expected outcomes and deliverables
6. Risk mitigation strategies
7. Follow-up recommendations

Format the response as structured JSON with clear sections.`;

    const aiResponse = await this.generateAIResponse(planningPrompt, message.payload);

    // Save workshop plan to database
    const workshopData = {
      title: topic,
      description: `Workshop planned by AI agent`,
      type: 'governance',
      status: 'planned',
      facilitator_id: null, // Will be set when assigned
      planned_start: null,
      planned_end: null,
      participants: JSON.stringify(participants || []),
      agenda: aiResponse
    };

    try {
      const query = `
        INSERT INTO workshop_sessions (title, description, type, status, participants, agenda)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `;
      
      const result = await dbManager.query(query, [
        workshopData.title,
        workshopData.description,
        workshopData.type,
        workshopData.status,
        workshopData.participants,
        workshopData.agenda
      ]);

      const workshopId = result.rows[0].id;

      return {
        id: this.generateUniqueId('response'),
        from: this.id,
        to: message.from,
        type: 'workshop-plan-created',
        payload: {
          workshopId,
          plan: aiResponse,
          success: true
        },
        timestamp: new Date(),
        priority: message.priority,
        correlationId: message.correlationId
      };

    } catch (dbError) {
      this.log(`Database error saving workshop plan: ${dbError}`, 'error');
      
      return {
        id: this.generateUniqueId('response'),
        from: this.id,
        to: message.from,
        type: 'workshop-plan-created',
        payload: {
          plan: aiResponse,
          success: true,
          warning: 'Plan created but not saved to database'
        },
        timestamp: new Date(),
        priority: message.priority,
        correlationId: message.correlationId
      };
    }
  }

  private async generateWorkshopMaterials(message: AgentMessage): Promise<AgentMessage> {
    const { workshopType, activities, format, customRequirements } = message.payload;

    const materialsPrompt = `Generate comprehensive workshop materials for:

Workshop Type: ${workshopType}
Requested Activities: ${activities?.join(', ') || 'Standard governance activities'}
Format: ${format || 'Mixed (presentations, handouts, templates)'}
Custom Requirements: ${customRequirements || 'None specified'}

Please provide:
1. Facilitator guide with step-by-step instructions
2. Participant handouts and worksheets
3. Activity templates and frameworks
4. Presentation slides outline
5. Assessment and feedback forms
6. Digital tool recommendations
7. Preparation checklists

Make materials practical, engaging, and immediately usable.`;

    const aiResponse = await this.generateAIResponse(materialsPrompt, message.payload);

    return {
      id: this.generateUniqueId('response'),
      from: this.id,
      to: message.from,
      type: 'workshop-materials-generated',
      payload: {
        materials: aiResponse,
        downloadable: true,
        formats: ['pdf', 'docx', 'pptx']
      },
      timestamp: new Date(),
      priority: message.priority,
      correlationId: message.correlationId
    };
  }

  private async facilitateSession(message: AgentMessage): Promise<AgentMessage> {
    const { currentActivity, participants, issues, timeRemaining } = message.payload;

    const facilitationPrompt = `Provide real-time facilitation guidance for the current situation:

Current Activity: ${currentActivity}
Participants: ${participants?.length || 0} people
Active Issues: ${issues?.join(', ') || 'None reported'}
Time Remaining: ${timeRemaining || 'Not specified'}

Please provide:
1. Immediate next steps
2. Engagement strategies for current issues
3. Time management recommendations
4. Conflict resolution approaches (if needed)
5. Alternative activities if pivoting is needed
6. Energy management techniques
7. Progress check recommendations

Be specific and actionable for immediate implementation.`;

    const aiResponse = await this.generateAIResponse(facilitationPrompt, message.payload);

    return {
      id: this.generateUniqueId('response'),
      from: this.id,
      to: message.from,
      type: 'facilitation-guidance',
      payload: {
        guidance: aiResponse,
        urgency: issues?.length > 0 ? 'high' : 'normal',
        timestamp: new Date()
      },
      timestamp: new Date(),
      priority: 'high',
      correlationId: message.correlationId
    };
  }

  private async synthesizeOutcomes(message: AgentMessage): Promise<AgentMessage> {
    const { workshopData, outcomes, nextSteps } = message.payload;

    const synthesisPrompt = `Analyze the workshop outcomes and create an implementation plan:

Workshop Data: ${JSON.stringify(workshopData)}
Key Outcomes: ${outcomes?.join(', ') || 'Not specified'}
Generate Next Steps: ${nextSteps ? 'Yes' : 'No'}

Please provide:
1. Executive summary of workshop results
2. Key decisions and agreements reached
3. Stakeholder commitments and responsibilities
4. Risk assessment and mitigation strategies
5. Implementation timeline and milestones
6. Success metrics and measurement approaches
7. Follow-up meeting recommendations
8. Governance framework recommendations

Create a comprehensive action plan that ensures workshop outcomes translate into real organizational change.`;

    const aiResponse = await this.generateAIResponse(synthesisPrompt, message.payload);

    // Save outcomes to database if workshop ID provided
    if (workshopData?.workshopId) {
      try {
        const query = `
          UPDATE workshop_sessions 
          SET outcomes = $1, status = 'completed', actual_end = CURRENT_TIMESTAMP
          WHERE id = $2
        `;
        
        await dbManager.query(query, [aiResponse, workshopData.workshopId]);
      } catch (dbError) {
        this.log(`Error saving workshop outcomes: ${dbError}`, 'error');
      }
    }

    return {
      id: this.generateUniqueId('response'),
      from: this.id,
      to: message.from,
      type: 'outcomes-synthesized',
      payload: {
        synthesis: aiResponse,
        implementationPlan: true,
        followUpRequired: true
      },
      timestamp: new Date(),
      priority: message.priority,
      correlationId: message.correlationId
    };
  }

  private async getWorkshopTemplates(message: AgentMessage): Promise<AgentMessage> {
    try {
      const query = `
        SELECT * FROM report_templates 
        WHERE type = 'workshop-summary' 
        AND is_active = true
        ORDER BY created_at DESC
      `;
      
      const result = await dbManager.query(query);
      const templates = result.rows;

      return {
        id: this.generateUniqueId('response'),
        from: this.id,
        to: message.from,
        type: 'workshop-templates',
        payload: {
          templates: templates,
          count: templates.length
        },
        timestamp: new Date(),
        priority: message.priority,
        correlationId: message.correlationId
      };

    } catch (error) {
      this.log(`Error fetching workshop templates: ${error}`, 'error');
      throw error;
    }
  }

  private async handleGeneralQuery(message: AgentMessage): Promise<AgentMessage> {
    const userQuery = message.payload.query || message.payload.message || 'General workshop planning assistance needed';
    
    const aiResponse = await this.generateAIResponse(userQuery, message.payload);

    return {
      id: this.generateUniqueId('response'),
      from: this.id,
      to: message.from,
      type: 'general-response',
      payload: {
        response: aiResponse,
        capabilities: this.getCapabilities()
      },
      timestamp: new Date(),
      priority: message.priority,
      correlationId: message.correlationId
    };
  }
} 