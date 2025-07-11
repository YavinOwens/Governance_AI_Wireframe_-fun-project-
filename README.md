# Governance Workshop Platform

A comprehensive Next.js application that implements a multi-agent system for governance workshop facilitation and document management. This platform demonstrates advanced agentic architecture with inter-agent communication, hybrid protocol implementation, and human-in-the-loop capabilities.

## 🏗️ Architecture Overview

### Multi-Agent System
- **Workshop Planner Agent**: Handles workshop planning, facilitation, and coordination
- **Database Manager Agent**: Manages PostgreSQL operations and schema evolution
- **Data Analyst Agent**: Processes data and generates insights
- **Content Creator Agent**: Generates presentations and materials
- **Tool Development Agents**: Create custom tools and manage libraries

### Communication Protocols
- **MCP (Model Context Protocol)**: Standardized AI model interactions
- **ACP (Agent Communication Protocol)**: Inter-agent messaging
- **WebSocket Real-time Communication**: Live agent status and message routing

### Data Sources
- **Local File Upload**: Drag-and-drop file uploads
- **SharePoint Integration**: Connect to SharePoint sites and documents
- **Cloud Storage**: AWS S3 and other cloud providers
- **Local File System**: Browse and select local directories

## 🚀 Features

### Core Capabilities
- ✅ **Multi-Agent Coordination**: Real-time agent communication and task distribution
- ✅ **Workshop Builder**: Create and manage governance workshops with agent assistance
- ✅ **Document Management**: Comprehensive document lifecycle management
- ✅ **Data Source Integration**: Connect to multiple data sources
- ✅ **Human-in-the-Loop**: Strategic intervention points for human oversight
- ✅ **Real-time Monitoring**: Live agent status and activity tracking
- ✅ **Database Management**: Agent-driven PostgreSQL administration

### Agent Teams
1. **Governance Workshop Team**
   - Workshop planning and facilitation
   - Co-design methodology specialists
   - Data analysis and insight generation
   - Content creation and presentation

2. **Tool Development Team**
   - Custom tool creation
   - Library maintenance and version control
   - API integration specialists
   - Quality assurance and testing

3. **Database Management Team**
   - PostgreSQL administration
   - Schema evolution management
   - Performance optimization
   - Backup and recovery

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd governance-workshop-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=future_thought_db
   DB_USER=postgres
   DB_PASSWORD=password

   # WebSocket Configuration
   NEXT_PUBLIC_WS_URL=http://localhost:3001

   # SharePoint Configuration (optional)
   SHAREPOINT_SITE_URL=https://your-tenant.sharepoint.com/sites/Governance
   SHAREPOINT_CLIENT_ID=your-client-id
   SHAREPOINT_CLIENT_SECRET=your-client-secret
   SHAREPOINT_TENANT_ID=your-tenant-id

   # AWS S3 Configuration (optional)
   AWS_S3_BUCKET=governance-workshop-bucket
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key

   # Application Configuration
   NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
   ```

4. **Set up PostgreSQL database**
   ```sql
   CREATE DATABASE future_thought_db;
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Usage Guide

### Dashboard Overview
The main dashboard provides:
- **Real-time Agent Monitoring**: View agent status, capabilities, and current tasks
- **Team Management**: Monitor agent teams and their coordination
- **Data Source Management**: Connect and sync various data sources
- **Workshop Builder**: Create and manage governance workshops
- **Document Manager**: Organize and manage uploaded documents
- **Human Interventions**: Handle approval and decision points

### Creating a Workshop
1. Navigate to the "Workshop Builder" tab
2. Click "Create New Workshop"
3. Fill in workshop details (name, description, duration, participants)
4. Add workshop objectives
5. Submit to trigger agent planning
6. Review and approve the generated workshop plan

### Managing Data Sources
1. Go to "Data Sources" tab
2. Connect to SharePoint, cloud storage, or local sources
3. Upload files using drag-and-drop interface
4. Sync documents from connected sources
5. Organize documents with tags and metadata

### Agent Communication
1. Visit "Agent Monitor" tab
2. Select an agent to view details
3. Send custom messages or use quick actions
4. Monitor real-time message history
5. Coordinate team activities

### Human Interventions
1. Check "Human Interventions" tab for pending approvals
2. Review intervention details and context
3. Choose appropriate action (approve, reject, request changes)
4. Monitor resolution timeline and outcomes

## 🔧 Technical Architecture

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Socket.io Client**: Real-time communication
- **React Dropzone**: File upload handling

### Backend
- **Next.js API Routes**: Server-side API endpoints
- **Socket.io Server**: WebSocket communication
- **PostgreSQL**: Primary database with pg driver
- **Agent System**: Custom multi-agent architecture

### Agent Communication
```typescript
interface AgentMessage {
  id: string;
  from: string;
  to: string;
  type: 'task' | 'response' | 'broadcast' | 'error';
  payload: any;
  timestamp: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### Database Schema
The application uses PostgreSQL with the following key tables:
- `agents`: Agent registration and status
- `messages`: Inter-agent communication history
- `workflows`: Workshop and workflow definitions
- `documents`: Document metadata and storage
- `interventions`: Human intervention requests

## 🧪 Development

### Running Tests
```bash
npm run test
```

### Building for Production
```bash
npm run build
npm start
```

### Code Structure
```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   └── page.tsx           # Main dashboard
├── components/            # React components
│   ├── AgentMonitor.tsx
│   ├── DataSourceManager.tsx
│   ├── WorkshopBuilder.tsx
│   ├── DocumentManager.tsx
│   └── HumanInterventionPanel.tsx
├── lib/                   # Core libraries
│   ├── agents/           # Agent system
│   ├── data-sources/     # Data source management
│   └── websocket/        # WebSocket server
└── types/                # TypeScript definitions
```

## 🔒 Security Considerations

- **Authentication**: Implement proper user authentication
- **Authorization**: Role-based access control
- **Data Privacy**: GDPR compliance for document handling
- **Secure Communication**: Encrypted agent-to-agent messaging
- **Audit Trail**: Complete logging of agent actions

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set in production:
- Database connection details
- External service credentials
- WebSocket server configuration

### Database Migration
Run database migrations before deployment:
```bash
npm run db:migrate
```

### Production Build
```bash
npm run build
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the code examples

## 🔮 Future Enhancements

- **AI Model Integration**: Connect to external AI services
- **Advanced Analytics**: Enhanced reporting and insights
- **Mobile Support**: React Native mobile application
- **API Documentation**: OpenAPI/Swagger documentation
- **Plugin System**: Extensible agent capabilities
- **Multi-tenancy**: Support for multiple organizations
