import { MigrationHistoryRepository } from '@ai-novel/db';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app';
import { createPersistentApiRuntime } from '../runtime';

describe('migration history API routes', () => {
  it('returns migration history from an injected store', async () => {
    const app = buildApp({
      migrationHistory: {
        list: async () => [
          {
            id: 'migration_001',
            name: 'create_observability_summary',
            status: 'Applied',
            checksum: 'sha256:aaa',
            appliedAt: '2026-04-27T08:00:00.000Z',
            durationMs: 12
          }
        ]
      }
    });

    const response = await app.inject({ method: 'GET', url: '/migrations/history' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        id: 'migration_001',
        name: 'create_observability_summary',
        status: 'Applied',
        checksum: 'sha256:aaa',
        appliedAt: '2026-04-27T08:00:00.000Z',
        durationMs: 12
      }
    ]);
  });

  it('wires persistent runtime migration history route to the repository', async () => {
    const runtime = await createPersistentApiRuntime(':memory:');
    const repository = new MigrationHistoryRepository(runtime.database.db);
    await repository.record({
      id: 'migration_runtime_1',
      name: 'runtime_smoke',
      status: 'Applied',
      checksum: 'sha256:runtime',
      appliedAt: '2026-04-27T08:02:00.000Z',
      durationMs: 4
    });

    const response = await runtime.app.inject({ method: 'GET', url: '/migrations/history' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      expect.objectContaining({ id: 'migration_runtime_1', name: 'runtime_smoke', status: 'Applied' })
    ]);
    await runtime.app.close();
    runtime.database.client.close();
  });
});
