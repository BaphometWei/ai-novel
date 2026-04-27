import type { ScheduledBackupPolicy, ScheduledBackupRunStatus } from '@ai-novel/workflow';
import { and, eq, lte } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { scheduledBackupPolicies } from '../schema';

export class ScheduledBackupRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(policy: ScheduledBackupPolicy): Promise<void> {
    await this.db
      .insert(scheduledBackupPolicies)
      .values(toRow(policy))
      .onConflictDoUpdate({
        target: scheduledBackupPolicies.id,
        set: toRow(policy)
      });
  }

  async findById(id: string): Promise<ScheduledBackupPolicy | null> {
    const row = await this.db
      .select()
      .from(scheduledBackupPolicies)
      .where(eq(scheduledBackupPolicies.id, id))
      .get();

    return row ? toPolicy(row) : null;
  }

  async listDue(now: string): Promise<ScheduledBackupPolicy[]> {
    const rows = await this.db
      .select()
      .from(scheduledBackupPolicies)
      .where(and(eq(scheduledBackupPolicies.enabled, 1), lte(scheduledBackupPolicies.nextRunAt, now)))
      .all();

    return rows.map(toPolicy);
  }

  async updateRunStatus(
    id: string,
    input: {
      lastRunAt: string;
      nextRunAt: string;
      lastRunStatus: ScheduledBackupRunStatus;
    }
  ): Promise<void> {
    await this.db
      .update(scheduledBackupPolicies)
      .set({
        lastRunAt: input.lastRunAt,
        nextRunAt: input.nextRunAt,
        lastRunStatus: input.lastRunStatus
      })
      .where(eq(scheduledBackupPolicies.id, id));
  }
}

function toRow(policy: ScheduledBackupPolicy): typeof scheduledBackupPolicies.$inferInsert {
  return {
    id: policy.id,
    projectId: policy.projectId,
    cadence: policy.cadence,
    targetPathPrefix: policy.targetPathPrefix,
    enabled: policy.enabled ? 1 : 0,
    lastRunAt: policy.lastRunAt,
    nextRunAt: policy.nextRunAt,
    retentionCount: policy.retentionCount,
    lastRunStatus: policy.lastRunStatus
  };
}

function toPolicy(row: typeof scheduledBackupPolicies.$inferSelect): ScheduledBackupPolicy {
  return {
    id: row.id,
    projectId: row.projectId,
    cadence: row.cadence as ScheduledBackupPolicy['cadence'],
    targetPathPrefix: row.targetPathPrefix,
    enabled: row.enabled === 1,
    lastRunAt: row.lastRunAt ?? undefined,
    nextRunAt: row.nextRunAt,
    retentionCount: row.retentionCount,
    lastRunStatus: (row.lastRunStatus ?? undefined) as ScheduledBackupPolicy['lastRunStatus']
  };
}
