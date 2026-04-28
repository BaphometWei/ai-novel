import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('narrative intelligence acceptance integration', () => {
  it('updates persisted narrative state from an accepted manuscript version', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Narrative Project',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();

    const chapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/chapters`,
      payload: {
        title: 'Chapter 1',
        order: 1,
        body: 'The locked observatory is always sealed at noon. Mira chooses trust over control.',
        status: 'Accepted'
      }
    });
    const versionId = chapterResponse.json().version.id;

    const response = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/narrative-intelligence/extract-from-version`,
      payload: { manuscriptVersionId: versionId, sourceRunId: 'agent_run_seed' }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().created).toEqual(
      expect.arrayContaining(['promise', 'secret', 'arc', 'timeline', 'world_rule', 'dependency', 'closure'])
    );

    const summary = await runtime.app.inject({
      method: 'GET',
      url: `/narrative-intelligence/projects/${project.id}/summary?currentChapter=1`
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json().promiseStates.length).toBeGreaterThan(0);

    runtime.database.client.close();
    await runtime.app.close();
  });

  it('rejects extraction from manuscript versions that are not accepted', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const projectResponse = await runtime.app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Draft Narrative Project',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });
    const project = projectResponse.json();

    const chapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/chapters`,
      payload: {
        title: 'Chapter 1',
        order: 1,
        body: 'The draft observatory is not canon yet.',
        status: 'Draft'
      }
    });
    const versionId = chapterResponse.json().version.id;

    const response = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/narrative-intelligence/extract-from-version`,
      payload: { manuscriptVersionId: versionId, sourceRunId: 'agent_run_seed' }
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      error: 'Narrative extraction requires an accepted manuscript version'
    });

    runtime.database.client.close();
    await runtime.app.close();
  });
});
