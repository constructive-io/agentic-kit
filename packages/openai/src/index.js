"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAdapter = void 0;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
// ─── OpenAIAdapter ────────────────────────────────────────────────────────────
class OpenAIAdapter {
    name = 'openai';
    apiKey;
    baseUrl;
    defaultModel;
    defaultMaxTokens;
    constructor(options) {
        const opts = typeof options === 'string' ? { apiKey: options } : options;
        this.apiKey = opts.apiKey;
        this.baseUrl = opts.baseUrl ?? 'https://api.openai.com';
        this.defaultModel = opts.defaultModel ?? 'gpt-4o';
        this.defaultMaxTokens = opts.maxTokens ?? 4096;
    }
    async generate(input) {
        return this._request(input);
    }
    async generateStreaming(input, onChunk) {
        return this._request(input, onChunk);
    }
    async listModels() {
        return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini', 'o3-mini'];
    }
    // ── Private ───────────────────────────────────────────────────────────────────
    async _request(input, onChunk) {
        const body = {
            model: input.model || this.defaultModel,
            messages: this._buildMessages(input),
            stream: !!onChunk,
            max_tokens: input.maxTokens ?? this.defaultMaxTokens,
            ...(input.temperature !== undefined && { temperature: input.temperature }),
        };
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/v1/chat/completions`, {
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
        if (onChunk)
            return this._stream(res, onChunk);
        const data = await res.json();
        return data.choices[0]?.message?.content ?? '';
    }
    _buildMessages(input) {
        // OpenAI supports system role natively in messages[]
        const msgs = [];
        if (input.system)
            msgs.push({ role: 'system', content: input.system });
        if (input.messages) {
            const filtered = input.system
                ? input.messages.filter((m) => m.role !== 'system')
                : input.messages;
            msgs.push(...filtered);
        }
        else if (input.prompt) {
            msgs.push({ role: 'user', content: input.prompt });
        }
        return msgs;
    }
    async _stream(res, onChunk) {
        const reader = res.body?.getReader();
        if (!reader)
            throw new Error('No response body');
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
                if (!line.startsWith('data: '))
                    continue;
                const payload = line.slice(6).trim();
                if (payload === '[DONE]')
                    return;
                try {
                    const chunk = JSON.parse(payload);
                    const content = chunk.choices[0]?.delta?.content;
                    if (content)
                        onChunk(content);
                }
                catch { /* malformed — skip */ }
            }
        }
    }
}
exports.OpenAIAdapter = OpenAIAdapter;
exports.default = OpenAIAdapter;
