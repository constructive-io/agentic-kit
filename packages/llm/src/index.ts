import { request } from 'undici';
import { logger, LLMProvider, LLMOptions } from '@agentic-kit/core';

export { LLMProvider, LLMOptions };

export class OpenAIProvider implements LLMProvider {
  public readonly name = 'OpenAI';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.openai.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    logger.info(`Initialized ${this.name} provider`);
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    logger.debug(`${this.name} generating response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1000,
          stop: options?.stopSequences,
        }),
      });

      const data = await response.body.json() as any;
      return data.choices[0].message.content;
    } catch (error) {
      logger.error(`${this.name} generation failed:`, error);
      throw error;
    }
  }

  async generateStream(prompt: string, onChunk: (chunk: string) => void, options?: LLMOptions): Promise<void> {
    logger.debug(`${this.name} streaming response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: options?.model || 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 1000,
          stop: options?.stopSequences,
          stream: true,
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
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
            }
          }
        }
      }
    } catch (error) {
      logger.error(`${this.name} streaming failed:`, error);
      throw error;
    }
  }
}

export * from './anthropic-provider';
export * from './ollama-provider';
