import type { RecurringIssueSummary, ReviewFinding, ReviewLearningEvent } from '@ai-novel/domain';
import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { recurringIssueSummaries, reviewLearningEvents } from '../schema';

export interface ReviewLearningEventRecord {
  projectId: string;
  profileId: string;
  category: string;
  event: ReviewLearningEvent;
  findingSnapshot: ReviewFinding;
}

export interface RecurringIssueSummaryRecord {
  projectId: string;
  profileId: string;
  category: string;
  summary: RecurringIssueSummary;
  updatedAt: string;
}

export class ReviewLearningRepository {
  constructor(private readonly db: AppDatabase) {}

  async saveLifecycleEvent(record: ReviewLearningEventRecord): Promise<void> {
    await this.db.insert(reviewLearningEvents).values({
      id: record.event.id,
      projectId: record.projectId,
      profileId: record.profileId,
      category: record.category,
      findingId: record.event.findingId,
      eventJson: JSON.stringify(record.event),
      findingSnapshotJson: JSON.stringify(record.findingSnapshot),
      occurredAt: record.event.occurredAt
    });
  }

  async listLifecycleEvents(
    projectId: string,
    profileId: string,
    category: string
  ): Promise<ReviewLearningEventRecord[]> {
    const rows = await this.db
      .select()
      .from(reviewLearningEvents)
      .where(
        and(
          eq(reviewLearningEvents.projectId, projectId),
          eq(reviewLearningEvents.profileId, profileId),
          eq(reviewLearningEvents.category, category)
        )
      )
      .orderBy(asc(reviewLearningEvents.occurredAt), asc(reviewLearningEvents.id))
      .all();

    return rows.map((row) => ({
      projectId: row.projectId,
      profileId: row.profileId,
      category: row.category,
      event: JSON.parse(row.eventJson) as ReviewLearningEvent,
      findingSnapshot: JSON.parse(row.findingSnapshotJson) as ReviewFinding
    }));
  }

  async upsertRecurringIssueSummary(record: RecurringIssueSummaryRecord): Promise<void> {
    const row = {
      id: toSummaryId(record),
      projectId: record.projectId,
      profileId: record.profileId,
      category: record.category,
      signature: record.summary.signature,
      summaryJson: JSON.stringify(record.summary),
      updatedAt: record.updatedAt
    };

    await this.db
      .insert(recurringIssueSummaries)
      .values(row)
      .onConflictDoUpdate({ target: recurringIssueSummaries.id, set: row });
  }

  async listRecurringIssueSummaries(
    projectId: string,
    profileId: string,
    category: string
  ): Promise<RecurringIssueSummaryRecord[]> {
    const rows = await this.db
      .select()
      .from(recurringIssueSummaries)
      .where(
        and(
          eq(recurringIssueSummaries.projectId, projectId),
          eq(recurringIssueSummaries.profileId, profileId),
          eq(recurringIssueSummaries.category, category)
        )
      )
      .orderBy(asc(recurringIssueSummaries.updatedAt), asc(recurringIssueSummaries.id))
      .all();

    return rows.map((row) => ({
      projectId: row.projectId,
      profileId: row.profileId,
      category: row.category,
      summary: JSON.parse(row.summaryJson) as RecurringIssueSummary,
      updatedAt: row.updatedAt
    }));
  }
}

function toSummaryId(record: RecurringIssueSummaryRecord): string {
  return `${record.projectId}:${record.profileId}:${record.category}:${record.summary.signature}`;
}
