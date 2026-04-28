import {
  AgentRunRepository,
  ContextPackRepository,
  createDatabase,
  DurableJobRepository,
  LlmCallLogRepository,
  migrateDatabase,
  PromptVersionRepository,
  type PromptVersion,
  ProjectRepository,
  WorkflowRunRepository
} from '@ai-novel/db';
import {
  createProject,
  type AgentRun,
  type ContextPack,
  type LlmCallRecord,
  type Project
} from '@ai-novel/domain';
import { createFakeProvider, LlmGateway } from '@ai-novel/llm-gateway';
import type { DurableJob, WorkflowRun } from '@ai-novel/workflow';
import { describe, expect, it } from 'vitest';
import {
  AgentOrchestrationError,
  createAgentOrchestrationService,
  type AgentOrchestrationStores,
  type AgentOrchestrationProviderRuntime
} from '../services/agent-orchestration.service';
import { PersistentProjectService } from '../services/project.service';

const chapterPlanPromptVersion: PromptVersion = {
  id: 'prompt_chapter_plan_v1',
  taskType: 'chapter_planning',
  template: 'Plan {{goal}} from {{context}}',
  model: 'fake-model',
  provider: 'fake',
  version: 1,
  status: 'Active',
  createdAt: '2026-04-27T06:00:00.000Z'
};

describe('agent orchestration service failure persistence', () => {
  it('requires prepare before external orchestration and only calls the provider on confirmed execute', async () => {
    const project = createProject({
      title: 'External Plan',
      language: 'en-US',
      targetAudience: 'serial fiction readers'
    });
    const memory = createMemoryStores(project);
    let gatewayCreates = 0;
    const service = createAgentOrchestrationService(
      memory.stores,
      createInspectableRuntime({
        onCreateGateway: () => {
          gatewayCreates += 1;
        }
      })
    );
    const input = orchestrationInput(project.id);

    await expect(service.start(input)).rejects.toMatchObject({
      message: 'Pre-send inspection is required for external orchestration runs',
      statusCode: 409
    });
    expect(gatewayCreates).toBe(0);
    expect(memory.jobs.size).toBe(0);

    const prepared = await service.prepare(input);
    expect(prepared).toMatchObject({
      projectId: project.id,
      status: 'Prepared',
      confirmationRequired: true,
      provider: { provider: 'openai', model: 'gpt-test', isExternal: true },
      warnings: ['External model call requires pre-send confirmation'],
      blockingReasons: []
    });
    expect(gatewayCreates).toBe(0);
    expect(memory.jobs.get(prepared.id)).toMatchObject({ workflowType: 'orchestration.prepare', status: 'Paused' });
    expect(memory.agentRuns.get(prepared.agentRunId)).toMatchObject({ status: 'Queued' });

    const cancelled = await service.cancelPrepared(prepared.id, { cancelledBy: 'vitest' });
    expect(cancelled).toMatchObject({ id: prepared.id, status: 'Cancelled' });
    expect(gatewayCreates).toBe(0);
    expect(memory.jobs.get(prepared.id)).toMatchObject({
      status: 'Cancelled',
      payload: { cancelledBy: 'vitest' }
    });
    expect(memory.agentRuns.get(prepared.agentRunId)).toMatchObject({ status: 'Cancelled' });

    const confirmed = await service.prepare(input);
    const executed = await service.executePrepared(confirmed.id, { confirmed: true, confirmedBy: 'vitest' });
    expect(gatewayCreates).toBe(1);
    expect(executed).toMatchObject({
      orchestrationRunId: confirmed.id,
      job: {
        status: 'Succeeded',
        payload: { confirmedBy: 'vitest' }
      },
      agentRun: { status: 'Succeeded' },
      output: { title: 'Prepared chapter plan' }
    });
    await expect(memory.stores.llmCallLogs.findByAgentRunId(confirmed.agentRunId)).resolves.toHaveLength(1);
  });

  it('persists disabled-project prepared orchestration inspection and blocks execute without provider calls', async () => {
    const project = createProject({
      title: 'No External Plan',
      language: 'en-US',
      targetAudience: 'serial fiction readers',
      externalModelPolicy: 'Disabled'
    });
    const memory = createMemoryStores(project);
    let gatewayCreates = 0;
    const service = createAgentOrchestrationService(
      memory.stores,
      createInspectableRuntime({
        onCreateGateway: () => {
          gatewayCreates += 1;
        }
      })
    );

    const prepared = await service.prepare(orchestrationInput(project.id));

    expect(prepared).toMatchObject({
      status: 'Prepared',
      provider: { provider: 'openai', model: 'gpt-test', isExternal: true },
      blockingReasons: ['External model use is disabled for this project']
    });
    await expect(service.executePrepared(prepared.id, { confirmed: true, confirmedBy: 'vitest' })).rejects.toMatchObject({
      message: 'External model use is disabled for this project',
      statusCode: 403
    });
    expect(gatewayCreates).toBe(0);
    expect(memory.jobs.get(prepared.id)).toMatchObject({ status: 'Paused' });
    expect(memory.agentRuns.get(prepared.agentRunId)).toMatchObject({ status: 'Queued' });
    await expect(memory.stores.llmCallLogs.findByAgentRunId(prepared.agentRunId)).resolves.toHaveLength(0);
  });

  it('marks prepared orchestration failed when gateway setup fails during execute', async () => {
    const project = createProject({
      title: 'Gateway Failure Plan',
      language: 'en-US',
      targetAudience: 'serial fiction readers'
    });
    const memory = createMemoryStores(project);
    const service = createAgentOrchestrationService(
      memory.stores,
      createInspectableRuntime({
        createGatewayError: new Error('provider setup unavailable')
      })
    );
    const prepared = await service.prepare(orchestrationInput(project.id));

    await expect(service.executePrepared(prepared.id, { confirmed: true, confirmedBy: 'vitest' })).rejects.toMatchObject({
      message: 'provider setup unavailable',
      statusCode: 500,
      orchestrationRunId: prepared.id
    });

    expect(memory.jobs.get(prepared.id)).toMatchObject({
      status: 'Failed',
      payload: {
        error: 'provider setup unavailable',
        output: null
      }
    });
    expect(memory.agentRuns.get(prepared.agentRunId)).toMatchObject({ status: 'Failed' });
    await expect(memory.stores.llmCallLogs.findByAgentRunId(prepared.agentRunId)).resolves.toHaveLength(0);
    expect(Array.from(memory.workflowRuns.values()).at(-1)).toMatchObject({
      steps: expect.arrayContaining([
        expect.objectContaining({ name: 'generate_structured_output', status: 'Failed' })
      ])
    });
  });

  it('persists a failed orchestration run when structured output cannot be repaired', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const projectService = new PersistentProjectService(new ProjectRepository(database.db));
    const project = await projectService.create({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new PromptVersionRepository(database.db).save(chapterPlanPromptVersion);
    const service = createAgentOrchestrationService(
      {
        projects: projectService,
        contextPacks: new ContextPackRepository(database.db),
        agentRuns: new AgentRunRepository(database.db),
        llmCallLogs: new LlmCallLogRepository(database.db),
        workflowRuns: new WorkflowRunRepository(database.db),
        durableJobs: new DurableJobRepository(database.db)
      },
      ({ promptVersionId }) =>
        new LlmGateway({
          provider: createFakeProvider({
            text: 'invalid',
            structured: 'not an object',
            embedding: [],
            usage: { inputTokens: 10, outputTokens: 3 }
          }),
          defaultModel: 'fake-model',
          promptVersionId
        })
    );

    let orchestrationRunId: string | undefined;
    try {
      await service.start({
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is under siege.' }]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentOrchestrationError);
      orchestrationRunId = (error as AgentOrchestrationError).orchestrationRunId;
    }

    expect(orchestrationRunId).toMatch(/^job_/);
    const failed = await service.findById(orchestrationRunId ?? '');

    expect(failed).toMatchObject({
      job: { status: 'Failed' },
      agentRun: { status: 'Failed' },
      workflowRun: {
        steps: [
          { name: 'create_context_pack', status: 'Succeeded' },
          { name: 'create_agent_run', status: 'Succeeded' },
          { name: 'generate_structured_output', status: 'Failed' },
          { name: 'persist_llm_call_log', status: 'Succeeded' }
        ]
      },
      llmCalls: [{ status: 'Failed', retryCount: 2, error: 'Structured output failed validation for ChapterPlan' }]
    });

    database.client.close();
  });

  it('marks the durable job failed when persistence fails after the job starts', async () => {
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    const jobs = new Map<string, DurableJob>();
    const service = createAgentOrchestrationService(
      {
        projects: {
          async findById() {
            return project;
          }
        },
        contextPacks: {
          async save() {
            throw new Error('context database unavailable');
          },
          async findById() {
            return null;
          }
        },
        agentRuns: {
          async save() {},
          async findById() {
            return null;
          }
        },
        llmCallLogs: {
          async save() {},
          async findByAgentRunId() {
            return [];
          }
        },
        workflowRuns: {
          async save() {},
          async findById() {
            return null;
          }
        },
        durableJobs: {
          async save(job) {
            jobs.set(job.id, job);
          },
          async findById(id) {
            return jobs.get(id) ?? null;
          }
        }
      },
      ({ promptVersionId }) =>
        new LlmGateway({
          provider: createFakeProvider({
            text: 'unused',
            structured: { ok: true },
            embedding: []
          }),
          defaultModel: 'fake-model',
          promptVersionId
        })
    );

    let orchestrationRunId: string | undefined;
    try {
      await service.start({
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is under siege.' }]
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AgentOrchestrationError);
      orchestrationRunId = (error as AgentOrchestrationError).orchestrationRunId;
    }

    expect(orchestrationRunId).toMatch(/^job_/);
    const failed = await service.findById(orchestrationRunId ?? '');

    expect(failed).toMatchObject({
      orchestrationRunId,
      job: {
        status: 'Failed',
        payload: { error: 'context database unavailable' }
      },
      contextPack: null,
      agentRun: null,
      workflowRun: null,
      llmCalls: []
    });
  });
});

function orchestrationInput(projectId: Project['id']) {
  return {
    projectId,
    workflowType: 'chapter_creation',
    taskType: 'chapter_planning',
    agentRole: 'Planner',
    taskGoal: 'Plan the next inspected chapter',
    riskLevel: 'Medium' as const,
    outputSchema: 'ChapterPlan',
    promptVersionId: 'prompt_chapter_plan_v1',
    retrieval: {
      query: 'next inspected chapter',
      maxContextItems: 4,
      maxSectionChars: 1200
    }
  };
}

function createInspectableRuntime(
  options: { onCreateGateway?: () => void; createGatewayError?: Error } = {}
): AgentOrchestrationProviderRuntime {
  return {
    async inspectSend(input) {
      return {
        provider: 'openai',
        model: 'gpt-test',
        isExternal: true,
        secretConfigured: true,
        budgetEstimate: {
          inputTokens: Math.max(1, input.prompt.length),
          outputTokens: input.defaultMaxOutputTokens ?? 1024,
          estimatedCostUsd: 0.001,
          maxRunCostUsd: 0.25
        },
        warnings: input.allowExternalModel === false ? [] : ['External model call requires pre-send confirmation'],
        blockingReasons: input.allowExternalModel === false ? ['External model use is disabled for this project'] : []
      };
    },
    async createGateway({ promptVersionId }) {
      options.onCreateGateway?.();
      if (options.createGatewayError) {
        throw options.createGatewayError;
      }
      return new LlmGateway({
        provider: createFakeProvider({
          text: 'unused',
          structured: { title: 'Prepared chapter plan', nextAction: 'Review with author' },
          embedding: [],
          usage: { inputTokens: 12, outputTokens: 5 }
        }),
        defaultModel: 'gpt-test',
        promptVersionId
      });
    }
  };
}

function createMemoryStores(project: Project) {
  const contextPacks = new Map<string, ContextPack>();
  const agentRuns = new Map<string, AgentRun>();
  const llmCalls: LlmCallRecord[] = [];
  const workflowRuns = new Map<string, WorkflowRun>();
  const jobs = new Map<string, DurableJob>();
  const stores: AgentOrchestrationStores = {
    projects: {
      async findById(id) {
        return id === project.id ? project : null;
      }
    },
    contextPacks: {
      async save(contextPack) {
        contextPacks.set(contextPack.id, contextPack);
      },
      async findById(id) {
        return contextPacks.get(id) ?? null;
      }
    },
    agentRuns: {
      async save(agentRun) {
        agentRuns.set(agentRun.id, agentRun);
      },
      async findById(id) {
        return agentRuns.get(id) ?? null;
      }
    },
    llmCallLogs: {
      async save(record) {
        llmCalls.push(record);
      },
      async findByAgentRunId(agentRunId) {
        return llmCalls.filter((record) => record.agentRunId === agentRunId);
      }
    },
    workflowRuns: {
      async save(run) {
        workflowRuns.set(run.id, run);
      },
      async findById(id) {
        return workflowRuns.get(id) ?? null;
      }
    },
    durableJobs: {
      async save(job) {
        jobs.set(job.id, job);
      },
      async findById(id) {
        return jobs.get(id) ?? null;
      }
    }
  };

  return {
    contextPacks,
    agentRuns,
    llmCalls,
    workflowRuns,
    jobs,
    stores
  };
}
