import { GitTool, FileSystemTool, SearchTool, TextTool } from '../src';

describe('AgenticKit Tools', () => {
  describe('GitTool', () => {
    let tool: GitTool;

    beforeEach(() => {
      tool = new GitTool();
    });

    it('should create GitTool', () => {
      expect(tool).toBeDefined();
    });

    it('should get repository status', async () => {
      const status = await tool.status();
      expect(status).toBeDefined();
      expect(typeof status.current).toBe('string');
      expect(Array.isArray(status.files)).toBe(true);
    });

    it('should get commit history', async () => {
      const history = await tool.log({ maxCount: 5 });
      expect(history).toBeDefined();
      expect(Array.isArray(history.all)).toBe(true);
      expect(history.all.length).toBeLessThanOrEqual(5);
    });

    it('should get diff for changes', async () => {
      const diff = await tool.diff();
      expect(typeof diff).toBe('string');
    });
  });

  describe('FileSystemTool', () => {
    let tool: FileSystemTool;

    beforeEach(() => {
      tool = new FileSystemTool();
    });

    it('should create FileSystemTool', () => {
      expect(tool).toBeDefined();
    });

    it('should read file contents', async () => {
      const content = await tool.readFile('package.json');
      expect(typeof content).toBe('string');
      expect(content).toContain('"name"');
    });

    it('should write and read files', async () => {
      const testContent = 'Hello, World!';
      const testPath = '/tmp/test-file.txt';
      
      await tool.writeFile(testPath, testContent);
      const readContent = await tool.readFile(testPath);
      
      expect(readContent).toBe(testContent);
    });

    it('should list directory contents', async () => {
      const files = await tool.readDirectory('.');
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThan(0);
    });

    it('should check if file exists', async () => {
      const exists = await tool.exists('package.json');
      expect(exists).toBe(true);
      
      const notExists = await tool.exists('nonexistent-file.txt');
      expect(notExists).toBe(false);
    });
  });

  describe('SearchTool', () => {
    let tool: SearchTool;

    beforeEach(() => {
      tool = new SearchTool();
    });

    it('should create SearchTool', () => {
      expect(tool).toBeDefined();
    });

    it('should search in files', async () => {
      const testFile = '/tmp/search-test.txt';
      const content = 'This is a test document with some sample text for searching.';
      
      const fs = require('fs').promises;
      await fs.writeFile(testFile, content);
      
      const results = await tool.searchInFile(testFile, 'test document');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('test document');
      expect(results[0].file).toBe(testFile);
      expect(results[0].line).toBe(1);
    });

    it('should search with regex patterns in files', async () => {
      const testFile = '/tmp/regex-test.txt';
      const content = 'Email: user@example.com, Phone: 123-456-7890';
      
      const fs = require('fs').promises;
      await fs.writeFile(testFile, content);
      
      const pattern = /\b\d{3}-\d{3}-\d{4}\b/;
      const results = await tool.searchInFile(testFile, pattern);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('123-456-7890');
    });

    it('should search in directories', async () => {
      const results = await tool.searchInDirectory('.', 'package', ['.json']);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.some(r => r.file.includes('package.json'))).toBe(true);
    });

    it('should handle non-existent files gracefully', async () => {
      await expect(tool.searchInFile('/tmp/nonexistent.txt', 'test')).rejects.toThrow();
    });
  });

  describe('TextTool', () => {
    let tool: TextTool;

    beforeEach(() => {
      tool = new TextTool();
    });

    it('should create TextTool', () => {
      expect(tool).toBeDefined();
    });

    it('should extract code blocks', () => {
      const text = '```typescript\nconst x = 1;\n```';
      const blocks = tool.extractCodeBlocks(text);
      
      expect(blocks).toHaveLength(1);
      expect(blocks[0].language).toBe('typescript');
      expect(blocks[0].code).toBe('const x = 1;');
    });

    it('should extract URLs from text', () => {
      const text = 'Visit https://example.com and http://test.org for more info.';
      
      const urls = tool.extractUrls(text);
      
      expect(Array.isArray(urls)).toBe(true);
      expect(urls).toContain('https://example.com');
      expect(urls).toContain('http://test.org');
    });

    it('should extract emails from text', () => {
      const text = 'Contact us at support@example.com or admin@test.org';
      
      const emails = tool.extractEmails(text);
      
      expect(Array.isArray(emails)).toBe(true);
      expect(emails).toContain('support@example.com');
      expect(emails).toContain('admin@test.org');
    });

    it('should split text into chunks', () => {
      const longText = 'This is a very long text that needs to be split into smaller chunks for processing. '.repeat(20);
      
      const chunks = tool.splitIntoChunks(longText, 100, 20);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].length).toBeLessThanOrEqual(100);
    });

    it('should count tokens in text', () => {
      const text = 'Hello world! This is a test.';
      
      const tokenCount = tool.countTokens(text);
      
      expect(typeof tokenCount).toBe('number');
      expect(tokenCount).toBeGreaterThan(0);
    });

    it('should truncate text to token limit', () => {
      const longText = 'This is a very long text that needs to be truncated. '.repeat(50);
      
      const truncated = tool.truncateToTokenLimit(longText, 10);
      
      expect(truncated.length).toBeLessThan(longText.length);
      expect(truncated.endsWith('...')).toBe(true);
    });

    it('should handle short text without truncation', () => {
      const shortText = 'Short text.';
      
      const result = tool.truncateToTokenLimit(shortText, 100);
      
      expect(result).toBe(shortText);
    });
  });

  describe('Tool Integration', () => {
    it('should work together for complex text processing', async () => {
      const searchTool = new SearchTool();
      const textTool = new TextTool();
      


      const testFile = '/tmp/integration-test.txt';
      const document = 'This paper discusses machine learning algorithms and their applications. Visit https://example.com for more info.';

      const fs = require('fs').promises;
      await fs.writeFile(testFile, document);
      
      const searchResults = await searchTool.searchInFile(testFile, 'machine learning');
      
      const urls = textTool.extractUrls(document);
      
      const tokenCount = textTool.countTokens(document);

      expect(searchResults.length).toBeGreaterThan(0);
      expect(urls.length).toBeGreaterThan(0);
      expect(tokenCount).toBeGreaterThan(0);
    });
  });
});
