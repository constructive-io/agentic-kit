import { 
  logger, 
  Action, 
  Observation,
} from '@agentic-kit/core';
import { Runtime } from './index';
import { chromium, Browser, Page } from 'playwright';

export interface BrowserRuntimeConfig {
  headless: boolean;
  timeout: number;
  viewport: { width: number; height: number };
}

export class BrowserRuntime implements Runtime {
  public readonly name = 'BrowserRuntime';
  private browser?: Browser;
  private pages: Map<string, Page> = new Map();
  private config: BrowserRuntimeConfig;

  constructor(config: Partial<BrowserRuntimeConfig> = {}) {
    this.config = {
      headless: true,
      timeout: 30000,
      viewport: { width: 1280, height: 720 },
      ...config,
    };
    logger.info(`Initialized ${this.name}`);
  }

  private async ensureBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({ 
        headless: this.config.headless,
        timeout: this.config.timeout,
      });
    }
  }

  private async getOrCreatePage(browserId: string): Promise<Page> {
    await this.ensureBrowser();
    
    if (!this.pages.has(browserId)) {
      const page = await this.browser!.newPage();
      await page.setViewportSize(this.config.viewport);
      this.pages.set(browserId, page);
    }
    
    return this.pages.get(browserId)!;
  }

  private async executeBrowseInteractive(action: Action): Promise<Observation> {
    const { browser_id, url, goal } = action.args;
    
    try {
      const page = await this.getOrCreatePage(browser_id);
      
      if (url) {
        await page.goto(url, { waitUntil: 'networkidle' });
      }
      
      const currentUrl = page.url();
      const title = await page.title();
      const screenshot = await page.screenshot({ type: 'png' });
      const screenshotBase64 = screenshot.toString('base64');
      
      const content = `Page loaded: ${title}\nURL: ${currentUrl}\nGoal: ${goal}`;
      
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'browse',
        content,
        extras: {
          url: currentUrl,
          screenshot: screenshotBase64,
        },
      };
    } catch (error) {
      logger.error(`Browser interaction failed: ${error}`);
      return {
        id: '',
        timestamp: new Date(),
        source: '',
        type: 'observation',
        observationType: 'error',
        content: `Browser interaction failed: ${error instanceof Error ? error.message : String(error)}`,
        extras: { error_code: 'BROWSER_ERROR' },
      };
    }
  }

  async execute(action: Action): Promise<Observation> {
    logger.debug(`${this.name} executing action: ${action.actionType}`);
    
    switch (action.actionType) {
      case 'browse_interactive':
        return this.executeBrowseInteractive(action);
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
    for (const [browserId, page] of this.pages) {
      try {
        await page.close();
      } catch (error) {
        logger.warn(`Failed to close page ${browserId}:`, error);
      }
    }
    this.pages.clear();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
    logger.info(`${this.name} cleanup completed`);
  }
}
