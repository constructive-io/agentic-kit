import { execa } from 'execa';
import { logger } from '@agentic-kit/core';
import { Runtime, RuntimeResult } from './index';

export class DockerRuntime implements Runtime {
  public readonly name = 'DockerRuntime';
  private containerId?: string;
  private image: string;

  constructor(image: string = 'ubuntu:latest') {
    this.image = image;
    logger.info(`Initialized ${this.name} with image ${image}`);
  }

  async execute(command: string): Promise<RuntimeResult> {
    logger.debug(`Docker executing: ${command}`);
    
    try {
      if (!this.containerId) {
        const result = await execa('docker', ['run', '-d', '-i', this.image, 'bash']);
        this.containerId = result.stdout.trim();
        logger.debug(`Started container: ${this.containerId}`);
      }

      const result = await execa('docker', ['exec', this.containerId, 'bash', '-c', command], {
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
    if (this.containerId) {
      try {
        await execa('docker', ['stop', this.containerId]);
        await execa('docker', ['rm', this.containerId]);
        logger.debug(`Cleaned up container: ${this.containerId}`);
      } catch (error) {
        logger.error(`Failed to cleanup container: ${error}`);
      }
      this.containerId = undefined;
    }
    logger.info(`${this.name} cleanup completed`);
  }
}
