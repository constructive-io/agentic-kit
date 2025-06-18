import { request } from 'undici';
import { logger, LLMProvider, LLMOptions } from '@agentic-kit/core';

export class OllamaProvider implements LLMProvider {
  public readonly name = 'Ollama';
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    logger.info(`Initialized ${this.name} provider at ${baseUrl}`);
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    logger.debug(`${this.name} generating response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || 'mistral',
          prompt: prompt,
          stream: false,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 1000,
            stop: options?.stopSequences,
          },
        }),
      });

      const data = await response.body.json() as any;
      return data.response;
    } catch (error) {
      logger.error(`${this.name} generation failed:`, error);
      throw error;
    }
  }

  async generateStream(prompt: string, onChunk: (chunk: string) => void, options?: LLMOptions): Promise<void> {
    logger.debug(`${this.name} streaming response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || 'mistral',
          prompt: prompt,
          stream: true,
          options: {
            temperature: options?.temperature || 0.7,
            num_predict: options?.maxTokens || 1000,
            stop: options?.stopSequences,
          },
        }),
      });

      const decoder = new TextDecoder();
      const reader = (response.body as any).getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              onChunk(parsed.response);
            }
            if (parsed.done) {
              return;
            }
          } catch (e) {
          }
        }
      }
    } catch (error) {
      logger.error(`${this.name} streaming failed:`, error);
      throw error;
    }
  }
}
