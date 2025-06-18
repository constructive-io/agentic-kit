import { Action, Observation } from './index';

export class RunAction implements Action {
  type: 'action' = 'action';
  actionType: 'run' = 'run';
  id: string;
  timestamp: Date;
  source: string;
  args: {
    command: string;
    thought?: string;
  };

  constructor(command: string, thought?: string, source: string = 'agent') {
    this.id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.source = source;
    this.args = { command, thought };
  }
}

export class CmdOutputObservation implements Observation {
  type: 'observation' = 'observation';
  observationType: 'run' = 'run';
  id: string;
  timestamp: Date;
  source: string;
  content: string;
  extras?: {
    command?: string;
    exitCode?: number;
  };

  constructor(content: string, command?: string, exitCode?: number, source: string = 'runtime') {
    this.id = `obs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.source = source;
    this.content = content;
    this.extras = { command, exitCode };
  }
}

export class FinishAction implements Action {
  type: 'action' = 'action';
  actionType: 'finish' = 'finish';
  id: string;
  timestamp: Date;
  source: string;
  args: {
    thought: string;
  };

  constructor(thought: string, source: string = 'agent') {
    this.id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.timestamp = new Date();
    this.source = source;
    this.args = { thought };
  }
}
