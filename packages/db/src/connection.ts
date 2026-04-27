import { createClient } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type AppDatabase = LibSQLDatabase<typeof schema>;

function toDatabaseUrl(filename: string): string {
  return filename === ':memory:' ? ':memory:' : `file:${filename}`;
}

export function createDatabase(filename: string) {
  const client = createClient({ url: toDatabaseUrl(filename) });
  const db: AppDatabase = drizzle(client, { schema });

  return {
    client,
    db,
    requestedJournalMode: 'WAL' as const
  };
}
