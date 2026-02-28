"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cross_fetch_1 = __importDefault(require("cross-fetch"));
// ─── Client ───────────────────────────────────────────────────────────────────
class OllamaClient {
    baseUrl;
    constructor(baseUrl = 'http://localhost:11434') {
        this.baseUrl = baseUrl;
    }
    // ── Models ──────────────────────────────────────────────────────────────────
    async listModels() {
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/tags`);
        if (!res.ok) {
            throw new Error(`listModels failed: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        if (data.models?.length)
            return data.models.map((m) => m.name);
        if (data.tags?.length)
            return data.tags;
        return [];
    }
    async pullModel(model) {
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model }),
        });
        if (!res.ok) {
            throw new Error(`pullModel failed: ${res.status} ${res.statusText}`);
        }
    }
    async deleteModel(model) {
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/delete`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: model }),
        });
        if (!res.ok) {
            throw new Error(`deleteModel failed: ${res.status} ${res.statusText}`);
        }
    }
    async generate(input, onChunk) {
        if (input.messages) {
            return this._chat(input, onChunk);
        }
        return this._generate(input, onChunk);
    }
    // ── Embeddings ──────────────────────────────────────────────────────────────
    async generateEmbedding(text, model = 'nomic-embed-text') {
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: text }),
        });
        if (!res.ok) {
            throw new Error(`generateEmbedding failed: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return data.embedding;
    }
    // ── Private: /api/generate ──────────────────────────────────────────────────
    async _generate(input, onChunk) {
        const body = {
            model: input.model,
            prompt: input.prompt ?? '',
            stream: !!onChunk,
        };
        if (input.system)
            body.system = input.system;
        if (input.temperature !== undefined)
            body.temperature = input.temperature;
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`generate failed: ${res.status} ${res.statusText} — ${text}`);
        }
        if (onChunk) {
            return this._streamResponse(res, (data) => data.response, onChunk);
        }
        const data = await res.json();
        return data.response;
    }
    // ── Private: /api/chat ──────────────────────────────────────────────────────
    async _chat(input, onChunk) {
        const messages = [];
        if (input.system) {
            messages.push({ role: 'system', content: input.system });
        }
        messages.push(...(input.messages ?? []));
        const body = {
            model: input.model,
            messages,
            stream: !!onChunk,
        };
        if (input.temperature !== undefined)
            body.temperature = input.temperature;
        const res = await (0, cross_fetch_1.default)(`${this.baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`chat failed: ${res.status} ${res.statusText} — ${text}`);
        }
        if (onChunk) {
            return this._streamResponse(res, (data) => data.message?.content ?? '', onChunk);
        }
        const data = await res.json();
        return data.message?.content ?? '';
    }
    // ── Private: streaming reader ───────────────────────────────────────────────
    async _streamResponse(res, extract, onChunk) {
        const reader = res.body?.getReader();
        if (!reader)
            throw new Error('No response body reader');
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            const lines = decoder.decode(value).split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    const chunk = extract(data);
                    if (chunk)
                        onChunk(chunk);
                }
                catch {
                    // partial line — skip
                }
            }
        }
    }
}
exports.default = OllamaClient;
