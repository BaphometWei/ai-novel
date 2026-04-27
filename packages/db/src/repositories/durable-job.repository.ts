import type { DurableJob } from '@ai-novel/workflow';
import { eq } from 'drizzle-orm';
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
        replayOfJobId: job.replayOfJobId
      })
      .onConflictDoUpdate({
        target: durableJobs.id,
        set: {
          workflowType: job.workflowType,
          payloadJson: JSON.stringify(job.payload),
          status: job.status,
          retryCount: job.retryCount,
          replayOfJobId: job.replayOfJobId
        }
      });
  }

  async findById(id: string): Promise<DurableJob | null> {
    const row = await this.db.select().from(durableJobs).where(eq(durableJobs.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      workflowType: row.workflowType,
      payload: JSON.parse(row.payloadJson) as DurableJob['payload'],
      status: row.status as DurableJob['status'],
      retryCount: row.retryCount,
      replayOfJobId: row.replayOfJobId ?? undefined
    };
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
}
