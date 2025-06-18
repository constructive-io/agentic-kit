import { FastifyInstance } from 'fastify';
import { logger } from '@agentic-kit/core';

export async function registerAgentRoutes(server: FastifyInstance): Promise<void> {
  server.post('/api/agents/:agentType/execute', async (request, reply) => {
    const { agentType } = request.params as { agentType: string };
    const { prompt, sessionId } = request.body as { prompt: string; sessionId: string };

    logger.info(`Executing ${agentType} agent for session ${sessionId}`);

    try {
      const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        executionId,
        agentType,
        sessionId,
        status: 'started',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`Agent execution failed:`, error);
      reply.status(500);
      return { error: 'Agent execution failed' };
    }
  });

  server.get('/api/agents/:agentType/status/:executionId', async (request, reply) => {
    const { agentType, executionId } = request.params as { agentType: string; executionId: string };

    logger.debug(`Getting status for ${agentType} execution ${executionId}`);

    return {
      executionId,
      agentType,
      status: 'completed',
      result: 'Task completed successfully',
      timestamp: new Date().toISOString(),
    };
  });
}

export async function registerRuntimeRoutes(server: FastifyInstance): Promise<void> {
  server.post('/api/runtime/execute', async (request, reply) => {
    const { command, runtimeType = 'local' } = request.body as { command: string; runtimeType?: string };

    logger.info(`Executing command in ${runtimeType} runtime: ${command}`);

    try {
      const result = {
        stdout: 'Command executed successfully',
        stderr: '',
        exitCode: 0,
        timestamp: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      logger.error('Runtime execution failed:', error);
      reply.status(500);
      return { error: 'Runtime execution failed' };
    }
  });
}
