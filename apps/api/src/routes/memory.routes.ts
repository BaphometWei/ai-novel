import { extractMemoryFromAcceptedText, type MemoryExtractionDependencies } from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';

export type MemoryRouteDependencies = MemoryExtractionDependencies;

const memoryExtractionParamsSchema = z.object({
  projectId: z.custom<`project_${string}`>(
    (value) => typeof value === 'string' && value.startsWith('project_'),
    'projectId must start with project_'
  )
});

const acceptedSourceSchema = z.object({
  kind: z.literal('AcceptedManuscriptText'),
  manuscriptVersionId: z.string().min(1),
  text: z.string().min(1)
});

const memoryExtractionSchema = z.object({
  source: z.discriminatedUnion('kind', [
    acceptedSourceSchema,
    z.object({
      kind: z.literal('DraftArtifactText'),
      artifactId: z.string().min(1),
      text: z.string().min(1)
    }),
    z.object({
      kind: z.literal('AgentGeneratedText'),
      agentRunId: z.string().min(1),
      text: z.string().min(1)
    })
  ])
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid memory extraction payload' });
}

function unsupportedSource(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Memory extraction requires accepted manuscript text' });
}

export function registerMemoryRoutes(app: FastifyInstance, dependencies: MemoryRouteDependencies) {
  app.post('/projects/:projectId/memory/extractions', async (request, reply) => {
    const params = memoryExtractionParamsSchema.safeParse(request.params);
    const body = memoryExtractionSchema.safeParse(request.body);
    if (!params.success || !body.success) return invalidPayload(reply);
    if (body.data.source.kind !== 'AcceptedManuscriptText') return unsupportedSource(reply);

    const result = await extractMemoryFromAcceptedText(
      {
        projectId: params.data.projectId,
        source: body.data.source
      },
      dependencies
    );

    return reply.code(201).send(result);
  });
}
