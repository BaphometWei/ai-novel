import { describe, expect, it } from 'vitest';
import { createPersistentApiRuntime } from '../runtime';

describe('manuscript chapter API routes', () => {
  it('creates a chapter, adds a version, and lists ordered versions through the API', async () => {
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
    const firstArtifactResponse = await runtime.app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        type: 'manuscript_version',
        source: 'user',
        version: 1,
        hash: 'sha256:chapter-opening-v1-api',
        uri: 'artifacts/chapter-opening-v1.md'
      }
    });
    const secondArtifactResponse = await runtime.app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        type: 'manuscript_version',
        source: 'agent_run',
        version: 2,
        hash: 'sha256:chapter-opening-v2-api',
        uri: 'artifacts/chapter-opening-v2.md'
      }
    });
    expect(firstArtifactResponse.statusCode).toBe(201);
    expect(secondArtifactResponse.statusCode).toBe(201);

    const createChapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${project.id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        bodyArtifactId: firstArtifactResponse.json().id
      }
    });
    const created = createChapterResponse.json();

    const addVersionResponse = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${created.chapter.id}/versions`,
      payload: {
        bodyArtifactId: secondArtifactResponse.json().id,
        status: 'Accepted',
        makeCurrent: true,
        metadata: { acceptedBy: 'author' }
      }
    });

    const listResponse = await runtime.app.inject({
      method: 'GET',
      url: `/projects/${project.id}/chapters`
    });

    expect(createChapterResponse.statusCode).toBe(201);
    expect(addVersionResponse.statusCode).toBe(201);
    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json()).toEqual([
      expect.objectContaining({
        id: created.chapter.id,
        title: 'Opening',
        currentVersionId: addVersionResponse.json().id,
        versions: [
          expect.objectContaining({ versionNumber: 1, bodyArtifactId: firstArtifactResponse.json().id }),
          expect.objectContaining({ versionNumber: 2, bodyArtifactId: secondArtifactResponse.json().id })
        ]
      })
    ]);

    await runtime.app.close();
    runtime.database.client.close();
  });

  it('stores chapter body text as a manuscript version artifact before creating the chapter version', async () => {
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

    const createChapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${projectResponse.json().id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        body: 'The city wakes under ash.'
      }
    });
    expect(createChapterResponse.statusCode).toBe(201);
    const created = createChapterResponse.json();
    const artifactResponse = await runtime.app.inject({
      method: 'GET',
      url: `/artifacts/${created.version.bodyArtifactId}`
    });

    expect(artifactResponse.statusCode).toBe(200);
    expect(artifactResponse.json()).toMatchObject({
      id: created.version.bodyArtifactId,
      type: 'manuscript_version',
      source: 'user',
      hash: expect.stringMatching(/^sha256:/)
    });
    await expect(runtime.stores.artifactContent.readText(artifactResponse.json().uri)).resolves.toBe(
      'The city wakes under ash.'
    );
    await runtime.app.close();
    runtime.database.client.close();
  });

  it('reads the current chapter body text from its manuscript version artifact', async () => {
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
    const createChapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${projectResponse.json().id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        body: 'The first accepted body.'
      }
    });
    const acceptedVersionResponse = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${createChapterResponse.json().chapter.id}/versions`,
      payload: {
        body: 'The author-approved current body.',
        status: 'Accepted',
        makeCurrent: true
      }
    });

    const bodyResponse = await runtime.app.inject({
      method: 'GET',
      url: `/chapters/${createChapterResponse.json().chapter.id}/current-body`
    });

    expect(acceptedVersionResponse.statusCode).toBe(201);
    expect(bodyResponse.statusCode).toBe(200);
    expect(bodyResponse.json()).toEqual({
      chapterId: createChapterResponse.json().chapter.id,
      versionId: acceptedVersionResponse.json().id,
      body: 'The author-approved current body.'
    });
    await runtime.app.close();
    runtime.database.client.close();
  });

  it('returns 404 when the current chapter body artifact content is unavailable', async () => {
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
    const artifactResponse = await runtime.app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        type: 'manuscript_version',
        source: 'user',
        version: 1,
        hash: 'sha256:chapter-body-missing-content',
        uri: 'artifacts/missing-current-body.md'
      }
    });
    const createChapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${projectResponse.json().id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        bodyArtifactId: artifactResponse.json().id
      }
    });

    const bodyResponse = await runtime.app.inject({
      method: 'GET',
      url: `/chapters/${createChapterResponse.json().chapter.id}/current-body`
    });

    expect(bodyResponse.statusCode).toBe(404);
    expect(bodyResponse.json()).toEqual({ error: 'Current chapter body not found' });
    await runtime.app.close();
    runtime.database.client.close();
  });

  it('rejects manuscript version status transitions that would break current-version invariants', async () => {
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
    const artifactResponse = await runtime.app.inject({
      method: 'POST',
      url: '/artifacts',
      payload: {
        type: 'manuscript_version',
        source: 'user',
        version: 1,
        hash: 'sha256:chapter-invalid-transition',
        uri: 'artifacts/chapter-invalid-transition.md'
      }
    });
    const artifactId = artifactResponse.json().id;

    const rejectedCreate = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${projectResponse.json().id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        bodyArtifactId: artifactId,
        status: 'Rejected'
      }
    });
    const createChapterResponse = await runtime.app.inject({
      method: 'POST',
      url: `/projects/${projectResponse.json().id}/chapters`,
      payload: {
        title: 'Opening',
        order: 1,
        bodyArtifactId: artifactId
      }
    });
    const acceptedNotCurrent = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${createChapterResponse.json().chapter.id}/versions`,
      payload: {
        bodyArtifactId: artifactId,
        status: 'Accepted',
        makeCurrent: false
      }
    });
    const rejectedCurrent = await runtime.app.inject({
      method: 'POST',
      url: `/chapters/${createChapterResponse.json().chapter.id}/versions`,
      payload: {
        bodyArtifactId: artifactId,
        status: 'Rejected',
        makeCurrent: true
      }
    });

    expect(rejectedCreate.statusCode).toBe(400);
    expect(acceptedNotCurrent.statusCode).toBe(400);
    expect(rejectedCurrent.statusCode).toBe(400);
    await runtime.app.close();
    runtime.database.client.close();
  });

  it('does not persist inline body artifacts when chapter version creation fails', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');

    const response = await runtime.app.inject({
      method: 'POST',
      url: '/chapters/chapter_missing/versions',
      payload: {
        body: 'This body should not be persisted.',
        status: 'Draft'
      }
    });
    const artifactList = await runtime.app.inject({
      method: 'GET',
      url: '/artifacts?type=manuscript_version&source=user'
    });

    expect(response.statusCode).toBe(404);
    expect(artifactList.statusCode).toBe(200);
    expect(artifactList.json()).toEqual([]);
    await runtime.app.close();
    runtime.database.client.close();
  });
});
