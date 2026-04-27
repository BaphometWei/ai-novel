import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { SettingsRepository } from '../repositories/settings.repository';

describe('SettingsRepository', () => {
  it('saves provider settings without returning or persisting raw api keys', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new SettingsRepository(database.db);

    await repository.saveProviderSettings({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      apiKey: 'sk-local-secret',
      redactedMetadata: {
        apiKeyPreview: 'sk-...cret',
        configuredBy: 'settings-panel'
      },
      updatedAt: '2026-04-27T06:00:00.000Z'
    });

    const settings = await repository.findProviderSettings('openai');
    expect(settings).toEqual({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: {
        apiKeyPreview: 'sk-...cret',
        configuredBy: 'settings-panel'
      },
      updatedAt: '2026-04-27T06:00:00.000Z'
    });
    expect(settings).not.toHaveProperty('apiKey');

    const rows = await database.client.execute('SELECT * FROM provider_settings');
    expect(JSON.stringify(rows.rows)).not.toContain('sk-local-secret');
    database.client.close();
  });

  it('redacts secret-like values from provider metadata before persisting', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new SettingsRepository(database.db);

    await repository.saveProviderSettings({
      provider: 'openai',
      defaultModel: 'gpt-test',
      secretRef: 'env:OPENAI_API_KEY',
      redactedMetadata: {
        apiKey: 'sk-local-secret',
        nested: {
          refreshToken: 'token-local-secret',
          publicLabel: 'developer-machine'
        }
      },
      updatedAt: '2026-04-27T06:00:00.000Z'
    });

    const settings = await repository.findProviderSettings('openai');
    expect(settings?.redactedMetadata).toEqual({
      apiKey: '[redacted]',
      nested: {
        refreshToken: '[redacted]',
        publicLabel: 'developer-machine'
      }
    });

    const rows = await database.client.execute('SELECT redacted_metadata_json FROM provider_settings');
    expect(JSON.stringify(rows.rows)).not.toContain('sk-local-secret');
    expect(JSON.stringify(rows.rows)).not.toContain('token-local-secret');
    database.client.close();
  });

  it('saves and loads provider budget policy', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new SettingsRepository(database.db);

    await repository.saveBudgetPolicy({
      provider: 'openai',
      maxRunCostUsd: 0.25,
      updatedAt: '2026-04-27T06:00:00.000Z'
    });

    await expect(repository.findBudgetPolicy('openai')).resolves.toEqual({
      provider: 'openai',
      maxRunCostUsd: 0.25,
      updatedAt: '2026-04-27T06:00:00.000Z'
    });
    database.client.close();
  });
});
