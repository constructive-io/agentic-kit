import { AgenticKitServer } from '../src';

describe('AgenticKit Server', () => {
  it('should create server instance', () => {
    const server = new AgenticKitServer(3001);
    expect(server).toBeDefined();
  });

  it('should start and stop server', async () => {
    const server = new AgenticKitServer(3002);
    
    await server.start();
    await server.stop();
  }, 10000);
});
