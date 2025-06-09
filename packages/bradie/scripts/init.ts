#!/usr/bin/env ts-node

import { Bradie } from '../src/index';

interface Args {
  domain: string;
  projectName: string;
  projectPath: string;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let domain = 'http://localhost:3001';
  let projectName = '';
  let projectPath = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--domain' && argv[i + 1]) {
      domain = argv[++i];
    } else if ((arg === '--projectName' || arg === '-n') && argv[i + 1]) {
      projectName = argv[++i];
    } else if ((arg === '--projectPath' || arg === '-p') && argv[i + 1]) {
      projectPath = argv[++i];
    }
  }

  if (!projectName || !projectPath) {
    console.error('Usage: ts-node scripts/init.ts --projectName <PROJECT_NAME> --projectPath <PROJECT_PATH> [--domain <domain>]');
    process.exit(1);
  }

  return { domain, projectName, projectPath };
}

(async () => {
  const { domain, projectName, projectPath } = parseArgs();

  const client = new Bradie({
    domain,
    onSystemMessage: (msg) => console.log('[system]', msg),
    onAssistantReply: (msg) => console.log('[assistant]', msg),
    onError: (err) => {
      console.error('[error]', err);
      process.exit(1);
    },
  });

  try {
    const { sessionId, projectId } = await client.initProject(projectName, projectPath);
    console.log('sessionId:', sessionId);
    console.log('projectId:', projectId);
  } catch (err) {
    console.error('[error]', err);
    process.exit(1);
  }
})(); 