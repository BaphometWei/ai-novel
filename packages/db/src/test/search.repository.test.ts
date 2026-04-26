import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { SearchRepository } from '../repositories/search.repository';

describe('SearchRepository', () => {
  it('indexes and searches source-backed story documents with SQLite FTS', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new SearchRepository(database.client);

    await repository.indexDocument({
      id: 'canon_fact_abc',
      projectId: 'project_abc',
      sourceType: 'canon_fact',
      title: 'Protagonist fear',
      body: 'The protagonist fears deep water after the river incident.'
    });

    await expect(repository.search({ projectId: 'project_abc', query: 'deep water' })).resolves.toEqual([
      expect.objectContaining({
        id: 'canon_fact_abc',
        sourceType: 'canon_fact',
        title: 'Protagonist fear'
      })
    ]);
    database.client.close();
  });
});
