import Fastify from 'fastify';
import type { ArtifactStore } from '@ai-novel/artifacts';
import { createContextPack } from '@ai-novel/domain';
import { createFakeProvider } from '@ai-novel/llm-gateway';
import type { AgentRoomRepositories, BackupWorkflowDependencies } from '@ai-novel/workflow';
import { createHash, randomUUID } from 'node:crypto';
import { registerAgentRoomRoutes } from './routes/agent-room.routes';
import { createInMemoryAgentRunStores, registerAgentRunRoutes, type AgentRunRouteStores } from './routes/agent-runs.routes';
import { createInMemoryApprovalStore, registerApprovalRoutes, type ApprovalRouteStore } from './routes/approvals.routes';
import { registerArtifactRoutes, type ArtifactRouteStore } from './routes/artifacts.routes';
import { registerBackupRoutes } from './routes/backup.routes';
import { registerBranchRetconRoutes } from './routes/branch-retcon.routes';
import { registerContextPackRoutes, type ContextPackRouteStore } from './routes/context-packs.routes';
import { createInMemoryImportExportStore, registerImportExportRoutes, type ImportExportRouteStore } from './routes/import-export.routes';
import { registerGovernanceRoutes } from './routes/governance.routes';
import { registerManuscriptRoutes } from './routes/manuscripts.routes';
import { registerMemoryRoutes, type MemoryRouteDependencies } from './routes/memory.routes';
import { registerMigrationHistoryRoutes, type MigrationHistoryRouteStore } from './routes/migration-history.routes';
import { registerNarrativeIntelligenceRoutes, type NarrativeIntelligenceRouteDependencies } from './routes/narrative-intelligence.routes';
import { registerObservabilityRoutes, type ObservabilityRouteStores } from './routes/observability.routes';
import { registerOrchestrationRoutes } from './routes/orchestration.routes';
import { registerProjectRoutes } from './routes/projects.routes';
import { registerReviewLearningRoutes, type ReviewLearningRouteDependencies } from './routes/review-learning.routes';
import { registerRetrievalRoutes, type RetrievalRouteDependencies } from './routes/retrieval.routes';
import { createInMemorySearchStore, registerSearchRoutes, type GlobalSearchRouteStore } from './routes/search.routes';
import { createInMemoryScheduledBackupStore, registerScheduledBackupRoutes, type ScheduledBackupRouteStore } from './routes/scheduled-backup.routes';
import { registerSettingsRoutes } from './routes/settings.routes';
import { registerVersionHistoryRoutes, type VersionHistoryRouteStore } from './routes/version-history.routes';
import { createInMemoryWorkbenchStores, registerWorkbenchRoutes, type WorkbenchRouteStores } from './routes/workbench.routes';
import { registerWritingRunRoutes, type WritingRunRouteDependencies } from './routes/writing-runs.routes';
import { registerWorkflowRoutes, type WorkflowRouteStores } from './routes/workflow.routes';
import type { AgentOrchestrationService } from './services/agent-orchestration.service';
import type { AcceptanceWorkflowService } from './services/acceptance-workflow.service';
import type { ManuscriptService } from './services/manuscript.service';
import { ProjectService, type ProjectServiceLike } from './services/project.service';
import type { SettingsService } from './services/settings.service';

export interface BuildAppOptions {
  harnessMode?: 'strict' | 'demo';
  agentRoom?: AgentRoomRepositories;
  agentRuns?: AgentRunRouteStores;
  acceptanceWorkflow?: AcceptanceWorkflowService;
  approvals?: ApprovalRouteStore;
  artifacts?: ArtifactRouteStore;
  artifactContent?: ArtifactStore;
  backup?: BackupWorkflowDependencies;
  contextPacks?: ContextPackRouteStore;
  importExport?: ImportExportRouteStore;
  memory?: MemoryRouteDependencies;
  migrationHistory?: MigrationHistoryRouteStore;
  narrativeIntelligence?: NarrativeIntelligenceRouteDependencies;
  manuscriptService?: ManuscriptService;
  observability?: ObservabilityRouteStores;
  orchestration?: AgentOrchestrationService;
  projectService?: ProjectServiceLike;
  reviewLearning?: ReviewLearningRouteDependencies;
  retrieval?: RetrievalRouteDependencies;
  scheduledBackups?: ScheduledBackupRouteStore;
  search?: GlobalSearchRouteStore;
  settingsService?: SettingsService;
  versionHistory?: VersionHistoryRouteStore;
  workbench?: WorkbenchRouteStores;
  writingRuns?: WritingRunRouteDependencies;
  workflow?: WorkflowRouteStores;
}

export function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: false });
  const projectService = options.projectService ?? new ProjectService();
  const harnessMode = options.harnessMode ?? 'strict';

  app.get('/health', async () => ({
    ok: true,
    service: 'ai-novel-api'
  }));

  registerProjectRoutes(app, projectService);
  registerSettingsRoutes(app, options.settingsService);
  registerAgentRoomRoutes(app, options.agentRoom ?? createEmptyAgentRoomRepositories());
  registerApprovalRoutes(app, options.approvals ?? createInMemoryApprovalStore());
  registerBackupRoutes(
    app,
    options.backup ?? (harnessMode === 'demo' ? createInMemoryBackupDependencies() : createUnavailableBackupDependencies())
  );
  registerImportExportRoutes(app, options.importExport ?? createInMemoryImportExportStore());
  registerMemoryRoutes(app, options.memory ?? createInMemoryMemoryDependencies());
  registerWritingRunRoutes(
    app,
    options.writingRuns ?? (harnessMode === 'demo' ? createDefaultWritingRunDependencies() : createUnavailableWritingRunDependencies())
  );
  registerAgentRunRoutes(app, options.agentRuns);
  registerObservabilityRoutes(app, options.observability ?? options.agentRuns ?? createInMemoryAgentRunStores());
  registerMigrationHistoryRoutes(app, options.migrationHistory ?? createInMemoryMigrationHistoryStore());
  registerNarrativeIntelligenceRoutes(app, options.narrativeIntelligence);
  registerRetrievalRoutes(app, options.retrieval);
  registerBranchRetconRoutes(app);
  registerGovernanceRoutes(app);
  if (options.artifacts) {
    registerArtifactRoutes(app, options.artifacts);
  }
  if (options.contextPacks) {
    registerContextPackRoutes(app, {
      contextPacks: options.contextPacks,
      artifacts: options.artifacts,
      artifactContent: options.artifactContent
    });
  }
  if (options.manuscriptService) {
    registerManuscriptRoutes(app, options.manuscriptService, options.acceptanceWorkflow);
  }
  if (options.orchestration) {
    registerOrchestrationRoutes(app, options.orchestration);
  }
  registerSearchRoutes(app, options.search ?? createInMemorySearchStore());
  registerScheduledBackupRoutes(app, options.scheduledBackups ?? createInMemoryScheduledBackupStore());
  registerReviewLearningRoutes(app, options.reviewLearning);
  if (options.versionHistory) {
    registerVersionHistoryRoutes(app, options.versionHistory);
  }
  registerWorkbenchRoutes(app, options.workbench ?? createInMemoryWorkbenchStores(projectService));
  registerWorkflowRoutes(app, options.workflow);

  return app;
}

function createInMemoryMigrationHistoryStore(): MigrationHistoryRouteStore {
  return {
    list: async () => []
  };
}

function createEmptyAgentRoomRepositories(): AgentRoomRepositories {
  return {
    agentRuns: {
      list: async () => [],
      getById: async () => null
    },
    workflowRuns: {
      getByAgentRunId: async () => null
    },
    contextPacks: {
      getById: async () => null
    },
    artifacts: {
      listByRunId: async () => []
    },
    llmCallLogs: {
      listByRunId: async () => []
    }
  };
}

function createInMemoryBackupDependencies(): BackupWorkflowDependencies {
  const writes = new Map<string, string>();
  const backups = new Map<string, Parameters<BackupWorkflowDependencies['repository']['saveBackupRecord']>[0]>();
  const restores: unknown[] = [];

  return {
    clock: { now: () => new Date().toISOString() },
    ids: {
      createJobId: () => createLocalId('backup_job'),
      createBackupId: () => createLocalId('backup'),
      createRestoreId: () => createLocalId('restore')
    },
    hash: (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    store: {
      writeText(path, content) {
        writes.set(path, content);
      },
      readText(path) {
        const content = writes.get(path);
        if (!content) throw new Error(`Missing backup at ${path}`);
        return content;
      }
    },
    repository: {
      readProjectSnapshot(projectId) {
        return { project: { id: projectId }, exportedAt: new Date().toISOString() };
      },
      backupPathFor(backupId) {
        return `memory://${backupId}.json`;
      },
      saveBackupRecord(record) {
        backups.set(record.path, record);
      },
      findBackupByPath(path) {
        return backups.get(path);
      },
      restoreProject(targetProjectId, payload) {
        restores.push({ targetProjectId, payload });
      },
      saveRestoreRecord(record) {
        restores.push(record);
      }
    }
  };
}

function createUnavailableBackupDependencies(): BackupWorkflowDependencies {
  return {
    clock: { now: () => new Date().toISOString() },
    ids: {
      createJobId: () => createLocalId('backup_job'),
      createBackupId: () => createLocalId('backup'),
      createRestoreId: () => createLocalId('restore')
    },
    hash: (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex'),
    store: {
      writeText() {
        throw new Error('Backup dependencies are not configured');
      },
      readText() {
        throw new Error('Backup dependencies are not configured');
      }
    },
    repository: {
      readProjectSnapshot() {
        throw new Error('Backup dependencies are not configured');
      },
      backupPathFor(backupId) {
        return `unconfigured://${backupId}.json`;
      },
      saveBackupRecord() {
        throw new Error('Backup dependencies are not configured');
      },
      findBackupByPath() {
        throw new Error('Backup dependencies are not configured');
      },
      restoreProject() {
        throw new Error('Backup dependencies are not configured');
      },
      saveRestoreRecord() {
        throw new Error('Backup dependencies are not configured');
      }
    }
  };
}

function createInMemoryMemoryDependencies(): MemoryRouteDependencies {
  return {
    extractor: {
      extract: () => []
    },
    clock: () => new Date().toISOString(),
    createId: (prefix) => createLocalId(prefix),
    repository: {
      saveCandidate: () => undefined,
      saveApprovalRequest: () => undefined
    }
  };
}

function createDefaultWritingRunDependencies(): WritingRunRouteDependencies {
  return {
    provider: createFakeProvider({
      text: 'Deterministic writing draft',
      structured: {
        summary: 'Draft follows the writing contract.',
        passed: true,
        findings: []
      },
      embedding: [],
      usage: { inputTokens: 120, outputTokens: 40 }
    }),
    buildContext(input) {
      return createContextPack({
        taskGoal: input.taskGoal,
        agentRole: input.agentRole,
        riskLevel: input.riskLevel,
        sections: [],
        citations: [],
        exclusions: [],
        warnings: [],
        retrievalTrace: [`query:${input.query}`]
      });
    }
  };
}

function createUnavailableWritingRunDependencies(): WritingRunRouteDependencies {
  return {
    async start() {
      throw new Error('Writing run dependencies are not configured');
    }
  };
}

function createLocalId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}
