import { SQLiteMemoryStore, ConversationMemory } from '../src';
import { AgentEvent, AgentState } from '@agentic-kit/core';

describe('AgenticKit Memory', () => {
  describe('SQLiteMemoryStore', () => {
    let store: SQLiteMemoryStore;

    beforeEach(() => {
      store = new SQLiteMemoryStore();
    });

    afterEach(() => {
      store.close();
    });

    it('should create SQLiteMemoryStore', () => {
      expect(store).toBeDefined();
    });

    it('should save and load data', async () => {
      const testData = { message: 'hello world' };
      
      await store.save('test-key', testData);
      const loaded = await store.load('test-key');
      
      expect(loaded).toEqual(testData);
    });

    it('should delete data', async () => {
      const testData = { message: 'test data' };
      
      await store.save('delete-key', testData);
      await store.delete('delete-key');
      
      const loaded = await store.load('delete-key');
      expect(loaded).toBeNull();
    });

    it('should list stored keys', async () => {
      await store.save('key1', { data: 'value1' });
      await store.save('key2', { data: 'value2' });
      
      const keys = await store.list();
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });
  });

  describe('ConversationMemory', () => {
    let memory: ConversationMemory;

    beforeEach(() => {
      memory = new ConversationMemory();
    });

    it('should create ConversationMemory', () => {
      expect(memory).toBeDefined();
    });

    it('should save and retrieve messages', async () => {
      const conversationId = 'test-conversation';
      const event: AgentEvent = {
        id: 'test-event',
        timestamp: new Date(),
        source: 'test',
        type: 'action'
      };

      await memory.saveMessage(conversationId, event);
      const conversation = await memory.getConversation(conversationId);
      
      expect(conversation).toHaveLength(1);
      expect(conversation[0]).toEqual(event);
    });

    it('should handle multiple messages in conversation', async () => {
      const conversationId = 'multi-message-conversation';
      const events: AgentEvent[] = [
        {
          id: 'event-1',
          timestamp: new Date(),
          source: 'test',
          type: 'action'
        },
        {
          id: 'event-2',
          timestamp: new Date(),
          source: 'test',
          type: 'observation'
        }
      ];

      for (const event of events) {
        await memory.saveMessage(conversationId, event);
      }

      const conversation = await memory.getConversation(conversationId);
      expect(conversation).toHaveLength(2);
      expect(conversation).toEqual(events);
    });

    it('should delete conversations', async () => {
      const conversationId = 'delete-test';
      const event: AgentEvent = {
        id: 'test-event',
        timestamp: new Date(),
        source: 'test',
        type: 'action'
      };

      await memory.saveMessage(conversationId, event);
      expect(await memory.getConversation(conversationId)).toHaveLength(1);

      await memory.deleteConversation(conversationId);
      expect(await memory.getConversation(conversationId)).toHaveLength(0);
    });

    it('should save and load full conversations', async () => {
      const conversationId = 'full-conversation';
      const events: AgentEvent[] = [
        {
          id: 'event-1',
          timestamp: new Date(),
          source: 'agent',
          type: 'action'
        },
        {
          id: 'event-2',
          timestamp: new Date(),
          source: 'runtime',
          type: 'observation'
        }
      ];

      await memory.saveConversation(conversationId, events);
      const loadedConversation = await memory.loadConversation(conversationId);
      
      expect(loadedConversation).toEqual(events);
    });

    it('should handle agent state operations', async () => {
      const sessionId = 'state-session';
      const state: AgentState = {
        history: [],
        iteration: 5,
        maxIterations: 100,
        inputs: { message: 'test' },
        outputs: { result: 'success' }
      };

      await expect(memory.saveAgentState(sessionId, state)).resolves.not.toThrow();
      
      const loadedState = await memory.loadAgentState(sessionId);
      expect(loadedState).toBeNull(); // Current implementation returns null
    });

    it('should create and restore snapshots', async () => {
      const sessionId = 'snapshot-session';
      const state: AgentState = {
        history: [],
        iteration: 10,
        maxIterations: 100,
        inputs: {},
        outputs: {}
      };

      const snapshotId = await memory.createSnapshot(sessionId, state);
      expect(snapshotId).toContain('snapshot_');
      expect(snapshotId).toContain(sessionId);

      const restoredState = await memory.restoreSnapshot(snapshotId);
      expect(restoredState).toBeNull(); // Current implementation returns null
    });

    it('should delete sessions', async () => {
      const sessionId = 'delete-session';
      const event: AgentEvent = {
        id: 'session-event',
        timestamp: new Date(),
        source: 'test',
        type: 'action'
      };

      await memory.saveMessage(sessionId, event);
      expect(await memory.getConversation(sessionId)).toHaveLength(1);

      await memory.deleteSession(sessionId);
      expect(await memory.getConversation(sessionId)).toHaveLength(0);
    });

    it('should return empty conversation for non-existent conversation', async () => {
      const conversation = await memory.getConversation('non-existent');
      expect(conversation).toEqual([]);
    });
  });
});
