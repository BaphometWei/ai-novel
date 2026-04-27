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
  id: 'prompt_obs_v1',
  taskType: 'chapter_planning',
  template: 'Plan {{goal}} from {{context}}',
  model: 'fake-model',
  provider: 'fake',
  version: 1,
  status: 'Active',
  createdAt: '2026-04-27T06:00:00.000Z'
};

describe('observability API routes', () => {
  it('returns an observability summary from injected runtime stores', async () => {
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
        promptVersionId: promptVersion.id,
        contextPackId: contextPack.id
      }),
      status: 'Succeeded' as const,
      createdAt: '2026-04-27T06:01:00.000Z'
    };
    await promptVersions.save(promptVersion);
    await contextPacks.save(contextPack);
    await agentRuns.save(run);
    const app = buildApp({ agentRuns: { agentRuns, llmCallLogs } });
    await app.inject({
      method: 'POST',
      url: `/agent-runs/${run.id}/llm-calls`,
      payload: {
        promptVersionId: promptVersion.id,
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 100, outputTokens: 40 },
        durationMs: 250,
        estimatedCostUsd: 0.0014,
        retryCount: 1,
        status: 'Succeeded'
      }
    });

    const response = await app.inject({ method: 'GET', url: '/observability/summary' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cost: { totalUsd: 0.0014, averageUsdPerRun: 0.0014 },
      latency: { averageDurationMs: 250, p95DurationMs: 250 },
      tokens: { total: 140, averagePerRun: 140 },
      quality: { acceptedRate: 1 },
      adoption: { adoptedRate: 1 }
    });
    database.client.close();
  });

  it('wires persistent runtime observability summary to persisted agent runs and LLM calls', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
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
    const run = createAgentRun({
      agentName: 'Planner Agent',
      taskType: 'chapter_planning',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_chapter_plan_v1',
      contextPackId: contextPack.id
    });
    await runtime.stores.contextPacks.save(contextPack);
    await runtime.stores.agentRuns.agentRuns.save(run);
    await runtime.app.inject({
      method: 'POST',
      url: `/agent-runs/${run.id}/llm-calls`,
      payload: {
        promptVersionId: 'prompt_chapter_plan_v1',
        provider: 'fake',
        model: 'fake-model',
        usage: { inputTokens: 10, outputTokens: 5 },
        durationMs: 100,
        estimatedCostUsd: 0.00015,
        retryCount: 0,
        status: 'Succeeded'
      }
    });

    const response = await runtime.app.inject({ method: 'GET', url: '/observability/summary' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      cost: { totalUsd: 0.00015 },
      tokens: { total: 15 }
    });
    await runtime.app.close();
    runtime.database.client.close();
  });
});
