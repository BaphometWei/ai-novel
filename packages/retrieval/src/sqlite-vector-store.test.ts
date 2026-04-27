import { createDatabase, EmbeddingRepository, migrateDatabase } from '@ai-novel/db';
import { describe, expect, it } from 'vitest';
import { createSqliteVectorStore } from './sqlite-vector-store';

const NOW = '2026-04-27T09:00:00.000Z';

describe('createSqliteVectorStore', () => {
  it('ranks persisted embedding references by cosine similarity without returning vectors', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const repository = new EmbeddingRepository(database.db);
      const store = createSqliteVectorStore(repository);

      await repository.upsert({
        id: 'embedding_close',
        sourceId: 'canon_fact_1',
        sourceType: 'canon_fact',
        model: 'fake-embedding',
        modelVersion: 'v1',
        vectorHash: 'sha256:close',
        vector: [1, 0, 0],
        dimensions: 3,
        createdAt: NOW,
        updatedAt: NOW
      });
      await repository.upsert({
        id: 'embedding_far',
        sourceId: 'chapter_1',
        sourceType: 'manuscript',
        model: 'fake-embedding',
        modelVersion: 'v1',
        vectorHash: 'sha256:far',
        vector: [0, 1, 0],
        dimensions: 3,
        createdAt: NOW,
        updatedAt: NOW
      });

      const results = await store.search([0.9, 0.1, 0], 2);

      expect(results).toEqual([
        expect.objectContaining({
          id: 'embedding_close',
          sourceId: 'canon_fact_1',
          sourceType: 'canon_fact',
          score: expect.closeTo(0.9938837346736189, 12)
        }),
        expect.objectContaining({
          id: 'embedding_far',
          sourceId: 'chapter_1',
          sourceType: 'manuscript',
          score: expect.closeTo(0.11043152607484655, 12)
        })
      ]);
      expect(results[0]).not.toHaveProperty('vector');
    } finally {
      database.client.close();
    }
  });

  it('rejects zero query vectors before scoring persisted rows', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const store = createSqliteVectorStore(new EmbeddingRepository(database.db));

      await expect(store.search([0, 0, 0], 5)).rejects.toThrow('zero query vector');
    } finally {
      database.client.close();
    }
  });

  it('rejects query vectors whose dimensions do not match persisted embeddings', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const repository = new EmbeddingRepository(database.db);
      const store = createSqliteVectorStore(repository);
      await repository.upsert({
        id: 'embedding_three_dimensional',
        sourceId: 'knowledge_1',
        model: 'fake-embedding',
        modelVersion: 'v1',
        vectorHash: 'sha256:three-dimensional',
        vector: [1, 0, 0],
        dimensions: 3,
        createdAt: NOW,
        updatedAt: NOW
      });

      await expect(store.search([1, 0], 5)).rejects.toThrow('dimension mismatch');
    } finally {
      database.client.close();
    }
  });

  it('returns an empty result set for an empty store', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const store = createSqliteVectorStore(new EmbeddingRepository(database.db));

      await expect(store.search([1, 0, 0], 5)).resolves.toEqual([]);
    } finally {
      database.client.close();
    }
  });
});
