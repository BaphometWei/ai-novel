import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';
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
        taskGoal: 'Plan the next siege chapter',
        agentRole: 'Planner',
        riskLevel: 'Medium',
        sections: [{ name: 'canon', content: 'The city is under siege.' }]
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
      contextPack: { id: created.contextPack.id },
      workflowRun: { id: created.workflowRun.id },
      llmCalls: [{ agentRunId: created.agentRun.id, status: 'Succeeded' }]
    });

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
});
