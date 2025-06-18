import { simpleGit, SimpleGit } from 'simple-git';
import { promises as fs } from 'fs';
import { logger } from '@agentic-kit/core';

export class GitTool {
  private git: SimpleGit;
  private repoPath: string;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
    this.git = simpleGit(repoPath);
    logger.info(`Initialized GitTool for repository: ${repoPath}`);
  }

  async status(): Promise<any> {
    logger.debug('Getting git status');
    return await this.git.status();
  }

  async add(files: string[]): Promise<void> {
    logger.debug(`Adding files: ${files.join(', ')}`);
    await this.git.add(files);
  }

  async commit(message: string): Promise<void> {
    logger.debug(`Committing with message: ${message}`);
    await this.git.commit(message);
  }

  async push(remote: string = 'origin', branch?: string): Promise<void> {
    logger.debug(`Pushing to ${remote}${branch ? `:${branch}` : ''}`);
    await this.git.push(remote, branch);
  }

  async pull(remote: string = 'origin', branch?: string): Promise<void> {
    logger.debug(`Pulling from ${remote}${branch ? `:${branch}` : ''}`);
    await this.git.pull(remote, branch);
  }

  async createBranch(branchName: string): Promise<void> {
    logger.debug(`Creating branch: ${branchName}`);
    await this.git.checkoutLocalBranch(branchName);
  }

  async checkout(branchName: string): Promise<void> {
    logger.debug(`Checking out branch: ${branchName}`);
    await this.git.checkout(branchName);
  }

  async diff(options?: string[]): Promise<string> {
    logger.debug('Getting git diff');
    return await this.git.diff(options);
  }

  async log(options?: any): Promise<any> {
    logger.debug('Getting git log');
    return await this.git.log(options);
  }
}

export class FileSystemTool {
  constructor() {
    logger.info('Initialized FileSystemTool');
  }

  async readFile(path: string): Promise<string> {
    logger.debug(`Reading file: ${path}`);
    return await fs.readFile(path, 'utf-8');
  }

  async writeFile(path: string, content: string): Promise<void> {
    logger.debug(`Writing file: ${path}`);
    await fs.writeFile(path, content, 'utf-8');
  }

  async readDirectory(path: string): Promise<string[]> {
    logger.debug(`Reading directory: ${path}`);
    return await fs.readdir(path);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await fs.stat(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getStats(path: string): Promise<any> {
    logger.debug(`Getting stats for: ${path}`);
    return await fs.stat(path);
  }
}

export * from './search-tool';
export * from './text-tool';
