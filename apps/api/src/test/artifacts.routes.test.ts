import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('artifact metadata API routes', () => {
  it('creates and reads artifact metadata by id, hash, and list filters', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const createResponse = await runtime.app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        type: 'manuscript_version',
        source: 'user',
        version: 1,
        hash: 'sha256:artifact-route-body',
        uri: 'artifacts/chapter-body.md',
        relatedRunId: 'agent_run_writer'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const artifact = createResponse.json();
    expect(artifact).toMatchObject({
      id: expect.stringMatching(/^artifact_/),
      type: 'manuscript_version',
      hash: 'sha256:artifact-route-body',
      relatedRunId: 'agent_run_writer'
    });

    const byId = await runtime.app.inject({ method: 'GET', url: `/artifacts/${artifact.id}` });
    const byHash = await runtime.app.inject({
      method: 'GET',
      url: '/artifacts?hash=sha256%3Aartifact-route-body'
    });
    const byType = await runtime.app.inject({
      method: 'GET',
      url: '/artifacts?type=manuscript_version&source=user'
    });

    expect(byId.statusCode).toBe(200);
    expect(byId.json()).toMatchObject({ id: artifact.id });
    expect(byHash.statusCode).toBe(200);
    expect(byHash.json()).toMatchObject({ id: artifact.id });
    expect(byType.statusCode).toBe(200);
    expect(byType.json()).toEqual([expect.objectContaining({ id: artifact.id })]);

    await runtime.app.close();
    runtime.database.client.close();
  });
});
