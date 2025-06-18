import { logger } from '@agentic-kit/core';

export class TextTool {
  constructor() {
    logger.info('Initialized TextTool');
  }

  extractCodeBlocks(text: string, language?: string): CodeBlock[] {
    logger.debug('Extracting code blocks from text');
    
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      const blockLanguage = match[1] || 'text';
      const code = match[2].trim();
      
      if (!language || blockLanguage === language) {
        blocks.push({
          language: blockLanguage,
          code: code,
          startIndex: match.index,
          endIndex: match.index + match[0].length,
        });
      }
    }

    return blocks;
  }

  extractUrls(text: string): string[] {
    logger.debug('Extracting URLs from text');
    
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
    const matches = text.match(urlRegex);
    
    return matches || [];
  }

  extractEmails(text: string): string[] {
    logger.debug('Extracting emails from text');
    
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex);
    
    return matches || [];
  }

  splitIntoChunks(text: string, maxChunkSize: number = 1000, overlap: number = 100): string[] {
    logger.debug(`Splitting text into chunks (max: ${maxChunkSize}, overlap: ${overlap})`);
    
    if (text.length <= maxChunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;
      
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) {
          end = lastSpace;
        }
      }

      chunks.push(text.slice(start, end));
      start = end - overlap;
    }

    return chunks;
  }

  countTokens(text: string): number {
    const words = text.split(/\s+/).filter(word => word.length > 0);
    return Math.ceil(words.length * 1.3);
  }

  truncateToTokenLimit(text: string, maxTokens: number): string {
    const estimatedTokens = this.countTokens(text);
    
    if (estimatedTokens <= maxTokens) {
      return text;
    }

    const ratio = maxTokens / estimatedTokens;
    const targetLength = Math.floor(text.length * ratio);
    
    return text.slice(0, targetLength) + '...';
  }
}

export interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}
