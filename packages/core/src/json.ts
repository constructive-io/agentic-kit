import type { JsonObject } from './types.js';

export function parsePartialJson(raw: string): JsonObject {
  const trimmed = raw.trim();
  if (!trimmed) {
    return {};
  }

  const parsed = parseJsonObject(trimmed);
  if (parsed) {
    return parsed;
  }

  const completed = completePartialJson(trimmed);
  if (!completed) {
    return {};
  }

  return parseJsonObject(completed) ?? {};
}

function parseJsonObject(raw: string): JsonObject | undefined {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isJsonObject(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function completePartialJson(input: string): string | undefined {
  let output = input;
  let inString = false;
  let escaping = false;
  const stack: string[] = [];

  for (const char of input) {
    if (escaping) {
      escaping = false;
      continue;
    }

    if (inString && char === '\\') {
      escaping = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === '{') {
      stack.push('}');
    } else if (char === '[') {
      stack.push(']');
    } else if (char === '}' || char === ']') {
      const expected = stack.pop();
      if (expected !== char) {
        return undefined;
      }
    }
  }

  if (escaping) {
    return undefined;
  }

  if (inString) {
    output += '"';
  }

  while (stack.length > 0) {
    output += stack.pop();
  }

  return output;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function clone<TValue>(value: TValue): TValue {
  return JSON.parse(JSON.stringify(value)) as TValue;
}
