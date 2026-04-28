import type { ArtifactStore as ArtifactContentStore } from '@ai-novel/artifacts';
import {
  createAgentRun,
  createArtifactRecord,
  createLlmCallRecord,
  type AgentRun,
  type ArtifactRecord,
  type ContextPack,
  type EntityId,
  type LlmCallRecord,
  type Project
} from '@ai-novel/domain';
import {
  createDurableJob,
  createTaskContract,
  transitionJob,
  type DurableJob,
  type WorkflowRun,
  runWritingWorkflow,
  WorkflowRunner,
  type WritingWorkflowInput,
  type WritingWorkflowResult
} from '@ai-novel/workflow';
import type { LlmGateway } from '@ai-novel/llm-gateway';
import type { ArtifactMetadataStore, ContextPackStore, LlmCallLogStore } from './agent-orchestration.service';
import type { ContextBuildService } from './context-build.service';
import type { ProviderRuntime } from './provider-runtime';

export interface WritingRunProjectLookup {
  findById(id: string): Project | null | Promise<Project | null>;
}

export interface WritingRunAgentRunStore {
  save(agentRun: AgentRun): Promise<void>;
}

export interface WritingRunWorkflowRunStore {
  save(run: WorkflowRun): Promise<void>;
}

export interface WritingRunDurableJobStore {
  save(job: DurableJob): Promise<void>;
}

export interface PersistedWritingWorkflowResult extends WritingWorkflowResult {
  agentRunId: EntityId<'agent_run'>;
  workflowRunId: string;
  durableJobId: string;
  draftArtifact: WritingWorkflowResult['draftArtifact'] & {
    artifactRecordId: EntityId<'artifact'>;
  };
  selfCheckArtifact: WritingWorkflowResult['selfCheckArtifact'] & {
    artifactRecordId: EntityId<'artifact'>;
  };
}

export interface PersistentWritingRunService {
  start(input: WritingWorkflowInput): Promise<PersistedWritingWorkflowResult>;
}

export function createPersistentWritingRunService(input: {
  projects: WritingRunProjectLookup;
  contextBuildService: ContextBuildService;
  providerRuntime: ProviderRuntime;
  contextPacks: ContextPackStore;
  artifacts: ArtifactMetadataStore;
  artifactContent: ArtifactContentStore;
  agentRuns: WritingRunAgentRunStore;
  llmCallLogs: LlmCallLogStore;
  workflowRuns: WritingRunWorkflowRunStore;
  durableJobs: WritingRunDurableJobStore;
  model?: string;
}): PersistentWritingRunService {
  return new RepositoryWritingRunService(input);
}

class RepositoryWritingRunService implements PersistentWritingRunService {
  private readonly runner = new WorkflowRunner();

  constructor(
    private readonly dependencies: {
      projects: WritingRunProjectLookup;
      contextBuildService: ContextBuildService;
      providerRuntime: ProviderRuntime;
      contextPacks: ContextPackStore;
      artifacts: ArtifactMetadataStore;
      artifactContent: ArtifactContentStore;
      agentRuns: WritingRunAgentRunStore;
      llmCallLogs: LlmCallLogStore;
      workflowRuns: WritingRunWorkflowRunStore;
      durableJobs: WritingRunDurableJobStore;
      model?: string;
    }
  ) {}

  async start(input: WritingWorkflowInput): Promise<PersistedWritingWorkflowResult> {
    const project = await this.dependencies.projects.findById(input.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const promptVersionId = 'prompt_default';
    const job = createDurableJob({
      workflowType: 'writing.run',
      payload: {
        projectId: input.projectId,
        target: input.target,
        taskType: 'writing_draft'
      }
    });
    await this.dependencies.durableJobs.save(job);
    const runningJob = transitionJob(job, 'Running');
    await this.dependencies.durableJobs.save(runningJob);

    let agentRun: AgentRun | null = null;
    let contextPack: ContextPack | null = null;
    try {
      const builtContext = await this.dependencies.contextBuildService.build({
        projectId: input.projectId,
        taskGoal: input.contract.goal,
        agentRole: 'Writer',
        riskLevel: 'Medium',
        query: input.retrieval.query,
        maxContextItems: input.retrieval.maxContextItems,
        maxSectionChars: input.retrieval.maxSectionChars
      });
      agentRun = createAgentRun({
        agentName: 'Writer',
        taskType: 'writing_draft',
        workflowType: 'writing.run',
        promptVersionId,
        contextPackId: builtContext.id
      });
      contextPack = await this.attachContextPackArtifact(builtContext, agentRun.id);
      await this.dependencies.contextPacks.save(contextPack);
      await this.dependencies.agentRuns.save({ ...agentRun, status: 'Running' });

      const gateway = await this.dependencies.providerRuntime.createGateway({ promptVersionId });
      const result = await runWritingWorkflow(input, {
        provider: gateway,
        buildContext: () => contextPack as ContextPack,
        model: this.dependencies.model
      });

      const draftArtifact = await this.persistOutputArtifact({
        name: `${result.draftArtifact.id}.json`,
        relatedRunId: agentRun.id,
        payload: {
          relatedRunId: agentRun.id,
          ...result.draftArtifact
        }
      });
      const selfCheckArtifact = await this.persistOutputArtifact({
        name: `${result.selfCheckArtifact.id}.json`,
        relatedRunId: agentRun.id,
        payload: {
          relatedRunId: agentRun.id,
          ...result.selfCheckArtifact
        }
      });

      const succeededAgentRun = { ...agentRun, status: 'Succeeded' as const };
      await this.dependencies.agentRuns.save(succeededAgentRun);
      const llmCalls = await this.persistLlmCalls(gateway, succeededAgentRun.id);
      const workflowRun = await this.persistWorkflowRun(input, {
        contextPack,
        agentRun: succeededAgentRun,
        draftArtifact,
        selfCheckArtifact,
        llmCalls
      });
      const succeededJob: DurableJob = {
        ...transitionJob(runningJob, 'Succeeded'),
        payload: {
          ...runningJob.payload,
          contextPackId: contextPack.id,
          agentRunId: succeededAgentRun.id,
          workflowRunId: workflowRun.id,
          draftArtifactId: draftArtifact.id,
          selfCheckArtifactId: selfCheckArtifact.id,
          status: 'AwaitingAcceptance'
        }
      };
      await this.dependencies.durableJobs.save(succeededJob);

      return {
        ...result,
        id: succeededAgentRun.id,
        agentRunId: succeededAgentRun.id,
        workflowRunId: workflowRun.id,
        durableJobId: succeededJob.id,
        contextPack,
        draftArtifact: {
          ...result.draftArtifact,
          artifactRecordId: draftArtifact.id
        },
        selfCheckArtifact: {
          ...result.selfCheckArtifact,
          artifactRecordId: selfCheckArtifact.id
        }
      };
    } catch (error) {
      if (agentRun) {
        await this.dependencies.agentRuns.save({ ...agentRun, status: 'Failed' });
      }
      await this.dependencies.durableJobs.save({
        ...transitionJob(runningJob, 'Failed'),
        payload: {
          ...runningJob.payload,
          ...(contextPack ? { contextPackId: contextPack.id } : {}),
          ...(agentRun ? { agentRunId: agentRun.id } : {}),
          error: error instanceof Error ? error.message : 'Writing run failed'
        }
      });
      throw error;
    }
  }

  private async attachContextPackArtifact(
    contextPack: ContextPack,
    relatedRunId: EntityId<'agent_run'>
  ): Promise<ContextPack> {
    const stored = await this.dependencies.artifactContent.writeText(
      `${contextPack.id}.json`,
      JSON.stringify({ ...contextPack, relatedRunId })
    );
    const artifact = createArtifactRecord({
      type: 'context_pack',
      source: 'agent_run',
      version: 1,
      hash: stored.hash,
      uri: stored.uri,
      relatedRunId
    });
    await this.dependencies.artifacts.save(artifact);

    return { ...contextPack, artifactId: artifact.id };
  }

  private async persistOutputArtifact(input: {
    name: string;
    relatedRunId: EntityId<'agent_run'>;
    payload: Record<string, unknown>;
  }): Promise<ArtifactRecord> {
    const stored = await this.dependencies.artifactContent.writeText(input.name, JSON.stringify(input.payload));
    const artifact = createArtifactRecord({
      type: 'agent_output',
      source: 'agent_run',
      version: 1,
      hash: stored.hash,
      uri: stored.uri,
      relatedRunId: input.relatedRunId
    });
    await this.dependencies.artifacts.save(artifact);
    return artifact;
  }

  private async persistLlmCalls(gateway: LlmGateway, agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]> {
    const records = gateway.callLog.map((entry) =>
      createLlmCallRecord({
        agentRunId,
        ...entry
      })
    );

    for (const record of records) {
      await this.dependencies.llmCallLogs.save(record);
    }

    return records;
  }

  private async persistWorkflowRun(
    input: WritingWorkflowInput,
    persisted: {
      contextPack: ContextPack;
      agentRun: AgentRun;
      draftArtifact: ArtifactRecord;
      selfCheckArtifact: ArtifactRecord;
      llmCalls: LlmCallRecord[];
    }
  ): Promise<WorkflowRun> {
    const workflowRun = await this.runner.run(
      createTaskContract({
        projectId: input.projectId,
        taskType: 'writing_draft',
        agentRole: 'Writer',
        riskLevel: 'Medium',
        outputSchema: 'WritingWorkflowResult'
      }),
      [
        {
          name: 'create_context_pack',
          artifactIds: [persisted.contextPack.artifactId ?? persisted.contextPack.id],
          status: 'Succeeded'
        },
        { name: 'create_agent_run', artifactIds: [persisted.agentRun.id], status: 'Succeeded' },
        { name: 'generate_draft', artifactIds: [persisted.draftArtifact.id], status: 'Succeeded' },
        { name: 'self_check', artifactIds: [persisted.selfCheckArtifact.id], status: 'Succeeded' },
        {
          name: 'persist_llm_call_log',
          artifactIds: persisted.llmCalls.map((record) => record.id),
          status: 'Succeeded'
        }
      ]
    );
    await this.dependencies.workflowRuns.save(workflowRun);
    return workflowRun;
  }
}
