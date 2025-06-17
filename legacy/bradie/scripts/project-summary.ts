#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

interface Args {
  domain: string;
  sessionId: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  let sessionId = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    } else if ((arg === '--sessionId' || arg === '-s') && argv[i + 1]) {
      sessionId = argv[++i];
    }
  }

  if (!sessionId) {
    console.error('Usage: ts-node scripts/project-summary.ts --sessionId <SESSION_ID> [--domain <domain>]');
    process.exit(1);
  }

  return { domain, sessionId };
}

(async () => {
  const { domain, sessionId } = parseArgs();
  const client = new Bradie({
    domain,
    onSystemMessage: () => {},
    onAssistantReply: () => {},
    onError: (err) => {
      console.error('[error]', err);
      process.exit(1);
    },
  });

  try {
    const summary = await client.getProjectSummary(sessionId);
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 