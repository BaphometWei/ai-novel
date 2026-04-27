import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { PromptVersionRepository, type PromptVersion } from '../repositories/prompt-version.repository';

describe('PromptVersionRepository', () => {
  it('saves and loads a prompt version by id', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new PromptVersionRepository(database.db);
    const promptVersion: PromptVersion = {
      id: 'writer.continue.v2.1',
      taskType: 'draft_continuation',
      template: 'Continue from canon: {{canon}}',
      model: 'gpt-test',
      provider: 'openai',
      version: 2,
      status: 'Active',
      createdAt: '2026-04-27T06:00:00.000Z'
    };

    await repository.save(promptVersion);

    await expect(repository.findById(promptVersion.id)).resolves.toEqual(promptVersion);
    database.client.close();
  });

  it('returns null when a prompt version is missing', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new PromptVersionRepository(database.db);

    await expect(repository.findById('missing.prompt')).resolves.toBeNull();
    database.client.close();
  });
});
