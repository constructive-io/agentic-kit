import { GitTool, FileSystemTool, SearchTool, TextTool } from '../src';

describe('AgenticKit Tools', () => {
  it('should create GitTool', () => {
    const tool = new GitTool();
    expect(tool).toBeDefined();
  });

  it('should create FileSystemTool', () => {
    const tool = new FileSystemTool();
    expect(tool).toBeDefined();
  });

  it('should create SearchTool', () => {
    const tool = new SearchTool();
    expect(tool).toBeDefined();
  });

  it('should create TextTool', () => {
    const tool = new TextTool();
    expect(tool).toBeDefined();
  });

  it('should extract code blocks', () => {
    const tool = new TextTool();
    const text = '```typescript\nconst x = 1;\n```';
    const blocks = tool.extractCodeBlocks(text);
    
    expect(blocks).toHaveLength(1);
    expect(blocks[0].language).toBe('typescript');
    expect(blocks[0].code).toBe('const x = 1;');
  });
});
