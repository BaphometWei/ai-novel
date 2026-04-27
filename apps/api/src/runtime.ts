import {
  AgentRunRepository,
  ContextPackRepository,
  createDatabase,
  DurableJobRepository,
  KnowledgeRepository,
  LlmCallLogRepository,
  migrateDatabase,
  PromptVersionRepository,
  type PromptVersion,
  ProjectRepository,
  ReviewRepository,
  SerializationRepository,
  SettingsRepository,
  type BudgetPolicy,
  type ProviderSettingsSaveInput,
  WorkflowRunRepository
} from '@ai-novel/db';
import type { ProviderAdapter } from '@ai-novel/domain';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildApp } from './app';
import { createAgentOrchestrationService } from './services/agent-orchestration.service';
import { createProviderRuntime } from './services/provider-runtime';
import { PersistentProjectService } from './services/project.service';

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface PersistentApiRuntimeOptions {
  env?: Record<string, string | undefined>;
  fetch?: FetchLike;
  fallbackProvider?: ProviderAdapter;
  providerSettings?: ProviderSettingsSaveInput;
  budgetPolicy?: BudgetPolicy;
}

const defaultPromptVersions: PromptVersion[] = [
  {
    id: 'prompt_default',
    taskType: 'general_agent_task',
    template: 'Complete {{goal}} using the provided context.',
    model: 'fake-model',
    provider: 'fake',
    version: 1,
    status: 'Active',
    createdAt: '2026-04-27T06:00:00.000Z'
  },
  {
    id: 'prompt_chapter_plan_v1',
    taskType: 'chapter_planning',
    template: 'Plan {{goal}} from {{context}}.',
    model: 'fake-model',
    provider: 'fake',
    version: 1,
    status: 'Active',
    createdAt: '2026-04-27T06:00:00.000Z'
  }
];

export async function createPersistentApiRuntime(
  filename = process.env.AI_NOVEL_DB_PATH ?? 'data/ai-novel.sqlite',
  options: PersistentApiRuntimeOptions = {}
) {
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
  const promptVersions = new PromptVersionRepository(database.db);
  const settings = new SettingsRepository(database.db);
  await seedDefaultPromptVersions(promptVersions);
  if (options.providerSettings) {
    await settings.saveProviderSettings(options.providerSettings);
  }
  if (options.budgetPolicy) {
    await settings.saveBudgetPolicy(options.budgetPolicy);
  }
  const providerRuntime = await createProviderRuntime(settings, {
    env: options.env,
    fetch: options.fetch,
    fallbackProvider: options.fallbackProvider
  });

  const stores = {
    agentRuns: {
      agentRuns,
      llmCallLogs
    },
    contextPacks,
    promptVersions,
    settings,
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
  const orchestration = createAgentOrchestrationService(
    {
      projects: projectService,
      contextPacks,
      agentRuns,
      llmCallLogs,
      workflowRuns,
      durableJobs
    },
    providerRuntime.createGateway
  );

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

async function seedDefaultPromptVersions(promptVersions: PromptVersionRepository): Promise<void> {
  for (const promptVersion of defaultPromptVersions) {
    if (!(await promptVersions.findById(promptVersion.id))) {
      await promptVersions.save(promptVersion);
    }
  }
}
