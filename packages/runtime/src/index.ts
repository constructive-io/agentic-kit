import { execa } from 'execa';
import { chromium, Browser, Page } from 'playwright';
import { logger } from '@agentic-kit/core';

export interface Runtime {
  name: string;
  execute(command: string): Promise<RuntimeResult>;
  cleanup(): Promise<void>;
}

export interface RuntimeResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timestamp: Date;
}

export class LocalRuntime implements Runtime {
  public readonly name = 'LocalRuntime';
  private workingDir: string;

  constructor(workingDir: string = process.cwd()) {
    this.workingDir = workingDir;
    logger.info(`Initialized ${this.name} in ${workingDir}`);
  }

  async execute(command: string): Promise<RuntimeResult> {
    logger.debug(`Executing: ${command}`);
    
    try {
      const result = await execa('bash', ['-c', command], {
        cwd: this.workingDir,
        timeout: 30000,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode || 0,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.exitCode || 1,
        timestamp: new Date(),
      };
    }
  }

  async cleanup(): Promise<void> {
    logger.info(`${this.name} cleanup completed`);
  }
}

export * from './browser-runtime';
export * from './docker-runtime';
