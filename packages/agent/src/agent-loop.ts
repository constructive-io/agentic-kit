import {
  type AssistantMessage,
  type Context,
  createToolResultMessage,
  type Message,
  type StreamOptions,
} from '@agentic-kit/core';
import { stream as defaultStream } from 'agentic-kit';

import type {
  AgentEvent,
  AgentOptions,
  AgentState,
  AgentTool,
  AgentToolResult,
} from './types.js';
import { validateToolArguments as defaultValidateToolArguments } from './validation.js';

export type AgentEventSink = (event: AgentEvent) => void | Promise<void>;

export type AgentLoopConfig = {
  initialMessages?: Message[];
  state: AgentState;
  streamFn?: AgentOptions['streamFn'];
  transformContext?: AgentOptions['transformContext'];
  validateToolArguments?: AgentOptions['validateToolArguments'];
  signal: AbortSignal;
};

export async function runAgentLoop(config: AgentLoopConfig, emit: AgentEventSink): Promise<Message[]> {
  const messages = [...config.state.messages];

  await emit({ type: 'agent_start' });

  if (config.initialMessages && config.initialMessages.length > 0) {
    for (const message of config.initialMessages) {
      await emit({ type: 'message_start', message });
      messages.push(message);
      await emit({ type: 'message_end', message });
    }
  }

  while (true) {
    await emit({ type: 'turn_start' });

    const assistantMessage = await generateAssistantMessage(config, messages, emit);
    messages.push(assistantMessage);
    await emit({ type: 'message_end', message: assistantMessage });

    if (assistantMessage.stopReason === 'error' || assistantMessage.stopReason === 'aborted') {
      await emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
      break;
    }

    const toolCalls = assistantMessage.content.filter((block) => block.type === 'toolCall');
    if (toolCalls.length === 0) {
      await emit({ type: 'turn_end', message: assistantMessage, toolResults: [] });
      break;
    }

    const toolResults = await executeToolCalls(config, toolCalls, emit);
    for (const toolResult of toolResults) {
      await emit({ type: 'message_start', message: toolResult });
      messages.push(toolResult);
      await emit({ type: 'message_end', message: toolResult });
    }

    await emit({ type: 'turn_end', message: assistantMessage, toolResults });
  }

  await emit({ type: 'agent_end', messages });
  return messages;
}

async function generateAssistantMessage(
  config: AgentLoopConfig,
  messages: Message[],
  emit: AgentEventSink
): Promise<AssistantMessage> {
  const transformedMessages = config.transformContext
    ? await config.transformContext(messages, config.signal)
    : messages;

  const context: Context = {
    systemPrompt: config.state.systemPrompt,
    tools: config.state.tools,
    messages: transformedMessages,
  };

  const streamFn = config.streamFn ?? defaultStream;
  const streamResult = streamFn(config.state.model, context, {
    ...(config.state.streamOptions ?? {}),
    signal: config.signal,
  } as StreamOptions);

  for await (const event of streamResult) {
    switch (event.type) {
    case 'start':
      await emit({ type: 'message_start', message: event.partial });
      break;
    case 'text_start':
    case 'text_delta':
    case 'text_end':
    case 'thinking_start':
    case 'thinking_delta':
    case 'thinking_end':
    case 'toolcall_start':
    case 'toolcall_delta':
    case 'toolcall_end':
      await emit({
        type: 'message_update',
        message: event.partial,
        assistantMessageEvent: event,
      });
      break;
    case 'done':
    case 'error':
      break;
    }
  }

  return streamResult.result();
}

async function executeToolCalls(
  config: AgentLoopConfig,
  toolCalls: Array<Extract<AssistantMessage['content'][number], { type: 'toolCall' }>>,
  emit: AgentEventSink
) {
  const results = [];

  for (const toolCall of toolCalls) {
    const tool = config.state.tools.find((candidate) => candidate.name === toolCall.name);
    await emit({
      type: 'tool_execution_start',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      args: toolCall.arguments as Record<string, unknown>,
    });

    let result: AgentToolResult;
    let isError = false;

    try {
      if (!tool) {
        throw new Error(`Tool '${toolCall.name}' not found`);
      }

      const validateToolArguments = config.validateToolArguments ?? defaultValidateToolArguments;
      const validatedArgs = validateToolArguments(
        tool.parameters,
        toolCall.arguments as Record<string, unknown>
      );

      result = await executeTool(tool, toolCall.id, validatedArgs, config.signal, emit);
    } catch (error) {
      result = {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      };
      isError = true;
    }

    await emit({
      type: 'tool_execution_end',
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result,
      isError,
    });

    results.push(
      createToolResultMessage(toolCall.id, toolCall.name, result.content, isError)
    );
  }

  return results;
}

async function executeTool(
  tool: AgentTool,
  toolCallId: string,
  args: Record<string, unknown>,
  signal: AbortSignal,
  emit: AgentEventSink
): Promise<AgentToolResult> {
  const updateEvents: Promise<void>[] = [];

  try {
    return await tool.execute(toolCallId, args, signal, (partialResult) => {
      updateEvents.push(
        Promise.resolve(
          emit({
            type: 'tool_execution_update',
            toolCallId,
            toolName: tool.name,
            args,
            partialResult,
          })
        )
      );
    });
  } finally {
    await Promise.all(updateEvents);
  }
}
