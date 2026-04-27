import { createAgentRun, createContextPack } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { AgentRunRepository } from '../repositories/agent-run.repository';
import { ContextPackRepository } from '../repositories/context-pack.repository';
import { PromptVersionRepository, type PromptVersion } from '../repositories/prompt-version.repository';

const promptVersion: PromptVersion = {
  id: 'prompt_v1',
  taskType: 'scene_draft',
  template: 'Draft a scene from {{context}}',
  model: 'gpt-test',
  provider: 'fake',
  version: 1,
  status: 'Active',
  createdAt: '2026-04-27T06:00:00.000Z'
};

describe('agent run persistence', () => {
  it('stores context packs and traceable agent runs', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [{ name: 'canon', content: 'Hero is injured.' }],
      citations: [{ sourceId: 'canon_fact_1', quote: 'Hero is injured.' }],
      exclusions: ['restricted_sample_1'],
      warnings: ['Timeline deadline nearby'],
      retrievalTrace: ['keyword: hero injury']
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

    await expect(contextPacks.findById(contextPack.id)).resolves.toMatchObject({
      id: contextPack.id,
      exclusions: ['restricted_sample_1']
    });
    await expect(agentRuns.findById(run.id)).resolves.toMatchObject({
      id: run.id,
      contextPackId: contextPack.id,
      status: 'Queued'
    });
    database.client.close();
  });

  it('rejects agent runs that reference a missing prompt version', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const run = createAgentRun({
      agentName: 'Writer Agent',
      taskType: 'scene_draft',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_missing',
      contextPackId: contextPack.id
    });

    await contextPacks.save(contextPack);

    await expect(agentRuns.save(run)).rejects.toThrow();
    database.client.close();
  });

  it('rejects agent runs that reference a missing context pack', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const agentRuns = new AgentRunRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const run = createAgentRun({
      agentName: 'Writer Agent',
      taskType: 'scene_draft',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: 'context_pack_missing'
    });

    await promptVersions.save(promptVersion);
    await expect(agentRuns.save(run)).rejects.toThrow();
    database.client.close();
  });

  it('updates agent run status when saving an existing run', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const contextPack = createContextPack({
      taskGoal: 'Draft a scene',
      agentRole: 'Writer Agent',
      riskLevel: 'Medium',
      sections: [],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
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
    await agentRuns.save({ ...run, status: 'Running' });
    await agentRuns.save({ ...run, status: 'Cancelled' });

    await expect(agentRuns.findById(run.id)).resolves.toMatchObject({
      id: run.id,
      status: 'Cancelled'
    });
    database.client.close();
  });

  it('lists agent runs with optional workflow, task, status, and limit filters', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
    const promptVersions = new PromptVersionRepository(database.db);
    const firstContextPack = createContextPack({
      taskGoal: 'Plan a chapter',
      agentRole: 'Planner Agent',
      riskLevel: 'Medium',
      sections: [],
      citations: [],
      exclusions: [],
      warnings: [],
      retrievalTrace: []
    });
    const secondContextPack = createContextPack({
      taskGoal: 'Review a scene',
      agentRole: 'Reviewer Agent',
      riskLevel: 'High',
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
        contextPackId: firstContextPack.id
      }),
      createdAt: '2026-04-27T06:00:00.000Z'
    };
    const runningSceneRun = {
      ...createAgentRun({
        agentName: 'Writer Agent',
        taskType: 'scene_draft',
        workflowType: 'chapter_creation',
        promptVersionId: 'prompt_v1',
        contextPackId: firstContextPack.id
      }),
      status: 'Running' as const,
      createdAt: '2026-04-27T06:01:00.000Z'
    };
    const failedReviewRun = {
      ...createAgentRun({
        agentName: 'Reviewer Agent',
        taskType: 'continuity_review',
        workflowType: 'quality_review',
        promptVersionId: 'prompt_v1',
        contextPackId: secondContextPack.id
      }),
      status: 'Failed' as const,
      createdAt: '2026-04-27T06:02:00.000Z'
    };

    await promptVersions.save(promptVersion);
    await contextPacks.save(firstContextPack);
    await contextPacks.save(secondContextPack);
    await agentRuns.save(queuedChapterRun);
    await agentRuns.save(runningSceneRun);
    await agentRuns.save(failedReviewRun);

    await expect(agentRuns.list({ workflowType: 'chapter_creation', limit: 1 })).resolves.toEqual([
      queuedChapterRun
    ]);
    await expect(agentRuns.list({ taskType: 'scene_draft' })).resolves.toEqual([runningSceneRun]);
    await expect(agentRuns.list({ status: 'Failed' })).resolves.toEqual([failedReviewRun]);
    await expect(
      agentRuns.list({ workflowType: 'chapter_creation', taskType: 'scene_draft', status: 'Running' })
    ).resolves.toEqual([runningSceneRun]);
    database.client.close();
  });
});
