import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('project routes', () => {
  it('updates the project external model policy', async () => {
    const app = buildApp();
    const created = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Offline Draft',
        language: 'en-US',
        targetAudience: 'local-only authors'
      }
    });
    const project = created.json();

    const updated = await app.inject({
      method: 'PATCH',
      url: `/projects/${project.id}/external-model-policy`,
      payload: { externalModelPolicy: 'Disabled' }
    });

    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toMatchObject({
      id: project.id,
      externalModelPolicy: 'Disabled'
    });

    const read = await app.inject({ method: 'GET', url: `/projects/${project.id}` });
    expect(read.json()).toMatchObject({
      id: project.id,
      externalModelPolicy: 'Disabled'
    });
    await app.close();
  });

  it('returns 404 when updating an unknown project external model policy', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'PATCH',
      url: '/projects/project_missing/external-model-policy',
      payload: { externalModelPolicy: 'Disabled' }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: 'Project not found' });
    await app.close();
  });
});
