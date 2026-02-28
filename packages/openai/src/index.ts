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

export interface OpenAIOptions {
  apiKey: string;
  /** Override base URL — works with any OpenAI-compatible API (LM Studio, vLLM, Together, etc.) */
  baseUrl?: string;
  /** Default model when GenerateInput.model is not set */
  defaultModel?: string;
  /** Default max_tokens */
  maxTokens?: number;
}

// ─── Internal response types ──────────────────────────────────────────────────

interface ChatCompletionResponse {
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
}

interface ChatCompletionChunk {
  choices: Array<{
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

// ─── OpenAIAdapter ────────────────────────────────────────────────────────────

export class OpenAIAdapter {
  public readonly name = 'openai';

  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private defaultMaxTokens: number;

  constructor(options: OpenAIOptions | string) {
    const opts: OpenAIOptions =
      typeof options === 'string' ? { apiKey: options } : options;

    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com';
    this.defaultModel = opts.defaultModel ?? 'gpt-4o';
    this.defaultMaxTokens = opts.maxTokens ?? 4096;
  }

  async generate(input: GenerateInput): Promise<string> {
    return this._request(input) as Promise<string>;
  }

  async generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void> {
    return this._request(input, onChunk) as Promise<void>;
  }

  async listModels(): Promise<string[]> {
    return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'];
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private async _request(
    input: GenerateInput,
    onChunk?: (chunk: string) => void
  ): Promise<string | void> {
    const body: Record<string, unknown> = {
      model: input.model || this.defaultModel,
      messages: this._buildMessages(input),
      stream: !!onChunk,
      max_tokens: input.maxTokens ?? this.defaultMaxTokens,
      ...(input.temperature !== undefined && { temperature: input.temperature }),
    };

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }

    if (onChunk) return this._stream(res, onChunk);

    const data: ChatCompletionResponse = await res.json();
    return data.choices[0]?.message?.content ?? '';
  }

  private _buildMessages(input: GenerateInput): Array<{ role: string; content: string }> {
    // OpenAI supports system role natively in messages[]
    const msgs: ChatMessage[] = [];
    if (input.system) msgs.push({ role: 'system', content: input.system });
    if (input.messages) {
      const filtered = input.system
        ? input.messages.filter((m) => m.role !== 'system')
        : input.messages;
      msgs.push(...filtered);
    } else if (input.prompt) {
      msgs.push({ role: 'user', content: input.prompt });
    }
    return msgs;
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
        if (payload === '[DONE]') return;
        try {
          const chunk: ChatCompletionChunk = JSON.parse(payload);
          const content = chunk.choices[0]?.delta?.content;
          if (content) onChunk(content);
        } catch { /* malformed — skip */ }
      }
    }
  }
}

export default OpenAIAdapter;
