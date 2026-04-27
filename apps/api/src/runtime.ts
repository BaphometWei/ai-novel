import {
  AgentRunRepository,
  ContextPackRepository,
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
import { createDefaultAgentOrchestrationService } from './services/agent-orchestration.service';
import { PersistentProjectService } from './services/project.service';

export async function createPersistentApiRuntime(filename = process.env.AI_NOVEL_DB_PATH ?? 'data/ai-novel.sqlite') {
  if (filename !== ':memory:') {
    await mkdir(dirname(resolve(filename)), { recursive: true });
  }

  const database = createDatabase(filename);
  await migrateDatabase(database.client);
  const projectRepository = new ProjectRepository(database.db);
  const projectService = new PersistentProjectService(projectRepository);
  const contextPacks = new ContextPackRepository(database.db);
  const agentRuns = new AgentRunRepository(database.db);
  const llmCallLogs = new LlmCallLogRepository(database.db);
  const durableJobs = new DurableJobRepository(database.db);
  const workflowRuns = new WorkflowRunRepository(database.db);

  const stores = {
    agentRuns: {
      agentRuns,
      llmCallLogs
    },
    contextPacks,
    projectRepository,
    projectService,
    workbench: {
      projects: projectService,
      knowledge: new KnowledgeRepository(database.db),
      review: new ReviewRepository(database.db),
      serialization: new SerializationRepository(database.db)
    },
    workflow: {
      durableJobs,
      workflowRuns
    }
  };
  const orchestration = createDefaultAgentOrchestrationService({
    projects: projectService,
    contextPacks,
    agentRuns,
    llmCallLogs,
    workflowRuns,
    durableJobs
  });

  return {
    app: buildApp({
      agentRuns: stores.agentRuns,
      orchestration,
      projectService,
      workbench: stores.workbench,
      workflow: stores.workflow
    }),
    database,
    stores
  };
}
