import type {
  VersionHistory,
  VersionedEntityRef,
  VersionRestorePoint,
  VersionTraceLink
} from '@ai-novel/domain';
import { asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { versionHistories } from '../schema';

export interface VersionHistorySnapshotRecord {
  id: string;
  projectId: string;
  history: VersionHistory;
  createdAt: string;
}

export class VersionHistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(projectId: string, history: VersionHistory): Promise<string> {
    const id = `vh_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    await this.db.insert(versionHistories).values({
      id,
      projectId,
      entitiesJson: JSON.stringify(history.entities),
      traceLinksJson: JSON.stringify(history.trace.links),
      restorePointsJson: JSON.stringify(history.restorePoints),
      createdAt: history.trace.createdAt
    });
    return id;
  }

  async list(projectId: string): Promise<VersionHistorySnapshotRecord[]> {
    const rows = await this.db
      .select()
      .from(versionHistories)
      .where(eq(versionHistories.projectId, projectId))
      .orderBy(asc(versionHistories.createdAt), sql`rowid`)
      .all();

    return rows.map(toVersionHistorySnapshotRecord);
  }

  async get(projectId: string, id: string): Promise<VersionHistorySnapshotRecord | null> {
    const row = await this.db
      .select()
      .from(versionHistories)
      .where(sql`${versionHistories.projectId} = ${projectId} AND ${versionHistories.id} = ${id}`)
      .get();
    if (!row) return null;
    return toVersionHistorySnapshotRecord(row);
  }
}

function toVersionHistorySnapshotRecord(
  row: typeof versionHistories.$inferSelect
): VersionHistorySnapshotRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    history: {
      entities: JSON.parse(row.entitiesJson) as VersionedEntityRef[],
      trace: {
        links: JSON.parse(row.traceLinksJson) as VersionTraceLink[],
        createdAt: row.createdAt
      },
      restorePoints: JSON.parse(row.restorePointsJson) as VersionRestorePoint[]
    },
    createdAt: row.createdAt
  };
}
