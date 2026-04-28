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
      status: 'Active',
      externalModelPolicy: 'Allowed'
    });
    database.client.close();
  });

  it('persists external model policy updates', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new ProjectRepository(database.db);
    const project = createProject({
      title: 'Offline Draft',
      language: 'en-US',
      targetAudience: 'local-only authors'
    });
    await repository.save(project);

    await repository.updateExternalModelPolicy(project.id, 'Disabled');

    await expect(repository.findById(project.id)).resolves.toMatchObject({
      id: project.id,
      externalModelPolicy: 'Disabled'
    });
    database.client.close();
  });
});
