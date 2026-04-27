import { createVersionHistory, type VersionHistory, type VersionedEntityType } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface VersionHistorySnapshotRouteRecord {
  id: string;
  projectId: string;
  history: VersionHistory;
  createdAt: string;
}

export interface VersionHistoryRouteStore {
  save(projectId: string, history: VersionHistory): Promise<string>;
  list(projectId: string): Promise<VersionHistorySnapshotRouteRecord[]>;
  get(projectId: string, id: string): Promise<VersionHistorySnapshotRouteRecord | null>;
}

const entityTypeSchema: z.ZodType<VersionedEntityType> = z.enum([
  'manuscript',
  'canon',
  'prompt',
  'run',
  'context_pack',
  'artifact'
]);

const snapshotInputSchema = z.object({
  createdAt: z.string().datetime(),
  entities: z.array(
    z.object({
      id: z.string().min(1),
      type: entityTypeSchema,
      version: z.number().int().nonnegative(),
      label: z.string().min(1)
    })
  ),
  links: z.array(
    z.object({
      from: z.string().min(1),
      to: z.string().min(1),
      relation: z.string().min(1)
    })
  )
});

const projectParamsSchema = z.object({ projectId: z.string().min(1) });
const snapshotParamsSchema = projectParamsSchema.extend({ snapshotId: z.string().min(1) });

export function registerVersionHistoryRoutes(app: FastifyInstance, store: VersionHistoryRouteStore) {
  app.get('/version-history/:projectId', async (request, reply) => {
    const parsed = projectParamsSchema.safeParse(request.params);
    if (!parsed.success) return invalidPayload(reply);

    return reply.send(await store.list(parsed.data.projectId));
  });

  app.get('/version-history/:projectId/snapshots/:snapshotId', async (request, reply) => {
    const parsed = snapshotParamsSchema.safeParse(request.params);
    if (!parsed.success) return invalidPayload(reply);

    const snapshot = await store.get(parsed.data.projectId, parsed.data.snapshotId);
    if (!snapshot) return reply.code(404).send({ error: 'Version history snapshot not found' });
    return reply.send(snapshot);
  });

  app.post('/version-history/:projectId/snapshots', async (request, reply) => {
    const params = projectParamsSchema.safeParse(request.params);
    const payload = snapshotInputSchema.safeParse(request.body);
    if (!params.success || !payload.success) return invalidPayload(reply);

    const history = createVersionHistory(payload.data);
    const id = await store.save(params.data.projectId, history);
    const saved = await store.get(params.data.projectId, id);
    return reply.code(201).send(saved ?? { id, projectId: params.data.projectId, history, createdAt: history.trace.createdAt });
  });
}

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid version history payload' });
}

