import { 
  Agent, 
  AgentState, 
  Action, 
  logger,
  LLMProvider,
} from '@agentic-kit/core';

export class CodeActAgent implements Agent {
  public readonly name = 'CodeActAgent';
  private llmProvider: LLMProvider;
  private systemPrompt: string;

  constructor(llmProvider: LLMProvider) {
    this.llmProvider = llmProvider;
    this.systemPrompt = this.buildSystemPrompt();
    logger.info(`Initialized ${this.name}`);
  }

  private buildSystemPrompt(): string {
    return `You are a helpful assistant that can interact with a computer to solve tasks.
* When you need to run a command, use the run action with the command to execute
* When you need to read a file, use the read action with the file path
* When you need to write to a file, use the write action with the file path and content
* When you need to communicate with the user, use the message action
* Always think step by step and explain your reasoning
* Be precise and careful with file paths and commands
* If you encounter an error, analyze it and try a different approach

Available actions:
- run: Execute a shell command
- read: Read the contents of a file
- write: Write content to a file
- message: Send a message to the user

Format your response as a JSON object with the following structure:
{
  "thought": "Your reasoning for the next action",
  "action": "action_type",
  "args": { "key": "value" }
}`;
  }

  private buildContext(state: AgentState): string {
    const recentHistory = state.history.slice(-10);
    let context = `Current iteration: ${state.iteration}/${state.maxIterations}\n\n`;
    
    if (recentHistory.length > 0) {
      context += "Recent history:\n";
      for (const event of recentHistory) {
        if (event.type === 'action') {
          const action = event as Action;
          context += `Action: ${action.actionType} - ${JSON.stringify(action.args)}\n`;
          if (action.thought) {
            context += `Thought: ${action.thought}\n`;
          }
        } else {
          context += `Observation: ${event.type} - ${(event as any).content}\n`;
        }
      }
    }
    
    return context;
  }

  private async generateAction(context: string, userMessage?: string): Promise<any> {
    const prompt = `${this.systemPrompt}\n\nContext:\n${context}\n\n${
      userMessage ? `User message: ${userMessage}\n\n` : ''
    }What should be the next action?`;

    try {
      const response = await this.llmProvider.generate(prompt, {
        temperature: 0.1,
        maxTokens: 1000,
      });

      return JSON.parse(response.trim());
    } catch (error) {
      logger.error('Failed to parse LLM response:', error);
      return {
        thought: 'Failed to parse response, sending message to user',
        action: 'message',
        args: { content: 'I encountered an error processing your request. Please try again.' }
      };
    }
  }

  private parseActionResponse(response: any): Action {
    const { thought, action, args } = response;

    const baseAction: Action = {
      id: '',
      timestamp: new Date(),
      source: this.name,
      type: 'action',
      actionType: action,
      args,
      thought,
    };

    return baseAction;
  }

  async step(state: AgentState): Promise<Action> {
    logger.debug(`${this.name} processing step ${state.iteration}`);
    
    try {
      const context = this.buildContext(state);
      const userMessage = state.inputs.message as string;
      
      const response = await this.generateAction(context, userMessage);
      const action = this.parseActionResponse(response);
      
      action.source = this.name;
      action.id = `action_${state.iteration}_${Date.now()}`;
      action.timestamp = new Date();
      
      return action;
    } catch (error) {
      logger.error(`${this.name} step failed:`, error);
      
      return {
        id: `action_${state.iteration}_${Date.now()}`,
        timestamp: new Date(),
        source: this.name,
        type: 'action',
        actionType: 'message',
        args: { content: 'I encountered an error. Please try again.' },
        thought: 'Error handling fallback',
      };
    }
  }

  reset(): void {
    logger.info(`${this.name} reset`);
  }
}

export * from './browsing-agent';
export * from './visual-agent';
