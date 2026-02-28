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
export default class OllamaClient {
    private baseUrl;
    constructor(baseUrl?: string);
    listModels(): Promise<string[]>;
    pullModel(model: string): Promise<void>;
    deleteModel(model: string): Promise<void>;
    generate(input: GenerateInput): Promise<string>;
    generate(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
    generateEmbedding(text: string, model?: string): Promise<number[]>;
    private _generate;
    private _chat;
    private _streamResponse;
}
