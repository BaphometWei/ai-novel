import type { ReaderFeedback, SerializationPlan } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { readerFeedbackRows, serializationPlans } from '../schema';

export class SerializationRepository {
  constructor(private readonly db: AppDatabase) {}

  async savePlan(plan: SerializationPlan): Promise<void> {
    await this.db.insert(serializationPlans).values({
      id: plan.id,
      projectId: plan.projectId,
      platformProfileJson: JSON.stringify(plan.platformProfile),
      updateScheduleJson: JSON.stringify(plan.updateSchedule),
      experimentsJson: JSON.stringify(plan.experiments)
    });
  }

  async findPlanById(id: string): Promise<SerializationPlan | null> {
    const row = await this.db.select().from(serializationPlans).where(eq(serializationPlans.id, id)).get();
    if (!row) return null;

    return {
      id: row.id,
      projectId: row.projectId,
      platformProfile: JSON.parse(row.platformProfileJson) as SerializationPlan['platformProfile'],
      updateSchedule: JSON.parse(row.updateScheduleJson) as SerializationPlan['updateSchedule'],
      experiments: JSON.parse(row.experimentsJson) as SerializationPlan['experiments']
    };
  }

  async saveReaderFeedback(projectId: string, feedback: ReaderFeedback): Promise<void> {
    await this.db.insert(readerFeedbackRows).values({
      id: feedback.id,
      projectId,
      chapterId: feedback.chapterId,
      segment: feedback.segment,
      sentiment: feedback.sentiment,
      tagsJson: JSON.stringify(feedback.tags),
      body: feedback.text
    });
  }

  async listReaderFeedback(projectId: string): Promise<ReaderFeedback[]> {
    const rows = await this.db
      .select()
      .from(readerFeedbackRows)
      .where(eq(readerFeedbackRows.projectId, projectId))
      .all();

    return rows.map((row) => ({
      id: row.id,
      chapterId: row.chapterId,
      segment: row.segment as ReaderFeedback['segment'],
      sentiment: row.sentiment as ReaderFeedback['sentiment'],
      tags: JSON.parse(row.tagsJson) as string[],
      text: row.body
    }));
  }
}
