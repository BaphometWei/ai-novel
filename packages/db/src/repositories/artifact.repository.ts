import type { ArtifactRecord } from '@ai-novel/domain';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { artifacts } from '../schema';

function toArtifactRecord(row: typeof artifacts.$inferSelect): ArtifactRecord {
  return {
    id: row.id as ArtifactRecord['id'],
    type: row.type as ArtifactRecord['type'],
    source: row.source as ArtifactRecord['source'],
    version: row.version,
    hash: row.hash,
    uri: row.uri,
    ...(row.relatedRunId ? { relatedRunId: row.relatedRunId as ArtifactRecord['relatedRunId'] } : {}),
    createdAt: row.createdAt
  };
}

export class ArtifactRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(artifact: ArtifactRecord): Promise<void> {
    await this.db.insert(artifacts).values({
      id: artifact.id,
      type: artifact.type,
      source: artifact.source,
      version: artifact.version,
      hash: artifact.hash,
      uri: artifact.uri,
      relatedRunId: artifact.relatedRunId ?? null,
      createdAt: artifact.createdAt
    });
  }

  async findByHash(hash: string): Promise<ArtifactRecord | null> {
    const row = await this.db.select().from(artifacts).where(eq(artifacts.hash, hash)).get();
    if (!row) return null;

    return toArtifactRecord(row);
  }

  async findById(id: string): Promise<ArtifactRecord | null> {
    const row = await this.db.select().from(artifacts).where(eq(artifacts.id, id)).get();
    if (!row) return null;

    return toArtifactRecord(row);
  }

  async list(filters: {
    type?: ArtifactRecord['type'];
    source?: ArtifactRecord['source'];
    limit?: number;
  }): Promise<ArtifactRecord[]> {
    const rows = await this.db
      .select()
      .from(artifacts)
      .where(
        and(
          filters.type ? eq(artifacts.type, filters.type) : undefined,
          filters.source ? eq(artifacts.source, filters.source) : undefined
        )
      )
      .orderBy(asc(artifacts.createdAt), sql`rowid`)
      .limit(filters.limit ?? -1);

    return rows.map(toArtifactRecord);
  }
}
