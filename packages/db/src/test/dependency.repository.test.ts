import { createDependencyIndexEntry, createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { DependencyRepository } from '../repositories/dependency.repository';
import { ProjectRepository } from '../repositories/project.repository';

describe('DependencyRepository', () => {
  it('persists and finds dependencies by target object', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new DependencyRepository(database.db);
    const entry = createDependencyIndexEntry({
      projectId: project.id,
      sourceObject: { type: 'Chapter', id: 'chapter_abc' },
      targetObject: { type: 'CanonFact', id: 'canon_fact_abc' },
      dependencyType: 'uses_canon',
      confidence: 0.92,
      sourceRunId: 'agent_run_abc',
      invalidationRule: 'target_changed'
    });

    await repository.save(entry);

    await expect(repository.findByTarget({ type: 'CanonFact', id: 'canon_fact_abc' })).resolves.toEqual([
      expect.objectContaining({ id: entry.id, dependencyType: 'uses_canon' })
    ]);
    database.client.close();
  });

  it('rejects dependencies for missing projects', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new DependencyRepository(database.db);
    const entry = createDependencyIndexEntry({
      projectId: 'project_missing',
      sourceObject: { type: 'Chapter', id: 'chapter_abc' },
      targetObject: { type: 'CanonFact', id: 'canon_fact_abc' },
      dependencyType: 'uses_canon',
      confidence: 0.92,
      sourceRunId: 'agent_run_abc',
      invalidationRule: 'target_changed'
    });

    await expect(repository.save(entry)).rejects.toThrow();
    database.client.close();
  });
});
