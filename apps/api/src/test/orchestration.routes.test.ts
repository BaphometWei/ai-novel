import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';
import { createContextPack } from '@ai-novel/domain';
import { AgentOrchestrationError } from '../services/agent-orchestration.service';

describe('persistent agent orchestration routes', () => {
  it('creates and reloads a deterministic persisted agent orchestration run', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();

    const createResponse = await runtime.app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: project.id,
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        promptVersionId: 'prompt_chapter_plan_v1',
        contextSections: [{ name: 'canon', content: 'The city is under siege.' }]
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toMatchObject({
      orchestrationRunId: expect.stringMatching(/^job_/),
      output: {
        title: 'Deterministic chapter plan',
        nextAction: 'Review the plan with the author'
      },
      agentRun: {
        agentName: 'Planner',
        taskType: 'chapter_planning',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_chapter_plan_v1',
        status: 'Succeeded'
      },
      contextPack: {
        artifactId: expect.stringMatching(/^artifact_/),
        taskGoal: 'Plan the next siege chapter',
        agentRole: 'Planner',
        riskLevel: 'Medium',
        sections: [{ name: 'retrieved_context', content: '' }],
        retrievalTrace: expect.arrayContaining(['query:Plan the next siege chapter'])
      },
      workflowRun: {
        steps: [
          { order: 1, name: 'create_context_pack', status: 'Succeeded' },
          { order: 2, name: 'create_agent_run', status: 'Succeeded' },
          { order: 3, name: 'generate_structured_output', status: 'Succeeded' },
          { order: 4, name: 'persist_llm_call_log', status: 'Succeeded' }
        ]
      },
      llmCalls: [
        {
          promptVersionId: 'prompt_chapter_plan_v1',
          provider: 'fake',
          model: 'fake-model',
          schemaName: 'ChapterPlan',
          retryCount: 0,
          status: 'Succeeded'
        }
      ]
    });

    const reloadResponse = await runtime.app.inject({
      method: 'GET',
      url: `/orchestration/runs/${created.orchestrationRunId}`
    });

    expect(reloadResponse.statusCode).toBe(200);
    expect(reloadResponse.json()).toMatchObject({
      orchestrationRunId: created.orchestrationRunId,
      agentRun: { id: created.agentRun.id, status: 'Succeeded' },
      contextPack: { id: created.contextPack.id, artifactId: created.contextPack.artifactId },
      workflowRun: { id: created.workflowRun.id },
      llmCalls: [{ agentRunId: created.agentRun.id, status: 'Succeeded' }]
    });

    const artifactResponse = await runtime.app.inject({
      method: 'GET',
      url: `/artifacts/${created.contextPack.artifactId}`
    });
    expect(artifactResponse.statusCode).toBe(200);
    expect(artifactResponse.json()).toMatchObject({
      type: 'context_pack',
      source: 'agent_run',
      relatedRunId: created.agentRun.id
    });
    await expect(runtime.stores.artifactContent.readText(artifactResponse.json().uri)).resolves.toContain(
      '"taskGoal":"Plan the next siege chapter"'
    );
    expect(JSON.stringify(created.contextPack.sections)).not.toContain('The city is under siege.');

    await runtime.app.close();
    runtime.database.client.close();
  });

  it('returns the persisted orchestration run id when start fails after creating records', async () => {
    const app = buildApp({
      orchestration: {
        async start() {
          throw new AgentOrchestrationError(
            'Structured output failed validation for ChapterPlan',
            500,
            'job_failed'
          );
        },
        async prepare() {
          throw new Error('not used');
        },
        async executePrepared() {
          throw new Error('not used');
        },
        async cancelPrepared() {
          throw new Error('not used');
        },
        async findById() {
          return null;
        }
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/orchestration/runs',
      payload: {
        projectId: 'project_abc',
        workflowType: 'chapter_creation',
        taskType: 'chapter_planning',
        agentRole: 'Planner',
        taskGoal: 'Plan the next siege chapter',
        riskLevel: 'Medium',
        outputSchema: 'ChapterPlan',
        contextSections: []
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Structured output failed validation for ChapterPlan',
      orchestrationRunId: 'job_failed'
    });

    await app.close();
  });

  it('routes prepared orchestration sends through persistent service dependencies', async () => {
    const contextPack = createContextPack({
      taskGoal: 'Plan the next siege chapter',
      agentRole: 'Planner',
      riskLevel: 'Medium',
      sections: [{ name: 'retrieved_context', content: 'Prepared orchestration context.' }],
      citations: [{ sourceId: 'canon_1', quote: 'The city is under siege.' }],
      exclusions: ['restricted_source_1'],
      warnings: ['External model call requires pre-send confirmation'],
      retrievalTrace: ['query:Plan siege chapter']
    });
    const service = {
      start: async () => {
        throw new Error('not used');
      },
      findById: async () => null,
      prepare: vi.fn(async () => ({
        id: 'job_orchestration_prepared_1',
        projectId: 'project_abc',
        agentRunId: 'agent_run_orchestration_prepared_1',
        status: 'Prepared',
        confirmationRequired: true,
        provider: {
          provider: 'openai',
          model: 'gpt-test',
          isExternal: true,
          secretConfigured: true
        },
        budgetEstimate: {
          inputTokens: 42,
          outputTokens: 1024,
          estimatedCostUsd: 0.016
        },
        warnings: ['External model call requires pre-send confirmation'],
        blockingReasons: [],
        expiresAt: '2026-04-28T01:00:00.000Z',
        contextPack
      })),
      executePrepared: vi.fn(async () => ({
        orchestrationRunId: 'job_orchestration_prepared_1',
        job: {
          id: 'job_orchestration_prepared_1',
          workflowType: 'orchestration.prepare',
          payload: {},
          status: 'Succeeded',
          retryCount: 0
        },
        contextPack,
        agentRun: {
          id: 'agent_run_orchestration_prepared_1',
          agentName: 'Planner',
          taskType: 'chapter_planning',
          workflowType: 'chapter_creation',
          promptVersionId: 'prompt_chapter_plan_v1',
          contextPackId: contextPack.id,
          status: 'Succeeded',
          createdAt: '2026-04-28T00:00:00.000Z'
        },
        workflowRun: null,
        llmCalls: [],
        output: { title: 'Prepared chapter plan', nextAction: 'Review with author' }
      })),
      cancelPrepared: vi.fn(async () => ({
        id: 'job_orchestration_prepared_1',
        projectId: 'project_abc',
        agentRunId: 'agent_run_orchestration_prepared_1',
        status: 'Cancelled',
        confirmationRequired: true,
        provider: {
          provider: 'openai',
          model: 'gpt-test',
          isExternal: true,
          secretConfigured: true
        },
        budgetEstimate: { inputTokens: 42, outputTokens: 1024, estimatedCostUsd: 0.016 },
        warnings: [],
        blockingReasons: [],
        expiresAt: '2026-04-28T01:00:00.000Z',
        contextPack
      }))
    };
    const app = buildApp({ orchestration: service as never });

    const payload = {
      projectId: 'project_abc',
      workflowType: 'chapter_creation',
      taskType: 'chapter_planning',
      agentRole: 'Planner',
      taskGoal: 'Plan the next siege chapter',
      riskLevel: 'Medium',
      outputSchema: 'ChapterPlan',
      promptVersionId: 'prompt_chapter_plan_v1',
      retrieval: { query: 'siege chapter' }
    };

    const prepare = await app.inject({
      method: 'POST',
      url: '/orchestration/runs/prepare',
      payload
    });
    expect(prepare.statusCode).toBe(201);
    expect(service.prepare).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project_abc' }));
    expect(prepare.json()).toMatchObject({
      id: 'job_orchestration_prepared_1',
      status: 'Prepared',
      contextPack: { id: contextPack.id }
    });

    const execute = await app.inject({
      method: 'POST',
      url: '/orchestration/runs/job_orchestration_prepared_1/execute',
      payload: { confirmed: true, confirmedBy: 'vitest' }
    });
    expect(execute.statusCode).toBe(201);
    expect(service.executePrepared).toHaveBeenCalledWith('job_orchestration_prepared_1', {
      confirmed: true,
      confirmedBy: 'vitest'
    });
    expect(execute.json()).toMatchObject({ output: { title: 'Prepared chapter plan' } });

    const cancel = await app.inject({
      method: 'POST',
      url: '/orchestration/runs/job_orchestration_prepared_1/cancel',
      payload: { cancelledBy: 'vitest' }
    });
    expect(cancel.statusCode).toBe(200);
    expect(service.cancelPrepared).toHaveBeenCalledWith('job_orchestration_prepared_1', { cancelledBy: 'vitest' });
    expect(cancel.json()).toMatchObject({ id: 'job_orchestration_prepared_1', status: 'Cancelled' });

    await app.close();
  });
});
