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

const preparedWritingRunParamsSchema = writingRunParamsSchema.extend({
  preparedRunId: z.string().min(1)
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

const executePreparedSchema = z.object({
  confirmed: z.boolean(),
  confirmedBy: z.string().min(1).optional()
});

const cancelPreparedSchema = z.object({
  cancelledBy: z.string().min(1).optional()
});

function invalidPayload(reply: FastifyReply) {
  return reply.code(400).send({ error: 'Invalid writing run payload' });
}

export function registerWritingRunRoutes(app: FastifyInstance, dependencies: WritingRunRouteDependencies) {
  app.post('/projects/:projectId/writing-runs/prepare', async (request, reply) => {
    const params = writingRunParamsSchema.safeParse(request.params);
    const parsed = writingRunInputSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (parsed.data.contract.wordRange.max < parsed.data.contract.wordRange.min) {
      return invalidPayload(reply);
    }
    if (!supportsPreparedWritingRuns(dependencies)) {
      return reply.code(503).send({ error: 'Writing run dependencies are not configured' });
    }

    try {
      return reply.code(201).send(await dependencies.prepare(toWorkflowInput(params.data.projectId, parsed.data)));
    } catch (error) {
      return sendWritingRunError(reply, error);
    }
  });

  app.post('/projects/:projectId/writing-runs/:preparedRunId/execute', async (request, reply) => {
    const params = preparedWritingRunParamsSchema.safeParse(request.params);
    const parsed = executePreparedSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!supportsPreparedWritingRuns(dependencies)) {
      return reply.code(503).send({ error: 'Writing run dependencies are not configured' });
    }

    try {
      return reply
        .code(201)
        .send(await dependencies.executePrepared(params.data.projectId, params.data.preparedRunId, parsed.data));
    } catch (error) {
      return sendWritingRunError(reply, error);
    }
  });

  app.post('/projects/:projectId/writing-runs/:preparedRunId/cancel', async (request, reply) => {
    const params = preparedWritingRunParamsSchema.safeParse(request.params);
    const parsed = cancelPreparedSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);
    if (!supportsPreparedWritingRuns(dependencies)) {
      return reply.code(503).send({ error: 'Writing run dependencies are not configured' });
    }

    try {
      return reply
        .code(200)
        .send(await dependencies.cancelPrepared(params.data.projectId, params.data.preparedRunId, parsed.data));
    } catch (error) {
      return sendWritingRunError(reply, error);
    }
  });

  app.post('/projects/:projectId/writing-runs', async (request, reply) => {
    const params = writingRunParamsSchema.safeParse(request.params);
    const parsed = writingRunInputSchema.safeParse(request.body);
    if (!params.success || !parsed.success) return invalidPayload(reply);

    if (parsed.data.contract.wordRange.max < parsed.data.contract.wordRange.min) {
      return invalidPayload(reply);
    }

    const input = toWorkflowInput(params.data.projectId, parsed.data);

    let result;
    try {
      result = isPersistentWritingRunService(dependencies)
        ? await dependencies.start(input)
        : await runWritingWorkflow(input, dependencies);
    } catch (error) {
      return sendWritingRunError(reply, error);
    }

    return reply.code(201).send(result);
  });
}

function isPersistentWritingRunService(
  dependencies: WritingRunRouteDependencies
): dependencies is PersistentWritingRunService {
  return 'start' in dependencies;
}

function supportsPreparedWritingRuns(
  dependencies: WritingRunRouteDependencies
): dependencies is PersistentWritingRunService {
  return 'start' in dependencies && 'prepare' in dependencies && 'executePrepared' in dependencies && 'cancelPrepared' in dependencies;
}

function toWorkflowInput(projectId: WritingWorkflowInput['projectId'], data: z.infer<typeof writingRunInputSchema>): WritingWorkflowInput {
  return {
    projectId,
    target: data.target,
    contract: data.contract,
    retrieval: data.retrieval
  };
}

function sendWritingRunError(reply: FastifyReply, error: unknown) {
  if (!(error instanceof Error)) throw error;
  if (error.message === 'External model use is disabled for this project') {
    return reply.code(403).send({ error: error.message });
  }
  if (error.message === 'Prepared writing run not found') {
    return reply.code(404).send({ error: error.message });
  }
  if (error.message === 'Writing run dependencies are not configured') {
    return reply.code(503).send({ error: error.message });
  }
  if (error.message === 'Pre-send inspection is required for external writing runs') {
    return reply.code(409).send({ error: error.message, requiresInspection: true });
  }
  if (
    error.message.startsWith('Prepared writing run') ||
    error.message.startsWith('LLM budget exceeded') ||
    error.message.startsWith('Missing provider secret')
  ) {
    return reply.code(409).send({ error: error.message });
  }
  throw error;
}
