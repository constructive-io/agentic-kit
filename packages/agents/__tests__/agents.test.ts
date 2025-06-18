import { CodeActAgent, BrowsingAgent, VisualAgent } from '../src';
import { AgentState, Action, CmdRunAction, MessageAction, LLMProvider } from '@agentic-kit/core';

class MockLLMProvider implements LLMProvider {
  public readonly name = 'MockLLM';
  private responses: string[] = [];
  private currentIndex = 0;

  constructor(responses: string[] = []) {
    this.responses = responses.length > 0 ? responses : [
      JSON.stringify({
        thought: 'I need to run a command to help with this task.',
        action: 'run',
        args: { command: 'echo "Hello, World!"' }
      }),
      JSON.stringify({
        thought: 'Let me send a message to the user.',
        action: 'message',
        args: { content: 'Task completed successfully!' }
      })
    ];
  }

  async generate(prompt: string): Promise<string> {
    const response = this.responses[this.currentIndex % this.responses.length];
    this.currentIndex++;
    return response;
  }

  async generateStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    const response = await this.generate(prompt);
    onChunk(response);
  }
}

describe('AgenticKit Agents', () => {
  describe('CodeActAgent', () => {
    let mockLLMProvider: MockLLMProvider;
    let agent: CodeActAgent;

    beforeEach(() => {
      mockLLMProvider = new MockLLMProvider();
      agent = new CodeActAgent(mockLLMProvider);
    });

    it('should create CodeActAgent with correct properties', () => {
      expect(agent.name).toBe('CodeActAgent');
    });

    it('should generate action from empty state', async () => {
      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await agent.step(state);
      
      expect(action).toBeDefined();
      expect(action.type).toBe('action');
      expect(action.source).toBe('CodeActAgent');
      expect(['run', 'message']).toContain(action.actionType);
    });

    it('should parse run action correctly', async () => {
      const mockProvider = new MockLLMProvider([
        JSON.stringify({
          thought: 'I need to execute a command.',
          action: 'run',
          args: { command: 'ls -la' }
        })
      ]);
      
      const testAgent = new CodeActAgent(mockProvider);

      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await testAgent.step(state);
      
      expect(action.actionType).toBe('run');
      expect((action as CmdRunAction).args.command).toBe('ls -la');
    });

    it('should parse message action correctly', async () => {
      const mockProvider = new MockLLMProvider([
        JSON.stringify({
          thought: 'Let me send a message.',
          action: 'message',
          args: { content: 'Hello, user!' }
        })
      ]);
      
      const testAgent = new CodeActAgent(mockProvider);

      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await testAgent.step(state);
      
      expect(action.actionType).toBe('message');
      expect((action as MessageAction).args.content).toBe('Hello, user!');
    });

    it('should build context from conversation history', async () => {
      const previousAction: CmdRunAction = {
        id: 'prev_action',
        timestamp: new Date(),
        source: 'CodeActAgent',
        type: 'action',
        actionType: 'run',
        args: { command: 'pwd' },
        thought: 'I need to check current directory'
      };

      const state: AgentState = {
        history: [previousAction],
        iteration: 1,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await agent.step(state);
      
      expect(action).toBeDefined();
      expect(action.type).toBe('action');
    });

    it('should handle malformed LLM responses gracefully', async () => {
      const mockProvider = new MockLLMProvider([
        'This is a malformed response without proper JSON'
      ]);
      
      const testAgent = new CodeActAgent(mockProvider);

      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await testAgent.step(state);
      
      expect(action.actionType).toBe('message');
      expect((action as MessageAction).args.content).toContain('error');
    });

    it('should reset agent state', () => {
      expect(() => agent.reset()).not.toThrow();
    });
  });

  describe('BrowsingAgent', () => {
    let mockLLMProvider: MockLLMProvider;
    let agent: BrowsingAgent;

    beforeEach(() => {
      mockLLMProvider = new MockLLMProvider();
      agent = new BrowsingAgent(mockLLMProvider);
    });

    it('should create BrowsingAgent with correct properties', () => {
      expect(agent.name).toBe('BrowsingAgent');
    });

    it('should generate browsing actions', async () => {
      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await agent.step(state);
      
      expect(action).toBeDefined();
      expect(action.type).toBe('action');
      expect(action.source).toBe('BrowsingAgent');
    });
  });

  describe('VisualAgent', () => {
    let mockLLMProvider: MockLLMProvider;
    let agent: VisualAgent;

    beforeEach(() => {
      mockLLMProvider = new MockLLMProvider();
      agent = new VisualAgent(mockLLMProvider);
    });

    it('should create VisualAgent with correct properties', () => {
      expect(agent.name).toBe('VisualAgent');
    });

    it('should generate visual actions', async () => {
      const state: AgentState = {
        history: [],
        iteration: 0,
        maxIterations: 10,
        inputs: {},
        outputs: {}
      };

      const action = await agent.step(state);
      
      expect(action).toBeDefined();
      expect(action.type).toBe('action');
      expect(action.source).toBe('VisualAgent');
    });
  });
});
