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
export declare class OpenAIAdapter {
    readonly name = "openai";
    private apiKey;
    private baseUrl;
    private defaultModel;
    private defaultMaxTokens;
    constructor(options: OpenAIOptions | string);
    generate(input: GenerateInput): Promise<string>;
    generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
    listModels(): Promise<string[]>;
    private _request;
    private _buildMessages;
    private _stream;
}
export default OpenAIAdapter;
