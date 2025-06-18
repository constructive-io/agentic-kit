import { Agent, Action, AgentState, AgentConfig, logger } from '@agentic-kit/core';

export class VisualAgent implements Agent {
  public readonly name = 'VisualAgent';
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
        actionType: 'screenshot',
        args: {
          thought: 'Taking screenshot to analyze visual content'
        }
      };
    }
    
    return {
      id: `action-${Date.now()}`,
      timestamp: new Date(),
      source: this.name,
      type: 'action',
      actionType: 'finish',
      args: { thought: 'Visual analysis completed' }
    };
  }

  reset(): void {
    logger.info(`${this.name} reset`);
  }
}
