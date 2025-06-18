import { SQLiteMemoryStore, ConversationMemory } from '../src';

describe('AgenticKit Memory', () => {
  it('should create SQLiteMemoryStore', () => {
    const store = new SQLiteMemoryStore();
    expect(store).toBeDefined();
    store.close();
  });

  it('should create ConversationMemory', () => {
    const memory = new ConversationMemory('test-session');
    expect(memory).toBeDefined();
    memory.close();
  });

  it('should save and load data', async () => {
    const store = new SQLiteMemoryStore();
    const testData = { message: 'hello world' };
    
    await store.save('test-key', testData);
    const loaded = await store.load('test-key');
    
    expect(loaded).toEqual(testData);
    store.close();
  });
});
