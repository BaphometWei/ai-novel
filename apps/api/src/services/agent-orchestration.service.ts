import { createFakeProvider, LlmGateway } from '@ai-novel/llm-gateway';
import {
  createAgentRun,
  createContextPack,
  createLlmCallRecord,
  type AgentRun,
  type ContextPack,
  type ContextSection,
  type EntityId,
  type LlmCallRecord,
  type Project,
  type RiskLevel
} from '@ai-novel/domain';
import {
  createDurableJob,
  createTaskContract,
  transitionJob,
  type DurableJob,
  type WorkflowRun,
  WorkflowRunner
} from '@ai-novel/workflow';

export interface ProjectLookup {
  findById(id: string): Project | null | Promise<Project | null>;
}

export interface ContextPackStore {
  save(contextPack: ContextPack): Promise<void>;
  findById(id: string): Promise<ContextPack | null>;
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
  contextPacks: ContextPackStore;
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
  contextSections: ContextSection[];
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
  findById(id: string): Promise<AgentOrchestrationResult | null>;
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
  createGateway: (input: { promptVersionId: string }) => LlmGateway
): AgentOrchestrationService {
  return new PersistentAgentOrchestrationService(stores, createGateway);
}

class PersistentAgentOrchestrationService implements AgentOrchestrationService {
  private readonly runner = new WorkflowRunner();

  constructor(
    private readonly stores: AgentOrchestrationStores,
    private readonly createGateway: (input: { promptVersionId: string }) => LlmGateway
  ) {}

  async start(input: StartAgentOrchestrationInput): Promise<AgentOrchestrationResult> {
    const project = await this.stores.projects.findById(input.projectId);
    if (!project) {
      throw new AgentOrchestrationError('Project not found', 404);
    }

    const promptVersionId = input.promptVersionId ?? 'prompt_default';
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
      const contextPack = createContextPack({
        taskGoal: input.taskGoal,
        agentRole: input.agentRole,
        riskLevel: input.riskLevel,
        sections: input.contextSections,
        citations: [],
        exclusions: [],
        warnings: [],
        retrievalTrace: [`orchestration:${input.taskType}`]
      });
      await this.stores.contextPacks.save(contextPack);

      const agentRun = createAgentRun({
        agentName: input.agentRole,
        taskType: input.taskType,
        workflowType: input.workflowType,
        promptVersionId,
        contextPackId: contextPack.id
      });
      const contract = createTaskContract({
        projectId: input.projectId,
        taskType: input.taskType,
        agentRole: input.agentRole,
        riskLevel: input.riskLevel,
        outputSchema: input.outputSchema
      });
      const gateway = this.createGateway({ promptVersionId });
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
          { name: 'create_context_pack', artifactIds: [contextPack.id], status: 'Succeeded' },
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
        { name: 'create_context_pack', artifactIds: [contextPack.id], status: 'Succeeded' },
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
        error instanceof AgentOrchestrationError ? error.statusCode : 500,
        failedJob.id
      );
    }
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
