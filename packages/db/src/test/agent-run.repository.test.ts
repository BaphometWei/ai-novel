import { createAgentRun, createContextPack } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { AgentRunRepository } from '../repositories/agent-run.repository';
import { ContextPackRepository } from '../repositories/context-pack.repository';

describe('agent run persistence', () => {
  it('stores context packs and traceable agent runs', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const contextPacks = new ContextPackRepository(database.db);
    const agentRuns = new AgentRunRepository(database.db);
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

  it('rejects agent runs that reference a missing context pack', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const agentRuns = new AgentRunRepository(database.db);
    const run = createAgentRun({
      agentName: 'Writer Agent',
      taskType: 'scene_draft',
      workflowType: 'chapter_creation',
      promptVersionId: 'prompt_v1',
      contextPackId: 'context_pack_missing'
    });

    await expect(agentRuns.save(run)).rejects.toThrow();
    database.client.close();
  });
});
