import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';

describe('scheduled backup API routes', () => {
  it('upserts and lists scheduled backup policies', async () => {
    const app = buildApp();

    const upsert = await app.inject({
      method: 'PUT',
      url: '/scheduled-backups/policies/schedule_daily',
      payload: {
        projectId: 'project_1',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_1',
        enabled: true,
        nextRunAt: '2026-04-27T09:00:00.000Z',
        retentionCount: 7
      }
    });
    const list = await app.inject({ method: 'GET', url: '/scheduled-backups/policies' });

    expect(upsert.statusCode).toBe(200);
    expect(upsert.json()).toEqual({
      id: 'schedule_daily',
      projectId: 'project_1',
      cadence: 'daily',
      targetPathPrefix: 'backups/project_1',
      enabled: true,
      nextRunAt: '2026-04-27T09:00:00.000Z',
      retentionCount: 7
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([upsert.json()]);
  });

  it('lists due policies as scheduled backup job intents', async () => {
    const app = buildApp();

    await app.inject({
      method: 'PUT',
      url: '/scheduled-backups/policies/schedule_due',
      payload: {
        projectId: 'project_1',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_1',
        enabled: true,
        nextRunAt: '2026-04-27T09:00:00.000Z',
        retentionCount: 7
      }
    });
    await app.inject({
      method: 'PUT',
      url: '/scheduled-backups/policies/schedule_future',
      payload: {
        projectId: 'project_2',
        cadence: 'weekly',
        targetPathPrefix: 'backups/project_2',
        enabled: true,
        nextRunAt: '2026-04-28T09:00:00.000Z',
        retentionCount: 4
      }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/scheduled-backups/due?now=2026-04-27T10:00:00.000Z'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      policies: [
        {
          id: 'schedule_due',
          projectId: 'project_1',
          cadence: 'daily',
          targetPathPrefix: 'backups/project_1',
          enabled: true,
          nextRunAt: '2026-04-27T09:00:00.000Z',
          retentionCount: 7
        }
      ],
      intents: [
        {
          scheduleId: 'schedule_due',
          projectId: 'project_1',
          type: 'backup.create',
          reason: 'scheduled',
          requestedBy: 'scheduled-backup',
          targetPathPrefix: 'backups/project_1',
          retentionCount: 7
        }
      ]
    });
  });

  it('marks a scheduled backup run success and advances the next run', async () => {
    const app = buildApp();
    await app.inject({
      method: 'PUT',
      url: '/scheduled-backups/policies/schedule_daily',
      payload: {
        projectId: 'project_1',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_1',
        enabled: true,
        nextRunAt: '2026-04-27T09:00:00.000Z',
        retentionCount: 7
      }
    });

    const response = await app.inject({
      method: 'POST',
      url: '/scheduled-backups/policies/schedule_daily/runs',
      payload: {
        completedAt: '2026-04-27T10:15:00.000Z',
        status: 'Succeeded'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: 'schedule_daily',
      lastRunAt: '2026-04-27T10:15:00.000Z',
      nextRunAt: '2026-04-28T09:00:00.000Z',
      lastRunStatus: 'Succeeded'
    });
  });

  it('returns 400 for invalid scheduled backup payloads', async () => {
    const app = buildApp();

    const response = await app.inject({
      method: 'PUT',
      url: '/scheduled-backups/policies/schedule_bad',
      payload: {
        projectId: '',
        cadence: 'yearly',
        targetPathPrefix: '',
        enabled: true,
        nextRunAt: 'not-a-date',
        retentionCount: 0
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: 'Invalid scheduled backup payload' });
  });
});
