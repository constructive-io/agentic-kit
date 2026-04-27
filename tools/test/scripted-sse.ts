import type { AgentEvent } from '@agentic-kit/agent';

export function createScriptedSSEResponse(events: AgentEvent[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>
): AsyncIterable<AgentEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      let blankIdx = buffer.indexOf('\n\n');
      while (blankIdx !== -1) {
        const rawEvent = buffer.slice(0, blankIdx);
        buffer = buffer.slice(blankIdx + 2);
        const event = parseEvent(rawEvent);
        if (event) {
          yield event;
        }
        blankIdx = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(raw: string): AgentEvent | null {
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line === '' || line.startsWith(':')) {
      continue;
    }
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) {
      value = value.slice(1);
    }
    if (field === 'data') {
      dataLines.push(value);
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const data = dataLines.join('\n');
  if (data === '[DONE]') {
    return null;
  }

  try {
    return JSON.parse(data) as AgentEvent;
  } catch {
    return null;
  }
}
