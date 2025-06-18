import { Agent, Action, AgentState, AgentConfig, logger } from '@agentic-kit/core';

export class CodeActAgent implements Agent {
  public readonly name = 'CodeActAgent';
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    logger.info(`Initialized ${this.name} with config`, config);
  }

  async step(state: AgentState): Promise<Action> {
    logger.debug(`${this.name} step ${state.iteration}`);
    
    const lastObservation = state.lastObservation;
    
    if (!lastObservation) {
      return {
        id: `action-${Date.now()}`,
        timestamp: new Date(),
        source: this.name,
        type: 'action',
        actionType: 'run',
        args: {
          command: 'pwd && ls -la',
          thought: 'Let me start by understanding the current environment'
        }
      };
    }
    
    return {
      id: `action-${Date.now()}`,
      timestamp: new Date(),
      source: this.name,
      type: 'action',
      actionType: 'finish',
      args: { thought: 'Task completed' }
    };
  }

  reset(): void {
    logger.info(`${this.name} reset`);
  }
}

export * from './browsing-agent';
export * from './visual-agent';
