import { LocalRuntime, BrowserRuntime, DockerRuntime } from '../src';
import { CmdRunAction, CmdOutputObservation } from '@agentic-kit/core';

describe('AgenticKit Runtime', () => {
  describe('LocalRuntime', () => {
    let runtime: LocalRuntime;

    beforeEach(() => {
      runtime = new LocalRuntime({ workingDir: '/tmp' });
    });

    it('should create LocalRuntime with working directory', () => {
      expect(runtime).toBeDefined();
      expect(runtime.name).toBe('LocalRuntime');
    });

    it('should execute simple commands successfully', async () => {
      const action: CmdRunAction = {
        id: 'test_cmd',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'echo "Hello, World!"' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('run');
      expect(result.extras?.exit_code).toBe(0);
      expect(result.content).toContain('Hello, World!');
      expect(result.extras?.command).toBe('echo "Hello, World!"');
    });

    it('should handle command failures', async () => {
      const action: CmdRunAction = {
        id: 'test_cmd_fail',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'nonexistent-command' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('error');
      expect(result.content).toContain('Command execution failed');
    });

    it('should validate commands for security', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm -rf',
        'format',
        'fdisk'
      ];

      dangerousCommands.forEach(cmd => {
        expect(() => (runtime as any).validateCommand(cmd)).toThrow();
      });
    });

    it('should allow safe commands', () => {
      const safeCommands = [
        'ls -la',
        'echo "test"',
        'cat file.txt',
        'grep "pattern" file.txt',
        'find . -name "*.js"'
      ];

      safeCommands.forEach(cmd => {
        expect(() => (runtime as any).validateCommand(cmd)).not.toThrow();
      });
    });

    it('should handle timeout for long-running commands', async () => {
      const runtime = new LocalRuntime({ workingDir: '/tmp', timeout: 1000 });
      
      const action: CmdRunAction = {
        id: 'test_timeout',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'sleep 5' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('error');
      expect(result.content).toContain('timeout');
    });

    it('should cleanup resources', async () => {
      await expect(runtime.cleanup()).resolves.not.toThrow();
    });

    it('should execute file read actions', async () => {
      const action = {
        id: 'test_read',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'read',
        args: { path: 'package.json' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('read');
      expect(result.content).toBeDefined();
      expect(result.extras?.path).toBe('package.json');
    });

    it('should execute file write actions', async () => {
      const action = {
        id: 'test_write',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'write',
        args: { path: 'test-file.txt', content: 'Hello, Test!' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('read');
      expect(result.content).toContain('written successfully');
      expect(result.extras?.path).toBe('test-file.txt');
    });

    it('should handle unsupported action types', async () => {
      const action = {
        id: 'test_unsupported',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'unsupported',
        args: {}
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('error');
      expect(result.content).toContain('Unsupported action type');
    });
  });

  describe('BrowserRuntime', () => {
    let runtime: BrowserRuntime;

    beforeEach(() => {
      runtime = new BrowserRuntime();
    });

    it('should create BrowserRuntime', () => {
      expect(runtime).toBeDefined();
      expect(runtime.name).toBe('BrowserRuntime');
    });

    it('should execute browse_interactive actions', async () => {
      const action = {
        id: 'test_browse',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'browse_interactive',
        args: {
          browser_id: 'test_browser',
          url: 'https://example.com',
          goal: 'Test browser interaction'
        }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('browse');
      expect(result.content).toContain('Page loaded');
      expect(result.extras?.url).toBe('https://example.com');
      expect(result.extras?.screenshot).toBeDefined();
    });

    it('should handle unsupported action types', async () => {
      const action = {
        id: 'test_unsupported',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'unsupported',
        args: {}
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('error');
      expect(result.content).toContain('Unsupported action type');
    });

    it('should cleanup browser resources', async () => {
      await expect(runtime.cleanup()).resolves.not.toThrow();
    });
  });

  describe('DockerRuntime', () => {
    let runtime: DockerRuntime;

    beforeEach(() => {
      runtime = new DockerRuntime({ image: 'node:18-alpine' });
    });

    it('should create DockerRuntime with image', () => {
      expect(runtime).toBeDefined();
      expect(runtime.name).toBe('DockerRuntime');
    });

    it('should execute commands in container', async () => {
      const action: CmdRunAction = {
        id: 'docker_cmd',
        timestamp: new Date(),
        source: 'test',
        type: 'action',
        actionType: 'run',
        args: { command: 'echo "Hello from Docker!"' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('run');
      expect(result.extras?.exit_code).toBe(0);
      expect(result.content).toContain('Hello from Docker!');
    });

    it('should execute file read actions', async () => {
      const action = {
        id: 'docker_read',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'read',
        args: { path: '/etc/hostname' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('read');
      expect(result.content).toBeDefined();
      expect(result.extras?.path).toBe('/etc/hostname');
    });

    it('should execute file write actions', async () => {
      const action = {
        id: 'docker_write',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'write',
        args: { path: '/tmp/test.txt', content: 'Hello, Docker!' }
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('read');
      expect(result.content).toContain('written successfully');
      expect(result.extras?.path).toBe('/tmp/test.txt');
    });

    it('should handle unsupported action types', async () => {
      const action = {
        id: 'docker_unsupported',
        timestamp: new Date(),
        source: 'test',
        type: 'action' as const,
        actionType: 'unsupported',
        args: {}
      };

      const result = await runtime.execute(action);
      
      expect(result.observationType).toBe('error');
      expect(result.content).toContain('Unsupported action type');
    });

    it('should cleanup container resources', async () => {
      await expect(runtime.cleanup()).resolves.not.toThrow();
    });
  });

  describe('Runtime Interface Compliance', () => {
    it('should implement consistent interface across all runtimes', () => {
      const localRuntime = new LocalRuntime({ workingDir: '/tmp' });
      const browserRuntime = new BrowserRuntime();
      const dockerRuntime = new DockerRuntime({ image: 'node:18' });

      expect(typeof localRuntime.execute).toBe('function');
      expect(typeof localRuntime.cleanup).toBe('function');
      
      expect(typeof browserRuntime.execute).toBe('function');
      expect(typeof browserRuntime.cleanup).toBe('function');
      
      expect(typeof dockerRuntime.execute).toBe('function');
      expect(typeof dockerRuntime.cleanup).toBe('function');
    });
  });
});
