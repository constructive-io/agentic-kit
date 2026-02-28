import fetch from 'cross-fetch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateInput {
  model: string;
  prompt?: string;
  messages?: ChatMessage[];
  system?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

export interface AnthropicOptions {
  apiKey: string;
  /** Override base URL — useful for proxies */
  baseUrl?: string;
  /** Default model when GenerateInput.model is not set */
  defaultModel?: string;
  /** Default max_tokens (Anthropic requires this field) */
  maxTokens?: number;
}

// ─── Internal response types ──────────────────────────────────────────────────

interface MessageResponse {
  content: Array<{ type: 'text'; text: string }>;
  stop_reason: string;
}

interface StreamEvent {
  type: string;
  index?: number;
  delta?: { type: string; text: string };
}

// ─── AnthropicAdapter ─────────────────────────────────────────────────────────

export class AnthropicAdapter {
  public readonly name = 'anthropic';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;

  constructor(options: AnthropicOptions | string) {
    const opts: AnthropicOptions =
      typeof options === 'string' ? { apiKey: options } : options;

    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
    this.defaultModel = opts.defaultModel ?? 'claude-opus-4-5';
    this.defaultMaxTokens = opts.maxTokens ?? 4096;
  }

  async generate(input: GenerateInput): Promise<string> {
    return this._request(input) as Promise<string>;
  }

  async generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void> {
    return this._request(input, onChunk) as Promise<void>;
  }

  async listModels(): Promise<string[]> {
    return ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private async _request(
    input: GenerateInput,
    onChunk?: (chunk: string) => void
  ): Promise<string | void> {
    const body: Record<string, unknown> = {
      model: input.model || this.defaultModel,
      max_tokens: input.maxTokens ?? this.defaultMaxTokens,
      messages: this._buildMessages(input),
      stream: !!onChunk,
      ...(input.system && { system: input.system }),
      ...(input.temperature !== undefined && { temperature: input.temperature }),
    };

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic error ${res.status}: ${text}`);
    }

    if (onChunk) return this._stream(res, onChunk);

    const data: MessageResponse = await res.json();
    return data.content.map((b) => b.text).join('');
  }

  private _buildMessages(input: GenerateInput): Array<{ role: string; content: string }> {
    // Anthropic: system goes top-level, only user/assistant in messages[]
    if (input.messages) {
      return input.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role, content: m.content }));
    }
    if (input.prompt) return [{ role: 'user', content: input.prompt }];
    return [];
  }

  private async _stream(res: Response, onChunk: (chunk: string) => void): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (!payload) continue;
        try {
          const event: StreamEvent = JSON.parse(payload);
          if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
            if (event.delta.text) onChunk(event.delta.text);
          }
        } catch { /* malformed — skip */ }
      }
    }
  }
}

export default AnthropicAdapter;
