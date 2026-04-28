import type { ArtifactStore as ArtifactContentStore } from '@ai-novel/artifacts';
import { createFakeProvider, LlmGateway } from '@ai-novel/llm-gateway';
import {
  createAgentRun,
  createArtifactRecord,
  createContextPack,
  createLlmCallRecord,
  type AgentRun,
  type ArtifactRecord,
  type ContextPack,
  type ContextSection,
  type EntityId,
  type LlmCallRecord,
  type Project,
  type RiskLevel
} from '@ai-novel/domain';
import {
  createDurableJob,
  assertAgentCanRunTask,
  createTaskContract,
  transitionJob,
  type DurableJob,
  type WorkflowRun,
  WorkflowRunner
} from '@ai-novel/workflow';
import type { ContextBuildService } from './context-build.service';

export interface ProjectLookup {
  findById(id: string): Project | null | Promise<Project | null>;
}

export interface ContextPackStore {
  save(contextPack: ContextPack): Promise<void>;
  findById(id: string): Promise<ContextPack | null>;
}

export interface ArtifactMetadataStore {
  save(artifact: ArtifactRecord): Promise<void>;
  findByHash(hash: string): Promise<ArtifactRecord | null>;
}

export interface AgentRunStore {
  save(agentRun: AgentRun): Promise<void>;
  findById(id: EntityId<'agent_run'>): Promise<AgentRun | null>;
}

export interface LlmCallLogStore {
  save(record: LlmCallRecord): Promise<void>;
  findByAgentRunId(agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]>;
}

export interface WorkflowRunStore {
  save(run: WorkflowRun): Promise<void>;
  findById(id: string): Promise<WorkflowRun | null>;
}

export interface DurableJobStore {
  save(job: DurableJob): Promise<void>;
  findById(id: string): Promise<DurableJob | null>;
}

export interface AgentOrchestrationStores {
  projects: ProjectLookup;
  contextBuildService?: ContextBuildService;
  contextPacks: ContextPackStore;
  artifacts?: ArtifactMetadataStore;
  artifactContent?: ArtifactContentStore;
  agentRuns: AgentRunStore;
  llmCallLogs: LlmCallLogStore;
  workflowRuns: WorkflowRunStore;
  durableJobs: DurableJobStore;
}

export interface StartAgentOrchestrationInput {
  projectId: EntityId<'project'>;
  workflowType: string;
  taskType: string;
  agentRole: string;
  taskGoal: string;
  riskLevel: RiskLevel;
  outputSchema: string;
  promptVersionId?: string;
  model?: string;
  contextSections?: ContextSection[];
  retrieval?: {
    query: string;
    maxContextItems?: number;
    maxSectionChars?: number;
  };
}

export type PreparedAgentOrchestrationRunStatus = 'Prepared' | 'Cancelled';

export interface PreparedAgentOrchestrationRun {
  id: string;
  projectId: EntityId<'project'>;
  agentRunId: EntityId<'agent_run'>;
  status: PreparedAgentOrchestrationRunStatus;
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

export interface ExecutePreparedAgentOrchestrationInput {
  confirmed: boolean;
  confirmedBy?: string;
}

export interface CancelPreparedAgentOrchestrationInput {
  cancelledBy?: string;
}

export interface AgentOrchestrationResult {
  orchestrationRunId: string;
  job: DurableJob;
  contextPack: ContextPack | null;
  agentRun: AgentRun | null;
  workflowRun: WorkflowRun | null;
  llmCalls: LlmCallRecord[];
  output: unknown;
}

export interface AgentOrchestrationService {
  start(input: StartAgentOrchestrationInput): Promise<AgentOrchestrationResult>;
  prepare(input: StartAgentOrchestrationInput): Promise<PreparedAgentOrchestrationRun>;
  executePrepared(preparedRunId: string, input: ExecutePreparedAgentOrchestrationInput): Promise<AgentOrchestrationResult>;
  cancelPrepared(preparedRunId: string, input?: CancelPreparedAgentOrchestrationInput): Promise<PreparedAgentOrchestrationRun>;
  findById(id: string): Promise<AgentOrchestrationResult | null>;
}

export interface AgentOrchestrationSendInspection {
  provider: string;
  model: string;
  isExternal: boolean;
  secretConfigured: boolean;
  budgetEstimate: PreparedAgentOrchestrationRun['budgetEstimate'];
  warnings: string[];
  blockingReasons: string[];
}

export interface AgentOrchestrationProviderRuntime {
  createGateway(input: { promptVersionId: string; allowExternalModel?: boolean }): LlmGateway | Promise<LlmGateway>;
  inspectSend(input: {
    promptVersionId: string;
    prompt: string;
    allowExternalModel?: boolean;
    defaultMaxOutputTokens?: number;
  }): Promise<AgentOrchestrationSendInspection>;
}

export class AgentOrchestrationError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly orchestrationRunId?: string
  ) {
    super(message);
  }
}

export function createDefaultAgentOrchestrationService(stores: AgentOrchestrationStores): AgentOrchestrationService {
  return createAgentOrchestrationService(stores, ({ promptVersionId }) => {
    const provider = createFakeProvider({
      text: 'Deterministic agent output',
      structured: {
        title: 'Deterministic chapter plan',
        nextAction: 'Review the plan with the author'
      },
      embedding: [],
      usage: { inputTokens: 120, outputTokens: 40 }
    });

    return new LlmGateway({
      provider,
      defaultModel: 'fake-model',
      promptVersionId
    });
  });
}

export function createAgentOrchestrationService(
  stores: AgentOrchestrationStores,
  providerRuntime:
    | AgentOrchestrationProviderRuntime
    | ((input: { promptVersionId: string; allowExternalModel?: boolean }) => LlmGateway | Promise<LlmGateway>)
): AgentOrchestrationService {
  return new PersistentAgentOrchestrationService(stores, normalizeProviderRuntime(providerRuntime));
}

class PersistentAgentOrchestrationService implements AgentOrchestrationService {
  private readonly runner = new WorkflowRunner();

  constructor(
    private readonly stores: AgentOrchestrationStores,
    private readonly providerRuntime: AgentOrchestrationProviderRuntime
  ) {}

  async start(input: StartAgentOrchestrationInput): Promise<AgentOrchestrationResult> {
    const project = await this.stores.projects.findById(input.projectId);
    if (!project) {
      throw new AgentOrchestrationError('Project not found', 404);
    }
    try {
      assertAgentCanRunTask(input.agentRole, input.taskType);
    } catch (error) {
      throw new AgentOrchestrationError(error instanceof Error ? error.message : 'Invalid agent task', 400);
    }

    const promptVersionId = input.promptVersionId ?? 'prompt_default';
    const directInspection = await this.providerRuntime.inspectSend({
      promptVersionId,
      prompt: input.taskGoal,
      allowExternalModel: project.externalModelPolicy !== 'Disabled'
    });
    if (directInspection.isExternal && project.externalModelPolicy === 'Disabled') {
      throw new AgentOrchestrationError('External model use is disabled for this project', 403);
    }
    if (directInspection.isExternal) {
      throw new AgentOrchestrationError('Pre-send inspection is required for external orchestration runs', 409);
    }

    const job = createDurableJob({
      workflowType: input.workflowType,
      payload: {
        projectId: input.projectId,
        taskType: input.taskType,
        agentRole: input.agentRole,
        taskGoal: input.taskGoal
      }
    });
    await this.stores.durableJobs.save(job);
    const runningJob = transitionJob(job, 'Running');
    await this.stores.durableJobs.save(runningJob);

    try {
      const baseContextPack =
        this.stores.contextBuildService
          ? await this.stores.contextBuildService.build({
              projectId: input.projectId,
              taskGoal: input.taskGoal,
              agentRole: input.agentRole,
              riskLevel: input.riskLevel,
              query: input.retrieval?.query ?? input.taskGoal,
              maxContextItems: input.retrieval?.maxContextItems,
              maxSectionChars: input.retrieval?.maxSectionChars
            })
          : createContextPack({
              taskGoal: input.taskGoal,
              agentRole: input.agentRole,
              riskLevel: input.riskLevel,
              sections: [],
              citations: [],
              exclusions: [],
              warnings: [],
              retrievalTrace: [`orchestration:${input.taskType}`]
            });

      const agentRun = createAgentRun({
        agentName: input.agentRole,
        taskType: input.taskType,
        workflowType: input.workflowType,
        promptVersionId,
        contextPackId: baseContextPack.id
      });
      const contextPack = await this.attachContextPackArtifact(baseContextPack, agentRun.id);
      await this.stores.contextPacks.save(contextPack);
      const contract = createTaskContract({
        projectId: input.projectId,
        taskType: input.taskType,
        agentRole: input.agentRole,
        riskLevel: input.riskLevel,
        outputSchema: input.outputSchema
      });
      const gateway = await this.providerRuntime.createGateway({
        promptVersionId,
        allowExternalModel: project.externalModelPolicy !== 'Disabled'
      });
      let generated: { value: Record<string, unknown> };
      try {
        generated = await gateway.generateStructured<Record<string, unknown>>({
          prompt: buildPrompt(input, contextPack),
          schemaName: input.outputSchema,
          model: input.model,
          validate: isRecord
        });
      } catch (error) {
        const failedAgentRun: AgentRun = { ...agentRun, status: 'Failed' };
        await this.stores.agentRuns.save(failedAgentRun);

        const llmCalls = await this.persistLlmCalls(gateway, failedAgentRun.id);
        const workflowRun = await this.runner.run(contract, [
          { name: 'create_context_pack', artifactIds: [contextPack.artifactId ?? contextPack.id], status: 'Succeeded' },
          { name: 'create_agent_run', artifactIds: [failedAgentRun.id], status: 'Succeeded' },
          {
            name: 'generate_structured_output',
            artifactIds: [],
            status: 'Failed',
            error: error instanceof Error ? error.message : 'Agent orchestration failed'
          },
          { name: 'persist_llm_call_log', artifactIds: llmCalls.map((record) => record.id), status: 'Succeeded' }
        ]);
        await this.stores.workflowRuns.save(workflowRun);

        const failedJob: DurableJob = {
          ...transitionJob(runningJob, 'Failed'),
          payload: {
            ...runningJob.payload,
            contextPackId: contextPack.id,
            agentRunId: failedAgentRun.id,
            workflowRunId: workflowRun.id,
            output: null
          }
        };
        await this.stores.durableJobs.save(failedJob);
        throw new AgentOrchestrationError(
          error instanceof Error ? error.message : 'Agent orchestration failed',
          500,
          failedJob.id
        );
      }

      const succeededAgentRun: AgentRun = { ...agentRun, status: 'Succeeded' };
      await this.stores.agentRuns.save(succeededAgentRun);

      const llmCalls = await this.persistLlmCalls(gateway, succeededAgentRun.id);

      const workflowRun = await this.runner.run(contract, [
        { name: 'create_context_pack', artifactIds: [contextPack.artifactId ?? contextPack.id], status: 'Succeeded' },
        { name: 'create_agent_run', artifactIds: [succeededAgentRun.id], status: 'Succeeded' },
        { name: 'generate_structured_output', artifactIds: [], status: 'Succeeded' },
        { name: 'persist_llm_call_log', artifactIds: llmCalls.map((record) => record.id), status: 'Succeeded' }
      ]);
      await this.stores.workflowRuns.save(workflowRun);

      const succeededJob: DurableJob = {
        ...transitionJob(runningJob, 'Succeeded'),
        payload: {
          ...runningJob.payload,
          contextPackId: contextPack.id,
          agentRunId: succeededAgentRun.id,
          workflowRunId: workflowRun.id,
          output: generated.value
        }
      };
      await this.stores.durableJobs.save(succeededJob);

      return {
        orchestrationRunId: succeededJob.id,
        job: succeededJob,
        contextPack,
        agentRun: succeededAgentRun,
        workflowRun,
        llmCalls,
        output: generated.value
      };
    } catch (error) {
      if (error instanceof AgentOrchestrationError && error.orchestrationRunId) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Agent orchestration failed';
      const statusCode =
        message === 'External model use is disabled for this project'
          ? 403
          : error instanceof AgentOrchestrationError
            ? error.statusCode
            : 500;
      const failedJob: DurableJob = {
        ...transitionJob(runningJob, 'Failed'),
        payload: {
          ...runningJob.payload,
          error: message,
          output: null
        }
      };
      await this.stores.durableJobs.save(failedJob);
      throw new AgentOrchestrationError(
        message,
        statusCode,
        failedJob.id
      );
    }
  }

  async prepare(input: StartAgentOrchestrationInput): Promise<PreparedAgentOrchestrationRun> {
    const project = await this.stores.projects.findById(input.projectId);
    if (!project) {
      throw new AgentOrchestrationError('Project not found', 404);
    }
    try {
      assertAgentCanRunTask(input.agentRole, input.taskType);
    } catch (error) {
      throw new AgentOrchestrationError(error instanceof Error ? error.message : 'Invalid agent task', 400);
    }

    const promptVersionId = input.promptVersionId ?? 'prompt_default';
    const baseContextPack =
      this.stores.contextBuildService
        ? await this.stores.contextBuildService.build({
            projectId: input.projectId,
            taskGoal: input.taskGoal,
            agentRole: input.agentRole,
            riskLevel: input.riskLevel,
            query: input.retrieval?.query ?? input.taskGoal,
            maxContextItems: input.retrieval?.maxContextItems,
            maxSectionChars: input.retrieval?.maxSectionChars
          })
        : createContextPack({
            taskGoal: input.taskGoal,
            agentRole: input.agentRole,
            riskLevel: input.riskLevel,
            sections: [],
            citations: [],
            exclusions: [],
            warnings: [],
            retrievalTrace: [`orchestration:${input.taskType}`]
          });

    const agentRun = createAgentRun({
      agentName: input.agentRole,
      taskType: input.taskType,
      workflowType: input.workflowType,
      promptVersionId,
      contextPackId: baseContextPack.id
    });
    const contextPack = await this.attachContextPackArtifact(baseContextPack, agentRun.id);
    await this.stores.contextPacks.save(contextPack);
    await this.stores.agentRuns.save({ ...agentRun, status: 'Queued' });

    const inspection = await this.providerRuntime.inspectSend({
      promptVersionId,
      prompt: buildPrompt(input, contextPack),
      allowExternalModel: project.externalModelPolicy !== 'Disabled',
      defaultMaxOutputTokens: 1024
    });
    const job = transitionJob(
      createDurableJob({
        workflowType: 'orchestration.prepare',
        payload: {
          projectId: input.projectId,
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
    await this.stores.durableJobs.save(job);

    return this.toPreparedAgentOrchestrationRun(job, contextPack);
  }

  async executePrepared(
    preparedRunId: string,
    input: ExecutePreparedAgentOrchestrationInput
  ): Promise<AgentOrchestrationResult> {
    if (!input.confirmed) {
      throw new AgentOrchestrationError('Prepared orchestration run requires confirmation', 409);
    }

    const { job, payload, contextPack } = await this.loadPreparedJob(preparedRunId);
    if (job.status === 'Cancelled') {
      throw new AgentOrchestrationError('Prepared orchestration run is cancelled', 409);
    }
    if (job.status !== 'Paused') {
      throw new AgentOrchestrationError('Prepared orchestration run is not executable', 409);
    }
    if (payload.expiresAt < new Date().toISOString()) {
      throw new AgentOrchestrationError('Prepared orchestration run is stale', 409);
    }

    const project = await this.stores.projects.findById(payload.projectId);
    if (!project) {
      throw new AgentOrchestrationError('Project not found', 404);
    }

    const promptVersionId = payload.input.promptVersionId ?? 'prompt_default';
    const inspection = await this.providerRuntime.inspectSend({
      promptVersionId,
      prompt: buildPrompt(payload.input, contextPack),
      allowExternalModel: project.externalModelPolicy !== 'Disabled',
      defaultMaxOutputTokens: 1024
    });
    if (inspection.provider !== payload.provider || inspection.model !== payload.model) {
      throw new AgentOrchestrationError('Prepared orchestration run is stale', 409);
    }
    if (inspection.blockingReasons.length > 0) {
      const reason = inspection.blockingReasons[0] ?? 'Prepared orchestration run has blocking warnings';
      throw new AgentOrchestrationError(reason, reason === 'External model use is disabled for this project' ? 403 : 409);
    }

    const contract = createTaskContract({
      projectId: payload.input.projectId,
      taskType: payload.input.taskType,
      agentRole: payload.input.agentRole,
      riskLevel: payload.input.riskLevel,
      outputSchema: payload.input.outputSchema
    });
    const preparedAgentRun: AgentRun = {
      id: payload.agentRunId,
      agentName: payload.input.agentRole,
      taskType: payload.input.taskType,
      workflowType: payload.input.workflowType,
      promptVersionId,
      contextPackId: contextPack.id,
      status: 'Running',
      createdAt: contextPack.createdAt
    };
    const runningJob = transitionJob(job, 'Running');
    await this.stores.durableJobs.save(runningJob);
    await this.stores.agentRuns.save(preparedAgentRun);

    let gateway: LlmGateway | null = null;
    let generated: { value: Record<string, unknown> };
    try {
      gateway = await this.providerRuntime.createGateway({
        promptVersionId,
        allowExternalModel: project.externalModelPolicy !== 'Disabled'
      });
      generated = await gateway.generateStructured<Record<string, unknown>>({
        prompt: buildPrompt(payload.input, contextPack),
        schemaName: payload.input.outputSchema,
        model: payload.input.model,
        validate: isRecord
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Agent orchestration failed';
      const failedAgentRun: AgentRun = { ...preparedAgentRun, status: 'Failed' };
      await this.stores.agentRuns.save(failedAgentRun);
      const llmCalls = gateway ? await this.persistLlmCalls(gateway, failedAgentRun.id) : [];
      const workflowRun = await this.runner.run(contract, [
        { name: 'create_context_pack', artifactIds: [contextPack.artifactId ?? contextPack.id], status: 'Succeeded' },
        { name: 'create_agent_run', artifactIds: [failedAgentRun.id], status: 'Succeeded' },
        {
          name: 'generate_structured_output',
          artifactIds: [],
          status: 'Failed',
          error: message
        },
        { name: 'persist_llm_call_log', artifactIds: llmCalls.map((record) => record.id), status: 'Succeeded' }
      ]);
      await this.stores.workflowRuns.save(workflowRun);
      await this.stores.durableJobs.save({
        ...transitionJob(runningJob, 'Failed'),
        payload: {
          ...runningJob.payload,
          workflowRunId: workflowRun.id,
          error: message,
          output: null
        }
      });
      throw new AgentOrchestrationError(
        message,
        error instanceof AgentOrchestrationError
          ? error.statusCode
          : message === 'External model use is disabled for this project'
            ? 403
            : 500,
        runningJob.id
      );
    }

    const succeededAgentRun: AgentRun = { ...preparedAgentRun, status: 'Succeeded' };
    await this.stores.agentRuns.save(succeededAgentRun);
    const llmCalls = await this.persistLlmCalls(gateway, succeededAgentRun.id);
    const workflowRun = await this.runner.run(contract, [
      { name: 'create_context_pack', artifactIds: [contextPack.artifactId ?? contextPack.id], status: 'Succeeded' },
      { name: 'create_agent_run', artifactIds: [succeededAgentRun.id], status: 'Succeeded' },
      { name: 'generate_structured_output', artifactIds: [], status: 'Succeeded' },
      { name: 'persist_llm_call_log', artifactIds: llmCalls.map((record) => record.id), status: 'Succeeded' }
    ]);
    await this.stores.workflowRuns.save(workflowRun);

    const succeededJob: DurableJob = {
      ...transitionJob(runningJob, 'Succeeded'),
      payload: {
        ...runningJob.payload,
        confirmedBy: input.confirmedBy,
        confirmedAt: new Date().toISOString(),
        contextPackId: contextPack.id,
        agentRunId: succeededAgentRun.id,
        workflowRunId: workflowRun.id,
        output: generated.value
      }
    };
    await this.stores.durableJobs.save(succeededJob);

    return {
      orchestrationRunId: succeededJob.id,
      job: succeededJob,
      contextPack,
      agentRun: succeededAgentRun,
      workflowRun,
      llmCalls,
      output: generated.value
    };
  }

  async cancelPrepared(
    preparedRunId: string,
    input: CancelPreparedAgentOrchestrationInput = {}
  ): Promise<PreparedAgentOrchestrationRun> {
    const { job, payload, contextPack } = await this.loadPreparedJob(preparedRunId);
    if (job.status !== 'Paused') {
      throw new AgentOrchestrationError('Prepared orchestration run is not cancellable', 409);
    }

    const cancelled = transitionJob(job, 'Cancelled');
    await this.stores.durableJobs.save({
      ...cancelled,
      payload: {
        ...job.payload,
        cancelledBy: input.cancelledBy,
        cancelledAt: new Date().toISOString()
      }
    });
    await this.stores.agentRuns.save({
      id: payload.agentRunId,
      agentName: payload.input.agentRole,
      taskType: payload.input.taskType,
      workflowType: payload.input.workflowType,
      promptVersionId: payload.input.promptVersionId ?? 'prompt_default',
      contextPackId: contextPack.id,
      status: 'Cancelled',
      createdAt: contextPack.createdAt
    });

    return this.toPreparedAgentOrchestrationRun(cancelled, contextPack);
  }

  async findById(id: string): Promise<AgentOrchestrationResult | null> {
    const job = await this.stores.durableJobs.findById(id);
    if (!job) return null;

    const contextPackId = asString(job.payload.contextPackId);
    const agentRunId = asAgentRunId(job.payload.agentRunId);
    const workflowRunId = asString(job.payload.workflowRunId);
    const contextPack = contextPackId ? await this.stores.contextPacks.findById(contextPackId) : null;
    const agentRun = agentRunId ? await this.stores.agentRuns.findById(agentRunId) : null;
    const workflowRun = workflowRunId ? await this.stores.workflowRuns.findById(workflowRunId) : null;
    const llmCalls = agentRunId ? await this.stores.llmCallLogs.findByAgentRunId(agentRunId) : [];

    return {
      orchestrationRunId: job.id,
      job,
      contextPack,
      agentRun,
      workflowRun,
      llmCalls,
      output: job.payload.output
    };
  }

  private async persistLlmCalls(gateway: LlmGateway, agentRunId: EntityId<'agent_run'>): Promise<LlmCallRecord[]> {
    const llmCalls = gateway.callLog.map((entry) =>
      createLlmCallRecord({
        agentRunId,
        ...entry
      })
    );
    for (const record of llmCalls) {
      await this.stores.llmCallLogs.save(record);
    }
    return llmCalls;
  }

  private async attachContextPackArtifact(
    contextPack: ContextPack,
    relatedRunId: EntityId<'agent_run'>
  ): Promise<ContextPack> {
    if (!this.stores.artifacts || !this.stores.artifactContent) return contextPack;

    const content = JSON.stringify({ ...contextPack, relatedRunId });
    const stored = await this.stores.artifactContent.writeText(`${contextPack.id}.json`, content);
    const existing = await this.stores.artifacts.findByHash(stored.hash);
    const artifact =
      existing ??
      createArtifactRecord({
        type: 'context_pack',
        source: 'agent_run',
        version: 1,
        hash: stored.hash,
        uri: stored.uri,
        relatedRunId
      });

    if (!existing) {
      await this.stores.artifacts.save(artifact);
    }

    return { ...contextPack, artifactId: artifact.id };
  }

  private async loadPreparedJob(preparedRunId: string): Promise<{
    job: DurableJob;
    payload: PreparedAgentOrchestrationPayload;
    contextPack: ContextPack;
  }> {
    const job = await this.stores.durableJobs.findById(preparedRunId);
    if (!job || job.workflowType !== 'orchestration.prepare') {
      throw new AgentOrchestrationError('Prepared orchestration run not found', 404);
    }

    const payload = toPreparedPayload(job.payload);
    const contextPack = await this.stores.contextPacks.findById(payload.contextPackId);
    if (!contextPack) {
      throw new AgentOrchestrationError('Prepared orchestration run context not found', 409);
    }

    return { job, payload, contextPack };
  }

  private toPreparedAgentOrchestrationRun(
    job: DurableJob,
    contextPack: ContextPack
  ): PreparedAgentOrchestrationRun {
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

interface PreparedAgentOrchestrationPayload {
  projectId: EntityId<'project'>;
  input: StartAgentOrchestrationInput;
  contextPackId: EntityId<'context_pack'>;
  agentRunId: EntityId<'agent_run'>;
  provider: string;
  model: string;
  isExternal: boolean;
  secretConfigured: boolean;
  budgetEstimate: PreparedAgentOrchestrationRun['budgetEstimate'];
  warnings: string[];
  blockingReasons: string[];
  expiresAt: string;
}

function toPreparedPayload(payload: DurableJob['payload']): PreparedAgentOrchestrationPayload {
  return payload as unknown as PreparedAgentOrchestrationPayload;
}

function expiresAt(): string {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function normalizeProviderRuntime(
  providerRuntime:
    | AgentOrchestrationProviderRuntime
    | ((input: { promptVersionId: string; allowExternalModel?: boolean }) => LlmGateway | Promise<LlmGateway>)
): AgentOrchestrationProviderRuntime {
  if (typeof providerRuntime !== 'function') return providerRuntime;

  return {
    createGateway: providerRuntime,
    async inspectSend() {
      return {
        provider: 'fake',
        model: 'fake-model',
        isExternal: false,
        secretConfigured: true,
        budgetEstimate: {
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostUsd: 0
        },
        warnings: [],
        blockingReasons: []
      };
    }
  };
}

function buildPrompt(input: StartAgentOrchestrationInput, contextPack: ContextPack): string {
  const sections = contextPack.sections.map((section) => `[${section.name}]\n${section.content}`).join('\n\n');
  return [`Task: ${input.taskGoal}`, `Agent: ${input.agentRole}`, `Schema: ${input.outputSchema}`, sections].join('\n\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asAgentRunId(value: unknown): EntityId<'agent_run'> | null {
  return typeof value === 'string' && value.startsWith('agent_run_') ? (value as EntityId<'agent_run'>) : null;
}
