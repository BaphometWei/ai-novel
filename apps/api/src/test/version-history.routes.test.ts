import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('version history API routes', () => {
  it('creates and lists version history snapshots through the persistent runtime', async () => {
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
      url: `/version-history/${project.id}/snapshots`,
      payload: {
        createdAt: '2026-04-27T08:00:00.000Z',
        entities: [
          { id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' },
          { id: 'canon_1', type: 'canon', version: 1, label: 'Canon Fact v1' }
        ],
        links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
      }
    });

    const listResponse = await runtime.app.inject({
      method: 'GET',
      url: `/version-history/${project.id}`
    });

    expect(createResponse.statusCode).toBe(201);
    expect(createResponse.json()).toMatchObject({
      projectId: project.id,
      history: {
        trace: { createdAt: '2026-04-27T08:00:00.000Z' },
        restorePoints: [{ entityId: 'chapter_1', version: 3 }]
      }
    });
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([expect.objectContaining({ id: createResponse.json().id })]);

    await runtime.app.close();
    runtime.database.client.close();
  });

  it('rejects invalid snapshot payloads', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const response = await runtime.app.inject({
      method: 'POST',
      url: '/version-history/project_missing/snapshots',
      payload: { entities: [], links: [] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'Invalid version history payload' });

    await runtime.app.close();
    runtime.database.client.close();
  });
});

