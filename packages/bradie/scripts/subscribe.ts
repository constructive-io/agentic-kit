#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

interface Args {
  domain: string;
  sessionId: string;
  requestId: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  let sessionId = '';
  let requestId = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    } else if (arg === '--sessionId' && argv[i + 1]) {
      sessionId = argv[++i];
    } else if (arg === '--requestId' && argv[i + 1]) {
      requestId = argv[++i];
    }
  }

  if (!sessionId || !requestId) {
    console.error('Usage: ts-node scripts/subscribe.ts --sessionId <sessionId> --requestId <requestId> [--domain <domain>]');
    process.exit(1);
  }

  return { domain, sessionId, requestId };
}

(async () => {
  const { domain, sessionId, requestId } = parseArgs();

  const client = new Bradie({
    domain,
    onSystemMessage: (msg) => console.log('[system]', msg),
    onAssistantReply: (msg) => console.log('[assistant]', msg),
    onError: (err) => {
      console.error('[error]', err);
      process.exit(1);
    },
    onComplete: () => {
      console.log('[complete]');
      process.exit(0);
    },
  });

  // @ts-ignore: set private sessionId
  (client as any).sessionId = sessionId;

  try {
    await client.subscribeToResponse(requestId);
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 