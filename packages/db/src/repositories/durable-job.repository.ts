import { claimJob, requestJobCancellation, type DurableJob } from '@ai-novel/workflow';
import { asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { durableJobs } from '../schema';

export class DurableJobRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(job: DurableJob): Promise<void> {
    await this.db
      .insert(durableJobs)
      .values({
        id: job.id,
        workflowType: job.workflowType,
        payloadJson: JSON.stringify(job.payload),
        status: job.status,
        retryCount: job.retryCount,
        replayOfJobId: job.replayOfJobId,
        availableAt: job.availableAt,
        leaseOwner: job.leaseOwner,
        leaseExpiresAt: job.leaseExpiresAt,
        cancelRequestedAt: job.cancelRequestedAt,
        lastError: job.lastError
      })
      .onConflictDoUpdate({
        target: durableJobs.id,
        set: {
          workflowType: job.workflowType,
          payloadJson: JSON.stringify(job.payload),
          status: job.status,
          retryCount: job.retryCount,
          replayOfJobId: job.replayOfJobId,
          availableAt: job.availableAt,
          leaseOwner: job.leaseOwner,
          leaseExpiresAt: job.leaseExpiresAt,
          cancelRequestedAt: job.cancelRequestedAt,
          lastError: job.lastError
        }
      });
  }

  async findById(id: string): Promise<DurableJob | null> {
    const row = await this.db.select().from(durableJobs).where(eq(durableJobs.id, id)).get();
    if (!row) return null;

    return toDurableJob(row);
  }

  async findByAgentRunId(agentRunId: string): Promise<DurableJob | null> {
    const row = await this.db
      .select()
      .from(durableJobs)
      .where(sql`json_extract(${durableJobs.payloadJson}, '$.agentRunId') = ${agentRunId}`)
      .orderBy(sql`rowid DESC`)
      .limit(1)
      .get();
    if (!row) return null;

    return toDurableJob(row);
  }

  async findReplayLineage(id: string): Promise<string[]> {
    const lineage: string[] = [];
    let current = await this.findById(id);

    while (current) {
      lineage.unshift(current.id);
      current = current.replayOfJobId ? await this.findById(current.replayOfJobId) : null;
    }

    return lineage;
  }

  async listDue(now: string, limit = 25): Promise<DurableJob[]> {
    const rows = await this.db.select().from(durableJobs).orderBy(asc(sql`rowid`)).all();
    return rows.map(toDurableJob).filter((job) => isDue(job, now)).slice(0, limit);
  }

  async claimNext(input: {
    workflowTypes?: string[];
    workerId: string;
    now: string;
    leaseMs: number;
  }): Promise<DurableJob | null> {
    const dueJobs = await this.listDue(input.now, 100);
    const job = dueJobs.find((candidate) => {
      if (input.workflowTypes && !input.workflowTypes.includes(candidate.workflowType)) return false;
      return isClaimable(candidate, input.now);
    });
    if (!job) return null;

    const claimed = claimJob(job, {
      workerId: input.workerId,
      now: input.now,
      leaseMs: input.leaseMs
    });
    await this.save(claimed);
    return claimed;
  }

  async markCancelRequested(id: string, input: { now: string; reason?: string }): Promise<DurableJob | null> {
    const job = await this.findById(id);
    if (!job) return null;

    const updated = requestJobCancellation(job, input);
    await this.save(updated);
    return updated;
  }
}

function toDurableJob(row: typeof durableJobs.$inferSelect): DurableJob {
  return {
    id: row.id,
    workflowType: row.workflowType,
    payload: JSON.parse(row.payloadJson) as DurableJob['payload'],
    status: row.status as DurableJob['status'],
    retryCount: row.retryCount,
    replayOfJobId: row.replayOfJobId ?? undefined,
    availableAt: row.availableAt ?? undefined,
    leaseOwner: row.leaseOwner ?? undefined,
    leaseExpiresAt: row.leaseExpiresAt ?? undefined,
    cancelRequestedAt: row.cancelRequestedAt ?? undefined,
    lastError: row.lastError ?? undefined
  };
}

function isDue(job: DurableJob, now: string): boolean {
  return (job.status === 'Queued' || job.status === 'Retrying') && (!job.availableAt || job.availableAt <= now);
}

function isClaimable(job: DurableJob, now: string): boolean {
  if (job.leaseExpiresAt && job.leaseExpiresAt > now) return false;
  const leaseExpiresAt = job.leaseExpiresAt;
  return isDue(job, now) || (job.status === 'Running' && leaseExpiresAt !== undefined && leaseExpiresAt <= now);
}
