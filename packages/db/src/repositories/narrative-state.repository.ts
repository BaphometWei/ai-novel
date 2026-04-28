import { and, asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { narrativeStateRecords } from '../schema';

export type NarrativeStateType =
  | 'promise'
  | 'secret'
  | 'arc'
  | 'timeline_event'
  | 'world_rule'
  | 'dependency_finding'
  | 'closure'
  | 'source_metadata';

export interface NarrativeStateSnapshotMetadata {
  version: number;
  source: string;
  sourceId?: string;
  note?: string;
  createdAt: string;
}

export interface NarrativeStateRecord {
  id: string;
  projectId: string;
  type: NarrativeStateType;
  payload: unknown;
  snapshotVersion: number;
  snapshotMetadata: NarrativeStateSnapshotMetadata[];
  createdAt: string;
  updatedAt: string;
}

export class NarrativeStateRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(record: NarrativeStateRecord): Promise<void> {
    const row = toRow(record);

    await this.db
      .insert(narrativeStateRecords)
      .values(row)
      .onConflictDoUpdate({
        target: narrativeStateRecords.id,
        set: row
      });
  }

  async getById(id: string): Promise<NarrativeStateRecord | null> {
    const row = await this.db
      .select()
      .from(narrativeStateRecords)
      .where(eq(narrativeStateRecords.id, id))
      .get();

    return row ? fromRow(row) : null;
  }

  async listByProject(projectId: string): Promise<NarrativeStateRecord[]> {
    const rows = await this.db
      .select()
      .from(narrativeStateRecords)
      .where(eq(narrativeStateRecords.projectId, projectId))
      .orderBy(asc(narrativeStateRecords.createdAt), asc(narrativeStateRecords.id))
      .all();

    return rows.map(fromRow);
  }

  async listByProjectAndType(
    projectId: string,
    type: NarrativeStateType
  ): Promise<NarrativeStateRecord[]> {
    const rows = await this.db
      .select()
      .from(narrativeStateRecords)
      .where(and(eq(narrativeStateRecords.projectId, projectId), eq(narrativeStateRecords.type, type)))
      .orderBy(asc(narrativeStateRecords.createdAt), asc(narrativeStateRecords.id))
      .all();

    return rows.map(fromRow);
  }

  async appendSnapshotMetadata(
    id: string,
    metadata: NarrativeStateSnapshotMetadata
  ): Promise<NarrativeStateRecord | null> {
    const record = await this.getById(id);
    if (!record) return null;

    const updated: NarrativeStateRecord = {
      ...record,
      snapshotVersion: metadata.version,
      snapshotMetadata: [...record.snapshotMetadata, metadata],
      updatedAt: metadata.createdAt
    };

    await this.upsert(updated);
    return updated;
  }
}

function toRow(record: NarrativeStateRecord): typeof narrativeStateRecords.$inferInsert {
  return {
    id: record.id,
    projectId: record.projectId,
    type: record.type,
    payloadJson: JSON.stringify(record.payload),
    snapshotVersion: record.snapshotVersion,
    snapshotMetadataJson: JSON.stringify(record.snapshotMetadata),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function fromRow(row: typeof narrativeStateRecords.$inferSelect): NarrativeStateRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.type as NarrativeStateType,
    payload: JSON.parse(row.payloadJson) as unknown,
    snapshotVersion: row.snapshotVersion,
    snapshotMetadata: JSON.parse(row.snapshotMetadataJson) as NarrativeStateSnapshotMetadata[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}
