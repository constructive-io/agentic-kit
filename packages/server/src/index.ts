import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { 
  logger, 
  AgentController, 
  EventStream,
  Action,
  Observation,
} from '@agentic-kit/core';
import { CodeActAgent } from '@agentic-kit/agents';
import { LocalRuntime, BrowserRuntime, DockerRuntime } from '@agentic-kit/runtime';
import { OpenAIProvider } from '@agentic-kit/llm';

export interface SessionData {
  id: string;
  agentController: AgentController;
  runtime: any;
  eventStream: EventStream;
  createdAt: Date;
  lastActivity: Date;
}

export class AgenticKitServer {
  private server: FastifyInstance;
  private port: number;
  private sessions: Map<string, SessionData> = new Map();

  constructor(port: number = 3000) {
    this.port = port;
    this.server = Fastify({ logger: false });
    this.setupMiddleware();
    this.setupRoutes();
    logger.info(`Initialized AgenticKitServer on port ${port}`);
  }

  private async setupMiddleware(): Promise<void> {
    await this.server.register(cors, {
      origin: true,
      credentials: true,
    });

    await this.server.register(websocket);
  }

  private createSession(agentType: string = 'codeact', runtimeType: string = 'local'): SessionData {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let runtime;
    switch (runtimeType) {
      case 'browser':
        runtime = new BrowserRuntime();
        break;
      case 'docker':
        runtime = new DockerRuntime();
        break;
      default:
        runtime = new LocalRuntime();
    }

    const llmProvider = new OpenAIProvider(
      process.env.OPENAI_API_KEY || 'dummy-key'
    );
    
    let agent;
    switch (agentType) {
      case 'codeact':
      default:
        agent = new CodeActAgent(llmProvider);
    }

    const agentController = new AgentController(agent);
    const eventStream = agentController.getEventStream();

    const session: SessionData = {
      id: sessionId,
      agentController,
      runtime,
      eventStream,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    logger.info(`Created session ${sessionId} with agent ${agentType} and runtime ${runtimeType}`);
    
    return session;
  }

  private async processAgentStep(session: SessionData, userMessage?: string): Promise<void> {
    try {
      if (userMessage) {
        session.agentController.getState().inputs.message = userMessage;
      }

      const { action, shouldContinue } = await session.agentController.step();
      
      if (action && action.actionType !== 'message') {
        const observation = await session.runtime.execute(action);
        session.agentController.addObservation(observation);
      }

      session.lastActivity = new Date();
    } catch (error) {
      logger.error('Agent step failed:', error);
    }
  }

  private setupRoutes(): void {
    this.server.get('/health', async (request, reply) => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        sessions: this.sessions.size,
      };
    });

    this.server.get('/api/agents', async (request, reply) => {
      return {
        agents: [
          { name: 'CodeActAgent', description: 'Code generation and execution agent' },
          { name: 'BrowsingAgent', description: 'Web browsing and interaction agent' },
          { name: 'VisualAgent', description: 'Visual content analysis agent' },
        ],
      };
    });

    this.server.post('/api/sessions', async (request, reply) => {
      const body = request.body as any;
      const { agentType = 'codeact', runtimeType = 'local' } = body;
      
      const session = this.createSession(agentType, runtimeType);
      
      return {
        sessionId: session.id,
        agentType,
        runtimeType,
        status: 'created',
        timestamp: new Date().toISOString(),
      };
    });

    this.server.get('/api/sessions/:sessionId', async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }
      
      return {
        sessionId: session.id,
        status: 'active',
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        iteration: session.agentController.getState().iteration,
      };
    });

    this.server.post('/api/sessions/:sessionId/messages', async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { message } = request.body as { message: string };
      
      const session = this.sessions.get(sessionId);
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }
      
      await this.processAgentStep(session, message);
      
      return {
        status: 'processed',
        timestamp: new Date().toISOString(),
      };
    });

    this.server.get('/api/sessions/:sessionId/history', async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const session = this.sessions.get(sessionId);
      
      if (!session) {
        reply.status(404);
        return { error: 'Session not found' };
      }
      
      return {
        history: session.eventStream.getHistory(),
        iteration: session.agentController.getState().iteration,
      };
    });

    this.server.register(async (fastify) => {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        logger.info('WebSocket connection established');
        
        connection.socket.on('message', async (message: any) => {
          try {
            const data = JSON.parse(message.toString());
            logger.debug('Received WebSocket message:', data);
            
            if (data.type === 'agent_request') {
              const { sessionId, message: userMessage, agentType = 'codeact', runtimeType = 'local' } = data;
              
              let session = sessionId ? this.sessions.get(sessionId) : null;
              if (!session) {
                session = this.createSession(agentType, runtimeType);
              }
              
              session.eventStream.subscribe((event: any) => {
                const response = {
                  type: 'agent_event',
                  sessionId: session!.id,
                  event,
                  timestamp: new Date().toISOString(),
                };
                connection.socket.send(JSON.stringify(response));
              });
              
              await this.processAgentStep(session, userMessage);
              
              const response = {
                type: 'agent_response',
                sessionId: session.id,
                status: 'processing',
                timestamp: new Date().toISOString(),
              };
              
              connection.socket.send(JSON.stringify(response));
            }
          } catch (error) {
            logger.error('WebSocket message error:', error);
            
            const errorResponse = {
              type: 'error',
              message: 'Invalid message format',
              timestamp: new Date().toISOString(),
            };
            
            connection.socket.send(JSON.stringify(errorResponse));
          }
        });

        connection.socket.on('close', () => {
          logger.info('WebSocket connection closed');
        });
      });
    });
  }

  async start(): Promise<void> {
    try {
      await this.server.listen({ port: this.port, host: '0.0.0.0' });
      logger.info(`AgenticKit server started on port ${this.port}`);
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      for (const session of this.sessions.values()) {
        await session.runtime.cleanup();
      }
      this.sessions.clear();
      
      await this.server.close();
      logger.info('AgenticKit server stopped');
    } catch (error) {
      logger.error('Failed to stop server:', error);
      throw error;
    }
  }
}

export * from './routes';
export * from './middleware';
