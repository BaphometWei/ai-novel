import {
  AgentRunRepository,
  createDatabase,
  DurableJobRepository,
  KnowledgeRepository,
  LlmCallLogRepository,
  migrateDatabase,
  ProjectRepository,
  ReviewRepository,
  SerializationRepository,
  WorkflowRunRepository
} from '@ai-novel/db';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildApp } from './app';
import { PersistentProjectService } from './services/project.service';

export async function createPersistentApiRuntime(filename = process.env.AI_NOVEL_DB_PATH ?? 'data/ai-novel.sqlite') {
  if (filename !== ':memory:') {
    await mkdir(dirname(resolve(filename)), { recursive: true });
  }

  const database = createDatabase(filename);
  await migrateDatabase(database.client);
  const projectRepository = new ProjectRepository(database.db);
  const projectService = new PersistentProjectService(projectRepository);

  const stores = {
    agentRuns: {
      agentRuns: new AgentRunRepository(database.db),
      llmCallLogs: new LlmCallLogRepository(database.db)
    },
    projectRepository,
    projectService,
    workbench: {
      projects: projectService,
      knowledge: new KnowledgeRepository(database.db),
      review: new ReviewRepository(database.db),
      serialization: new SerializationRepository(database.db)
    },
    workflow: {
      durableJobs: new DurableJobRepository(database.db),
      workflowRuns: new WorkflowRunRepository(database.db)
    }
  };

  return {
    app: buildApp({
      agentRuns: stores.agentRuns,
      projectService,
      workbench: stores.workbench,
      workflow: stores.workflow
    }),
    database,
    stores
  };
}
