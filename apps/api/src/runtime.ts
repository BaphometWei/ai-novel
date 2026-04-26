import {
  AgentRunRepository,
  createDatabase,
  DurableJobRepository,
  LlmCallLogRepository,
  migrateDatabase,
  WorkflowRunRepository
} from '@ai-novel/db';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildApp } from './app';

export async function createPersistentApiRuntime(filename = process.env.AI_NOVEL_DB_PATH ?? 'data/ai-novel.sqlite') {
  if (filename !== ':memory:') {
    await mkdir(dirname(resolve(filename)), { recursive: true });
  }

  const database = createDatabase(filename);
  await migrateDatabase(database.client);

  const stores = {
    agentRuns: {
      agentRuns: new AgentRunRepository(database.db),
      llmCallLogs: new LlmCallLogRepository(database.db)
    },
    workflow: {
      durableJobs: new DurableJobRepository(database.db),
      workflowRuns: new WorkflowRunRepository(database.db)
    }
  };

  return {
    app: buildApp(stores),
    database,
    stores
  };
}
