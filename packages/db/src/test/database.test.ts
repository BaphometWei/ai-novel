import { describe, expect, it } from 'vitest';
import { createDatabase } from '../connection';
import { migrateDatabase } from '../migrate';

describe('createDatabase', () => {
  it('opens SQLite with WAL requested and foreign keys enabled', async () => {
    const database = createDatabase(':memory:');
    await migrateDatabase(database.client);
    const journalMode = await database.client.execute('PRAGMA journal_mode');
    const foreignKeys = await database.client.execute('PRAGMA foreign_keys');

    expect(database.requestedJournalMode).toBe('WAL');
    expect(journalMode.rows[0]).toHaveProperty('journal_mode');
    expect(Number(foreignKeys.rows[0].foreign_keys)).toBe(1);
    database.client.close();
  });
});
