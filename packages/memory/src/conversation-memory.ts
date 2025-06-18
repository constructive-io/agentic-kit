import { AgentEvent, logger } from '@agentic-kit/core';
import { SQLiteMemoryStore } from './index';

export class ConversationMemory {
  private store: SQLiteMemoryStore;
  private sessionId: string;

  constructor(sessionId: string, dbPath?: string) {
    this.sessionId = sessionId;
    this.store = new SQLiteMemoryStore(dbPath);
    logger.info(`Initialized ConversationMemory for session: ${sessionId}`);
  }

  async saveEvent(event: AgentEvent): Promise<void> {
    const key = `${this.sessionId}:events`;
    
    try {
      const events = await this.store.load(key);
      events.push(event);
      await this.store.save(key, events);
    } catch (error) {
      await this.store.save(key, [event]);
    }

    logger.debug(`Saved event ${event.id} for session ${this.sessionId}`);
  }

  async getEvents(): Promise<AgentEvent[]> {
    const key = `${this.sessionId}:events`;
    
    try {
      return await this.store.load(key);
    } catch (error) {
      return [];
    }
  }

  async saveContext(context: Record<string, any>): Promise<void> {
    const key = `${this.sessionId}:context`;
    await this.store.save(key, context);
    logger.debug(`Saved context for session ${this.sessionId}`);
  }

  async getContext(): Promise<Record<string, any>> {
    const key = `${this.sessionId}:context`;
    
    try {
      return await this.store.load(key);
    } catch (error) {
      return {};
    }
  }

  async clear(): Promise<void> {
    const eventsKey = `${this.sessionId}:events`;
    const contextKey = `${this.sessionId}:context`;
    
    try {
      await this.store.delete(eventsKey);
    } catch (error) {
    }
    
    try {
      await this.store.delete(contextKey);
    } catch (error) {
    }

    logger.info(`Cleared memory for session ${this.sessionId}`);
  }

  close(): void {
    this.store.close();
  }
}
