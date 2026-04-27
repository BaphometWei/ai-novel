import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ScheduledBackupRepository } from '../repositories/scheduled-backup.repository';

describe('ScheduledBackupRepository', () => {
  it('upserts policies, lists enabled due schedules, and advances run metadata', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ScheduledBackupRepository(database.db);

    await repository.upsert({
      id: 'schedule_due',
      projectId: 'project_1',
      cadence: 'daily',
      targetPathPrefix: 'backups/project_1',
      enabled: true,
      lastRunAt: undefined,
      nextRunAt: '2026-04-27T09:00:00.000Z',
      retentionCount: 7
    });
    await repository.upsert({
      id: 'schedule_disabled',
      projectId: 'project_2',
      cadence: 'daily',
      targetPathPrefix: 'backups/project_2',
      enabled: false,
      lastRunAt: undefined,
      nextRunAt: '2026-04-27T08:00:00.000Z',
      retentionCount: 3
    });
    await repository.upsert({
      id: 'schedule_future',
      projectId: 'project_3',
      cadence: 'weekly',
      targetPathPrefix: 'backups/project_3',
      enabled: true,
      lastRunAt: undefined,
      nextRunAt: '2026-04-28T09:00:00.000Z',
      retentionCount: 4
    });

    expect(await repository.listDue('2026-04-27T10:00:00.000Z')).toEqual([
      {
        id: 'schedule_due',
        projectId: 'project_1',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_1',
        enabled: true,
        lastRunAt: undefined,
        nextRunAt: '2026-04-27T09:00:00.000Z',
        retentionCount: 7
      }
    ]);

    await repository.updateRunStatus('schedule_due', {
      lastRunAt: '2026-04-27T10:15:00.000Z',
      nextRunAt: '2026-04-28T09:00:00.000Z',
      lastRunStatus: 'Succeeded'
    });

    expect(await repository.listDue('2026-04-27T10:30:00.000Z')).toEqual([]);
    expect(await repository.findById('schedule_due')).toEqual({
      id: 'schedule_due',
      projectId: 'project_1',
      cadence: 'daily',
      targetPathPrefix: 'backups/project_1',
      enabled: true,
      lastRunAt: '2026-04-27T10:15:00.000Z',
      nextRunAt: '2026-04-28T09:00:00.000Z',
      retentionCount: 7,
      lastRunStatus: 'Succeeded'
    });

    database.client.close();
  });
});
