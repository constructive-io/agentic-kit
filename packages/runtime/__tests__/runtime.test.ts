import { LocalRuntime, BrowserRuntime, DockerRuntime } from '../src';

describe('AgenticKit Runtime', () => {
  it('should create LocalRuntime', () => {
    const runtime = new LocalRuntime();
    expect(runtime.name).toBe('LocalRuntime');
  });

  it('should create BrowserRuntime', () => {
    const runtime = new BrowserRuntime();
    expect(runtime.name).toBe('BrowserRuntime');
  });

  it('should create DockerRuntime', () => {
    const runtime = new DockerRuntime();
    expect(runtime.name).toBe('DockerRuntime');
  });

  it('should execute command in LocalRuntime', async () => {
    const runtime = new LocalRuntime();
    const result = await runtime.execute('echo "test"');
    
    expect(result.stdout).toContain('test');
    expect(result.exitCode).toBe(0);
    expect(result.timestamp).toBeInstanceOf(Date);
  });
});
