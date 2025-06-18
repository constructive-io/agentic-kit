import { chromium, Browser, Page } from 'playwright';
import { logger } from '@agentic-kit/core';
import { Runtime, RuntimeResult } from './index';

export class BrowserRuntime implements Runtime {
  public readonly name = 'BrowserRuntime';
  private browser?: Browser;
  private page?: Page;

  constructor() {
    logger.info(`Initialized ${this.name}`);
  }

  async execute(command: string): Promise<RuntimeResult> {
    logger.debug(`Browser executing: ${command}`);
    
    try {
      if (!this.browser) {
        this.browser = await chromium.launch({ headless: true });
        this.page = await this.browser.newPage();
      }

      if (command.startsWith('goto:')) {
        const url = command.replace('goto:', '').trim();
        await this.page!.goto(url);
        const title = await this.page!.title();
        return {
          stdout: `Navigated to ${url}, title: ${title}`,
          stderr: '',
          exitCode: 0,
          timestamp: new Date(),
        };
      }

      if (command.startsWith('screenshot')) {
        const screenshot = await this.page!.screenshot();
        return {
          stdout: `Screenshot taken, size: ${screenshot.length} bytes`,
          stderr: '',
          exitCode: 0,
          timestamp: new Date(),
        };
      }

      return {
        stdout: '',
        stderr: `Unknown browser command: ${command}`,
        exitCode: 1,
        timestamp: new Date(),
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        timestamp: new Date(),
      };
    }
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
      this.page = undefined;
    }
    logger.info(`${this.name} cleanup completed`);
  }
}
