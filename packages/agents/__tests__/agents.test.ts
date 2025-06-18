import { CodeActAgent, BrowsingAgent, VisualAgent } from '../src';
import { AgentConfigSchema } from '@agentic-kit/core';

describe('AgenticKit Agents', () => {
  const config = AgentConfigSchema.parse({
    name: 'TestAgent',
    maxIterations: 10,
    temperature: 0.5,
  });

  it('should create CodeActAgent', () => {
    const agent = new CodeActAgent(config);
    expect(agent.name).toBe('CodeActAgent');
  });

  it('should create BrowsingAgent', () => {
    const agent = new BrowsingAgent(config);
    expect(agent.name).toBe('BrowsingAgent');
  });

  it('should create VisualAgent', () => {
    const agent = new VisualAgent(config);
    expect(agent.name).toBe('VisualAgent');
  });

  it('should execute agent step', async () => {
    const agent = new CodeActAgent(config);
    const state = {
      history: [],
      iteration: 0,
      maxIterations: 10,
    };

    const action = await agent.step(state);
    expect(action.type).toBe('action');
    expect(action.source).toBe('CodeActAgent');
  });
});
