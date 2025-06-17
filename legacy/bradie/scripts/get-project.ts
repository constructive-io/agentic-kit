#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

interface Args {
  domain: string;
  projectId: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  let projectId = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    } else if ((arg === '--projectId' || arg === '-i') && argv[i + 1]) {
      projectId = argv[++i];
    }
  }

  if (!projectId) {
    console.error('Usage: ts-node scripts/get-project.ts --projectId <PROJECT_ID> [--domain <domain>]');
    process.exit(1);
  }

  return { domain, projectId };
}

(async () => {
  const { domain, projectId } = parseArgs();
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
    const project = await client.getProject(projectId);
    console.log(JSON.stringify(project, null, 2));
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 