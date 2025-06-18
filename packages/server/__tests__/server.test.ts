import { AgenticKitServer } from '../src';

class MockWebSocket {
  public readyState = 1; // OPEN
  public onmessage?: (event: { data: string }) => void;
  public onclose?: () => void;
  public onerror?: (error: Error) => void;

  send(data: string) {
  }

  close() {
    if (this.onclose) {
      this.onclose();
    }
  }
}

describe('AgenticKit Server', () => {
  describe('Server Creation', () => {
    it('should create server instance', () => {
      const server = new AgenticKitServer(3001);
      expect(server).toBeDefined();
    });

    it('should create server with different port', () => {
      const server = new AgenticKitServer(3002);
      expect(server).toBeDefined();
    });
  });

  describe('Server Lifecycle', () => {
    let server: AgenticKitServer;

    beforeEach(() => {
      server = new AgenticKitServer(3003);
    });

    afterEach(async () => {
      try {
        await server.stop();
      } catch (error) {
      }
    });

    it('should start and stop server', async () => {
      await server.start();
      await server.stop();
    }, 10000);

    it('should handle multiple start/stop cycles', async () => {
      await server.start();
      await server.stop();
      
      await server.start();
      await server.stop();
    }, 15000);
  });

  describe('Server API', () => {
    it('should have proper server instance', () => {
      const server = new AgenticKitServer(3004);
      expect(server).toBeDefined();
      expect(typeof server.start).toBe('function');
      expect(typeof server.stop).toBe('function');
    });

    it('should handle server configuration', () => {
      const server = new AgenticKitServer(3005);
      expect(server).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle server creation with invalid port', () => {
      expect(() => {
        new AgenticKitServer(-1); // Invalid port
      }).not.toThrow();
    });

    it('should handle server startup errors gracefully', async () => {
      const server1 = new AgenticKitServer(3009);
      const server2 = new AgenticKitServer(3009); // Same port
      
      try {
        await server1.start();
        await expect(server2.start()).rejects.toThrow();
      } finally {
        await server1.stop();
      }
    }, 10000);
  });
});
