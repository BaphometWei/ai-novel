import { createProject } from '@ai-novel/domain';
import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { ProjectRepository } from '../repositories/project.repository';

describe('ProjectRepository', () => {
  it('saves and loads a project by id', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ProjectRepository(database.db);
    const project = createProject({
      title: 'Long Night',
      language: 'zh-CN',
      targetAudience: 'Chinese web-novel readers'
    });

    await repository.save(project);

    await expect(repository.findById(project.id)).resolves.toMatchObject({
      id: project.id,
      title: 'Long Night',
      status: 'Active'
    });
    database.client.close();
  });
});
