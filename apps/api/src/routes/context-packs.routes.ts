import type { ArtifactStore } from '@ai-novel/artifacts';
import { createArtifactRecord, createContextPack, type ArtifactRecord, type ContextPack } from '@ai-novel/domain';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export interface ContextPackRouteStore {
  save(contextPack: ContextPack): Promise<void>;
  findById(id: string): Promise<ContextPack | null>;
  list(filters: { limit?: number }): Promise<ContextPack[]>;
}

export interface ContextPackArtifactStore {
  save(artifact: ArtifactRecord): Promise<void>;
  findByHash(hash: string): Promise<ArtifactRecord | null>;
}

export interface ContextPackRouteStores {
  contextPacks: ContextPackRouteStore;
  artifacts?: ContextPackArtifactStore;
  artifactContent?: ArtifactStore;
}

const riskSchema = z.enum(['Low', 'Medium', 'High', 'Blocking']);
const contextPackInputSchema = z.object({
  taskGoal: z.string().min(1),
  agentRole: z.string().min(1),
  riskLevel: riskSchema,
  sections: z.array(z.object({ name: z.string().min(1), content: z.string() })),
  citations: z.array(z.object({ sourceId: z.string().min(1), quote: z.string().min(1) })),
  exclusions: z.array(z.string()),
  warnings: z.array(z.string()),
  retrievalTrace: z.array(z.string())
});

const contextPackParamsSchema = z.object({
  id: z.custom<ContextPack['id']>((value) => typeof value === 'string' && value.startsWith('context_pack_'))
});

const contextPackQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid context pack payload' });
}

export function registerContextPackRoutes(app: FastifyInstance, stores: ContextPackRouteStores) {
  app.post('/context-packs', async (request, reply) => {
    const parsed = contextPackInputSchema.safeParse(request.body);
    if (!parsed.success) return invalidPayload(reply);

    const baseContextPack = createContextPack(parsed.data);
    const contextPack = await attachContextPackArtifact(baseContextPack, stores);
    await stores.contextPacks.save(contextPack);
    return reply.code(201).send(contextPack);
  });

  app.get('/context-packs/:id', async (request, reply) => {
    const params = contextPackParamsSchema.safeParse(request.params);
    if (!params.success) return invalidPayload(reply);

    const contextPack = await stores.contextPacks.findById(params.data.id);
    if (!contextPack) return reply.code(404).send({ error: 'Context pack not found' });
    return reply.send(contextPack);
  });

  app.get('/context-packs', async (request, reply) => {
    const query = contextPackQuerySchema.safeParse(request.query);
    if (!query.success) return invalidPayload(reply);

    return reply.send(await stores.contextPacks.list(query.data));
  });
}

async function attachContextPackArtifact(
  contextPack: ContextPack,
  stores: ContextPackRouteStores
): Promise<ContextPack> {
  if (!stores.artifacts || !stores.artifactContent) return contextPack;

  const content = JSON.stringify(contextPack);
  const stored = await stores.artifactContent.writeText(`${contextPack.id}.json`, content);
  const existing = await stores.artifacts.findByHash(stored.hash);
  const artifact =
    existing ??
    createArtifactRecord({
      type: 'context_pack',
      source: 'system',
      version: 1,
      hash: stored.hash,
      uri: stored.uri
    });

  if (!existing) {
    await stores.artifacts.save(artifact);
  }

  return { ...contextPack, artifactId: artifact.id };
}
