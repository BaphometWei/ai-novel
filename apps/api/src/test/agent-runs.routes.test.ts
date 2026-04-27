import {
  AgentRunRepository,
  ContextPackRepository,
  createDatabase,
  LlmCallLogRepository,
  migrateDatabase,
  PromptVersionRepository,
  type PromptVersion
} from '@ai-novel/db';
import { createAgentRun, createContextPack } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';

const promptVersion: PromptVersion = {
  id: 'prompt_v1',
  taskType: 'chapter_planning',
  template: 'Plan {{goal}} from {{context}}',
  model: 'fake-model',
  provider: 'fake',
  version: 1,
  status: 'Active',
  createdAt: '2026-04-27T06:00:00.000Z'
};

describe('agent run observability API routes', () => {
  it('lists agent runs using optional filters and limit', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const llmCallLogs = new LlmCallLogRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Plan chapter',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      sections: [],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const queuedChapterRun = {
      ...createAgentRun({
        agentName: 'Planner Agent',
        taskType: 'chapter_planning',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_v1',
        contextPackId: contextPack.id
      }),
      createdAt: '2026-04-27T06:00:00.000Z'
    };
    const runningSceneRun = {
      ...createAgentRun({
        agentName: 'Writer Agent',
        taskType: 'scene_draft',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_v1',
        contextPackId: contextPack.id
      }),
      status: 'Running' as const,
      createdAt: '2026-04-27T06:01:00.000Z'
    };
    await promptVersions.save(promptVersion);
    await contextPacks.save(contextPack);
    await agentRuns.save(queuedChapterRun);
    await agentRuns.save(runningSceneRun);
    const app = buildApp({ agentRuns: { agentRuns, llmCallLogs } });

    const response = await app.inject({
      method: 'GET',
      url: '/agent-runs?workflowType=chapter_creation&status=Running&limit=1'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([runningSceneRun]);
    database.client.close();
  });

  it('returns an agent run by id', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const llmCallLogs = new LlmCallLogRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Plan chapter',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      sections: [],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const run = {
      ...createAgentRun({
        agentName: 'Planner Agent',
        taskType: 'chapter_planning',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_v1',
        contextPackId: contextPack.id
      }),
      status: 'Succeeded' as const,
      createdAt: '2026-04-27T06:02:00.000Z'
    };
    await promptVersions.save(promptVersion);
    await contextPacks.save(contextPack);
    await agentRuns.save(run);
    const app = buildApp({ agentRuns: { agentRuns, llmCallLogs } });

    const response = await app.inject({ method: 'GET', url: `/agent-runs/${run.id}` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(run);
    database.client.close();
  });

  it('returns the context pack referenced by an agent run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const llmCallLogs = new LlmCallLogRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Draft the midpoint reveal',
      agentRole: 'Writer Agent',
      riskLevel: 'High',
      sections: [{ name: 'canon', content: 'The heir is hiding in the clock tower.' }],
      citations: [{ sourceId: 'canon_fact_heir', quote: 'hiding in the clock tower' }],
      exclusions: ['restricted_sample_clocktower'],
      warnings: ['Do not reveal the heir identity yet.'],
      retrievalTrace: ['entity: heir', 'location: clock tower']
    });
    const run = createAgentRun({
      agentName: 'Writer Agent',
      taskType: 'scene_draft',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: contextPack.id
    });
    await promptVersions.save(promptVersion);
    await contextPacks.save(contextPack);
    await agentRuns.save(run);
    const app = buildApp({ agentRuns: { agentRuns, llmCallLogs, contextPacks } });

    const response = await app.inject({ method: 'GET', url: `/agent-runs/${run.id}/context-pack` });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(contextPack);
    database.client.close();
  });

  it('wires persistent runtime agent run context-pack reads to persisted context packs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const contextPack = createContextPack({
      taskGoal: 'Draft chapter opening',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'The bridge is already destroyed.' }],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const run = createAgentRun({
      agentName: 'Writer Agent',
      taskType: 'scene_draft',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_chapter_plan_v1',
      contextPackId: contextPack.id
    });
    await runtime.stores.contextPacks.save(contextPack);
    await runtime.stores.agentRuns.agentRuns.save(run);

    const response = await runtime.app.inject({
      method: 'GET',
      url: `/agent-runs/${run.id}/context-pack`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(contextPack);
    await runtime.app.close();
    runtime.database.client.close();
  });

  it('records and returns LLM call logs for an agent run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const llmCallLogs = new LlmCallLogRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Plan chapter',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'The city is under siege.' }],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const run = createAgentRun({
      agentName: 'Planner Agent',
      taskType: 'chapter_planning',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: contextPack.id
    });
    await promptVersions.save(promptVersion);
    await contextPacks.save(contextPack);
    await agentRuns.save(run);
    const app = buildApp({ agentRuns: { agentRuns, llmCallLogs } });

    const createResponse = await app.inject({
      method: 'POST',
      url: `/agent-runs/${run.id}/llm-calls`,
      payload: {
        promptVersionId: 'prompt_v1',
        provider: 'fake',
        model: 'fake-model',
        schemaName: 'ChapterPlan',
        usage: { inputTokens: 100, outputTokens: 40 },
        durationMs: 250,
        estimatedCostUsd: 0.0014,
        retryCount: 1,
        status: 'Succeeded'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toMatchObject({
      id: expect.stringMatching(/^llm_call_/),
      agentRunId: run.id,
      promptVersionId: 'prompt_v1',
      model: 'fake-model',
      status: 'Succeeded'
    });

    const listResponse = await app.inject({ method: 'GET', url: `/agent-runs/${run.id}/llm-calls` });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([created]);
    database.client.close();
  });

  it('returns 404 instead of surfacing a foreign-key failure for missing agent runs', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const app = buildApp({
      agentRuns: {
        agentRuns: new AgentRunRepository(database.db),
        llmCallLogs: new LlmCallLogRepository(database.db)
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/agent-runs/agent_run_missing/llm-calls',
      payload: {
        promptVersionId: 'prompt_v1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 1, outputTokens: 1 },
        durationMs: 10,
        estimatedCostUsd: 0.000002,
        retryCount: 0,
        status: 'Succeeded'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Agent run not found' });
    database.client.close();
  });
});
