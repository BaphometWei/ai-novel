import { createProject, createVersionHistory } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectRepository } from '../repositories/project.repository';
import { VersionHistoryRepository } from '../repositories/version-history.repository';

describe('VersionHistoryRepository', () => {
  it('saves, lists, and loads a version history snapshot for a project', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });
    await new ProjectRepository(database.db).save(project);
    const repository = new VersionHistoryRepository(database.db);
    const snapshot = createVersionHistory({
      createdAt: '2026-04-27T08:00:00.000Z',
      entities: [
        { id: 'chapter_1', type: 'manuscript', version: 3, label: 'Chapter 1 v3' },
        { id: 'canon_1', type: 'canon', version: 1, label: 'Canon Fact v1' }
      ],
      links: [{ from: 'canon_1', to: 'chapter_1', relation: 'grounds' }]
    });

    const snapshotId = await repository.save(project.id, snapshot);

    await expect(repository.list(project.id)).resolves.toEqual([
      expect.objectContaining({ id: snapshotId, projectId: project.id, history: snapshot })
    ]);
    await expect(repository.get(project.id, snapshotId)).resolves.toEqual(
      expect.objectContaining({ id: snapshotId, projectId: project.id, history: snapshot })
    );
    await expect(repository.list('project_other')).resolves.toEqual([]);
    await expect(repository.get(project.id, 'missing')).resolves.toBeNull();

    database.client.close();
  });
});
