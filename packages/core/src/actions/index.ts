export interface ActionArgs {
  [key: string]: any;
}

export interface BaseAction {
  id: string;
  timestamp: Date;
  source: string;
  type: 'action';
  actionType: string;
  args: ActionArgs;
  thought?: string;
}

export interface CmdRunActionArgs {
  command: string;
  background?: boolean;
  keepPromptRunning?: boolean;
}

export interface FileReadActionArgs {
  path: string;
  start?: number;
  end?: number;
}

export interface FileWriteActionArgs {
  path: string;
  content: string;
  start?: number;
  end?: number;
}

export interface MessageActionArgs {
  content: string;
  wait_for_response?: boolean;
}

export interface BrowseInteractiveActionArgs {
  browser_id: string;
  url?: string;
  goal: string;
}

export function createCmdRunAction(args: CmdRunActionArgs, thought?: string): BaseAction {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'action',
    actionType: 'run',
    args,
    thought,
  };
}

export function createFileReadAction(args: FileReadActionArgs, thought?: string): BaseAction {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'action',
    actionType: 'read',
    args,
    thought,
  };
}

export function createFileWriteAction(args: FileWriteActionArgs, thought?: string): BaseAction {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'action',
    actionType: 'write',
    args,
    thought,
  };
}

export function createMessageAction(args: MessageActionArgs, thought?: string): BaseAction {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'action',
    actionType: 'message',
    args,
    thought,
  };
}

export function createBrowseInteractiveAction(args: BrowseInteractiveActionArgs, thought?: string): BaseAction {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'action',
    actionType: 'browse_interactive',
    args,
    thought,
  };
}
