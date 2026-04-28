import type { EntityId, EntityPrefix } from '@ai-novel/domain';
import { runWritingWorkflow, type WritingWorkflowDependencies, type WritingWorkflowInput } from '@ai-novel/workflow';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { PersistentWritingRunService } from '../services/writing-run.service';

export type WritingRunRouteDependencies = WritingWorkflowDependencies | PersistentWritingRunService;

const entityIdSchema = <Prefix extends EntityPrefix>(prefix: Prefix) =>
  z.custom<EntityId<Prefix>>((value) => typeof value === 'string' && value.startsWith(`${prefix}_`), {
    message: `id must start with ${prefix}_`
  });

const writingRunParamsSchema = z.object({
  projectId: entityIdSchema('project')
});

const writingRunInputSchema = z.object({
  target: z.object({
    manuscriptId: entityIdSchema('manuscript'),
    chapterId: entityIdSchema('chapter'),
    range: z.string().min(1)
  }),
  contract: z.object({
    authorshipLevel: z.enum(['A1', 'A2', 'A3', 'A4']),
    goal: z.string().min(1),
    mustWrite: z.string().min(1),
    wordRange: z.object({
      min: z.number().int().positive(),
      max: z.number().int().positive()
    }),
    forbiddenChanges: z.array(z.string().min(1)),
    acceptanceCriteria: z.array(z.string().min(1))
  }),
  retrieval: z.object({
    query: z.string().min(1),
    maxContextItems: z.number().int().positive().optional(),
    maxSectionChars: z.number().int().positive().optional()
  })
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid writing run payload' });
}

export function registerWritingRunRoutes(app: FastifyInstance, dependencies: WritingRunRouteDependencies) {
  app.post('/projects/:projectId/writing-runs', async (request, reply) => {
    const params = writingRunParamsSchema.safeParse(request.params);
    const parsed = writingRunInputSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    if (parsed.data.contract.wordRange.max < parsed.data.contract.wordRange.min) {
      return invalidPayload(reply);
    }

    const input: WritingWorkflowInput = {
      projectId: params.data.projectId,
      target: parsed.data.target,
      contract: parsed.data.contract,
      retrieval: parsed.data.retrieval
    };

    let result;
    try {
      result = isPersistentWritingRunService(dependencies)
        ? await dependencies.start(input)
        : await runWritingWorkflow(input, dependencies);
    } catch (error) {
      if (error instanceof Error && error.message === 'External model use is disabled for this project') {
        return reply.code(403).send({ error: error.message });
      }
      throw error;
    }

    return reply.code(201).send(result);
  });
}

function isPersistentWritingRunService(
  dependencies: WritingRunRouteDependencies
): dependencies is PersistentWritingRunService {
  return 'start' in dependencies;
}
