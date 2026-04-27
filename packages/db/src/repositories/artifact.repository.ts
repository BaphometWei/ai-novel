import type { ArtifactRecord } from '@ai-novel/domain';
import { eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { artifacts } from '../schema';

export class ArtifactRepository {
  constructor(private readonly db: AppDatabase) {}

  async save(artifact: ArtifactRecord): Promise<void> {
    await this.db.insert(artifacts).values(artifact);
  }

  async findByHash(hash: string): Promise<ArtifactRecord | null> {
    const row = await this.db.select().from(artifacts).where(eq(artifacts.hash, hash)).get();
    if (!row) return null;

    return {
      id: row.id as ArtifactRecord['id'],
      type: row.type as ArtifactRecord['type'],
      source: row.source as ArtifactRecord['source'],
      version: row.version,
      hash: row.hash,
      uri: row.uri,
      createdAt: row.createdAt
    };
  }
}
