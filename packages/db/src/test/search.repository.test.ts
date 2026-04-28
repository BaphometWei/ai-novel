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

  it('treats punctuation-heavy agent goals as plain search terms', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new SearchRepository(database.client);

    await repository.indexDocument({
      id: 'manuscript_provider_backed',
      projectId: 'project_abc',
      sourceType: 'manuscript',
      title: 'Provider backed chapter',
      body: 'Plan the provider backed chapter without raw caller context.'
    });

    await expect(repository.search({ projectId: 'project_abc', query: 'Plan the provider-backed chapter' })).resolves.toEqual([
      expect.objectContaining({
        id: 'manuscript_provider_backed',
        sourceType: 'manuscript'
      })
    ]);
    database.client.close();
  });
});
