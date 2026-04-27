import { createArtifactRecord, type ArtifactRecord } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ArtifactRouteStore {
  save(artifact: ArtifactRecord): Promise<void>;
  findById(id: string): Promise<ArtifactRecord | null>;
  findByHash(hash: string): Promise<ArtifactRecord | null>;
  list(filters: { type?: ArtifactRecord['type']; source?: ArtifactRecord['source']; limit?: number }): Promise<ArtifactRecord[]>;
}

const artifactTypeSchema = z.enum(['manuscript_version', 'context_pack', 'agent_output', 'review_report', 'import_raw']);
const artifactSourceSchema = z.enum(['user', 'agent_run', 'import', 'system']);

const createArtifactSchema = z.object({
  type: artifactTypeSchema,
  source: artifactSourceSchema,
  version: z.number().int().positive(),
  hash: z.string().min(1),
  uri: z.string().min(1),
  relatedRunId: z
    .custom<ArtifactRecord['relatedRunId']>((value) => typeof value === 'string' && value.startsWith('agent_run_'))
    .optional()
});

const artifactParamsSchema = z.object({
  id: z.custom<ArtifactRecord['id']>((value) => typeof value === 'string' && value.startsWith('artifact_'))
});

const artifactQuerySchema = z.object({
  hash: z.string().min(1).optional(),
  type: artifactTypeSchema.optional(),
  source: artifactSourceSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid artifact payload' });
}

export function registerArtifactRoutes(app: FastifyInstance, store: ArtifactRouteStore) {
  app.post('/artifacts', async (request, reply) => {
    const parsed = createArtifactSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const artifact = createArtifactRecord(parsed.data);
    try {
      await store.save(artifact);
    } catch (error) {
      if (error instanceof Error && /UNIQUE|constraint/i.test(error.message)) {
        return reply.code(409).send({ error: 'Artifact hash already exists' });
      }
      throw error;
    }
    return reply.code(201).send(artifact);
  });

  app.get('/artifacts/:id', async (request, reply) => {
    const params = artifactParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const artifact = await store.findById(params.data.id);
    if (!artifact) return reply.code(404).send({ error: 'Artifact not found' });
    return reply.send(artifact);
  });

  app.get('/artifacts', async (request, reply) => {
    const query = artifactQuerySchema.safeParse(request.query);
    if (!query.success) return invalidPayload(reply);

    if (query.data.hash) {
      const artifact = await store.findByHash(query.data.hash);
      if (!artifact) return reply.code(404).send({ error: 'Artifact not found' });
      return reply.send(artifact);
    }

    return reply.send(await store.list(query.data));
  });
}
