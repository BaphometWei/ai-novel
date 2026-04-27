import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';
import { MigrationHistoryRepository } from '../repositories/migration-history.repository';

describe('MigrationHistoryRepository', () => {
  it('records and lists migration history entries in applied order', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const repository = new MigrationHistoryRepository(database.db);

    await repository.record({
      id: 'migration_001',
      name: 'create_observability_summary',
      status: 'Applied',
      checksum: 'sha256:aaa',
      appliedAt: '2026-04-27T08:00:00.000Z',
      durationMs: 12
    });
    await repository.record({
      id: 'migration_002',
      name: 'backfill_quality_metrics',
      status: 'Failed',
      checksum: 'sha256:bbb',
      appliedAt: '2026-04-27T08:01:00.000Z',
      durationMs: 30,
      error: 'backfill timeout'
    });

    await expect(repository.list()).resolves.toEqual([
      {
        id: 'migration_001',
        name: 'create_observability_summary',
        status: 'Applied',
        checksum: 'sha256:aaa',
        appliedAt: '2026-04-27T08:00:00.000Z',
        durationMs: 12
      },
      {
        id: 'migration_002',
        name: 'backfill_quality_metrics',
        status: 'Failed',
        checksum: 'sha256:bbb',
        appliedAt: '2026-04-27T08:01:00.000Z',
        durationMs: 30,
        error: 'backfill timeout'
      }
    ]);

    database.client.close();
  });
});
