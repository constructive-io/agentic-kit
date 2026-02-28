import fetch from 'cross-fetch';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateInput {
  model: string;
  /** Single-shot prompt — routes to /api/generate */
  prompt?: string;
  /** Multi-turn messages — routes to /api/chat (takes precedence over prompt) */
  messages?: ChatMessage[];
  /** System prompt — injected into /api/generate or prepended to /api/chat messages */
  system?: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: { role: string; content: string };
  done: boolean;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    model: string;
    modified_at: string;
    size: number;
    digest: string;
  }>;
  tags?: string[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

export default class OllamaClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
  }

  // ── Models ──────────────────────────────────────────────────────────────────

  async listModels(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/api/tags`);
    if (!res.ok) {
      throw new Error(`listModels failed: ${res.status} ${res.statusText}`);
    }
    const data: OllamaTagsResponse = await res.json();
    if (data.models?.length) return data.models.map((m) => m.name);
    if (data.tags?.length) return data.tags;
    return [];
  }

  async pullModel(model: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (!res.ok) {
      throw new Error(`pullModel failed: ${res.status} ${res.statusText}`);
    }
  }

  async deleteModel(model: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
    });
    if (!res.ok) {
      throw new Error(`deleteModel failed: ${res.status} ${res.statusText}`);
    }
  }

  // ── Generate (single-shot or multi-turn) ────────────────────────────────────

  async generate(input: GenerateInput): Promise<string>;
  async generate(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
  async generate(
    input: GenerateInput,
    onChunk?: (chunk: string) => void
  ): Promise<string | void> {
    if (input.messages) {
      return this._chat(input, onChunk);
    }
    return this._generate(input, onChunk);
  }

  // ── Embeddings ──────────────────────────────────────────────────────────────

  async generateEmbedding(text: string, model = 'nomic-embed-text'): Promise<number[]> {
    const res = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      throw new Error(`generateEmbedding failed: ${res.status} ${res.statusText}`);
    }
    const data: OllamaEmbeddingResponse = await res.json();
    return data.embedding;
  }

  // ── Private: /api/generate ──────────────────────────────────────────────────

  private async _generate(
    input: GenerateInput,
    onChunk?: (chunk: string) => void
  ): Promise<string | void> {
    const body: Record<string, unknown> = {
      model: input.model,
      prompt: input.prompt ?? '',
      stream: !!onChunk,
    };
    if (input.system) body.system = input.system;
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`generate failed: ${res.status} ${res.statusText} — ${text}`);
    }

    if (onChunk) {
      return this._streamResponse(res, (data: OllamaGenerateResponse) => data.response, onChunk);
    }

    const data: OllamaGenerateResponse = await res.json();
    return data.response;
  }

  // ── Private: /api/chat ──────────────────────────────────────────────────────

  private async _chat(
    input: GenerateInput,
    onChunk?: (chunk: string) => void
  ): Promise<string | void> {
    const messages: ChatMessage[] = [];
    if (input.system) {
      messages.push({ role: 'system', content: input.system });
    }
    messages.push(...(input.messages ?? []));

    const body: Record<string, unknown> = {
      model: input.model,
      messages,
      stream: !!onChunk,
    };
    if (input.temperature !== undefined) body.temperature = input.temperature;

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`chat failed: ${res.status} ${res.statusText} — ${text}`);
    }

    if (onChunk) {
      return this._streamResponse(
        res,
        (data: OllamaChatResponse) => data.message?.content ?? '',
        onChunk
      );
    }

    const data: OllamaChatResponse = await res.json();
    return data.message?.content ?? '';
  }

  // ── Private: streaming reader ───────────────────────────────────────────────

  private async _streamResponse<T>(
    res: Response,
    extract: (data: T) => string,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body reader');

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data: T = JSON.parse(line);
          const chunk = extract(data);
          if (chunk) onChunk(chunk);
        } catch {
          // partial line — skip
        }
      }
    }
  }
}
