import { OpenAIProvider, AnthropicProvider, OllamaProvider } from '../src';

jest.mock('undici', () => ({
  request: jest.fn()
}));

const mockRequest = require('undici').request as jest.MockedFunction<any>;

describe('AgenticKit LLM', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('OpenAIProvider', () => {
    let provider: OpenAIProvider;

    beforeEach(() => {
      provider = new OpenAIProvider('test-api-key');
    });

    it('should create OpenAI provider with correct name', () => {
      expect(provider.name).toBe('OpenAI');
    });

    it('should generate text response', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Hello, World!' } }]
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test prompt');
      
      expect(result).toBe('Hello, World!');
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle generation errors', async () => {
      mockRequest.mockRejectedValue(new Error('API Error'));

      await expect(provider.generate('Test prompt')).rejects.toThrow('API Error');
    });

    it('should support custom options', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Custom response' } }]
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generate('Test prompt', {
        model: 'gpt-4',
        temperature: 0.9,
        maxTokens: 500
      });

      const requestBody = JSON.parse(mockRequest.mock.calls[0][1].body);
      expect(requestBody.model).toBe('gpt-4');
      expect(requestBody.temperature).toBe(0.9);
      expect(requestBody.max_tokens).toBe(500);
    });

    it('should handle streaming responses', async () => {
      const receivedChunks: string[] = [];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":", "}}]}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"World"}}]}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"!"}}]}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true })
      };

      const mockResponse = {
        body: { getReader: () => mockReader }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generateStream('Test prompt', (chunk) => {
        receivedChunks.push(chunk);
      });

      expect(receivedChunks).toEqual(['Hello', ', ', 'World', '!']);
    });
  });

  describe('AnthropicProvider', () => {
    let provider: AnthropicProvider;

    beforeEach(() => {
      provider = new AnthropicProvider('test-api-key');
    });

    it('should create Anthropic provider with correct name', () => {
      expect(provider.name).toBe('Anthropic');
    });

    it('should generate text response', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            content: [{ text: 'Hello from Claude!' }]
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test prompt');
      
      expect(result).toBe('Hello from Claude!');
      expect(mockRequest).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          })
        })
      );
    });

    it('should handle custom model options', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            content: [{ text: 'Custom model response' }]
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generate('Test prompt', {
        model: 'claude-3-opus-20240229',
        temperature: 0.5,
        maxTokens: 1000
      });

      const requestBody = JSON.parse(mockRequest.mock.calls[0][1].body);
      expect(requestBody.model).toBe('claude-3-opus-20240229');
      expect(requestBody.temperature).toBe(0.5);
      expect(requestBody.max_tokens).toBe(1000);
    });

    it('should handle streaming responses', async () => {
      const receivedChunks: string[] = [];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":"Hello"}}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":" from"}}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"type":"content_block_delta","delta":{"text":" Claude!"}}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: [DONE]\n\n') })
          .mockResolvedValueOnce({ done: true })
      };

      const mockResponse = {
        body: { getReader: () => mockReader }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generateStream('Test prompt', (chunk) => {
        receivedChunks.push(chunk);
      });

      expect(receivedChunks).toEqual(['Hello', ' from', ' Claude!']);
    });
  });

  describe('OllamaProvider', () => {
    let provider: OllamaProvider;

    beforeEach(() => {
      provider = new OllamaProvider('http://localhost:11434');
    });

    it('should create Ollama provider with correct name', () => {
      expect(provider.name).toBe('Ollama');
    });

    it('should generate text response', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            response: 'Hello from Ollama!'
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      const result = await provider.generate('Test prompt');
      
      expect(result).toBe('Hello from Ollama!');
      expect(mockRequest).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should use custom model and options', async () => {
      const mockResponse = {
        body: {
          json: jest.fn().mockResolvedValue({
            response: 'Custom model response'
          })
        }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generate('Test prompt', {
        model: 'llama2',
        temperature: 0.8,
        maxTokens: 2000
      });

      const requestBody = JSON.parse(mockRequest.mock.calls[0][1].body);
      expect(requestBody.model).toBe('llama2');
      expect(requestBody.options.temperature).toBe(0.8);
      expect(requestBody.options.num_predict).toBe(2000);
    });

    it('should handle streaming responses', async () => {
      const receivedChunks: string[] = [];
      
      const mockReader = {
        read: jest.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"response":"Hello"}\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"response":" from"}\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"response":" Ollama!"}\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('{"done":true}\n') })
          .mockResolvedValueOnce({ done: true })
      };

      const mockResponse = {
        body: { getReader: () => mockReader }
      };
      
      mockRequest.mockResolvedValue(mockResponse);

      await provider.generateStream('Test prompt', (chunk) => {
        receivedChunks.push(chunk);
      });

      expect(receivedChunks).toEqual(['Hello', ' from', ' Ollama!']);
    });

    it('should handle connection errors gracefully', async () => {
      mockRequest.mockRejectedValue(new Error('Connection refused'));

      await expect(provider.generate('Test prompt')).rejects.toThrow('Connection refused');
    });
  });

  describe('Provider Interface Compliance', () => {
    it('should implement consistent interface across all providers', () => {
      const openaiProvider = new OpenAIProvider('test-key');
      const anthropicProvider = new AnthropicProvider('test-key');
      const ollamaProvider = new OllamaProvider();

      expect(typeof openaiProvider.name).toBe('string');
      expect(typeof openaiProvider.generate).toBe('function');
      expect(typeof openaiProvider.generateStream).toBe('function');
      
      expect(typeof anthropicProvider.name).toBe('string');
      expect(typeof anthropicProvider.generate).toBe('function');
      expect(typeof anthropicProvider.generateStream).toBe('function');
      
      expect(typeof ollamaProvider.name).toBe('string');
      expect(typeof ollamaProvider.generate).toBe('function');
      expect(typeof ollamaProvider.generateStream).toBe('function');
    });

    it('should have unique provider names', () => {
      const openaiProvider = new OpenAIProvider('test-key');
      const anthropicProvider = new AnthropicProvider('test-key');
      const ollamaProvider = new OllamaProvider();

      const names = [openaiProvider.name, anthropicProvider.name, ollamaProvider.name];
      const uniqueNames = [...new Set(names)];
      
      expect(uniqueNames).toHaveLength(3);
    });
  });
});
