import { logger, AgentEvent, AgentState } from '@agentic-kit/core';

export interface ConversationMemoryConfig {
  maxHistoryLength: number;
}

export class ConversationMemory {
  private conversations: Map<string, AgentEvent[]> = new Map();
  private config: ConversationMemoryConfig;

  constructor(config: Partial<ConversationMemoryConfig> = {}) {
    this.config = {
      maxHistoryLength: 1000,
      ...config,
    };
    logger.info('Initialized ConversationMemory');
  }

  async saveMessage(conversationId: string, event: AgentEvent): Promise<void> {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, []);
    }
    
    this.conversations.get(conversationId)!.push(event);
    logger.debug(`Saved event to conversation: ${conversationId}`);
  }

  async getConversation(conversationId: string): Promise<AgentEvent[]> {
    const conversation = this.conversations.get(conversationId) || [];
    logger.debug(`Retrieved conversation: ${conversationId} with ${conversation.length} events`);
    return conversation;
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.conversations.delete(conversationId);
    logger.debug(`Deleted conversation: ${conversationId}`);
  }

  async saveConversation(conversationId: string, events: AgentEvent[]): Promise<void> {
    this.conversations.set(conversationId, [...events]);
    logger.debug(`Saved full conversation: ${conversationId} with ${events.length} events`);
  }

  async loadConversation(sessionId: string): Promise<AgentEvent[]> {
    return this.getConversation(sessionId);
  }

  async saveAgentState(sessionId: string, state: AgentState): Promise<void> {
    logger.debug(`Saved agent state for session ${sessionId}`);
  }

  async loadAgentState(sessionId: string): Promise<AgentState | null> {
    logger.debug(`Loaded agent state for session ${sessionId}`);
    return null;
  }

  async createSnapshot(sessionId: string, state: AgentState): Promise<string> {
    const snapshotId = `snapshot_${sessionId}_${Date.now()}`;
    logger.info(`Created snapshot ${snapshotId} for session ${sessionId}`);
    return snapshotId;
  }

  async restoreSnapshot(snapshotId: string): Promise<AgentState | null> {
    logger.debug(`Restored snapshot ${snapshotId}`);
    return null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.deleteConversation(sessionId);
    logger.info(`Deleted session ${sessionId}`);
  }
}
