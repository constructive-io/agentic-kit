import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { logger } from '@agentic-kit/core';
import { CodeActAgent } from '@agentic-kit/agents';
import { LocalRuntime } from '@agentic-kit/runtime';

export class AgenticKitServer {
  private server: FastifyInstance;
  private port: number;

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

  private setupRoutes(): void {
    this.server.get('/health', async (request, reply) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
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
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        sessionId,
        status: 'created',
        timestamp: new Date().toISOString(),
      };
    });

    this.server.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection, req) => {
        logger.info('WebSocket connection established');
        
        connection.socket.on('message', async (message: any) => {
          try {
            const data = JSON.parse(message.toString());
            logger.debug('Received WebSocket message:', data);
            
            if (data.type === 'agent_request') {
              const response = {
                type: 'agent_response',
                requestId: data.requestId,
                data: { message: 'Agent processing started' },
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
