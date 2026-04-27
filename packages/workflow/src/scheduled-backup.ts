export type ScheduledBackupCadence = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type ScheduledBackupRunStatus = 'Succeeded' | 'Failed';

export interface ScheduledBackupPolicy {
  id: string;
  projectId: string;
  cadence: ScheduledBackupCadence;
  targetPathPrefix: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt: string;
  retentionCount: number;
  lastRunStatus?: ScheduledBackupRunStatus;
}

export interface ScheduledBackupJobIntent {
  scheduleId: string;
  projectId: string;
  type: 'backup.create';
  reason: 'scheduled';
  requestedBy: 'scheduled-backup';
  targetPathPrefix: string;
  retentionCount: number;
}

export interface ScheduledBackupRunResult {
  completedAt: string;
  status: ScheduledBackupRunStatus;
}

export function createScheduledBackupJobIntents(
  policies: ScheduledBackupPolicy[],
  now: string
): ScheduledBackupJobIntent[] {
  const nowTime = Date.parse(now);

  return policies
    .filter((policy) => policy.enabled && Date.parse(policy.nextRunAt) <= nowTime)
    .map((policy) => ({
      scheduleId: policy.id,
      projectId: policy.projectId,
      type: 'backup.create',
      reason: 'scheduled',
      requestedBy: 'scheduled-backup',
      targetPathPrefix: policy.targetPathPrefix,
      retentionCount: policy.retentionCount
    }));
}

export function advanceScheduledBackupAfterRun(
  policy: ScheduledBackupPolicy,
  result: ScheduledBackupRunResult
): ScheduledBackupPolicy {
  return {
    ...policy,
    lastRunAt: result.completedAt,
    nextRunAt: advanceCadence(policy.nextRunAt, policy.cadence),
    lastRunStatus: result.status
  };
}

function advanceCadence(nextRunAt: string, cadence: ScheduledBackupCadence): string {
  const date = new Date(nextRunAt);

  if (cadence === 'hourly') {
    date.setUTCHours(date.getUTCHours() + 1);
  } else if (cadence === 'daily') {
    date.setUTCDate(date.getUTCDate() + 1);
  } else if (cadence === 'weekly') {
    date.setUTCDate(date.getUTCDate() + 7);
  } else {
    date.setUTCMonth(date.getUTCMonth() + 1);
  }

  return date.toISOString();
}
