export interface ObservationExtras {
  [key: string]: any;
}

export interface BaseObservation {
  id: string;
  timestamp: Date;
  source: string;
  type: 'observation';
  observationType: string;
  content: string;
  extras?: ObservationExtras;
}

export interface CmdOutputObservationExtras extends ObservationExtras {
  command_id: number;
  command: string;
  exit_code: number;
}

export interface FileReadObservationExtras extends ObservationExtras {
  path: string;
}

export interface BrowserOutputObservationExtras extends ObservationExtras {
  url: string;
  screenshot?: string;
}

export interface ErrorObservationExtras extends ObservationExtras {
  error_code?: string;
}

export function createCmdOutputObservation(
  content: string,
  command: string,
  exit_code: number,
  command_id: number
): BaseObservation {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'observation',
    observationType: 'run',
    content,
    extras: {
      command_id,
      command,
      exit_code,
    },
  };
}

export function createFileReadObservation(content: string, path: string): BaseObservation {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'observation',
    observationType: 'read',
    content,
    extras: {
      path,
    },
  };
}

export function createBrowserOutputObservation(
  content: string,
  url: string,
  screenshot?: string
): BaseObservation {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'observation',
    observationType: 'browse',
    content,
    extras: {
      url,
      screenshot,
    },
  };
}

export function createErrorObservation(content: string, error_code?: string): BaseObservation {
  return {
    id: '',
    timestamp: new Date(),
    source: '',
    type: 'observation',
    observationType: 'error',
    content,
    extras: {
      error_code,
    },
  };
}
