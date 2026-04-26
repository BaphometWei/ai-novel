import type { DependencyIndexEntry, NarrativeObjectRef } from '@ai-novel/domain';
import { and, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { dependencyIndexEntries } from '../schema';

export class DependencyRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(entry: DependencyIndexEntry): Promise<void> {
    await this.db.insert(dependencyIndexEntries).values({
      id: entry.id,
      projectId: entry.projectId,
      sourceObjectJson: JSON.stringify(entry.sourceObject),
      targetObjectJson: JSON.stringify(entry.targetObject),
      targetType: entry.targetObject.type,
      targetId: entry.targetObject.id,
      dependencyType: entry.dependencyType,
      confidence: Math.round(entry.confidence * 1000),
      sourceRunId: entry.sourceRunId,
      invalidationRule: entry.invalidationRule
    });
  }

  async findByTarget(target: NarrativeObjectRef): Promise<DependencyIndexEntry[]> {
    const rows = await this.db
      .select()
      .from(dependencyIndexEntries)
      .where(and(eq(dependencyIndexEntries.targetType, target.type), eq(dependencyIndexEntries.targetId, target.id)));

    return rows.map((row) => ({
      id: row.id as DependencyIndexEntry['id'],
      projectId: row.projectId as DependencyIndexEntry['projectId'],
      sourceObject: JSON.parse(row.sourceObjectJson) as DependencyIndexEntry['sourceObject'],
      targetObject: JSON.parse(row.targetObjectJson) as DependencyIndexEntry['targetObject'],
      dependencyType: row.dependencyType,
      confidence: row.confidence / 1000,
      sourceRunId: row.sourceRunId as DependencyIndexEntry['sourceRunId'],
      invalidationRule: row.invalidationRule as DependencyIndexEntry['invalidationRule']
    }));
  }
}
