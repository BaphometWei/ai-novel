import { createDatabase } from './connection';
import { migrateDatabase } from './migrate';

const database = createDatabase(':memory:');
await migrateDatabase(database.client);
const foreignKeys = await database.client.execute('PRAGMA foreign_keys');

if (Number(foreignKeys.rows[0].foreign_keys) !== 1) {
  throw new Error('SQLite foreign keys are not enabled');
}

database.client.close();
console.log('SQLite check passed');
