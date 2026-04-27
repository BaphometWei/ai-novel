import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('context pack API routes', () => {
  it('creates, reads, and lists persisted context packs', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const createResponse = await runtime.app.inject({
      method: 'POST',
      url: '/context-packs',
      payload: {
        taskGoal: 'Plan chapter',
        agentRole: 'Planner',
        riskLevel: 'Medium',
        sections: [{ name: 'canon', content: 'The city is under siege.' }],
        citations: [{ sourceId: 'canon_fact_1', quote: 'The city is under siege.' }],
        exclusions: ['restricted_sample_1'],
        warnings: ['Timeline pressure'],
        retrievalTrace: ['keyword: siege']
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const contextPack = createResponse.json();
    expect(contextPack).toMatchObject({
      id: expect.stringMatching(/^context_pack_/),
      artifactId: expect.stringMatching(/^artifact_/),
      sections: [{ name: 'canon', content: 'The city is under siege.' }]
    });

    const byId = await runtime.app.inject({ method: 'GET', url: `/context-packs/${contextPack.id}` });
    const artifactResponse = await runtime.app.inject({ method: 'GET', url: `/artifacts/${contextPack.artifactId}` });
    const list = await runtime.app.inject({ method: 'GET', url: '/context-packs?limit=5' });

    expect(byId.statusCode).toBe(200);
    expect(byId.json()).toMatchObject({ id: contextPack.id });
    expect(artifactResponse.statusCode).toBe(200);
    expect(artifactResponse.json()).toMatchObject({
      id: contextPack.artifactId,
      type: 'context_pack',
      source: 'system',
      hash: expect.stringMatching(/^sha256:/)
    });
    await expect(runtime.stores.artifactContent.readText(artifactResponse.json().uri)).resolves.toContain(
      '"taskGoal":"Plan chapter"'
    );
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([expect.objectContaining({ id: contextPack.id })]);

    await runtime.app.close();
    runtime.database.client.close();
  });
});
