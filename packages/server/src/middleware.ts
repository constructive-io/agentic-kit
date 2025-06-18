import { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '@agentic-kit/core';

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    logger.warn('Missing authorization header');
    reply.status(401);
    throw new Error('Authorization required');
  }

  const token = authHeader.replace('Bearer ', '');
  
  if (!token || token === 'invalid') {
    logger.warn('Invalid authorization token');
    reply.status(401);
    throw new Error('Invalid token');
  }

  logger.debug('Authentication successful');
}

export async function rateLimitMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const clientIp = request.ip;
  const now = Date.now();
  
  logger.debug(`Rate limit check for IP: ${clientIp}`);
}

export async function loggingMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const start = Date.now();
  
  logger.info(`${request.method} ${request.url} started`);
}
