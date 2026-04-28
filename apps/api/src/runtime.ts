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
import { createProjectBundle, type EntityId, type Project, type ProviderAdapter } from '@ai-novel/domain';
import type {
  AgentRoomActionRepositories,
  BackupRecord,
  BackupWorkflowDependencies,
  ScheduledBackupPolicy
} from '@ai-novel/workflow';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
import { createAcceptanceWorkflowService } from './services/acceptance-workflow.service';
import { createContextBuildService } from './services/context-build.service';
import { createDurableWorkerService } from './services/durable-worker.service';
import { createGovernanceGateService } from './services/governance-gate.service';
import { ManuscriptService } from './services/manuscript.service';
import { createProviderRuntime } from './services/provider-runtime';
import { PersistentProjectService } from './services/project.service';
import { SettingsService } from './services/settings.service';
import { createPersistentWritingRunService } from './services/writing-run.service';

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
  const searchStore = createRepositorySearchStore(search);
  const contextBuildService = createContextBuildService({
    search: searchStore,
    settingsService
  });

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
      contextBuildService,
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
    durableJobs,
    governance
  });
  configurePersistentGovernanceRouteStore(governance);
  configurePersistentBranchRetconRouteStore(branchRetcon);
  const governanceGate = createGovernanceGateService(governance);
  const durableWorker = createDurableWorkerService({ durableJobs, handlers: [] });
  const reviewLearningDependencies = {
    ...createDefaultReviewLearningDependencies(),
    store: reviewLearning
  };
  const backup = createPersistentBackupDependencies({
    root: resolveBackupRoot(filename),
    projects: projectRepository,
    artifacts,
    manuscripts,
    agentRuns,
    settings,
    bundles: projectBundles,
    durableJobs
  });

  return {
    app: buildApp({
      acceptanceWorkflow: createAcceptanceWorkflowService({
        manuscriptService,
        memoryRepository: memory,
        governanceGate
      }),
      agentRoom,
      agentRuns: stores.agentRuns,
      approvals: createRepositoryApprovalStore(memory),
      artifacts,
      artifactContent,
      backup,
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
      writingRuns: createPersistentWritingRunService({
        projects: projectService,
        contextBuildService,
        providerRuntime,
        contextPacks,
        artifacts,
        artifactContent,
        agentRuns,
        llmCallLogs,
        workflowRuns,
        durableJobs
      }),
      workflow: {
        ...stores.workflow,
        worker: durableWorker
      }
    }),
    database,
    stores
  };
}

function createPersistentBackupDependencies(input: {
  root: string;
  projects: ProjectRepository;
  artifacts: ArtifactRepository;
  manuscripts: ManuscriptRepository;
  agentRuns: AgentRunRepository;
  settings: SettingsRepository;
  bundles: ProjectBundleRepository;
  durableJobs: DurableJobRepository;
}): BackupWorkflowDependencies {
  const store = createFilesystemBackupStore(input.root);

  return {
    clock: { now: () => new Date().toISOString() },
    ids: {
      createJobId: () => createLocalId('backup_job'),
      createBackupId: () => createLocalId('backup'),
      createRestoreId: () => createLocalId('restore')
    },
    hash: (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    store,
    repository: {
      async readProjectSnapshot(projectId) {
        const project = await input.projects.findById(projectId);
        if (!project) throw new Error('Project not found');
        const manuscript = await input.manuscripts.findByProjectId(projectId);
        const chapters = manuscript ? await input.manuscripts.listChapters(manuscript.id) : [];
        return {
          project,
          manuscripts: manuscript ? [{ ...manuscript, chapters }] : [],
          artifacts: await input.artifacts.list({ limit: 1000 }),
          runs: await input.agentRuns.list({ limit: 1000 }),
          settings: {
            provider: await input.settings.findProviderSettings('openai'),
            budget: await input.settings.findBudgetPolicy('openai')
          },
          exportedAt: new Date().toISOString()
        };
      },
      backupPathFor(backupId) {
        return join('backups', `${backupId}.json`);
      },
      async saveBackupRecord(record) {
        await input.bundles.saveBackup({
          path: record.path,
          bundle: createProjectBundle({
            project: {
              id: record.projectId,
              backupWorkflowRecord: record
            },
            settingsSnapshot: { backupWorkflowRecord: record },
            createdAt: record.createdAt
          }),
          createdAt: record.createdAt
        });
      },
      async findBackupByPath(path) {
        const bundle = await input.bundles.findBackupByPath(path);
        return readBackupRecordFromBundle(bundle?.settingsSnapshot);
      },
      async restoreProject(targetProjectId, payload) {
        await input.projects.save(projectFromBackupPayload(targetProjectId, payload));
      },
      async saveRestoreRecord(record) {
        await input.durableJobs.save({
          id: record.id,
          workflowType: 'backup.restore',
          payload: { ...record },
          status: 'Succeeded',
          retryCount: 0
        });
      }
    }
  };
}

function createFilesystemBackupStore(root: string): BackupWorkflowDependencies['store'] {
  const rootPath = resolve(root);
  return {
    async writeText(path, content) {
      const absolutePath = resolveInsideRoot(rootPath, path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, 'utf8');
    },
    async readText(path) {
      return readFile(resolveInsideRoot(rootPath, path), 'utf8');
    }
  };
}

function resolveInsideRoot(rootPath: string, path: string): string {
  const absolutePath = resolve(rootPath, path);
  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}\\`) && !absolutePath.startsWith(`${rootPath}/`)) {
    throw new Error('Backup path escapes store root');
  }
  return absolutePath;
}

function readBackupRecordFromBundle(snapshot: Record<string, unknown> | undefined): BackupRecord | undefined {
  const record = snapshot?.backupWorkflowRecord;
  if (!record || typeof record !== 'object') return undefined;
  return record as BackupRecord;
}

function projectFromBackupPayload(targetProjectId: string, payload: unknown): Project {
  const snapshot = payload as { project?: Partial<Project> };
  const source = snapshot?.project;
  if (!source?.title || !source.language || !source.status || !source.readerContract || !source.createdAt || !source.updatedAt) {
    throw new Error('Backup payload does not contain a restorable project');
  }

  return {
    id: targetProjectId as Project['id'],
    title: source.title,
    language: source.language,
    status: source.status,
    readerContract: source.readerContract,
    createdAt: source.createdAt,
    updatedAt: new Date().toISOString()
  };
}

function createPersistentAgentRoomRepositories(input: {
  agentRuns: AgentRunRepository;
  workflowRuns: WorkflowRunRepository;
  contextPacks: ContextPackRepository;
  artifacts: ArtifactRepository;
  llmCallLogs: LlmCallLogRepository;
  durableJobs: DurableJobRepository;
  governance: GovernanceRepository;
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
      listByRunId: async (agentRunId) =>
        (await input.governance.listApprovalReferencesBySourceRunId(agentRunId)).map((reference) => ({
          id: reference.id,
          runId: agentRunId,
          title: reference.reason,
          riskLevel: reference.riskLevel,
          status: reference.status,
          createdAt: reference.createdAt
        }))
    },
    durableJobs: {
      getByAgentRunId: (agentRunId) => input.durableJobs.findByAgentRunId(agentRunId),
      findReplayLineage: (jobId) => input.durableJobs.findReplayLineage(jobId),
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

function resolveBackupRoot(filename: string): string {
  if (filename === ':memory:') {
    return join(tmpdir(), `ai-novel-backups-${randomUUID()}`);
  }

  return resolve(dirname(resolve(filename)), 'backups');
}

function createLocalId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

async function seedDefaultPromptVersions(promptVersions: PromptVersionRepository): Promise<void> {
  for (const promptVersion of defaultPromptVersions) {
    if (!(await promptVersions.findById(promptVersion.id))) {
      await promptVersions.save(promptVersion);
    }
  }
}
