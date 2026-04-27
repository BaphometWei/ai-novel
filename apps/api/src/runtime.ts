import {
  AgentRunRepository,
  ArtifactRepository,
  BranchRetconRepository,
  ContextPackRepository,
  createDatabase,
  DurableJobRepository,
  GovernanceRepository,
  KnowledgeRepository,
  LlmCallLogRepository,
  migrateDatabase,
  ManuscriptRepository,
  MemoryRepository,
  MigrationHistoryRepository,
  NarrativeStateRepository,
  PromptVersionRepository,
  ProjectBundleRepository,
  type PromptVersion,
  ProjectRepository,
  ReviewLearningRepository,
  ReviewRepository,
  SerializationRepository,
  SearchRepository,
  SettingsRepository,
  ScheduledBackupRepository,
  scheduledBackupPolicies,
  VersionHistoryRepository,
  type AppDatabase,
  type BudgetPolicy,
  type ProviderSettingsSaveInput,
  WorkflowRunRepository
} from '@ai-novel/db';
import { FilesystemArtifactStore } from '@ai-novel/artifacts';
import type { EntityId, ProviderAdapter } from '@ai-novel/domain';
import type { AgentRoomActionRepositories, ScheduledBackupPolicy } from '@ai-novel/workflow';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { buildApp } from './app';
import { createRepositoryApprovalStore } from './routes/approvals.routes';
import { configurePersistentBranchRetconRouteStore } from './routes/branch-retcon.routes';
import { configurePersistentGovernanceRouteStore } from './routes/governance.routes';
import { createPersistentImportExportStore } from './routes/import-export.routes';
import type { ScheduledBackupRouteStore } from './routes/scheduled-backup.routes';
import { createRepositorySearchStore } from './routes/search.routes';
import { createDefaultReviewLearningDependencies } from './routes/review-learning.routes';
import { createAgentOrchestrationService } from './services/agent-orchestration.service';
import { ManuscriptService } from './services/manuscript.service';
import { createProviderRuntime } from './services/provider-runtime';
import { PersistentProjectService } from './services/project.service';
import { SettingsService } from './services/settings.service';

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
  const artifacts = new ArtifactRepository(database.db);
  const artifactContent = new FilesystemArtifactStore(resolveArtifactRoot(filename));
  const contextPacks = new ContextPackRepository(database.db);
  const agentRuns = new AgentRunRepository(database.db);
  const manuscripts = new ManuscriptRepository(database.db);
  const manuscriptService = new ManuscriptService(projectService, manuscripts, artifacts, artifactContent);
  const llmCallLogs = new LlmCallLogRepository(database.db);
  const durableJobs = new DurableJobRepository(database.db);
  const projectBundles = new ProjectBundleRepository(database.db);
  const workflowRuns = new WorkflowRunRepository(database.db);
  const promptVersions = new PromptVersionRepository(database.db);
  const settings = new SettingsRepository(database.db);
  const search = new SearchRepository(database.client);
  const memory = new MemoryRepository(database.db);
  const versionHistory = new VersionHistoryRepository(database.db);
  const migrationHistory = new MigrationHistoryRepository(database.db);
  const scheduledBackups = new ScheduledBackupRepository(database.db);
  const governance = new GovernanceRepository(database.db);
  const reviewLearning = new ReviewLearningRepository(database.db);
  const branchRetcon = new BranchRetconRepository(database.db);
  const narrativeStates = new NarrativeStateRepository(database.db);
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
  const settingsService = new SettingsService(settings);

  const stores = {
    agentRuns: {
      agentRuns,
      llmCallLogs,
      contextPacks
    },
    artifacts,
    artifactContent,
    contextPacks,
    manuscripts,
    manuscriptService,
    promptVersions,
    settings,
    projectRepository,
    projectService,
    versionHistory,
    migrationHistory,
    scheduledBackups,
    governance,
    reviewLearning,
    branchRetcon,
    narrativeStates,
    workbench: {
      projects: projectService,
      knowledge: new KnowledgeRepository(database.db),
      review: new ReviewRepository(database.db),
      serialization: new SerializationRepository(database.db)
    },
    workflow: {
      durableJobs,
      workflowRuns
    },
    importExport: {
      jobs: durableJobs,
      bundles: projectBundles
    }
  };
  const orchestration = createAgentOrchestrationService(
    {
      projects: projectService,
      contextPacks,
      artifacts,
      artifactContent,
      agentRuns,
      llmCallLogs,
      workflowRuns,
      durableJobs
    },
    providerRuntime.createGateway
  );
  const agentRoom = createPersistentAgentRoomRepositories({
    agentRuns,
    workflowRuns,
    contextPacks,
    artifacts,
    llmCallLogs,
    durableJobs
  });
  configurePersistentGovernanceRouteStore(governance);
  configurePersistentBranchRetconRouteStore(branchRetcon);
  const reviewLearningDependencies = {
    ...createDefaultReviewLearningDependencies(),
    store: reviewLearning
  };
  const searchStore = createRepositorySearchStore(search);

  return {
    app: buildApp({
      agentRoom,
      agentRuns: stores.agentRuns,
      approvals: createRepositoryApprovalStore(memory),
      artifacts,
      artifactContent,
      contextPacks,
      migrationHistory,
      narrativeIntelligence: {
        narrativeStates
      },
      manuscriptService,
      orchestration,
      observability: stores.agentRuns,
      projectService,
      importExport: createPersistentImportExportStore(stores.importExport),
      retrieval: {
        search: (input) => searchStore.search(input)
      },
      reviewLearning: reviewLearningDependencies,
      scheduledBackups: createPersistentScheduledBackupStore(database.db, scheduledBackups),
      search: searchStore,
      settingsService,
      versionHistory,
      workbench: stores.workbench,
      workflow: stores.workflow
    }),
    database,
    stores
  };
}

function createPersistentAgentRoomRepositories(input: {
  agentRuns: AgentRunRepository;
  workflowRuns: WorkflowRunRepository;
  contextPacks: ContextPackRepository;
  artifacts: ArtifactRepository;
  llmCallLogs: LlmCallLogRepository;
  durableJobs: DurableJobRepository;
}): AgentRoomActionRepositories {
  return {
    agentRuns: {
      list: () => input.agentRuns.list({}),
      getById: (id) => input.agentRuns.findById(id),
      save: (agentRun) => input.agentRuns.save(agentRun)
    },
    workflowRuns: {
      getByAgentRunId: async (agentRunId) => {
        const job = await input.durableJobs.findByAgentRunId(agentRunId);
        const workflowRunId = typeof job?.payload.workflowRunId === 'string' ? job.payload.workflowRunId : null;
        return workflowRunId ? input.workflowRuns.findById(workflowRunId) : null;
      }
    },
    contextPacks: {
      getById: (id) => input.contextPacks.findById(id)
    },
    artifacts: {
      listByRunId: async (agentRunId) =>
        (await input.artifacts.list({ limit: 1000 })).filter((artifact) => artifact.relatedRunId === agentRunId)
    },
    llmCallLogs: {
      listByRunId: (agentRunId) => input.llmCallLogs.findByAgentRunId(agentRunId as EntityId<'agent_run'>)
    },
    approvals: {
      listByRunId: async () => []
    },
    durableJobs: {
      getByAgentRunId: (agentRunId) => input.durableJobs.findByAgentRunId(agentRunId),
      save: (job) => input.durableJobs.save(job)
    }
  };
}

function createPersistentScheduledBackupStore(
  db: AppDatabase,
  repository: ScheduledBackupRepository
): ScheduledBackupRouteStore {
  return {
    upsert: (policy) => repository.upsert(policy),
    list: async () => {
      const rows = await db.select().from(scheduledBackupPolicies).all();
      return rows.map((row) => ({
        id: row.id,
        projectId: row.projectId,
        cadence: row.cadence as ScheduledBackupPolicy['cadence'],
        targetPathPrefix: row.targetPathPrefix,
        enabled: row.enabled === 1,
        lastRunAt: row.lastRunAt ?? undefined,
        nextRunAt: row.nextRunAt,
        retentionCount: row.retentionCount,
        lastRunStatus: (row.lastRunStatus ?? undefined) as ScheduledBackupPolicy['lastRunStatus']
      }));
    },
    findById: (id) => repository.findById(id),
    listDue: (now) => repository.listDue(now),
    updateRunStatus: (id, input) => repository.updateRunStatus(id, input)
  };
}

function resolveArtifactRoot(filename: string): string {
  if (filename === ':memory:') {
    return join(tmpdir(), `ai-novel-artifacts-${randomUUID()}`);
  }

  return resolve(dirname(resolve(filename)), 'artifacts');
}

async function seedDefaultPromptVersions(promptVersions: PromptVersionRepository): Promise<void> {
  for (const promptVersion of defaultPromptVersions) {
    if (!(await promptVersions.findById(promptVersion.id))) {
      await promptVersions.save(promptVersion);
    }
  }
}
