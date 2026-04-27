import { asc, sql } from 'drizzle-orm';
import type { AppDatabase } from '../connection';
import { migrationHistory } from '../schema';

export type MigrationHistoryStatus = 'Applied' | 'Failed' | 'RolledBack';

export interface MigrationHistoryRecord {
  id: string;
  name: string;
  status: MigrationHistoryStatus;
  checksum: string;
  appliedAt: string;
  durationMs: number;
  error?: string;
}

export class MigrationHistoryRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(record: MigrationHistoryRecord): Promise<void> {
    await this.db
      .insert(migrationHistory)
      .values({
        id: record.id,
        name: record.name,
        status: record.status,
        checksum: record.checksum,
        appliedAt: record.appliedAt,
        durationMs: record.durationMs,
        error: record.error
      })
      .onConflictDoUpdate({
        target: migrationHistory.id,
        set: {
          name: record.name,
          status: record.status,
          checksum: record.checksum,
          appliedAt: record.appliedAt,
          durationMs: record.durationMs,
          error: record.error
        }
      });
  }

  async list(): Promise<MigrationHistoryRecord[]> {
    const rows = await this.db.select().from(migrationHistory).orderBy(asc(migrationHistory.appliedAt), sql`rowid`);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status as MigrationHistoryStatus,
      checksum: row.checksum,
      appliedAt: row.appliedAt,
      durationMs: row.durationMs,
      ...(row.error ? { error: row.error } : {})
    }));
  }
}
