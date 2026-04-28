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
  buildWritingDraftPrompt,
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
  findById(id: string): Promise<DurableJob | null>;
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

export type PreparedWritingRunStatus = 'Prepared' | 'Cancelled';

export interface PreparedWritingRun {
  id: string;
  projectId: EntityId<'project'>;
  agentRunId: EntityId<'agent_run'>;
  status: PreparedWritingRunStatus;
  confirmationRequired: boolean;
  provider: {
    provider: string;
    model: string;
    isExternal: boolean;
    secretConfigured: boolean;
  };
  budgetEstimate: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
    maxRunCostUsd?: number;
  };
  warnings: string[];
  blockingReasons: string[];
  expiresAt: string;
  contextPack: ContextPack;
}

export interface ExecutePreparedWritingRunInput {
  confirmed: boolean;
  confirmedBy?: string;
}

export interface CancelPreparedWritingRunInput {
  cancelledBy?: string;
}

export interface PersistentWritingRunService {
  start(input: WritingWorkflowInput): Promise<PersistedWritingWorkflowResult>;
  prepare(input: WritingWorkflowInput): Promise<PreparedWritingRun>;
  executePrepared(
    projectId: EntityId<'project'>,
    preparedRunId: string,
    input: ExecutePreparedWritingRunInput
  ): Promise<PersistedWritingWorkflowResult>;
  cancelPrepared(
    projectId: EntityId<'project'>,
    preparedRunId: string,
    input?: CancelPreparedWritingRunInput
  ): Promise<PreparedWritingRun>;
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
    const directInspection = await this.dependencies.providerRuntime.inspectSend({
      promptVersionId,
      prompt: input.contract.goal,
      allowExternalModel: project.externalModelPolicy !== 'Disabled'
    });
    if (directInspection.isExternal && project.externalModelPolicy === 'Disabled') {
      throw new Error('External model use is disabled for this project');
    }
    if (directInspection.isExternal) {
      throw new Error('Pre-send inspection is required for external writing runs');
    }

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

      const gateway = await this.dependencies.providerRuntime.createGateway({
        promptVersionId,
        allowExternalModel: project.externalModelPolicy !== 'Disabled'
      });
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

  async prepare(input: WritingWorkflowInput): Promise<PreparedWritingRun> {
    const project = await this.dependencies.projects.findById(input.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const promptVersionId = 'prompt_default';
    const builtContext = await this.dependencies.contextBuildService.build({
      projectId: input.projectId,
      taskGoal: input.contract.goal,
      agentRole: 'Writer',
      riskLevel: 'Medium',
      query: input.retrieval.query,
      maxContextItems: input.retrieval.maxContextItems,
      maxSectionChars: input.retrieval.maxSectionChars
    });
    const agentRun = createAgentRun({
      agentName: 'Writer',
      taskType: 'writing_draft',
      workflowType: 'writing.run',
      promptVersionId,
      contextPackId: builtContext.id
    });
    const contextPack = await this.attachContextPackArtifact(builtContext, agentRun.id);
    await this.dependencies.contextPacks.save(contextPack);
    await this.dependencies.agentRuns.save({ ...agentRun, status: 'Queued' });

    const inspection = await this.dependencies.providerRuntime.inspectSend({
      promptVersionId,
      prompt: buildWritingDraftPrompt(input, contextPack),
      allowExternalModel: project.externalModelPolicy !== 'Disabled'
    });
    const job = transitionJob(
      createDurableJob({
        workflowType: 'writing.prepare',
        payload: {
          projectId: input.projectId,
          target: input.target,
          input,
          contextPackId: contextPack.id,
          agentRunId: agentRun.id,
          provider: inspection.provider,
          model: inspection.model,
          isExternal: inspection.isExternal,
          secretConfigured: inspection.secretConfigured,
          budgetEstimate: inspection.budgetEstimate,
          warnings: inspection.warnings,
          blockingReasons: inspection.blockingReasons,
          expiresAt: expiresAt(),
          createdAt: new Date().toISOString()
        }
      }),
      'Paused'
    );
    await this.dependencies.durableJobs.save(job);

    return this.toPreparedWritingRun(job, contextPack);
  }

  async executePrepared(
    projectId: EntityId<'project'>,
    preparedRunId: string,
    input: ExecutePreparedWritingRunInput
  ): Promise<PersistedWritingWorkflowResult> {
    if (!input.confirmed) {
      throw new Error('Prepared writing run requires confirmation');
    }

    const loaded = await this.loadPreparedJob(projectId, preparedRunId);
    const { job, payload, contextPack } = loaded;
    if (job.status === 'Cancelled') {
      throw new Error('Prepared writing run is cancelled');
    }
    if (job.status !== 'Paused') {
      throw new Error('Prepared writing run is not executable');
    }
    if (payload.expiresAt < new Date().toISOString()) {
      throw new Error('Prepared writing run is stale');
    }

    const project = await this.dependencies.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const promptVersionId = 'prompt_default';
    const inspection = await this.dependencies.providerRuntime.inspectSend({
      promptVersionId,
      prompt: buildWritingDraftPrompt(payload.input, contextPack),
      allowExternalModel: project.externalModelPolicy !== 'Disabled'
    });
    if (inspection.provider !== payload.provider || inspection.model !== payload.model) {
      throw new Error('Prepared writing run is stale');
    }
    if (inspection.blockingReasons.length > 0) {
      throw new Error(inspection.blockingReasons[0] ?? 'Prepared writing run has blocking warnings');
    }

    const agentRun = createAgentRun({
      agentName: 'Writer',
      taskType: 'writing_draft',
      workflowType: 'writing.run',
      promptVersionId,
      contextPackId: contextPack.id
    });
    const preparedAgentRun = {
      ...agentRun,
      id: payload.agentRunId,
      createdAt: contextPack.createdAt
    };
    const runningJob = transitionJob(job, 'Running');
    await this.dependencies.durableJobs.save(runningJob);
    await this.dependencies.agentRuns.save({ ...preparedAgentRun, status: 'Running' });

    try {
      const gateway = await this.dependencies.providerRuntime.createGateway({
        promptVersionId,
        allowExternalModel: project.externalModelPolicy !== 'Disabled'
      });
      const result = await runWritingWorkflow(payload.input, {
        provider: gateway,
        buildContext: () => contextPack,
        model: this.dependencies.model
      });
      return await this.persistPreparedExecution({
        input: payload.input,
        result,
        gateway,
        agentRun: preparedAgentRun,
        contextPack,
        runningJob,
        confirmedBy: input.confirmedBy
      });
    } catch (error) {
      await this.dependencies.agentRuns.save({ ...preparedAgentRun, status: 'Failed' });
      await this.dependencies.durableJobs.save({
        ...transitionJob(runningJob, 'Failed'),
        payload: {
          ...runningJob.payload,
          error: error instanceof Error ? error.message : 'Prepared writing run failed'
        }
      });
      throw error;
    }
  }

  async cancelPrepared(
    projectId: EntityId<'project'>,
    preparedRunId: string,
    input: CancelPreparedWritingRunInput = {}
  ): Promise<PreparedWritingRun> {
    const { job, payload, contextPack } = await this.loadPreparedJob(projectId, preparedRunId);
    if (job.status !== 'Paused') {
      throw new Error('Prepared writing run is not cancellable');
    }
    const cancelled = transitionJob(job, 'Cancelled');
    await this.dependencies.durableJobs.save({
      ...cancelled,
      payload: {
        ...job.payload,
        cancelledBy: input.cancelledBy,
        cancelledAt: new Date().toISOString()
      }
    });
    await this.dependencies.agentRuns.save({
      id: payload.agentRunId,
      agentName: 'Writer',
      taskType: 'writing_draft',
      workflowType: 'writing.run',
      promptVersionId: 'prompt_default',
      contextPackId: contextPack.id,
      status: 'Cancelled',
      createdAt: contextPack.createdAt
    });

    return this.toPreparedWritingRun({ ...cancelled, payload: { ...job.payload, status: 'Cancelled' } }, contextPack);
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

  private async persistPreparedExecution(input: {
    input: WritingWorkflowInput;
    result: WritingWorkflowResult;
    gateway: LlmGateway;
    agentRun: AgentRun;
    contextPack: ContextPack;
    runningJob: DurableJob;
    confirmedBy?: string;
  }): Promise<PersistedWritingWorkflowResult> {
    const draftArtifact = await this.persistOutputArtifact({
      name: `${input.result.draftArtifact.id}.json`,
      relatedRunId: input.agentRun.id,
      payload: {
        relatedRunId: input.agentRun.id,
        preparedRunId: input.runningJob.id,
        ...input.result.draftArtifact
      }
    });
    const selfCheckArtifact = await this.persistOutputArtifact({
      name: `${input.result.selfCheckArtifact.id}.json`,
      relatedRunId: input.agentRun.id,
      payload: {
        relatedRunId: input.agentRun.id,
        preparedRunId: input.runningJob.id,
        ...input.result.selfCheckArtifact
      }
    });

    const succeededAgentRun = { ...input.agentRun, status: 'Succeeded' as const };
    await this.dependencies.agentRuns.save(succeededAgentRun);
    const llmCalls = await this.persistLlmCalls(input.gateway, succeededAgentRun.id);
    const workflowRun = await this.persistWorkflowRun(input.input, {
      contextPack: input.contextPack,
      agentRun: succeededAgentRun,
      draftArtifact,
      selfCheckArtifact,
      llmCalls
    });
    const succeededJob: DurableJob = {
      ...transitionJob(input.runningJob, 'Succeeded'),
      payload: {
        ...input.runningJob.payload,
        confirmedBy: input.confirmedBy,
        confirmedAt: new Date().toISOString(),
        contextPackId: input.contextPack.id,
        agentRunId: succeededAgentRun.id,
        workflowRunId: workflowRun.id,
        draftArtifactId: draftArtifact.id,
        selfCheckArtifactId: selfCheckArtifact.id,
        status: 'AwaitingAcceptance'
      }
    };
    await this.dependencies.durableJobs.save(succeededJob);

    return {
      ...input.result,
      id: succeededAgentRun.id,
      agentRunId: succeededAgentRun.id,
      workflowRunId: workflowRun.id,
      durableJobId: succeededJob.id,
      contextPack: input.contextPack,
      draftArtifact: {
        ...input.result.draftArtifact,
        artifactRecordId: draftArtifact.id
      },
      selfCheckArtifact: {
        ...input.result.selfCheckArtifact,
        artifactRecordId: selfCheckArtifact.id
      }
    };
  }

  private async loadPreparedJob(projectId: EntityId<'project'>, preparedRunId: string): Promise<{
    job: DurableJob;
    payload: PreparedWritingRunPayload;
    contextPack: ContextPack;
  }> {
    const job = await this.dependencies.durableJobs.findById(preparedRunId);
    if (!job || job.workflowType !== 'writing.prepare') {
      throw new Error('Prepared writing run not found');
    }
    const payload = toPreparedPayload(job.payload);
    if (payload.projectId !== projectId) {
      throw new Error('Prepared writing run not found');
    }
    const contextPack = await this.dependencies.contextPacks.findById(payload.contextPackId);
    if (!contextPack) {
      throw new Error('Prepared writing run context not found');
    }

    return { job, payload, contextPack };
  }

  private toPreparedWritingRun(job: DurableJob, contextPack: ContextPack): PreparedWritingRun {
    const payload = toPreparedPayload(job.payload);
    return {
      id: job.id,
      projectId: payload.projectId,
      agentRunId: payload.agentRunId,
      status: job.status === 'Cancelled' ? 'Cancelled' : 'Prepared',
      confirmationRequired: true,
      provider: {
        provider: payload.provider,
        model: payload.model,
        isExternal: payload.isExternal,
        secretConfigured: payload.secretConfigured
      },
      budgetEstimate: payload.budgetEstimate,
      warnings: payload.warnings,
      blockingReasons: payload.blockingReasons,
      expiresAt: payload.expiresAt,
      contextPack
    };
  }
}

interface PreparedWritingRunPayload {
  projectId: EntityId<'project'>;
  input: WritingWorkflowInput;
  contextPackId: EntityId<'context_pack'>;
  agentRunId: EntityId<'agent_run'>;
  provider: string;
  model: string;
  isExternal: boolean;
  secretConfigured: boolean;
  budgetEstimate: PreparedWritingRun['budgetEstimate'];
  warnings: string[];
  blockingReasons: string[];
  expiresAt: string;
}

function expiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function toPreparedPayload(payload: DurableJob['payload']): PreparedWritingRunPayload {
  return payload as unknown as PreparedWritingRunPayload;
}
