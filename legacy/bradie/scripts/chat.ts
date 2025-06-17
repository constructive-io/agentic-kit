#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

interface Args {
  domain: string;
  sessionId: string;
  message: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  let sessionId = '';
  let message = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    } else if (arg === '--sessionId' && argv[i + 1]) {
      sessionId = argv[++i];
    } else if ((arg === '--message' || arg === '-m') && argv[i + 1]) {
      message = argv[++i];
    }
  }

  if (!sessionId || !message) {
    console.error('Usage: ts-node scripts/chat.ts --sessionId <SESSION_ID> --message "<MESSAGE>" [--domain <domain>]');
    process.exit(1);
  }

  return { domain, sessionId, message };
}

(async () => {
  const { domain, sessionId, message } = parseArgs();

  const client = new Bradie({
    domain,
    onSystemMessage: () => {},
    onAssistantReply: () => {},
    onError: (err) => {
      console.error('[error]', err);
      process.exit(1);
    },
  });

  // @ts-ignore: set private sessionId
  (client as any).sessionId = sessionId;

  try {
    const requestId = await client.sendMessage(message);
    console.log('requestId:', requestId);
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 