import type { StoredEmbedding } from '@ai-novel/db';
import type { VectorSearchResult, VectorStoreAdapter } from './vector-store';

export interface EmbeddingVectorReader {
  list(): Promise<StoredEmbedding[]>;
}

export function createSqliteVectorStore(repository: EmbeddingVectorReader): VectorStoreAdapter {
  return new SqliteVectorStore(repository);
}

class SqliteVectorStore implements VectorStoreAdapter {
  constructor(private readonly repository: EmbeddingVectorReader) {}

  async search(vector: number[], limit: number): Promise<VectorSearchResult[]> {
    const normalizedLimit = Math.max(0, Math.floor(limit));
    if (normalizedLimit === 0) return [];

    const queryMagnitude = assertSearchableQueryVector(vector);
    const embeddings = await this.repository.list();

    return embeddings
      .map((embedding) => scoreEmbedding(embedding, vector, queryMagnitude))
      .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
      .slice(0, normalizedLimit);
  }
}

function scoreEmbedding(
  embedding: StoredEmbedding,
  queryVector: number[],
  queryMagnitude: number
): VectorSearchResult {
  if (embedding.dimensions !== queryVector.length || embedding.vector.length !== queryVector.length) {
    throw new Error(
      `Vector dimension mismatch for embedding ${embedding.id}: query has ${queryVector.length}, stored embedding has ${embedding.dimensions}`
    );
  }

  const storedMagnitude = magnitude(embedding.vector);
  const result: VectorSearchResult = {
    id: embedding.id,
    sourceId: embedding.sourceId,
    score: storedMagnitude === 0 ? 0 : dotProduct(queryVector, embedding.vector) / (queryMagnitude * storedMagnitude)
  };

  if (embedding.sourceType !== undefined) {
    result.sourceType = embedding.sourceType;
  }

  return result;
}

function assertSearchableQueryVector(vector: number[]): number {
  if (vector.length === 0) {
    throw new Error('Cannot search with an empty query vector');
  }

  if (!vector.every((value) => Number.isFinite(value))) {
    throw new Error('Cannot search with a query vector containing non-finite numbers');
  }

  const queryMagnitude = magnitude(vector);
  if (queryMagnitude === 0) {
    throw new Error('Cannot search with a zero query vector');
  }

  return queryMagnitude;
}

function dotProduct(left: number[], right: number[]): number {
  return left.reduce((total, value, index) => total + value * right[index], 0);
}

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((total, value) => total + value * value, 0));
}
