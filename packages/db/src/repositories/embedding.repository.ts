import { asc, eq } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { embeddings } from '../schema';

export interface StoredEmbedding {
  id: string;
  sourceId: string;
  sourceType?: string;
  model: string;
  modelVersion: string;
  vectorHash: string;
  vector: number[];
  dimensions: number;
  createdAt: string;
  updatedAt: string;
}

export class EmbeddingRepository {
  constructor(private readonly db: AppDatabase) {}

  async upsert(embedding: StoredEmbedding): Promise<void> {
    assertValidEmbedding(embedding);
    const row = embeddingToRow(embedding);

    await this.db
      .insert(embeddings)
      .values(row)
      .onConflictDoUpdate({
        target: embeddings.id,
        set: row
      });
  }

  async findById(id: string): Promise<StoredEmbedding | null> {
    const row = await this.db.select().from(embeddings).where(eq(embeddings.id, id)).get();
    if (!row) return null;

    return embeddingFromRow(row);
  }

  async list(): Promise<StoredEmbedding[]> {
    const rows = await this.db
      .select()
      .from(embeddings)
      .orderBy(asc(embeddings.createdAt), asc(embeddings.id))
      .all();

    return rows.map(embeddingFromRow);
  }
}

function embeddingToRow(embedding: StoredEmbedding): typeof embeddings.$inferInsert {
  return {
    id: embedding.id,
    sourceId: embedding.sourceId,
    sourceType: embedding.sourceType ?? null,
    model: embedding.model,
    modelVersion: embedding.modelVersion,
    vectorHash: embedding.vectorHash,
    vectorJson: JSON.stringify(embedding.vector),
    dimensions: embedding.dimensions,
    createdAt: embedding.createdAt,
    updatedAt: embedding.updatedAt
  };
}

function embeddingFromRow(row: typeof embeddings.$inferSelect): StoredEmbedding {
  const vector = JSON.parse(row.vectorJson) as unknown;
  if (!isNumberArray(vector)) {
    throw new Error(`Embedding ${row.id} has invalid vector JSON`);
  }

  return {
    id: row.id,
    sourceId: row.sourceId,
    sourceType: row.sourceType ?? undefined,
    model: row.model,
    modelVersion: row.modelVersion,
    vectorHash: row.vectorHash,
    vector,
    dimensions: row.dimensions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function assertValidEmbedding(embedding: StoredEmbedding): void {
  if (!Number.isInteger(embedding.dimensions) || embedding.dimensions <= 0) {
    throw new Error('Embedding dimensions must be a positive integer');
  }

  if (embedding.vector.length !== embedding.dimensions) {
    throw new Error('Embedding dimensions must match vector length');
  }

  if (!isNumberArray(embedding.vector)) {
    throw new Error('Embedding vector must contain only finite numbers');
  }
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}
