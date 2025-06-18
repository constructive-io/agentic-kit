import { 
  logger, 
  Action, 
  Observation,
} from '@agentic-kit/core';
import { Runtime } from './index';
import { execa } from 'execa';

export interface DockerRuntimeConfig {
  image: string;
  workingDir: string;
  timeout: number;
  maxBuffer: number;
  volumes?: Record<string, string>;
  environment?: Record<string, string>;
}

export class DockerRuntime implements Runtime {
  public readonly name = 'DockerRuntime';
  private containerId?: string;
  private config: DockerRuntimeConfig;
  private commandCounter = 0;

  constructor(config: Partial<DockerRuntimeConfig> = {}) {
    this.config = {
      image: 'ubuntu:22.04',
      workingDir: '/workspace',
      timeout: 30000,
      maxBuffer: 1024 * 1024,
      ...config,
    };
    logger.info(`Initialized ${this.name} with image: ${this.config.image}`);
  }

  private async ensureContainer(): Promise<void> {
    if (this.containerId) {
      return;
    }

    try {
      const volumeArgs = Object.entries(this.config.volumes || {})
        .flatMap(([host, container]) => ['-v', `${host}:${container}`]);
      
      const envArgs = Object.entries(this.config.environment || {})
        .flatMap(([key, value]) => ['-e', `${key}=${value}`]);

      const result = await execa('docker', [
        'run',
        '-d',
        '-i',
        '--rm',
        '-w', this.config.workingDir,
        ...volumeArgs,
        ...envArgs,
        this.config.image,
        'sleep', 'infinity'
      ], {
        timeout: this.config.timeout,
      });

      this.containerId = result.stdout.trim();
      logger.info(`Created container: ${this.containerId}`);
    } catch (error) {
      logger.error(`Failed to create container: ${error}`);
      throw error;
    }
  }

  private async executeInContainer(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    await this.ensureContainer();
    
    try {
      const result = await execa('docker', [
        'exec',
        '-i',
        this.containerId!,
        'bash',
        '-c',
        command
      ], {
        timeout: this.config.timeout,
        maxBuffer: this.config.maxBuffer,
        reject: false,
      });

      return {
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        exitCode: result.exitCode || 0,
      };
    } catch (error) {
      logger.error(`Container command execution failed: ${error}`);
      throw error;
    }
  }

  private async executeCmdRun(action: Action): Promise<Observation> {
    const { command } = action.args;
    this.commandCounter++;
    
    try {
      const result = await this.executeInContainer(command);
      const content = result.stdout || result.stderr || '';
      
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'run',
        content,
        extras: {
          command_id: this.commandCounter,
          command,
          exit_code: result.exitCode,
        },
      };
    } catch (error) {
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Docker command execution failed: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'DOCKER_EXEC_ERROR' },
      };
    }
  }

  private async executeFileRead(action: Action): Promise<Observation> {
    const { path, start, end } = action.args;
    
    try {
      const command = start !== undefined || end !== undefined
        ? `sed -n '${start || 1},${end || '$'}p' "${path}"`
        : `cat "${path}"`;
      
      const result = await this.executeInContainer(command);
      
      if (result.exitCode !== 0) {
        return {
          id: '',
          timestamp: new Date(),
          source: '',
          type: 'observation',
          observationType: 'error',
          content: `Failed to read file ${path}: ${result.stderr}`,
          extras: { error_code: 'FILE_READ_ERROR' },
        };
      }
      
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'read',
        content: result.stdout,
        extras: { path },
      };
    } catch (error) {
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Docker file read failed: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'DOCKER_FILE_ERROR' },
      };
    }
  }

  private async executeFileWrite(action: Action): Promise<Observation> {
    const { path, content } = action.args;
    
    try {
      const escapedContent = content.replace(/'/g, "'\"'\"'");
      const command = `mkdir -p "$(dirname "${path}")" && echo '${escapedContent}' > "${path}"`;
      
      const result = await this.executeInContainer(command);
      
      if (result.exitCode !== 0) {
        return {
          id: '',
          timestamp: new Date(),
          source: '',
          type: 'observation',
          observationType: 'error',
          content: `Failed to write file ${path}: ${result.stderr}`,
          extras: { error_code: 'FILE_WRITE_ERROR' },
        };
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
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Docker file write failed: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'DOCKER_FILE_ERROR' },
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
    if (this.containerId) {
      try {
        await execa('docker', ['stop', this.containerId], { timeout: 10000 });
        logger.info(`Stopped container: ${this.containerId}`);
      } catch (error) {
        logger.warn(`Failed to stop container ${this.containerId}:`, error);
      }
      this.containerId = undefined;
    }
    logger.info(`${this.name} cleanup completed`);
  }
}
