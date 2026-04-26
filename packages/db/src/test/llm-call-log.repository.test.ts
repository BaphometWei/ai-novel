import { createAgentRun, createContextPack, createLlmCallRecord } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { AgentRunRepository } from '../repositories/agent-run.repository';
import { ContextPackRepository } from '../repositories/context-pack.repository';
import { LlmCallLogRepository } from '../repositories/llm-call-log.repository';

describe('LLM call log persistence', () => {
  it('stores traceable call metadata for an agent run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const callLogs = new LlmCallLogRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Plan chapter',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'The city is under siege.' }],
      citations: [{ sourceId: 'canon_fact_1', quote: 'city is under siege' }],
      exclusions: [],
      warnings: [],
      retrievalTrace: ['keyword: siege']
    });
    const run = createAgentRun({
      agentName: 'Planner Agent',
      taskType: 'chapter_planning',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: contextPack.id
    });
    const success = createLlmCallRecord({
      agentRunId: run.id,
      promptVersionId: 'prompt_v1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      usage: { inputTokens: 100, outputTokens: 40 },
      durationMs: 250,
      estimatedCostUsd: 0.0014,
      retryCount: 1,
      status: 'Succeeded'
    });
    const failure = createLlmCallRecord({
      agentRunId: run.id,
      promptVersionId: 'prompt_v1',
      provider: 'fake',
      model: 'fake-model',
      schemaName: 'ChapterPlan',
      usage: { inputTokens: 120, outputTokens: 20 },
      durationMs: 300,
      estimatedCostUsd: 0.0014,
      retryCount: 2,
      status: 'Failed',
      error: 'Structured output failed validation for ChapterPlan'
    });

    await contextPacks.save(contextPack);
    await agentRuns.save(run);
    await callLogs.save(success);
    await callLogs.save(failure);

    await expect(callLogs.findByAgentRunId(run.id)).resolves.toEqual([
      success,
      failure
    ]);
    database.client.close();
  });

  it('rejects call logs for a missing agent run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const callLogs = new LlmCallLogRepository(database.db);
    const log = createLlmCallRecord({
      agentRunId: 'agent_run_missing',
      promptVersionId: 'prompt_v1',
      provider: 'fake',
      model: 'fake-model',
      usage: { inputTokens: 1, outputTokens: 1 },
      durationMs: 10,
      estimatedCostUsd: 0.000002,
      retryCount: 0,
      status: 'Succeeded'
    });

    await expect(callLogs.save(log)).rejects.toThrow();
    database.client.close();
  });
});
