import type { MigrationHistoryRecord } from '@ai-novel/db';
import type { FastifyInstance } from 'fastify';

export interface MigrationHistoryRouteStore {
  list(): Promise<MigrationHistoryRecord[]>;
}

export function registerMigrationHistoryRoutes(app: FastifyInstance, store: MigrationHistoryRouteStore) {
  app.get('/migrations/history', async (_request, reply) => {
    return reply.send(await store.list());
  });
}
