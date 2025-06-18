import { promises as fs } from 'fs';
import { logger } from '@agentic-kit/core';

export class SearchTool {
  constructor() {
    logger.info('Initialized SearchTool');
  }

  async searchInFile(filePath: string, pattern: string | RegExp): Promise<SearchResult[]> {
    logger.debug(`Searching in file: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const results: SearchResult[] = [];

      lines.forEach((line, index) => {
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        const matches = line.match(regex);
        
        if (matches) {
          results.push({
            file: filePath,
            line: index + 1,
            content: line.trim(),
            matches: matches,
          });
        }
      });

      return results;
    } catch (error) {
      logger.error(`Failed to search in file ${filePath}:`, error);
      throw error;
    }
  }

  async searchInDirectory(dirPath: string, pattern: string | RegExp, extensions: string[] = ['.ts', '.js', '.json']): Promise<SearchResult[]> {
    logger.debug(`Searching in directory: ${dirPath}`);
    
    const results: SearchResult[] = [];
    
    try {
      const files = await this.getFilesRecursively(dirPath, extensions);
      
      for (const file of files) {
        const fileResults = await this.searchInFile(file, pattern);
        results.push(...fileResults);
      }
      
      return results;
    } catch (error) {
      logger.error(`Failed to search in directory ${dirPath}:`, error);
      throw error;
    }
  }

  private async getFilesRecursively(dirPath: string, extensions: string[]): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          const subFiles = await this.getFilesRecursively(fullPath, extensions);
          files.push(...subFiles);
        } else if (entry.isFile() && extensions.some(ext => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      logger.error(`Failed to read directory ${dirPath}:`, error);
    }
    
    return files;
  }
}

export interface SearchResult {
  file: string;
  line: number;
  content: string;
  matches: string[];
}
