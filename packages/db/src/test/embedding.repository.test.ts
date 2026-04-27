import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { EmbeddingRepository } from '../repositories/embedding.repository';

const CREATED_AT = '2026-04-27T09:00:00.000Z';
const UPDATED_AT = '2026-04-27T09:05:00.000Z';

describe('EmbeddingRepository', () => {
  it('upserts, gets, and lists local embedding rows without source records', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const repository = new EmbeddingRepository(database.db);

      await repository.upsert({
        id: 'embedding_1',
        sourceId: 'canon_fact_1',
        sourceType: 'canon_fact',
        model: 'fake-embedding',
        modelVersion: 'v1',
        vectorHash: 'sha256:old',
        vector: [1, 0, 0],
        dimensions: 3,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT
      });
      await repository.upsert({
        id: 'embedding_2',
        sourceId: 'chapter_1',
        model: 'fake-embedding',
        modelVersion: 'v1',
        vectorHash: 'sha256:chapter',
        vector: [0, 1, 0],
        dimensions: 3,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT
      });
      await repository.upsert({
        id: 'embedding_1',
        sourceId: 'canon_fact_1',
        sourceType: 'canon_fact',
        model: 'fake-embedding',
        modelVersion: 'v2',
        vectorHash: 'sha256:new',
        vector: [0.5, 0.5, 0],
        dimensions: 3,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT
      });

      await expect(repository.findById('embedding_1')).resolves.toEqual({
        id: 'embedding_1',
        sourceId: 'canon_fact_1',
        sourceType: 'canon_fact',
        model: 'fake-embedding',
        modelVersion: 'v2',
        vectorHash: 'sha256:new',
        vector: [0.5, 0.5, 0],
        dimensions: 3,
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT
      });
      await expect(repository.list()).resolves.toEqual([
        expect.objectContaining({ id: 'embedding_1', vectorHash: 'sha256:new' }),
        expect.objectContaining({ id: 'embedding_2', sourceType: undefined })
      ]);

      const tableInfo = await database.client.execute('PRAGMA table_info(embeddings)');
      expect(tableInfo.rows.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          'id',
          'source_id',
          'source_type',
          'model',
          'model_version',
          'vector_hash',
          'vector_json',
          'dimensions',
          'created_at',
          'updated_at'
        ])
      );
    } finally {
      database.client.close();
    }
  });

  it('rejects vectors whose declared dimensions do not match their JSON vector', async () => {
    const database = createDatabase(':memory:');

    try {
      await migrateDatabase(database.client);
      const repository = new EmbeddingRepository(database.db);

      await expect(
        repository.upsert({
          id: 'embedding_bad_dimensions',
          sourceId: 'canon_fact_1',
          model: 'fake-embedding',
          modelVersion: 'v1',
          vectorHash: 'sha256:bad-dimensions',
          vector: [1, 0, 0],
          dimensions: 2,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT
        })
      ).rejects.toThrow('dimensions');
    } finally {
      database.client.close();
    }
  });
});
