import { request } from 'undici';
import { logger, LLMProvider, LLMOptions } from '@agentic-kit/core';

export class AnthropicProvider implements LLMProvider {
  public readonly name = 'Anthropic';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl: string = 'https://api.anthropic.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    logger.info(`Initialized ${this.name} provider`);
  }

  async generate(prompt: string, options?: LLMOptions): Promise<string> {
    logger.debug(`${this.name} generating response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options?.model || 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
          stop_sequences: options?.stopSequences,
        }),
      });

      const data = await response.body.json() as any;
      return data.content[0].text;
    } catch (error) {
      logger.error(`${this.name} generation failed:`, error);
      throw error;
    }
  }

  async generateStream(prompt: string, onChunk: (chunk: string) => void, options?: LLMOptions): Promise<void> {
    logger.debug(`${this.name} streaming response for prompt length: ${prompt.length}`);
    
    try {
      const response = await request(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: options?.model || 'claude-3-sonnet-20240229',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 1000,
          temperature: options?.temperature || 0.7,
          stop_sequences: options?.stopSequences,
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
              if (parsed.type === 'content_block_delta') {
                const content = parsed.delta?.text;
                if (content) {
                  onChunk(content);
                }
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
