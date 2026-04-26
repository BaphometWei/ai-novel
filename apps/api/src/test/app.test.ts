import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('API app', () => {
  it('reports health', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: 'ai-novel-api' });
  });

  it('creates and returns a project through the API', async () => {
    const app = buildApp();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: 'Long Night',
        language: 'zh-CN',
        targetAudience: 'Chinese web-novel readers'
      }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json();
    expect(created).toMatchObject({ title: 'Long Night', status: 'Active' });

    const getResponse = await app.inject({ method: 'GET', url: `/projects/${created.id}` });
    expect(getResponse.statusCode).toBe(200);
    expect(getResponse.json()).toMatchObject({ id: created.id, title: 'Long Night' });
  });

  it('returns 400 for invalid project payloads', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/projects',
      payload: {
        title: '',
        language: 'zh-CN',
        targetAudience: ''
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: 'Invalid project payload' });
  });
});
