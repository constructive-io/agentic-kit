import { clone } from './json.js';
import type {
  AssistantMessage,
  Context,
  ImageContent,
  Message,
  ModelDescriptor,
  TextContent,
  ToolCallContent,
  ToolResultMessage,
  Usage,
  UserMessage,
} from './types.js';

export function createEmptyUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

export function calculateUsageCost(model: ModelDescriptor, usage: Usage): Usage['cost'] {
  const schedule = model.cost;
  usage.cost.input = ((schedule?.input ?? 0) / 1_000_000) * usage.input;
  usage.cost.output = ((schedule?.output ?? 0) / 1_000_000) * usage.output;
  usage.cost.cacheRead = ((schedule?.cacheRead ?? 0) / 1_000_000) * usage.cacheRead;
  usage.cost.cacheWrite = ((schedule?.cacheWrite ?? 0) / 1_000_000) * usage.cacheWrite;
  usage.cost.total =
    usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
  return usage.cost;
}

export function createAssistantMessage(model: ModelDescriptor): AssistantMessage {
  return {
    role: 'assistant',
    api: model.api,
    provider: model.provider,
    model: model.id,
    content: [],
    usage: createEmptyUsage(),
    stopReason: 'stop',
    timestamp: Date.now(),
  };
}

export function createTextContent(text = ''): TextContent {
  return { type: 'text', text };
}

export function createImageContent(data: string, mimeType: string): ImageContent {
  return { type: 'image', data, mimeType };
}

export function createToolCall(id: string, name: string): ToolCallContent {
  return { type: 'toolCall', id, name, arguments: {}, rawArguments: '' };
}

export function createUserMessage(content: UserMessage['content']): UserMessage {
  return {
    role: 'user',
    content,
    timestamp: Date.now(),
  };
}

export function createToolResultMessage(
  toolCallId: string,
  toolName: string,
  content: ToolResultMessage['content'],
  isError = false
): ToolResultMessage {
  return {
    role: 'toolResult',
    toolCallId,
    toolName,
    content,
    isError,
    timestamp: Date.now(),
  };
}

export function getMessageText(message: AssistantMessage): string {
  return message.content
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

export function cloneMessage<TMessage extends Message>(message: TMessage): TMessage {
  return clone(message);
}

export function normalizeContext(context: Context): Context {
  return {
    systemPrompt: context.systemPrompt,
    tools: context.tools ?? [],
    messages: context.messages.map((message) => ensureTimestamp(cloneMessage(message))),
  };
}

function ensureTimestamp<TMessage extends Message>(message: TMessage): TMessage {
  if (typeof message.timestamp !== 'number') {
    (message as Message).timestamp = Date.now();
  }
  return message;
}
