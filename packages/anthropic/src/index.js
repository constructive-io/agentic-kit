"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicAdapter = void 0;
const cross_fetch_1 = __importDefault(require("cross-fetch"));
// ─── AnthropicAdapter ─────────────────────────────────────────────────────────
class AnthropicAdapter {
    name = 'anthropic';
    apiKey;
    baseUrl;
    defaultModel;
    defaultMaxTokens;
    constructor(options) {
        const opts = typeof options === 'string' ? { apiKey: options } : options;
        this.apiKey = opts.apiKey;
        this.baseUrl = opts.baseUrl ?? 'https://api.anthropic.com';
        this.defaultModel = opts.defaultModel ?? 'claude-opus-4-5';
        this.defaultMaxTokens = opts.maxTokens ?? 4096;
    }
    async generate(input) {
        return this._request(input);
    }
    async generateStreaming(input, onChunk) {
        return this._request(input, onChunk);
    }
    async listModels() {
        return ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
    }
    // ── Private ───────────────────────────────────────────────────────────────────
    async _request(input, onChunk) {
        const body = {
            model: input.model || this.defaultModel,
            max_tokens: input.maxTokens ?? this.defaultMaxTokens,
            messages: this._buildMessages(input),
            stream: !!onChunk,
            ...(input.system && { system: input.system }),
            ...(input.temperature !== undefined && { temperature: input.temperature }),
        };
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/v1/messages`, {
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
        if (onChunk)
            return this._stream(res, onChunk);
        const data = await res.json();
        return data.content.map((b) => b.text).join('');
    }
    _buildMessages(input) {
        // Anthropic: system goes top-level, only user/assistant in messages[]
        if (input.messages) {
            return input.messages
                .filter((m) => m.role !== 'system')
                .map((m) => ({ role: m.role, content: m.content }));
        }
        if (input.prompt)
            return [{ role: 'user', content: input.prompt }];
        return [];
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
                if (!payload)
                    continue;
                try {
                    const event = JSON.parse(payload);
                    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                        if (event.delta.text)
                            onChunk(event.delta.text);
                    }
                }
                catch { /* malformed — skip */ }
            }
        }
    }
}
exports.AnthropicAdapter = AnthropicAdapter;
exports.default = AnthropicAdapter;
