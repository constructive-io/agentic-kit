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
export declare class AnthropicAdapter {
    readonly name = "anthropic";
    private apiKey;
    private baseUrl;
    private defaultModel;
    private defaultMaxTokens;
    constructor(options: AnthropicOptions | string);
    generate(input: GenerateInput): Promise<string>;
    generateStreaming(input: GenerateInput, onChunk: (chunk: string) => void): Promise<void>;
    listModels(): Promise<string[]>;
    private _request;
    private _buildMessages;
    private _stream;
}
export default AnthropicAdapter;
