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
});
