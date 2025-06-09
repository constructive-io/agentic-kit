import fetch from 'cross-fetch';

export type BradieState = 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';

export type Command =
  | 'read_file'
  | 'modify_file'
  | 'create_file'
  | 'search_file'
  | 'chat'
  | 'analyze'
  | 'delete_file'
  | 'run_code';

export interface AgentCommandLog {
  command: Command;
  error: string | null;
  parameters?: Record<string, any>;
  message?: string;
  result?: any;
}

export type ActionLog =
  | { type: 'assistant'; content: string }
  | { type: 'system'; content: string }
  | { type: 'error'; content: string }
  | { type: 'complete'; content?: string };

interface InstanceIdResponse { instanceId: string; }
interface InitResponse { sessionId: string; projectId: string; }
interface ActResponse {
  act_json: AgentCommandLog[];
  status: BradieState;
  error?: string;
}

export class Bradie {
  private domain: string;
  private onSystemMessage: (msg: string) => void;
  private onAssistantReply: (msg: string) => void;
  private onError?: (err: Error) => void;
  private onComplete?: () => void;
  private state: BradieState = 'idle';
  private sessionId?: string;
  private projectId?: string;
  private seenLogs: Set<string> = new Set();

  constructor(config: {
    domain: string;
    onSystemMessage: (msg: string) => void;
    onAssistantReply: (msg: string) => void;
    onError?: (err: Error) => void;
    onComplete?: () => void;
  }) {
    this.domain = config.domain;
    this.onSystemMessage = config.onSystemMessage;
    this.onAssistantReply = config.onAssistantReply;
    this.onError = config.onError;
    this.onComplete = config.onComplete;
  }

  public getState(): BradieState {
    return this.state;
  }

  public async initProject(
    projectName: string,
    projectPath: string
  ): Promise<{ sessionId: string; projectId: string }> {
    const res1 = await fetch(`${this.domain}/api/instance-id`);
    if (!res1.ok) throw new Error(`Failed to get instance ID: ${res1.statusText}`);
    const { instanceId }: InstanceIdResponse = await res1.json();

    const res2 = await fetch(`${this.domain}/api/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, projectName, projectPath }),
    });
    if (!res2.ok) throw new Error(`Failed to init project: ${res2.statusText}`);
    const { sessionId, projectId }: InitResponse = await res2.json();
    this.sessionId = sessionId;
    this.projectId = projectId;
    return { sessionId, projectId };
  }

  public async sendMessage(message: string): Promise<string> {
    if (!this.sessionId) throw new Error('Project not initialized');
    this.state = 'thinking';
    const res = await fetch(`${this.domain}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: this.sessionId, message }),
    });
    if (!res.ok) throw new Error(`Failed to send message: ${res.statusText}`);
    const data: { requestId: string; message: string; image?: string } = await res.json();
    return data.requestId;
  }

  public async subscribeToResponse(
    requestId: string,
    opts?: { pollInterval?: number; maxPolls?: number }
  ): Promise<void> {
    if (!this.sessionId) throw new Error('Project not initialized');
    const interval = opts?.pollInterval ?? 1000;
    const maxPolls = opts?.maxPolls ?? Infinity;
    let polls = 0;

    return new Promise<void>((resolve, reject) => {
      const poll = async () => {
        try {
          const res = await fetch(
            `${this.domain}/api/act?sessionId=${this.sessionId}&requestId=${requestId}`
          );
          if (!res.ok) {
            let details: string;
            try {
              details = await res.text();
            } catch {
              details = 'No response body';
            }
            throw new Error(`Poll failed: ${res.status} ${res.statusText} - ${details}`);
          }
          const data: ActResponse = await res.json();
          this.state = data.status;

          for (const log of data.act_json) {
            const key = JSON.stringify(log);
            if (!this.seenLogs.has(key)) {
              this.seenLogs.add(key);
              if (log.error) {
                this.state = 'error';
                this.onError?.(new Error(log.error));
                return reject(new Error(log.error));
              } else if (log.command === 'chat') {
                const content = log.parameters?.message || log.message || '';
                this.onAssistantReply(content);
              } else {
                this.onSystemMessage(
                  `✅ ${log.command}: ${log.message ?? JSON.stringify(log.result)}`
                );
              }
            }
          }

          if (data.status === 'complete') {
            this.state = 'complete';
            this.onComplete?.();
            return resolve();
          } else if (data.status === 'error') {
            this.state = 'error';
            this.onError?.(new Error(data.error || 'Unknown error'));
            return reject(new Error(data.error));
          }

          polls++;
          if (polls >= maxPolls) {
            return reject(new Error('Max polls exceeded'));
          }
          setTimeout(poll, interval);
        } catch (err: any) {
          this.state = 'error';
          this.onError?.(err);
          return reject(err);
        }
      };
      poll();
    });
  }

  public async fetchOnce(requestId: string): Promise<AgentCommandLog[]> {
    if (!this.sessionId) throw new Error('Project not initialized');
    const res = await fetch(
      `${this.domain}/api/act?sessionId=${this.sessionId}&requestId=${requestId}`
    );
    if (!res.ok) throw new Error(`Failed to fetch logs: ${res.statusText}`);
    const data: ActResponse = await res.json();
    return data.act_json;
  }
}