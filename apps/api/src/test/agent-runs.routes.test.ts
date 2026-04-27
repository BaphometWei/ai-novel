import {
  AgentRunRepository,
  ContextPackRepository,
  createDatabase,
  LlmCallLogRepository,
  migrateDatabase
} from '@ai-novel/db';
import { createAgentRun, createContextPack } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('agent run observability API routes', () => {
  it('records and returns LLM call logs for an agent run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const llmCallLogs = new LlmCallLogRepository(database.db);
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
