import { AgentConfigSchema, logger } from '../src';

describe('AgenticKit Core', () => {
  it('should validate agent configuration', () => {
    const validConfig = {
      name: 'TestAgent',
      maxIterations: 50,
      temperature: 0.5,
    };

    const result = AgentConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.data.name).toBe('TestAgent');
      expect(result.data.maxIterations).toBe(50);
      expect(result.data.temperature).toBe(0.5);
    }
  });

  it('should create logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
  });
});
