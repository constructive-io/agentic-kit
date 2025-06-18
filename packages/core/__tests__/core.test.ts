import { 
  AgentConfigSchema, 
  logger, 
  EventStream, 
  AgentController,
  Action,
  Observation,
  CmdRunAction,
  FileReadAction,
  FileWriteAction,
  MessageAction,
  BrowseInteractiveAction,
  CmdOutputObservation,
  FileReadObservation,
  BrowserOutputObservation,
  ErrorObservation,
  Agent,
  AgentState
} from '../src';

class MockAgent implements Agent {
  public readonly name = 'MockAgent';
  private stepCount = 0;

  async step(state: AgentState): Promise<Action> {
    this.stepCount++;
    return {
      id: `mock_action_${this.stepCount}`,
      timestamp: new Date(),
      source: this.name,
      type: 'action',
      actionType: 'run',
      args: { command: `echo "Step ${this.stepCount}"` }
    } as CmdRunAction;
  }

  reset(): void {
    this.stepCount = 0;
  }
}

describe('AgenticKit Core', () => {
  describe('Configuration Validation', () => {
    it('should validate valid agent configuration', () => {
      const validConfig = {
        name: 'TestAgent',
        maxIterations: 50,
        temperature: 0.5,
      };

      const result = AgentConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
      
      if (result.success) {
        expect(result.data.name).toBe('TestAgent');
        expect(result.data.maxIterations).toBe(50);
        expect(result.data.temperature).toBe(0.5);
      }
    });

    it('should apply default values for optional fields', () => {
      const minimalConfig = { name: 'MinimalAgent' };
      const result = AgentConfigSchema.safeParse(minimalConfig);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxIterations).toBe(100);
        expect(result.data.temperature).toBe(0.7);
      }
    });

    it('should reject invalid temperature values', () => {
      const invalidConfig = {
        name: 'TestAgent',
        temperature: 3.0, // Invalid: > 2
      };

      const result = AgentConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it('should reject missing required fields', () => {
      const invalidConfig = { temperature: 0.5 }; // Missing name
      const result = AgentConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe('Logger', () => {
    it('should create logger instance with required methods', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.warn).toBe('function');
    });
  });

  describe('EventStream', () => {
    let eventStream: EventStream;

    beforeEach(() => {
      eventStream = new EventStream();
    });

    it('should initialize with empty history', () => {
      expect(eventStream.getHistory()).toEqual([]);
    });

    it('should emit and store events', () => {
      const mockEvent: Action = {
        id: 'test_action',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'echo test' }
      };

      eventStream.emit('event', mockEvent);
      const history = eventStream.getHistory();
      
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockEvent);
    });

    it('should support event subscription', (done) => {
      const mockEvent: Action = {
        id: 'test_action',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'echo test' }
      };

      eventStream.subscribe((event) => {
        expect(event).toEqual(mockEvent);
        done();
      });

      eventStream.emit('event', mockEvent);
    });

    it('should clear history when requested', () => {
      const mockEvent: Action = {
        id: 'test_action',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'echo test' }
      };

      eventStream.emit('event', mockEvent);
      expect(eventStream.getHistory()).toHaveLength(1);
      
      eventStream.clear();
      expect(eventStream.getHistory()).toHaveLength(0);
    });
  });

  describe('AgentController', () => {
    let mockAgent: MockAgent;
    let controller: AgentController;

    beforeEach(() => {
      mockAgent = new MockAgent();
      controller = new AgentController(mockAgent, 5);
    });

    it('should initialize with correct state', () => {
      const state = controller.getState();
      
      expect(state.iteration).toBe(0);
      expect(state.maxIterations).toBe(5);
      expect(state.history).toEqual([]);
      expect(state.inputs).toEqual({});
      expect(state.outputs).toEqual({});
    });

    it('should execute agent step and update state', async () => {
      const result = await controller.step();
      
      expect(result.shouldContinue).toBe(true);
      expect(result.action).toBeDefined();
      expect(result.action.actionType).toBe('run');
      
      const state = controller.getState();
      expect(state.iteration).toBe(1);
      expect(state.history).toHaveLength(1);
      expect(state.lastAction).toEqual(result.action);
    });

    it('should stop when max iterations reached', async () => {
      for (let i = 0; i < 5; i++) {
        const result = await controller.step();
        expect(result.shouldContinue).toBe(i < 4);
      }
      
      const finalResult = await controller.step();
      expect(finalResult.shouldContinue).toBe(false);
    });

    it('should add observations to state and history', () => {
      const observation: CmdOutputObservation = {
        id: 'test_obs',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'run',
        content: 'Command output',
        command_id: 1,
        command: 'echo test',
        exit_code: 0
      };

      controller.addObservation(observation);
      
      const state = controller.getState();
      expect(state.history).toHaveLength(1);
      expect(state.lastObservation).toEqual(observation);
      expect(state.history[0].id).toMatch(/^obs_\d+_\d+$/);
    });

    it('should emit events through event stream', async () => {
      const eventStream = controller.getEventStream();
      const events: any[] = [];
      
      eventStream.subscribe((event) => {
        events.push(event);
      });

      await controller.step();
      
      const observation: Observation = {
        id: 'test_obs',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'run',
        content: 'Test output'
      };
      
      controller.addObservation(observation);
      
      expect(events).toHaveLength(2); // Action + Observation
      expect(events[0].type).toBe('action');
      expect(events[1].type).toBe('observation');
    });

    it('should reset state and agent', () => {
      controller.step();
      const observation: Observation = {
        id: 'test_obs',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'run',
        content: 'Test output'
      };
      controller.addObservation(observation);
      
      controller.reset();
      
      const state = controller.getState();
      expect(state.iteration).toBe(0);
      expect(state.history).toEqual([]);
      expect(state.lastAction).toBeUndefined();
      expect(state.lastObservation).toBeUndefined();
      expect(controller.getEventStream().getHistory()).toEqual([]);
    });
  });

  describe('Action Types', () => {
    it('should create valid CmdRunAction', () => {
      const action: CmdRunAction = {
        id: 'cmd_1',
        timestamp: new Date(),
        source: 'agent',
        type: 'action',
        actionType: 'run',
        args: {
          command: 'ls -la',
          background: false
        }
      };

      expect(action.actionType).toBe('run');
      expect(action.args.command).toBe('ls -la');
      expect(action.args.background).toBe(false);
    });

    it('should create valid FileReadAction', () => {
      const action: FileReadAction = {
        id: 'file_read_1',
        timestamp: new Date(),
        source: 'agent',
        type: 'action',
        actionType: 'read',
        args: {
          path: '/path/to/file.txt',
          start: 1,
          end: 10
        }
      };

      expect(action.actionType).toBe('read');
      expect(action.args.path).toBe('/path/to/file.txt');
      expect(action.args.start).toBe(1);
      expect(action.args.end).toBe(10);
    });

    it('should create valid FileWriteAction', () => {
      const action: FileWriteAction = {
        id: 'file_write_1',
        timestamp: new Date(),
        source: 'agent',
        type: 'action',
        actionType: 'write',
        args: {
          path: '/path/to/file.txt',
          content: 'Hello, World!'
        }
      };

      expect(action.actionType).toBe('write');
      expect(action.args.path).toBe('/path/to/file.txt');
      expect(action.args.content).toBe('Hello, World!');
    });

    it('should create valid MessageAction', () => {
      const action: MessageAction = {
        id: 'message_1',
        timestamp: new Date(),
        source: 'agent',
        type: 'action',
        actionType: 'message',
        args: {
          content: 'Hello, user!',
          wait_for_response: true
        }
      };

      expect(action.actionType).toBe('message');
      expect(action.args.content).toBe('Hello, user!');
      expect(action.args.wait_for_response).toBe(true);
    });

    it('should create valid BrowseInteractiveAction', () => {
      const action: BrowseInteractiveAction = {
        id: 'browse_1',
        timestamp: new Date(),
        source: 'agent',
        type: 'action',
        actionType: 'browse_interactive',
        args: {
          browser_id: 'browser_1',
          url: 'https://example.com',
          goal: 'Find information about the company'
        }
      };

      expect(action.actionType).toBe('browse_interactive');
      expect(action.args.browser_id).toBe('browser_1');
      expect(action.args.url).toBe('https://example.com');
      expect(action.args.goal).toBe('Find information about the company');
    });
  });

  describe('Observation Types', () => {
    it('should create valid CmdOutputObservation', () => {
      const observation: CmdOutputObservation = {
        id: 'cmd_output_1',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'run',
        content: 'Command executed successfully',
        command_id: 1,
        command: 'ls -la',
        exit_code: 0
      };

      expect(observation.observationType).toBe('run');
      expect(observation.content).toBe('Command executed successfully');
      expect(observation.command_id).toBe(1);
      expect(observation.command).toBe('ls -la');
      expect(observation.exit_code).toBe(0);
    });

    it('should create valid FileReadObservation', () => {
      const observation: FileReadObservation = {
        id: 'file_read_obs_1',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'read',
        content: 'File content here',
        path: '/path/to/file.txt'
      };

      expect(observation.observationType).toBe('read');
      expect(observation.content).toBe('File content here');
      expect(observation.path).toBe('/path/to/file.txt');
    });

    it('should create valid BrowserOutputObservation', () => {
      const observation: BrowserOutputObservation = {
        id: 'browser_obs_1',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'browse',
        content: 'Page loaded successfully',
        url: 'https://example.com',
        screenshot: 'base64_screenshot_data'
      };

      expect(observation.observationType).toBe('browse');
      expect(observation.content).toBe('Page loaded successfully');
      expect(observation.url).toBe('https://example.com');
      expect(observation.screenshot).toBe('base64_screenshot_data');
    });

    it('should create valid ErrorObservation', () => {
      const observation: ErrorObservation = {
        id: 'error_obs_1',
        timestamp: new Date(),
        source: 'runtime',
        type: 'observation',
        observationType: 'error',
        content: 'Command failed with error',
        error_code: 'ENOENT'
      };

      expect(observation.observationType).toBe('error');
      expect(observation.content).toBe('Command failed with error');
      expect(observation.error_code).toBe('ENOENT');
    });
  });
});
