import OllamaClient, { OllamaAdapter } from '../src';

const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
const modelId = process.env.OLLAMA_LIVE_MODEL ?? 'qwen3.5:4b';
const embedModel = process.env.OLLAMA_LIVE_EMBED_MODEL ?? 'nomic-embed-text:latest';
const hasEmbedModel = process.env.OLLAMA_LIVE_HAS_EMBED_MODEL === '1';
const liveSuite = process.env.OLLAMA_LIVE_SUITE ?? 'smoke';
const runSmoke = liveSuite === 'smoke' || liveSuite === 'extended';
const runExtended = liveSuite === 'extended';
const describeSmoke = runSmoke ? describe : describe.skip;
const describeExtended = runExtended ? describe : describe.skip;
const itWithEmbeddings = hasEmbedModel ? it : it.skip;

describeSmoke('Ollama live smoke', () => {
  jest.setTimeout(60_000);

  it('lists the configured live model', async () => {
    const client = new OllamaClient(baseUrl);
    const models = await client.listModels();

    expect(models).toContain(modelId);
  });

  it('streams a constrained single-word response', async () => {
    const adapter = new OllamaAdapter(baseUrl);
    const model = adapter.createModel(modelId);
    const stream = adapter.stream(
      model,
      {
        systemPrompt: 'Follow the user instruction exactly.',
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly the single word PONG and nothing else.',
            timestamp: Date.now(),
          },
        ],
      },
      { temperature: 0, maxTokens: 128 },
    );

    const eventTypes: string[] = [];
    for await (const event of stream) {
      eventTypes.push(event.type);
    }

    const message = await stream.result();
    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
      .toLowerCase();

    expect(eventTypes).toEqual(
      expect.arrayContaining(['text_start', 'text_delta', 'text_end', 'done']),
    );
    expect(message.stopReason).toBe('stop');
    expect(text).toContain('pong');
  });

  it('reports length stop reasons when generation is deliberately truncated', async () => {
    const adapter = new OllamaAdapter(baseUrl);
    const model = adapter.createModel(modelId);
    const stream = adapter.stream(
      model,
      {
        messages: [
          {
            role: 'user',
            content: 'Write a detailed numbered list from 1 to 100, one item per line.',
            timestamp: Date.now(),
          },
        ],
      },
      { temperature: 0, maxTokens: 8 },
    );

    let doneReason: string | undefined;
    for await (const event of stream) {
      if (event.type === 'done') {
        doneReason = event.reason;
      }
    }

    const message = await stream.result();
    expect(doneReason).toBe('length');
    expect(message.stopReason).toBe('length');
    expect(message.usage.output).toBeGreaterThan(0);
  });

  it('honors abort signals before the response completes', async () => {
    const adapter = new OllamaAdapter(baseUrl);
    const model = adapter.createModel(modelId);
    const controller = new AbortController();
    const stream = adapter.stream(
      model,
      {
        messages: [
          {
            role: 'user',
            content: 'Count upward forever, one number per line.',
            timestamp: Date.now(),
          },
        ],
      },
      { temperature: 0, maxTokens: 512, signal: controller.signal },
    );

    controller.abort();

    for await (const _event of stream) {
      // Drain terminal event.
    }

    const message = await stream.result();
    expect(message.stopReason).toBe('aborted');
  });
});

describeSmoke('generateWithUsage token metering', () => {
  jest.setTimeout(60_000);

  it('returns content and non-zero usage in batch mode', async () => {
    const client = new OllamaClient(baseUrl);
    const result = await client.generateWithUsage({
      model: modelId,
      prompt: 'Reply with exactly the single word PING and nothing else.',
      maxTokens: 128,
      temperature: 0,
    });

    expect(result.content.toLowerCase()).toContain('ping');
    expect(result.model).toBeTruthy();
    expect(result.usage.input).toBeGreaterThan(0);
    expect(result.usage.output).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThanOrEqual(
      result.usage.input + result.usage.output,
    );
    expect(result.stopReason).toBe('stop');
  });

  it('streams chunks and returns usage after completion', async () => {
    const client = new OllamaClient(baseUrl);
    const chunks: string[] = [];
    const result = await client.generateWithUsage(
      {
        model: modelId,
        prompt: 'Reply with exactly the single word PONG and nothing else.',
        stream: true,
        maxTokens: 128,
        temperature: 0,
      },
      (chunk: string) => {
        chunks.push(chunk);
      },
    );

    expect(chunks.length).toBeGreaterThan(0);
    expect(result.content.toLowerCase()).toContain('pong');
    expect(result.usage.output).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it('returns token counts for multi-turn chat', async () => {
    const client = new OllamaClient(baseUrl);
    const result = await client.generateWithUsage({
      model: modelId,
      messages: [
        { role: 'user', content: 'Say hello' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'Now say goodbye in one word.' },
      ],
      maxTokens: 128,
      temperature: 0,
    });

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.usage.input).toBeGreaterThan(0);
    expect(result.usage.output).toBeGreaterThan(0);
  });
});

describeExtended('Ollama live extended', () => {
  jest.setTimeout(60_000);

  it('surfaces reasoning blocks and usage for reasoning-capable models', async () => {
    const adapter = new OllamaAdapter(baseUrl);
    const model = adapter.createModel(modelId);
    const stream = adapter.stream(
      model,
      {
        messages: [
          {
            role: 'user',
            content: 'Reply with exactly the single word PONG and nothing else.',
            timestamp: Date.now(),
          },
        ],
      },
      { temperature: 0 },
    );

    const eventTypes: string[] = [];
    for await (const event of stream) {
      eventTypes.push(event.type);
    }

    const message = await stream.result();
    const text = message.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim()
      .toLowerCase();

    expect(eventTypes).toContain('done');
    expect(eventTypes).toContain('text_start');
    expect(eventTypes).toContain('text_end');
    expect(message.usage.input).toBeGreaterThan(0);
    expect(message.usage.output).toBeGreaterThan(0);
    expect(message.usage.totalTokens).toBeGreaterThan(0);
    expect(text).toContain('pong');

    const hasThinking = message.content.some((block) => block.type === 'thinking');
    if (hasThinking) {
      expect(eventTypes).toContain('thinking_start');
      expect(eventTypes).toContain('thinking_end');
    }
  });

  it('returns visible text through the legacy generate helper', async () => {
    const client = new OllamaClient(baseUrl);
    const output = await client.generate({
      model: modelId,
      prompt: 'Reply with exactly the single word BLUE and nothing else.',
      maxTokens: 320,
      temperature: 0,
    });

    expect(output.trim().toLowerCase()).toBe('blue');
  });

  it('maintains short multi-turn context', async () => {
    const client = new OllamaClient(baseUrl);
    const output = await client.generate({
      model: modelId,
      system: 'Follow the user instruction exactly.',
      messages: [
        {
          role: 'user',
          content: 'Remember this exact token: MARBLE. Reply with OK only.',
        },
        {
          role: 'assistant',
          content: 'OK',
        },
        {
          role: 'user',
          content: 'What token did I ask you to remember? Reply with one word only.',
        },
      ],
      maxTokens: 256,
      temperature: 0,
    });

    expect(output.trim().toLowerCase()).toContain('marble');
  });

  itWithEmbeddings('generates local embeddings when an embed model is installed', async () => {
    const client = new OllamaClient(baseUrl);
    const embedding = await client.generateEmbedding('hello world', embedModel);

    expect(Array.isArray(embedding)).toBe(true);
    expect(embedding.length).toBeGreaterThan(0);
    expect(embedding.every((value) => Number.isFinite(value))).toBe(true);
  });
});
