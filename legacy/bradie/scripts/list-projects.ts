#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

function parseArgs(): { domain: string } {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    }
  }
  return { domain };
}

(async () => {
  const { domain } = parseArgs();
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
    const projects = await client.listProjects();
    console.log(JSON.stringify(projects, null, 2));
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 