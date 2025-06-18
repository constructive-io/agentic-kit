import { 
  logger, 
  Action, 
  Observation,
} from '@agentic-kit/core';
import { execa } from 'execa';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

export interface Runtime {
  name: string;
  execute(action: Action): Promise<Observation>;
  cleanup(): Promise<void>;
}

export interface RuntimeConfig {
  workingDir: string;
  timeout: number;
  maxBuffer: number;
  allowedCommands?: string[];
  blockedCommands?: string[];
}

export class LocalRuntime implements Runtime {
  public readonly name = 'LocalRuntime';
  private config: RuntimeConfig;
  private commandCounter = 0;

  constructor(config: Partial<RuntimeConfig> = {}) {
    this.config = {
      workingDir: process.cwd(),
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      blockedCommands: ['rm -rf /', 'sudo rm -rf', 'format', 'fdisk'],
      ...config,
    };
    logger.info(`Initialized ${this.name} with working dir: ${this.config.workingDir}`);
  }

  private validateCommand(command: string): void {
    if (this.config.blockedCommands) {
      for (const blocked of this.config.blockedCommands) {
        if (command.includes(blocked)) {
          throw new Error(`Blocked command detected: ${blocked}`);
        }
      }
    }

    if (this.config.allowedCommands && this.config.allowedCommands.length > 0) {
      const isAllowed = this.config.allowedCommands.some(allowed => 
        command.startsWith(allowed)
      );
      if (!isAllowed) {
        throw new Error(`Command not in allowed list: ${command}`);
      }
    }
  }

  private async executeCmdRun(action: Action): Promise<Observation> {
    const { command, background } = action.args;
    this.commandCounter++;
    
    try {
      this.validateCommand(command);
      
      logger.debug(`Executing command: ${command}`);
      
      const result = await execa('bash', ['-c', command], {
        cwd: this.config.workingDir,
        timeout: this.config.timeout,
        maxBuffer: this.config.maxBuffer,
        reject: false,
      });

      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'run',
        content: result.stdout || result.stderr || '',
        extras: {
          command_id: this.commandCounter,
          command,
          exit_code: result.exitCode || 0,
        },
      };
    } catch (error) {
      logger.error(`Command execution failed: ${error}`);
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'EXEC_ERROR' },
      };
    }
  }

  private async executeFileRead(action: Action): Promise<Observation> {
    const { path, start, end } = action.args;
    
    try {
      const fullPath = join(this.config.workingDir, path);
      const content = await fs.readFile(fullPath, 'utf-8');
      
      let result = content;
      if (start !== undefined || end !== undefined) {
        const lines = content.split('\n');
        const startLine = start || 0;
        const endLine = end || lines.length;
        result = lines.slice(startLine, endLine).join('\n');
      }
      
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'read',
        content: result,
        extras: { path },
      };
    } catch (error) {
      logger.error(`File read failed: ${error}`);
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Failed to read file ${path}: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'FILE_READ_ERROR' },
      };
    }
  }

  private async executeFileWrite(action: Action): Promise<Observation> {
    const { path, content, start, end } = action.args;
    
    try {
      const fullPath = join(this.config.workingDir, path);
      
      await fs.mkdir(dirname(fullPath), { recursive: true });
      
      if (start !== undefined || end !== undefined) {
        const existingContent = await fs.readFile(fullPath, 'utf-8').catch(() => '');
        const lines = existingContent.split('\n');
        const startLine = start || 0;
        const endLine = end || lines.length;
        
        lines.splice(startLine, endLine - startLine, ...content.split('\n'));
        await fs.writeFile(fullPath, lines.join('\n'), 'utf-8');
      } else {
        await fs.writeFile(fullPath, content, 'utf-8');
      }
      
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'read',
        content: `File ${path} written successfully`,
        extras: { path },
      };
    } catch (error) {
      logger.error(`File write failed: ${error}`);
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Failed to write file ${path}: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'FILE_WRITE_ERROR' },
      };
    }
  }

  async execute(action: Action): Promise<Observation> {
    logger.debug(`${this.name} executing action: ${action.actionType}`);
    
    switch (action.actionType) {
      case 'run':
        return this.executeCmdRun(action);
      case 'read':
        return this.executeFileRead(action);
      case 'write':
        return this.executeFileWrite(action);
      default:
        return {
          id: '',
          timestamp: new Date(),
          source: '',
          type: 'observation',
          observationType: 'error',
          content: `Unsupported action type: ${action.actionType}`,
          extras: { error_code: 'UNSUPPORTED_ACTION' },
        };
    }
  }

  async cleanup(): Promise<void> {
    logger.info(`${this.name} cleanup completed`);
  }
}

export * from './browser-runtime';
export * from './docker-runtime';
