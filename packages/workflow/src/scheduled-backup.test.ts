import { describe, expect, it } from 'vitest';
import {
  advanceScheduledBackupAfterRun,
  createScheduledBackupJobIntents,
  type ScheduledBackupPolicy
} from './scheduled-backup';

describe('scheduled backup workflow helpers', () => {
  it('creates backup job intents only for enabled schedules due at the provided time', () => {
    const policies: ScheduledBackupPolicy[] = [
      {
        id: 'schedule_due',
        projectId: 'project_1',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_1',
        enabled: true,
        lastRunAt: undefined,
        nextRunAt: '2026-04-27T09:00:00.000Z',
        retentionCount: 7
      },
      {
        id: 'schedule_disabled',
        projectId: 'project_2',
        cadence: 'daily',
        targetPathPrefix: 'backups/project_2',
        enabled: false,
        lastRunAt: undefined,
        nextRunAt: '2026-04-27T08:00:00.000Z',
        retentionCount: 3
      },
      {
        id: 'schedule_future',
        projectId: 'project_3',
        cadence: 'weekly',
        targetPathPrefix: 'backups/project_3',
        enabled: true,
        lastRunAt: undefined,
        nextRunAt: '2026-04-28T09:00:00.000Z',
        retentionCount: 4
      }
    ];

    expect(createScheduledBackupJobIntents(policies, '2026-04-27T10:00:00.000Z')).toEqual([
      {
        scheduleId: 'schedule_due',
        projectId: 'project_1',
        type: 'backup.create',
        reason: 'scheduled',
        requestedBy: 'scheduled-backup',
        targetPathPrefix: 'backups/project_1',
        retentionCount: 7
      }
    ]);
  });

  it('advances next run deterministically from the scheduled due time after success or failure', () => {
    const policy: ScheduledBackupPolicy = {
      id: 'schedule_due',
      projectId: 'project_1',
      cadence: 'daily',
      targetPathPrefix: 'backups/project_1',
      enabled: true,
      lastRunAt: '2026-04-26T09:00:00.000Z',
      nextRunAt: '2026-04-27T09:00:00.000Z',
      retentionCount: 7
    };

    expect(
      advanceScheduledBackupAfterRun(policy, {
        completedAt: '2026-04-27T10:15:00.000Z',
        status: 'Succeeded'
      })
    ).toEqual({
      ...policy,
      lastRunAt: '2026-04-27T10:15:00.000Z',
      nextRunAt: '2026-04-28T09:00:00.000Z',
      lastRunStatus: 'Succeeded'
    });

    expect(
      advanceScheduledBackupAfterRun(policy, {
        completedAt: '2026-04-27T10:20:00.000Z',
        status: 'Failed'
      })
    ).toEqual({
      ...policy,
      lastRunAt: '2026-04-27T10:20:00.000Z',
      nextRunAt: '2026-04-28T09:00:00.000Z',
      lastRunStatus: 'Failed'
    });
  });
});
