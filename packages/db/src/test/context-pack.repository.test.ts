import { createContextPack } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ContextPackRepository } from '../repositories/context-pack.repository';

describe('ContextPackRepository', () => {
  it('lists context packs with an optional limit', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ContextPackRepository(database.db);
    const first = {
      ...createContextPack({
        taskGoal: 'Plan chapter',
        agentRole: 'Planner Agent',
        riskLevel: 'Low',
        sections: [{ name: 'canon', content: 'The city gates are closed.' }],
        citations: [{ sourceId: 'canon_fact_1', quote: 'city gates are closed' }],
        exclusions: [],
        warnings: [],
        retrievalTrace: ['keyword: gates']
      }),
      createdAt: '2026-04-27T06:00:00.000Z'
    };
    const second = {
      ...createContextPack({
        taskGoal: 'Draft scene',
        agentRole: 'Writer Agent',
        riskLevel: 'Medium',
        sections: [{ name: 'outline', content: 'Open with a quiet argument.' }],
        citations: [],
        exclusions: ['restricted_sample_1'],
        warnings: ['Continuity check required'],
        retrievalTrace: ['semantic: argument']
      }),
      createdAt: '2026-04-27T06:01:00.000Z'
    };

    await repository.save(first);
    await repository.save(second);

    await expect(repository.list({})).resolves.toEqual([first, second]);
    await expect(repository.list({ limit: 1 })).resolves.toEqual([first]);
    database.client.close();
  });
});
